use core::mem::size_of;
use core::ptr::{self, null_mut};
use std::alloc::{alloc, dealloc, Layout};
use std::ffi::{c_char, CStr};

#[repr(C)]
pub struct HashResult {
    pub hash: *mut u8,
    pub error: i32,
    pub error_message: *mut u8,
}

#[repr(C)]
struct AllocHeader {
    size: usize,
    align: usize,
}

const HEADER_SIZE: usize = size_of::<AllocHeader>();
const DEFAULT_ALIGN: usize = 8;
const POPCOUNT4: [u8; 16] = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

#[inline]
fn alloc_bytes(size: usize) -> *mut u8 {
    if size == 0 {
        return null_mut();
    }

    let align = DEFAULT_ALIGN.max(core::mem::align_of::<AllocHeader>());
    let Some(total) = size.checked_add(HEADER_SIZE) else {
        return null_mut();
    };

    let layout = match Layout::from_size_align(total, align) {
        Ok(layout) => layout,
        Err(_) => return null_mut(),
    };

    // SAFETY: layout is valid and non-zero sized.
    let raw = unsafe { alloc(layout) };
    if raw.is_null() {
        return null_mut();
    }

    let header = AllocHeader { size: total, align };
    // SAFETY: raw points to at least HEADER_SIZE bytes.
    unsafe {
        (raw as *mut AllocHeader).write(header);
        raw.add(HEADER_SIZE)
    }
}

#[inline]
fn dealloc_bytes(ptr: *mut u8) {
    if ptr.is_null() {
        return;
    }

    // SAFETY: ptr was created by alloc_bytes and has a valid header right before it.
    unsafe {
        let raw = ptr.sub(HEADER_SIZE);
        let header = (raw as *const AllocHeader).read();
        if header.size < HEADER_SIZE || header.align == 0 {
            return;
        }

        if let Ok(layout) = Layout::from_size_align(header.size, header.align) {
            dealloc(raw, layout);
        }
    }
}

#[no_mangle]
pub extern "C" fn malloc(size: usize) -> *mut u8 {
    alloc_bytes(size)
}

#[no_mangle]
pub extern "C" fn free(ptr: *mut u8) {
    dealloc_bytes(ptr)
}

#[inline]
fn hex_to_val(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => 0,
    }
}

fn alloc_c_string(text: &str) -> *mut u8 {
    let bytes = text.as_bytes();
    let len = bytes.len();
    let ptr = alloc_bytes(len + 1);
    if ptr.is_null() {
        return null_mut();
    }

    // SAFETY: ptr has len + 1 bytes available and source is valid.
    unsafe {
        ptr::copy_nonoverlapping(bytes.as_ptr(), ptr, len);
        *ptr.add(len) = 0;
    }

    ptr
}

fn create_hash_result(hash: *mut u8, error: i32, error_message: *mut u8) -> *mut HashResult {
    let ptr = alloc_bytes(size_of::<HashResult>()) as *mut HashResult;
    if ptr.is_null() {
        if !hash.is_null() {
            dealloc_bytes(hash);
        }
        if !error_message.is_null() {
            dealloc_bytes(error_message);
        }
        return null_mut();
    }

    // SAFETY: ptr points to writable memory for HashResult.
    unsafe {
        ptr.write(HashResult {
            hash,
            error,
            error_message,
        });
    }

    ptr
}

fn create_error_result(message: &str) -> *mut HashResult {
    let error_message = alloc_c_string(message);
    create_hash_result(null_mut(), 1, error_message)
}

fn calculate_hash_for_rgba(
    image_data: &[u8],
    width: usize,
    height: usize,
) -> Result<String, &'static str> {
    if width == 0 || height == 0 {
        return Err("Invalid dimensions");
    }

    let total_pixels = width.checked_mul(height).ok_or("Pixel count overflow")?;

    let expected_bytes = total_pixels
        .checked_mul(4)
        .ok_or("Image byte size overflow")?;

    if image_data.len() < expected_bytes {
        return Err("Image data is too short");
    }

    let mut gray: Vec<u16> = Vec::with_capacity(total_pixels);
    let mut sum: u64 = 0;

    for i in 0..total_pixels {
        let pixel_index = i * 4;
        let r = image_data[pixel_index] as u16;
        let g = image_data[pixel_index + 1] as u16;
        let b = image_data[pixel_index + 2] as u16;
        let value = (r + g + b) / 3;
        gray.push(value);
        sum += value as u64;
    }

    let mut hex = Vec::with_capacity((total_pixels + 3) / 4);
    let mut nibble: u8 = 0;
    let mut nibble_bits = 0usize;

    let total_pixels_u128 = total_pixels as u128;
    let sum_u128 = sum as u128;

    for &value in &gray {
        nibble <<= 1;
        if (value as u128) * total_pixels_u128 > sum_u128 {
            nibble |= 1;
        }

        nibble_bits += 1;
        if nibble_bits == 4 {
            let ch = b"0123456789abcdef"[nibble as usize];
            hex.push(ch);
            nibble = 0;
            nibble_bits = 0;
        }
    }

    if nibble_bits != 0 {
        nibble <<= (4 - nibble_bits) as u8;
        let ch = b"0123456789abcdef"[nibble as usize];
        hex.push(ch);
    }

    // SAFETY: only ASCII bytes in hex.
    Ok(unsafe { String::from_utf8_unchecked(hex) })
}

fn parse_c_hex(ptr: *const u8) -> Option<Vec<u8>> {
    if ptr.is_null() {
        return None;
    }

    // SAFETY: caller guarantees ptr is a valid null-terminated C string.
    let bytes = unsafe { CStr::from_ptr(ptr as *const c_char).to_bytes() };
    Some(bytes.to_vec())
}

fn hamming_distance_hex(hash1: &[u8], hash2: &[u8]) -> i32 {
    if hash1.len() != hash2.len() {
        return -1;
    }

    let mut distance = 0i32;
    for i in 0..hash1.len() {
        let v1 = hex_to_val(hash1[i]);
        let v2 = hex_to_val(hash2[i]);
        distance += POPCOUNT4[(v1 ^ v2) as usize] as i32;
    }

    distance
}

fn alloc_i32_array(values: &[i32]) -> *mut i32 {
    if values.is_empty() {
        return null_mut();
    }

    let Some(total_bytes) = values.len().checked_mul(size_of::<i32>()) else {
        return null_mut();
    };

    let ptr = alloc_bytes(total_bytes) as *mut i32;
    if ptr.is_null() {
        return null_mut();
    }

    // SAFETY: destination has enough space for values.len() i32s.
    unsafe {
        ptr::copy_nonoverlapping(values.as_ptr(), ptr, values.len());
    }

    ptr
}

#[no_mangle]
pub extern "C" fn calculate_perceptual_hash(
    image_data: *const u8,
    width: i32,
    height: i32,
    hash_size: i32,
) -> *mut HashResult {
    if image_data.is_null() || width <= 0 || height <= 0 || hash_size <= 0 {
        return create_error_result("Invalid input parameters");
    }

    let width_usize = width as usize;
    let height_usize = height as usize;

    let Some(image_len) = width_usize
        .checked_mul(height_usize)
        .and_then(|v| v.checked_mul(4))
    else {
        return create_error_result("Image size overflow");
    };

    // SAFETY: caller provides a valid RGBA buffer of width * height * 4 bytes.
    let image_slice = unsafe { core::slice::from_raw_parts(image_data, image_len) };

    match calculate_hash_for_rgba(image_slice, width_usize, height_usize) {
        Ok(hash) => {
            let hash_ptr = alloc_c_string(&hash);
            if hash_ptr.is_null() {
                return create_error_result("Failed to allocate hash result");
            }
            create_hash_result(hash_ptr, 0, null_mut())
        }
        Err(error) => create_error_result(error),
    }
}

#[no_mangle]
pub extern "C" fn calculate_batch_hashes(
    images_data: *const u8,
    dimensions: *const i32,
    image_offsets: *const i32,
    num_images: i32,
    hash_size: i32,
) -> *mut HashResult {
    if images_data.is_null()
        || dimensions.is_null()
        || image_offsets.is_null()
        || num_images <= 0
        || hash_size <= 0
    {
        return null_mut();
    }

    let num = num_images as usize;
    let total_bytes = match num.checked_mul(size_of::<HashResult>()) {
        Some(size) => size,
        None => return null_mut(),
    };

    let results_ptr = alloc_bytes(total_bytes) as *mut HashResult;
    if results_ptr.is_null() {
        return null_mut();
    }

    // SAFETY: pointers are valid and lengths are controlled by caller.
    let dims = unsafe { core::slice::from_raw_parts(dimensions, num * 2) };
    let offsets = unsafe { core::slice::from_raw_parts(image_offsets, num) };

    for i in 0..num {
        let width = dims[i * 2];
        let height = dims[i * 2 + 1];
        let offset = offsets[i];

        let entry = if width <= 0 || height <= 0 || offset < 0 {
            HashResult {
                hash: null_mut(),
                error: 1,
                error_message: alloc_c_string("Invalid image metadata"),
            }
        } else {
            let width_usize = width as usize;
            let height_usize = height as usize;
            match width_usize
                .checked_mul(height_usize)
                .and_then(|v| v.checked_mul(4))
            {
                Some(image_len) => {
                    // SAFETY: caller guarantees images_data has enough bytes from offset.
                    let image_ptr = unsafe { images_data.add(offset as usize) };
                    // SAFETY: image_ptr points to at least image_len bytes.
                    let image_slice = unsafe { core::slice::from_raw_parts(image_ptr, image_len) };

                    match calculate_hash_for_rgba(image_slice, width_usize, height_usize) {
                        Ok(hash) => {
                            let hash_ptr = alloc_c_string(&hash);
                            if hash_ptr.is_null() {
                                HashResult {
                                    hash: null_mut(),
                                    error: 1,
                                    error_message: alloc_c_string("Failed to allocate hash"),
                                }
                            } else {
                                HashResult {
                                    hash: hash_ptr,
                                    error: 0,
                                    error_message: null_mut(),
                                }
                            }
                        }
                        Err(error) => HashResult {
                            hash: null_mut(),
                            error: 1,
                            error_message: alloc_c_string(error),
                        },
                    }
                }
                None => HashResult {
                    hash: null_mut(),
                    error: 1,
                    error_message: alloc_c_string("Image size overflow"),
                },
            }
        };

        // SAFETY: results_ptr points to an array of num HashResult entries.
        unsafe {
            results_ptr.add(i).write(entry);
        }
    }

    results_ptr
}

#[no_mangle]
pub extern "C" fn calculate_hamming_distance(hash1: *const u8, hash2: *const u8) -> i32 {
    let Some(bytes1) = parse_c_hex(hash1) else {
        return -1;
    };
    let Some(bytes2) = parse_c_hex(hash2) else {
        return -1;
    };

    hamming_distance_hex(&bytes1, &bytes2)
}

#[no_mangle]
pub extern "C" fn find_similar_pairs(
    hashes: *const *const u8,
    num_hashes: i32,
    threshold: i32,
    out_count: *mut i32,
) -> *mut i32 {
    if !out_count.is_null() {
        // SAFETY: out_count points to writable memory.
        unsafe {
            *out_count = 0;
        }
    }

    if hashes.is_null() || num_hashes <= 1 {
        return null_mut();
    }

    let num = num_hashes as usize;
    // SAFETY: hashes points to num pointers.
    let hash_ptrs = unsafe { core::slice::from_raw_parts(hashes, num) };

    let mut parsed_hashes = Vec::with_capacity(num);
    for &hash_ptr in hash_ptrs {
        let Some(bytes) = parse_c_hex(hash_ptr) else {
            parsed_hashes.push(Vec::new());
            continue;
        };
        parsed_hashes.push(bytes);
    }

    let mut pairs: Vec<i32> = Vec::new();

    for i in 0..num {
        for j in (i + 1)..num {
            let distance = hamming_distance_hex(&parsed_hashes[i], &parsed_hashes[j]);
            if distance >= 0 && distance <= threshold {
                pairs.push(i as i32);
                pairs.push(j as i32);
            }
        }
    }

    let pair_count = (pairs.len() / 2) as i32;
    if !out_count.is_null() {
        // SAFETY: out_count points to writable memory.
        unsafe {
            *out_count = pair_count;
        }
    }

    alloc_i32_array(&pairs)
}

#[no_mangle]
pub extern "C" fn find_similar_pairs_bucketed(
    hashes: *const *const u8,
    num_hashes: i32,
    bucket_starts: *const i32,
    bucket_sizes: *const i32,
    num_buckets: i32,
    threshold: i32,
    out_count: *mut i32,
) -> *mut i32 {
    if !out_count.is_null() {
        // SAFETY: out_count points to writable memory.
        unsafe {
            *out_count = 0;
        }
    }

    if hashes.is_null() || bucket_starts.is_null() || bucket_sizes.is_null() {
        return null_mut();
    }

    if num_hashes <= 1 || num_buckets <= 0 {
        return null_mut();
    }

    let num_hashes_usize = num_hashes as usize;
    let num_buckets_usize = num_buckets as usize;

    // SAFETY: caller guarantees valid arrays with these lengths.
    let hash_ptrs = unsafe { core::slice::from_raw_parts(hashes, num_hashes_usize) };
    let starts = unsafe { core::slice::from_raw_parts(bucket_starts, num_buckets_usize) };
    let sizes = unsafe { core::slice::from_raw_parts(bucket_sizes, num_buckets_usize) };

    let mut parsed_hashes = Vec::with_capacity(num_hashes_usize);
    for &hash_ptr in hash_ptrs {
        let Some(bytes) = parse_c_hex(hash_ptr) else {
            parsed_hashes.push(Vec::new());
            continue;
        };
        parsed_hashes.push(bytes);
    }

    let mut pairs: Vec<i32> = Vec::new();

    // Compare within each bucket.
    for b in 0..num_buckets_usize {
        let start = starts[b];
        let size = sizes[b];

        if start < 0 || size <= 0 {
            continue;
        }

        let start_usize = start as usize;
        let size_usize = size as usize;

        if start_usize >= num_hashes_usize {
            continue;
        }

        let end = start_usize.saturating_add(size_usize).min(num_hashes_usize);

        for i in start_usize..end {
            for j in (i + 1)..end {
                let distance = hamming_distance_hex(&parsed_hashes[i], &parsed_hashes[j]);
                if distance >= 0 && distance <= threshold {
                    pairs.push(i as i32);
                    pairs.push(j as i32);
                }
            }
        }
    }

    // Compare adjacent buckets to catch near-prefix matches.
    if num_buckets_usize > 1 {
        for b in 0..(num_buckets_usize - 1) {
            let start1 = starts[b];
            let size1 = sizes[b];
            let start2 = starts[b + 1];
            let size2 = sizes[b + 1];

            if start1 < 0 || size1 <= 0 || start2 < 0 || size2 <= 0 {
                continue;
            }

            let range1_start = start1 as usize;
            let range2_start = start2 as usize;
            if range1_start >= num_hashes_usize || range2_start >= num_hashes_usize {
                continue;
            }

            let range1_end = range1_start
                .saturating_add(size1 as usize)
                .min(num_hashes_usize);
            let range2_end = range2_start
                .saturating_add(size2 as usize)
                .min(num_hashes_usize);

            for i in range1_start..range1_end {
                for j in range2_start..range2_end {
                    let distance = hamming_distance_hex(&parsed_hashes[i], &parsed_hashes[j]);
                    if distance >= 0 && distance <= threshold {
                        pairs.push(i as i32);
                        pairs.push(j as i32);
                    }
                }
            }
        }
    }

    let pair_count = (pairs.len() / 2) as i32;
    if !out_count.is_null() {
        // SAFETY: out_count points to writable memory.
        unsafe {
            *out_count = pair_count;
        }
    }

    alloc_i32_array(&pairs)
}

#[no_mangle]
pub extern "C" fn free_hash_result(result: *mut HashResult) {
    if result.is_null() {
        return;
    }

    // SAFETY: result is a valid pointer returned by create_hash_result.
    unsafe {
        let value = result.read();
        if !value.hash.is_null() {
            dealloc_bytes(value.hash);
        }
        if !value.error_message.is_null() {
            dealloc_bytes(value.error_message);
        }
    }

    dealloc_bytes(result as *mut u8);
}

#[no_mangle]
pub extern "C" fn free_batch_results(results: *mut HashResult, num_results: i32) {
    if results.is_null() || num_results <= 0 {
        return;
    }

    let len = num_results as usize;

    for i in 0..len {
        // SAFETY: results points to an array of len HashResult entries.
        let entry = unsafe { results.add(i).read() };
        if !entry.hash.is_null() {
            dealloc_bytes(entry.hash);
        }
        if !entry.error_message.is_null() {
            dealloc_bytes(entry.error_message);
        }
    }

    dealloc_bytes(results as *mut u8);
}

#[no_mangle]
pub extern "C" fn free_pairs(pairs: *mut i32) {
    dealloc_bytes(pairs as *mut u8);
}

#[no_mangle]
pub extern "C" fn has_simd_support() -> i32 {
    if cfg!(target_feature = "simd128") {
        1
    } else {
        0
    }
}
