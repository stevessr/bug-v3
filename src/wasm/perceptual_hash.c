#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

// Structure for hash calculation result
typedef struct {
    char* hash;
    int error;
    char* error_message;
} HashResult;

// Helper function to calculate average pixel value
static double calculate_average(unsigned char* data, int width, int height) {
    double sum = 0.0;
    int total_pixels = width * height;

    for (int i = 0; i < total_pixels; i++) {
        // Assuming RGB format (3 bytes per pixel)
        int pixel_index = i * 3;
        unsigned char r = data[pixel_index];
        unsigned char g = data[pixel_index + 1];
        unsigned char b = data[pixel_index + 2];
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

// Main perceptual hash calculation function
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

    // Convert to grayscale if needed (assuming input is already grayscale)
    int total_pixels = width * height;

    // Calculate average
    double average = calculate_average(image_data, width, height);

    // Generate binary hash
    char* binary_hash = malloc(hash_size * hash_size + 1);
    if (!binary_hash) {
        free(result);
        return create_error_result("Memory allocation failed for binary hash");
    }

    for (int i = 0; i < total_pixels; i++) {
        int pixel_index = i * 3;
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

// Hamming distance calculation
EMSCRIPTEN_KEEPALIVE
int calculate_hamming_distance(const char* hash1, const char* hash2) {
    if (!hash1 || !hash2) return -1;

    int len1 = strlen(hash1);
    int len2 = strlen(hash2);

    if (len1 != len2) return -1;

    int distance = 0;
    for (int i = 0; i < len1; i++) {
        if (hash1[i] != hash2[i]) {
            distance++;
        }
    }

    return distance;
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