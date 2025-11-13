# Gemini API Integration Features

This document describes the new Gemini API features added to the emoji extension.

## Overview

The extension now integrates with Google's Gemini API to provide intelligent emoji management features:

1. **AI-Powered Emoji Naming**: Automatically analyze images and suggest descriptive names
2. **Cross-Group Duplicate Detection**: Find and remove duplicate emojis based on image similarity
3. **Emoji References**: Reduce storage by referencing existing emojis instead of duplicating data

## Features

### 1. AI-Powered Emoji Naming

Uses Gemini 2.0 Flash model to analyze images and suggest relevant names.

#### Setup

1. Navigate to **Settings** page
2. Find the **Gemini API 配置** section
3. Enter your Gemini API key
   - Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

#### Usage

1. When adding a new emoji (single URL mode):
   - Enter the emoji URL first
   - Click the **AI 命名** (AI Naming) button next to the name field
   - Wait for AI analysis (usually 2-5 seconds)
   - Choose from suggested names or enter a custom one
   - Click **确认使用** (Confirm) to apply

#### Features

- Analyzes image content and suggests 5 relevant names
- Provides image description and tags
- Allows custom name input
- Auto-analyzes when modal opens (if API key is configured)

### 2. Cross-Group Duplicate Detection

Finds duplicate emojis across all groups using perceptual hashing to detect similar images.

#### How It Works

1. Calculates perceptual hash for each emoji (simplified hash based on image content)
2. Compares hashes using Hamming distance
3. Groups similar emojis together
4. Allows batch processing with two options:
   - **Create References**: Keep first emoji, convert others to references
   - **Delete**: Keep first emoji, delete others

#### Usage

1. Navigate to **Settings** page
2. Find the **跨分组重复检测** (Cross-Group Duplicate Detection) section
3. Adjust similarity threshold (0-20):
   - Lower values = stricter matching (only very similar images)
   - Higher values = looser matching (more images considered similar)
   - Default: 10 (recommended)
4. Select processing method:
   - **创建引用** (Create References) - Recommended, saves storage
   - **直接删除** (Delete) - Permanently removes duplicates
5. Click **开始扫描** (Start Scan)
6. Review detected duplicates
7. Click **处理重复项** (Process Duplicates) to apply changes

#### Notes

- First scan may take longer as it calculates hashes for all emojis
- Hashes are saved with emojis for faster subsequent scans
- The first emoji in each duplicate group is kept as the "original"
- References maintain emoji metadata (name, group) but point to original URL

### 3. Emoji Reference System

Reduces storage by allowing emojis to reference other emojis instead of storing duplicate image data.

#### Technical Details

- Each emoji can have a `referenceId` field pointing to another emoji
- When an emoji has a reference, it uses the referenced emoji's URL
- References are resolved automatically when displaying or using emojis
- Original emoji metadata (name, group membership) is preserved

#### Benefits

- Reduces storage space when same image is used in multiple groups
- Maintains organization (same emoji can appear in different groups with different names)
- Automatically updates if original emoji URL changes

## API Reference

### Gemini Service (`src/utils/geminiService.ts`)

#### `analyzeImageForNaming(imageUrl: string, config: GeminiConfig): Promise<ImageAnalysisResult>`

Analyzes an image using Gemini API and returns suggested names.

**Parameters:**
- `imageUrl`: URL of the image to analyze
- `config`: Configuration object with `apiKey` and optional `model`

**Returns:**
- `suggestedNames`: Array of suggested names
- `description`: Brief description of the image
- `tags`: Relevant tags

**Example:**
```typescript
const result = await analyzeImageForNaming('https://example.com/emoji.png', {
  apiKey: 'your-api-key'
})
console.log(result.suggestedNames) // ['happy-cat', 'smiling-kitten', ...]
```

#### `calculatePerceptualHash(imageUrl: string): Promise<string>`

Calculates a perceptual hash for an image.

**Parameters:**
- `imageUrl`: URL of the image

**Returns:**
- Hexadecimal hash string

#### `areSimilarImages(hash1: string, hash2: string, threshold: number): boolean`

Checks if two images are similar based on their perceptual hashes.

**Parameters:**
- `hash1`: First image hash
- `hash2`: Second image hash
- `threshold`: Maximum Hamming distance to consider images similar (default: 10)

**Returns:**
- `true` if images are similar, `false` otherwise

### Emoji Store Functions

#### `findDuplicatesAcrossGroups(similarityThreshold: number): Promise<Array<DuplicateGroup>>`

Finds duplicate emojis across all groups.

**Parameters:**
- `similarityThreshold`: Maximum Hamming distance for similarity (default: 10)

**Returns:**
- Array of duplicate groups, each containing similar emojis from different groups

#### `removeDuplicatesAcrossGroups(duplicates: Array<DuplicateGroup>, createReferences: boolean): Promise<number>`

Removes or creates references for duplicate emojis.

**Parameters:**
- `duplicates`: Array of duplicate groups from `findDuplicatesAcrossGroups`
- `createReferences`: If `true`, creates references; if `false`, deletes duplicates

**Returns:**
- Number of emojis removed

#### `resolveEmojiReference(emoji: Emoji): Emoji`

Resolves an emoji reference to get the actual emoji data.

**Parameters:**
- `emoji`: Emoji object (may contain a reference)

**Returns:**
- Resolved emoji with actual URL and display data

## Data Model

### Extended Types

```typescript
interface AppSettings {
  // ... existing fields ...
  geminiApiKey?: string  // Gemini API key for AI features
}

interface Emoji {
  // ... existing fields ...
  referenceId?: string      // ID of referenced emoji (if this is a reference)
  perceptualHash?: string   // Perceptual hash for similarity detection
}
```

## Security & Privacy

### API Key Storage
- API keys are stored in the extension's settings
- Never transmitted to third parties except Google's Gemini API
- Stored using browser's secure storage mechanism

### Image Processing
- Images are sent to Google's Gemini API for analysis
- Only when explicitly requested by user (clicking AI naming button)
- No automatic or background image uploads

### Perceptual Hashing
- Performed entirely in browser
- No data sent to external servers
- Hashes are stored locally with emojis

## Performance Considerations

### Gemini API Calls
- Rate limited by Google's API quotas
- Each analysis typically takes 2-5 seconds
- Failed requests are logged and can be retried

### Perceptual Hash Calculation
- First scan of large emoji collections may take time
- Hashes are cached with emojis for reuse
- Background processing recommended for large collections

### Storage Impact
- References reduce storage by avoiding URL duplication
- Perceptual hashes add ~32 bytes per emoji
- Overall storage reduction depends on duplicate rate

## Troubleshooting

### AI Naming Not Working

**Problem:** AI naming button doesn't work or shows errors

**Solutions:**
1. Verify API key is configured in Settings
2. Check API key is valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Ensure image URL is accessible (not blocked by CORS)
4. Check browser console for error messages

### Duplicate Detection Issues

**Problem:** Not finding expected duplicates

**Solutions:**
1. Increase similarity threshold (try 15-20)
2. Ensure images have been loaded at least once (for hash calculation)
3. Very different image formats may not match well

**Problem:** Finding too many duplicates

**Solutions:**
1. Decrease similarity threshold (try 5-8)
2. Review duplicate groups before processing

### Reference Resolution Errors

**Problem:** Referenced emojis not displaying

**Solutions:**
1. Ensure original emoji still exists in collection
2. Check that original emoji has valid URL
3. Try removing and recreating the reference

## Future Enhancements

Potential improvements for future versions:

1. **Batch AI Naming**: Analyze and name multiple emojis at once
2. **Advanced Hash Algorithms**: Use more sophisticated perceptual hashing (pHash, dHash)
3. **Smart Grouping**: Use AI to suggest optimal group organization
4. **Duplicate Auto-Detection**: Automatically detect duplicates when adding new emojis
5. **Reference Visualization**: Show reference chains in UI
6. **Performance Optimization**: Worker-based hash calculation for large collections

## Credits

- Gemini API by Google
- Perceptual hashing algorithm (simplified implementation)
- UI components using Ant Design Vue
