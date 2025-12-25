#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>

// Enable SIMD if supported
#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#define USE_SIMD 1
#else
#define USE_SIMD 0
#endif

// Structure for hash calculation result
typedef struct {
    char* hash;
    int error;
    char* error_message;
} HashResult;

// Structure for batch hamming distance result
typedef struct {
    int32_t* distances;
    int count;
    int error;
} BatchDistanceResult;

// Optimized popcount using built-in or manual implementation
static inline int popcount64(uint64_t x) {
#if defined(__GNUC__) || defined(__clang__)
    return __builtin_popcountll(x);
#else
    // Manual popcount for older compilers
    x = x - ((x >> 1) & 0x5555555555555555ULL);
    x = (x & 0x3333333333333333ULL) + ((x >> 2) & 0x3333333333333333ULL);
    x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0FULL;
    return (x * 0x0101010101010101ULL) >> 56;
#endif
}

static inline int popcount32(uint32_t x) {
#if defined(__GNUC__) || defined(__clang__)
    return __builtin_popcount(x);
#else
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0F0F0F0F;
    return (x * 0x01010101) >> 24;
#endif
}

// Convert hex char to value
static inline int hex_to_val(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
}

// Helper function to calculate average pixel value (RGBA format)
static double calculate_average_rgba(unsigned char* data, int width, int height) {
    double sum = 0.0;
    int total_pixels = width * height;

    for (int i = 0; i < total_pixels; i++) {
        int pixel_index = i * 4;  // RGBA = 4 bytes
        unsigned char r = data[pixel_index];
        unsigned char g = data[pixel_index + 1];
        unsigned char b = data[pixel_index + 2];
        // Alpha is at pixel_index + 3, ignored for hash
        sum += (r + g + b) / 3.0;
    }

    return sum / total_pixels;
}

// Helper function to convert binary hash to hex
static void binary_to_hex(const char* binary, char* hex, int binary_len) {
    const char hex_chars[] = "0123456789abcdef";

    for (int i = 0; i < binary_len; i += 4) {
        int value = 0;
        for (int j = 0; j < 4 && (i + j) < binary_len; j++) {
            if (binary[i + j] == '1') {
                value += (1 << (3 - j));
            }
        }
        hex[i / 4] = hex_chars[value];
    }
    hex[binary_len / 4] = '\0';
}

// Helper function to create error result
static HashResult* create_error_result(const char* message) {
    HashResult* result = malloc(sizeof(HashResult));
    if (!result) return NULL;

    result->hash = NULL;
    result->error = 1;
    result->error_message = malloc(strlen(message) + 1);
    if (result->error_message) {
        strcpy(result->error_message, message);
    }

    return result;
}

// Main perceptual hash calculation function (RGBA input from Canvas)
EMSCRIPTEN_KEEPALIVE
HashResult* calculate_perceptual_hash(unsigned char* image_data, int width, int height, int hash_size) {
    HashResult* result = malloc(sizeof(HashResult));
    if (!result) {
        return create_error_result("Memory allocation failed");
    }

    // Validate input parameters
    if (!image_data || width <= 0 || height <= 0 || hash_size <= 0) {
        free(result);
        return create_error_result("Invalid input parameters");
    }

    int total_pixels = width * height;

    // Calculate average
    double average = calculate_average_rgba(image_data, width, height);

    // Generate binary hash
    char* binary_hash = malloc(total_pixels + 1);
    if (!binary_hash) {
        free(result);
        return create_error_result("Memory allocation failed for binary hash");
    }

    for (int i = 0; i < total_pixels; i++) {
        int pixel_index = i * 4;  // RGBA format
        unsigned char r = image_data[pixel_index];
        unsigned char g = image_data[pixel_index + 1];
        unsigned char b = image_data[pixel_index + 2];
        double gray_value = (r + g + b) / 3.0;

        binary_hash[i] = (gray_value > average) ? '1' : '0';
    }
    binary_hash[total_pixels] = '\0';

    // Convert to hex
    int hex_len = (total_pixels + 3) / 4;
    char* hex_hash = malloc(hex_len + 1);
    if (!hex_hash) {
        free(binary_hash);
        free(result);
        return create_error_result("Memory allocation failed for hex hash");
    }

    binary_to_hex(binary_hash, hex_hash, total_pixels);
    free(binary_hash);

    result->hash = hex_hash;
    result->error = 0;
    result->error_message = NULL;

    return result;
}

// Batch hash calculation for multiple images
EMSCRIPTEN_KEEPALIVE
HashResult* calculate_batch_hashes(
    unsigned char* images_data,
    int* dimensions,
    int* image_offsets,
    int num_images,
    int hash_size
) {
    HashResult* results = malloc(sizeof(HashResult) * num_images);
    if (!results) {
        return create_error_result("Memory allocation failed for batch results");
    }

    for (int i = 0; i < num_images; i++) {
        int width = dimensions[i * 2];
        int height = dimensions[i * 2 + 1];
        int offset = image_offsets[i];

        unsigned char* image_data = images_data + offset;
        HashResult* single_result = calculate_perceptual_hash(image_data, width, height, hash_size);

        if (single_result) {
            results[i] = *single_result;
            free(single_result);  // Don't need the wrapper anymore
        } else {
            results[i].hash = NULL;
            results[i].error = 1;
            results[i].error_message = malloc(30);
            if (results[i].error_message) {
                strcpy(results[i].error_message, "Failed to calculate hash");
            }
        }
    }

    return results;
}

// Optimized Hamming distance calculation using bit operations on hex hashes
EMSCRIPTEN_KEEPALIVE
int calculate_hamming_distance(const char* hash1, const char* hash2) {
    if (!hash1 || !hash2) return -1;

    int len1 = strlen(hash1);
    int len2 = strlen(hash2);

    if (len1 != len2) return -1;

    int distance = 0;

    // Process 16 hex chars (64 bits) at a time for maximum efficiency
    int i = 0;
    for (; i + 16 <= len1; i += 16) {
        uint64_t val1 = 0, val2 = 0;
        for (int j = 0; j < 16; j++) {
            val1 = (val1 << 4) | hex_to_val(hash1[i + j]);
            val2 = (val2 << 4) | hex_to_val(hash2[i + j]);
        }
        distance += popcount64(val1 ^ val2);
    }

    // Process remaining 8 hex chars (32 bits)
    for (; i + 8 <= len1; i += 8) {
        uint32_t val1 = 0, val2 = 0;
        for (int j = 0; j < 8; j++) {
            val1 = (val1 << 4) | hex_to_val(hash1[i + j]);
            val2 = (val2 << 4) | hex_to_val(hash2[i + j]);
        }
        distance += popcount32(val1 ^ val2);
    }

    // Process remaining chars one by one
    for (; i < len1; i++) {
        uint8_t val1 = hex_to_val(hash1[i]);
        uint8_t val2 = hex_to_val(hash2[i]);
        distance += popcount32(val1 ^ val2);
    }

    return distance;
}

// Batch Hamming distance calculation for duplicate detection
// Calculates distances between all pairs in the comparison list
EMSCRIPTEN_KEEPALIVE
BatchDistanceResult* calculate_batch_hamming_distances(
    const char** hashes,
    int num_hashes,
    int* pair_indices,  // Pairs to compare: [i1, j1, i2, j2, ...]
    int num_pairs
) {
    BatchDistanceResult* result = malloc(sizeof(BatchDistanceResult));
    if (!result) return NULL;

    result->distances = malloc(sizeof(int32_t) * num_pairs);
    if (!result->distances) {
        result->error = 1;
        result->count = 0;
        return result;
    }

    result->count = num_pairs;
    result->error = 0;

    for (int p = 0; p < num_pairs; p++) {
        int i = pair_indices[p * 2];
        int j = pair_indices[p * 2 + 1];

        if (i < 0 || i >= num_hashes || j < 0 || j >= num_hashes) {
            result->distances[p] = -1;
        } else {
            result->distances[p] = calculate_hamming_distance(hashes[i], hashes[j]);
        }
    }

    return result;
}

// Optimized batch comparison: find all pairs below threshold
// Returns pairs as flat array: [i1, j1, i2, j2, ...]
EMSCRIPTEN_KEEPALIVE
int32_t* find_similar_pairs(
    const char** hashes,
    int num_hashes,
    int threshold,
    int* out_count
) {
    *out_count = 0;

    if (num_hashes <= 1) {
        return NULL;
    }

    // Pre-allocate with estimated capacity
    int capacity = num_hashes;  // Initial estimate
    int32_t* pairs = malloc(sizeof(int32_t) * capacity * 2);
    if (!pairs) return NULL;

    int count = 0;

    // Compare all pairs
    for (int i = 0; i < num_hashes; i++) {
        for (int j = i + 1; j < num_hashes; j++) {
            int distance = calculate_hamming_distance(hashes[i], hashes[j]);

            if (distance >= 0 && distance <= threshold) {
                // Expand array if needed
                if (count >= capacity) {
                    capacity *= 2;
                    int32_t* new_pairs = realloc(pairs, sizeof(int32_t) * capacity * 2);
                    if (!new_pairs) {
                        free(pairs);
                        *out_count = 0;
                        return NULL;
                    }
                    pairs = new_pairs;
                }

                pairs[count * 2] = i;
                pairs[count * 2 + 1] = j;
                count++;
            }
        }
    }

    *out_count = count;
    return pairs;
}

// Bucketed similarity search - more efficient for large datasets
// Hashes are pre-sorted by prefix buckets on JS side
EMSCRIPTEN_KEEPALIVE
int32_t* find_similar_pairs_bucketed(
    const char** hashes,
    int num_hashes,
    int* bucket_starts,    // Start index of each bucket
    int* bucket_sizes,     // Size of each bucket
    int num_buckets,
    int threshold,
    int* out_count
) {
    *out_count = 0;

    if (num_hashes <= 1 || num_buckets == 0) {
        return NULL;
    }

    // Estimate capacity based on bucket sizes
    int estimated_pairs = 0;
    for (int b = 0; b < num_buckets; b++) {
        int size = bucket_sizes[b];
        estimated_pairs += (size * (size - 1)) / 2;
    }
    // Add estimate for cross-bucket comparisons (adjacent buckets only)
    estimated_pairs /= 10;  // Most pairs won't match
    if (estimated_pairs < 100) estimated_pairs = 100;

    int capacity = estimated_pairs;
    int32_t* pairs = malloc(sizeof(int32_t) * capacity * 2);
    if (!pairs) return NULL;

    int count = 0;

    // Compare within each bucket
    for (int b = 0; b < num_buckets; b++) {
        int start = bucket_starts[b];
        int size = bucket_sizes[b];

        for (int i = 0; i < size; i++) {
            for (int j = i + 1; j < size; j++) {
                int idx_i = start + i;
                int idx_j = start + j;
                int distance = calculate_hamming_distance(hashes[idx_i], hashes[idx_j]);

                if (distance >= 0 && distance <= threshold) {
                    if (count >= capacity) {
                        capacity *= 2;
                        int32_t* new_pairs = realloc(pairs, sizeof(int32_t) * capacity * 2);
                        if (!new_pairs) {
                            free(pairs);
                            *out_count = 0;
                            return NULL;
                        }
                        pairs = new_pairs;
                    }

                    pairs[count * 2] = idx_i;
                    pairs[count * 2 + 1] = idx_j;
                    count++;
                }
            }
        }
    }

    // Compare between adjacent buckets (hashes with similar prefixes)
    for (int b = 0; b < num_buckets - 1; b++) {
        int start1 = bucket_starts[b];
        int size1 = bucket_sizes[b];
        int start2 = bucket_starts[b + 1];
        int size2 = bucket_sizes[b + 1];

        for (int i = 0; i < size1; i++) {
            for (int j = 0; j < size2; j++) {
                int idx_i = start1 + i;
                int idx_j = start2 + j;
                int distance = calculate_hamming_distance(hashes[idx_i], hashes[idx_j]);

                if (distance >= 0 && distance <= threshold) {
                    if (count >= capacity) {
                        capacity *= 2;
                        int32_t* new_pairs = realloc(pairs, sizeof(int32_t) * capacity * 2);
                        if (!new_pairs) {
                            free(pairs);
                            *out_count = 0;
                            return NULL;
                        }
                        pairs = new_pairs;
                    }

                    pairs[count * 2] = idx_i;
                    pairs[count * 2 + 1] = idx_j;
                    count++;
                }
            }
        }
    }

    *out_count = count;
    return pairs;
}

// Free batch distance result
EMSCRIPTEN_KEEPALIVE
void free_batch_distance_result(BatchDistanceResult* result) {
    if (result) {
        if (result->distances) free(result->distances);
        free(result);
    }
}

// Free pairs array
EMSCRIPTEN_KEEPALIVE
void free_pairs(int32_t* pairs) {
    if (pairs) free(pairs);
}

// Memory cleanup function
EMSCRIPTEN_KEEPALIVE
void free_hash_result(HashResult* result) {
    if (result) {
        if (result->hash) free(result->hash);
        if (result->error_message) free(result->error_message);
        free(result);
    }
}

// Memory cleanup for batch results
EMSCRIPTEN_KEEPALIVE
void free_batch_results(HashResult* results, int num_results) {
    if (results) {
        for (int i = 0; i < num_results; i++) {
            if (results[i].hash) free(results[i].hash);
            if (results[i].error_message) free(results[i].error_message);
        }
        free(results);
    }
}

// Get SIMD support status
EMSCRIPTEN_KEEPALIVE
int has_simd_support(void) {
    return USE_SIMD;
}
