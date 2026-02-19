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

struct PackedHash {
    blocks: Vec<u64>,
    nibbles: usize,
    valid: bool,
}

fn pack_hex_to_u64_blocks(bytes: &[u8]) -> PackedHash {
    if bytes.is_empty() {
        return PackedHash {
            blocks: Vec::new(),
            nibbles: 0,
            valid: false,
        };
    }

    let mut blocks = Vec::with_capacity((bytes.len() + 15) / 16);
    let mut offset = 0usize;

    while offset < bytes.len() {
        let end = (offset + 16).min(bytes.len());
        let mut block = 0u64;

        for &ch in &bytes[offset..end] {
            block = (block << 4) | hex_to_val(ch) as u64;
        }

        let remaining = 16usize - (end - offset);
        if remaining > 0 {
            block <<= (remaining * 4) as u32;
        }

        blocks.push(block);
        offset = end;
    }

    PackedHash {
        blocks,
        nibbles: bytes.len(),
        valid: true,
    }
}

fn parse_packed_hash(ptr: *const u8) -> PackedHash {
    match parse_c_hex(ptr) {
        Some(bytes) => pack_hex_to_u64_blocks(&bytes),
        None => PackedHash {
            blocks: Vec::new(),
            nibbles: 0,
            valid: false,
        },
    }
}

fn hamming_distance_packed(hash1: &PackedHash, hash2: &PackedHash, early_stop: i32) -> i32 {
    if !hash1.valid || !hash2.valid || hash1.nibbles != hash2.nibbles {
        return -1;
    }

    let mut distance = 0i32;
    let mut idx = 0usize;
    let len = hash1.blocks.len();

    // Unrolled block-wise accumulation to improve wasm backend vectorization opportunities.
    while idx + 4 <= len {
        distance += (hash1.blocks[idx] ^ hash2.blocks[idx]).count_ones() as i32;
        distance += (hash1.blocks[idx + 1] ^ hash2.blocks[idx + 1]).count_ones() as i32;
        distance += (hash1.blocks[idx + 2] ^ hash2.blocks[idx + 2]).count_ones() as i32;
        distance += (hash1.blocks[idx + 3] ^ hash2.blocks[idx + 3]).count_ones() as i32;

        if early_stop >= 0 && distance > early_stop {
            return distance;
        }

        idx += 4;
    }

    while idx < len {
        distance += (hash1.blocks[idx] ^ hash2.blocks[idx]).count_ones() as i32;
        if early_stop >= 0 && distance > early_stop {
            return distance;
        }
        idx += 1;
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
    let packed1 = parse_packed_hash(hash1);
    let packed2 = parse_packed_hash(hash2);
    hamming_distance_packed(&packed1, &packed2, -1)
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

    let mut parsed_hashes: Vec<PackedHash> = Vec::with_capacity(num);
    for &hash_ptr in hash_ptrs {
        parsed_hashes.push(parse_packed_hash(hash_ptr));
    }

    let mut pairs: Vec<i32> = Vec::new();
    let threshold_for_early_stop = threshold.max(0);

    for i in 0..num {
        for j in (i + 1)..num {
            let distance = hamming_distance_packed(
                &parsed_hashes[i],
                &parsed_hashes[j],
                threshold_for_early_stop,
            );
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

    let mut parsed_hashes: Vec<PackedHash> = Vec::with_capacity(num_hashes_usize);
    for &hash_ptr in hash_ptrs {
        parsed_hashes.push(parse_packed_hash(hash_ptr));
    }

    let mut pairs: Vec<i32> = Vec::new();
    let threshold_for_early_stop = threshold.max(0);

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
                let distance = hamming_distance_packed(
                    &parsed_hashes[i],
                    &parsed_hashes[j],
                    threshold_for_early_stop,
                );
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
                    let distance = hamming_distance_packed(
                        &parsed_hashes[i],
                        &parsed_hashes[j],
                        threshold_for_early_stop,
                    );
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

// ===== Color Quantization =====

/// Result struct for color quantization operations.
/// `colors_ptr` points to a flat array of `[r, g, b, population]` u32 tuples.
#[repr(C)]
pub struct ColorResult {
    pub colors_ptr: *mut u32,
    pub num_colors: i32,
    pub error: i32,
    pub error_message: *mut u8,
}

fn create_color_result(
    colors_ptr: *mut u32,
    num_colors: i32,
    error: i32,
    error_message: *mut u8,
) -> *mut ColorResult {
    let ptr = alloc_bytes(size_of::<ColorResult>()) as *mut ColorResult;
    if ptr.is_null() {
        if !colors_ptr.is_null() {
            dealloc_bytes(colors_ptr as *mut u8);
        }
        if !error_message.is_null() {
            dealloc_bytes(error_message);
        }
        return null_mut();
    }

    unsafe {
        ptr.write(ColorResult {
            colors_ptr,
            num_colors,
            error,
            error_message,
        });
    }

    ptr
}

fn create_color_error(message: &str) -> *mut ColorResult {
    let error_message = alloc_c_string(message);
    create_color_result(null_mut(), 0, 1, error_message)
}

/// Allocate and populate a flat u32 array with [r, g, b, population] tuples.
fn alloc_color_array(colors: &[(u32, u32, u32, u32)]) -> *mut u32 {
    if colors.is_empty() {
        return null_mut();
    }

    let total_u32s = colors.len() * 4;
    let Some(total_bytes) = total_u32s.checked_mul(size_of::<u32>()) else {
        return null_mut();
    };

    let ptr = alloc_bytes(total_bytes) as *mut u32;
    if ptr.is_null() {
        return null_mut();
    }

    for (i, &(r, g, b, pop)) in colors.iter().enumerate() {
        unsafe {
            *ptr.add(i * 4) = r;
            *ptr.add(i * 4 + 1) = g;
            *ptr.add(i * 4 + 2) = b;
            *ptr.add(i * 4 + 3) = pop;
        }
    }

    ptr
}

#[inline]
fn color_distance_sq(r1: u32, g1: u32, b1: u32, r2: u32, g2: u32, b2: u32) -> u32 {
    let dr = r1.wrapping_sub(r2);
    let dg = g1.wrapping_sub(g2);
    let db = b1.wrapping_sub(b2);
    // Use i32 to handle negative differences correctly
    let dr = dr as i32;
    let dg = dg as i32;
    let db = db as i32;
    (dr * dr + dg * dg + db * db) as u32
}

/// Extract RGB pixels from RGBA data, skipping transparent pixels.
fn extract_rgb_pixels(pixel_data: &[u8], skip_alpha: u8) -> Vec<(u32, u32, u32)> {
    let num_pixels = pixel_data.len() / 4;
    let mut pixels = Vec::with_capacity(num_pixels);

    for i in 0..num_pixels {
        let a = pixel_data[i * 4 + 3];
        if a < skip_alpha {
            continue;
        }
        let r = pixel_data[i * 4] as u32;
        let g = pixel_data[i * 4 + 1] as u32;
        let b = pixel_data[i * 4 + 2] as u32;
        pixels.push((r, g, b));
    }

    pixels
}

/// K-Means clustering on RGBA pixel data.
#[no_mangle]
pub extern "C" fn kmeans_quantize(
    pixel_data: *const u8,
    width: i32,
    height: i32,
    k: i32,
    max_iterations: i32,
    skip_alpha_threshold: u8,
) -> *mut ColorResult {
    if pixel_data.is_null() || width <= 0 || height <= 0 || k <= 0 {
        return create_color_error("Invalid input parameters");
    }

    let w = width as usize;
    let h = height as usize;
    let k = k as usize;
    let max_iter = if max_iterations <= 0 { 20 } else { max_iterations as usize };

    let Some(num_pixels) = w.checked_mul(h) else {
        return create_color_error("Pixel count overflow");
    };
    let Some(data_len) = num_pixels.checked_mul(4) else {
        return create_color_error("Data size overflow");
    };

    let data = unsafe { core::slice::from_raw_parts(pixel_data, data_len) };
    let pixels = extract_rgb_pixels(data, skip_alpha_threshold);

    if pixels.is_empty() {
        return create_color_result(null_mut(), 0, 0, null_mut());
    }

    if pixels.len() <= k {
        let colors: Vec<(u32, u32, u32, u32)> = pixels.iter().map(|&(r, g, b)| (r, g, b, 1)).collect();
        let ptr = alloc_color_array(&colors);
        return create_color_result(ptr, colors.len() as i32, 0, null_mut());
    }

    // Initialize centroids by evenly sampling the pixel array (deterministic)
    let mut centroids: Vec<(u32, u32, u32)> = Vec::with_capacity(k);
    for i in 0..k {
        let idx = (i * pixels.len()) / k;
        centroids.push(pixels[idx]);
    }

    // Cluster assignment buffer
    let mut assignments = vec![0usize; pixels.len()];
    let mut cluster_counts = vec![0u64; k];
    let mut cluster_sums_r = vec![0u64; k];
    let mut cluster_sums_g = vec![0u64; k];
    let mut cluster_sums_b = vec![0u64; k];

    for _iter in 0..max_iter {
        // Assign each pixel to nearest centroid
        for (pi, &(r, g, b)) in pixels.iter().enumerate() {
            let mut min_dist = u32::MAX;
            let mut min_idx = 0usize;
            for (ci, &(cr, cg, cb)) in centroids.iter().enumerate() {
                let dist = color_distance_sq(r, g, b, cr, cg, cb);
                if dist < min_dist {
                    min_dist = dist;
                    min_idx = ci;
                }
            }
            assignments[pi] = min_idx;
        }

        // Recompute centroids
        for i in 0..k {
            cluster_counts[i] = 0;
            cluster_sums_r[i] = 0;
            cluster_sums_g[i] = 0;
            cluster_sums_b[i] = 0;
        }

        for (pi, &(r, g, b)) in pixels.iter().enumerate() {
            let ci = assignments[pi];
            cluster_counts[ci] += 1;
            cluster_sums_r[ci] += r as u64;
            cluster_sums_g[ci] += g as u64;
            cluster_sums_b[ci] += b as u64;
        }

        let mut changed = false;
        for i in 0..k {
            if cluster_counts[i] == 0 {
                continue;
            }
            let new_r = (cluster_sums_r[i] / cluster_counts[i]) as u32;
            let new_g = (cluster_sums_g[i] / cluster_counts[i]) as u32;
            let new_b = (cluster_sums_b[i] / cluster_counts[i]) as u32;

            if color_distance_sq(new_r, new_g, new_b, centroids[i].0, centroids[i].1, centroids[i].2) > 1 {
                changed = true;
                centroids[i] = (new_r, new_g, new_b);
            }
        }

        if !changed {
            break;
        }
    }

    // Build output with population counts
    let mut colors: Vec<(u32, u32, u32, u32)> = Vec::with_capacity(k);
    for i in 0..k {
        if cluster_counts[i] > 0 {
            colors.push((centroids[i].0, centroids[i].1, centroids[i].2, cluster_counts[i] as u32));
        }
    }

    // Sort by population descending
    colors.sort_by(|a, b| b.3.cmp(&a.3));

    let ptr = alloc_color_array(&colors);
    create_color_result(ptr, colors.len() as i32, 0, null_mut())
}

/// Median Cut algorithm on RGBA pixel data.
#[no_mangle]
pub extern "C" fn median_cut_quantize(
    pixel_data: *const u8,
    width: i32,
    height: i32,
    num_colors: i32,
    skip_alpha_threshold: u8,
) -> *mut ColorResult {
    if pixel_data.is_null() || width <= 0 || height <= 0 || num_colors <= 0 {
        return create_color_error("Invalid input parameters");
    }

    let w = width as usize;
    let h = height as usize;

    let Some(num_pixels) = w.checked_mul(h) else {
        return create_color_error("Pixel count overflow");
    };
    let Some(data_len) = num_pixels.checked_mul(4) else {
        return create_color_error("Data size overflow");
    };

    let data = unsafe { core::slice::from_raw_parts(pixel_data, data_len) };
    let pixels = extract_rgb_pixels(data, skip_alpha_threshold);

    if pixels.is_empty() {
        return create_color_result(null_mut(), 0, 0, null_mut());
    }

    // Calculate depth from num_colors: depth = ceil(log2(num_colors))
    let target = num_colors as usize;
    let depth = if target <= 1 { 0 } else { (target as f64).log2().ceil() as usize };

    let result_pixels = median_cut_impl(pixels, depth);

    let colors: Vec<(u32, u32, u32, u32)> = result_pixels
        .into_iter()
        .map(|(r, g, b, pop)| (r, g, b, pop))
        .collect();

    // Sort by population descending
    let mut colors = colors;
    colors.sort_by(|a, b| b.3.cmp(&a.3));

    let ptr = alloc_color_array(&colors);
    create_color_result(ptr, colors.len() as i32, 0, null_mut())
}

fn median_cut_impl(
    mut pixels: Vec<(u32, u32, u32)>,
    depth: usize,
) -> Vec<(u32, u32, u32, u32)> {
    if depth == 0 || pixels.is_empty() {
        if pixels.is_empty() {
            return Vec::new();
        }
        // Return average color with population
        let count = pixels.len() as u64;
        let (sr, sg, sb) = pixels.iter().fold((0u64, 0u64, 0u64), |(sr, sg, sb), &(r, g, b)| {
            (sr + r as u64, sg + g as u64, sb + b as u64)
        });
        return vec![((sr / count) as u32, (sg / count) as u32, (sb / count) as u32, count as u32)];
    }

    // Find the channel with the largest range
    let (mut min_r, mut max_r) = (255u32, 0u32);
    let (mut min_g, mut max_g) = (255u32, 0u32);
    let (mut min_b, mut max_b) = (255u32, 0u32);

    for &(r, g, b) in &pixels {
        if r < min_r { min_r = r; }
        if r > max_r { max_r = r; }
        if g < min_g { min_g = g; }
        if g > max_g { max_g = g; }
        if b < min_b { min_b = b; }
        if b > max_b { max_b = b; }
    }

    let range_r = max_r - min_r;
    let range_g = max_g - min_g;
    let range_b = max_b - min_b;

    // Sort by the channel with the largest range
    if range_r >= range_g && range_r >= range_b {
        pixels.sort_unstable_by_key(|&(r, _, _)| r);
    } else if range_g >= range_r && range_g >= range_b {
        pixels.sort_unstable_by_key(|&(_, g, _)| g);
    } else {
        pixels.sort_unstable_by_key(|&(_, _, b)| b);
    }

    let mid = pixels.len() / 2;
    let right = pixels.split_off(mid);

    let mut results = median_cut_impl(pixels, depth - 1);
    results.extend(median_cut_impl(right, depth - 1));
    results
}

#[no_mangle]
pub extern "C" fn free_color_result(result: *mut ColorResult) {
    if result.is_null() {
        return;
    }

    unsafe {
        let value = result.read();
        if !value.colors_ptr.is_null() {
            dealloc_bytes(value.colors_ptr as *mut u8);
        }
        if !value.error_message.is_null() {
            dealloc_bytes(value.error_message);
        }
    }

    dealloc_bytes(result as *mut u8);
}
