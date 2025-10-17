# X.com Image Duplication Bug Fix

## Problem Description

Images from x.com (Twitter) were being repeatedly injected with duplicate buttons in a stable pattern. Specifically, **exactly 2 buttons** would consistently appear for each image, creating a poor user experience.

## Root Cause Analysis

The bug had **two main causes**:

### Primary Cause: Duplicate Element Processing in scanAndInjectCarousel

The `scanAndInjectCarousel()` function uses multiple CSS selectors to find image elements:
- Container selectors: `div[aria-label="Image"]`, `div[style*="background-image"]`
- Image selectors: `img`

For a typical Twitter image structure like:
```html
<div aria-label="Image" class="injected">
  <div style="background-image: url(...)"></div>
  <img src="..." class="injected">
</div>
```

**Both the container div AND the img element** would be added to the processing set, causing `addCarouselButtonToEl()` to be called twice for the same logical image - once for the container, once for the img tag.

### Secondary Cause: Mutation Observer Triggering Rescans

The mutation observer in `observeCarousel()` was triggering unnecessary rescans when:

1. **Attribute Changes on Already-Injected Elements**: When any attribute (like `style`, `src`, `aria-label`, etc.) changed on an element that was already processed and marked as "injected", the observer would trigger a full rescan.

2. **Insufficient Filtering**: The original code only skipped mutations when:
   - The attribute being changed was specifically `class` AND
   - The element already had the `injected` class

   This meant that other attribute changes on injected elements would still trigger rescans.

3. **Button Addition Triggering Rescans**: When the code added its own emoji buttons to the DOM, these additions could trigger the mutation observer, potentially causing recursive injection attempts.

## The Fix

### Change 1: Filter Out Nested Elements in scanAndInjectCarousel (PRIMARY FIX)

**Location**: Lines 396-416 in `src/content/x/image/carousel.ts`

**Before**:
```typescript
const set = new Set<Element>()
selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
// ... special case for pbs.twimg.com ...
set.forEach(el => addCarouselButtonToEl(el))
```

**After**:
```typescript
const set = new Set<Element>()
selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
// ... special case for pbs.twimg.com ...

// Filter out elements whose ancestors are also in the set to prevent duplicate processing
// For example, if both a container div and its child img are in the set, only process the container
const filtered = new Set<Element>()
set.forEach(el => {
  let hasAncestorInSet = false
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    if (set.has(parent)) {
      hasAncestorInSet = true
      break
    }
    parent = parent.parentElement
  }
  if (!hasAncestorInSet) {
    filtered.add(el)
  }
})

filtered.forEach(el => addCarouselButtonToEl(el))
console.log(`[XCarousel] Processed ${filtered.size} carousel elements (${set.size} total matched)`)
```

**Explanation**: This is the **primary fix** that solves the duplicate button issue. Before processing elements, we now filter out any element whose ancestor is also in the set. This ensures that for a structure like:
```html
<div aria-label="Image">  <!-- This will be processed -->
  <img src="...">         <!-- This will be filtered out -->
</div>
```
Only the container div is processed, not both the container and the img. This prevents the double injection.

### Change 2: Skip All Attribute Changes on Injected Elements

**Location**: Lines 481-484 in `src/content/x/image/carousel.ts`

**Before**:
```typescript
if (m.type === 'attributes') {
  const tgt = m.target as Element
  if (!tgt) continue
  // Skip if this is just adding the 'injected' class to prevent double injection
  if (m.attributeName === 'class' && tgt.classList.contains('injected')) {
    continue
  }
  if (tgt.tagName === 'IMG') {
    // attribute changes on <img> (e.g. src) are relevant
    needsScan = true
    break
  }
  // ... rest of code
}
```

**After**:
```typescript
if (m.type === 'attributes') {
  const tgt = m.target as Element
  if (!tgt) continue
  // Skip if this is just adding the 'injected' class to prevent double injection
  if (m.attributeName === 'class' && tgt.classList.contains('injected')) {
    continue
  }
  // Skip attribute changes on already-injected elements to prevent re-injection
  if (isInjected(tgt)) {
    continue
  }
  if (tgt.tagName === 'IMG') {
    // attribute changes on <img> (e.g. src) are relevant
    needsScan = true
    break
  }
  // ... rest of code
}
```

**Explanation**: Added a check using the `isInjected()` helper function to skip ANY attribute change on elements that have already been processed. This prevents the observer from triggering rescans when Twitter/X.com updates styles, positions, or other attributes on already-processed image containers. This is a **secondary fix** that improves performance and prevents potential edge cases.

### Change 3: Skip Button Additions in childList Mutations

**Location**: Lines 456-463 in `src/content/x/image/carousel.ts`

**Before**:
```typescript
if (m.type === 'childList') {
  for (const n of Array.from(m.addedNodes)) {
    if (n.nodeType !== 1) continue
    const el = n as Element
    if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
      needsScan = true
      break
    }
  }
  if (needsScan) break
}
```

**After**:
```typescript
if (m.type === 'childList') {
  for (const n of Array.from(m.addedNodes)) {
    if (n.nodeType !== 1) continue
    const el = n as Element
    // Skip if this is our own injected button being added
    if (
      el.classList &&
      (el.classList.contains('x-emoji-add-btn-carousel') ||
        el.classList.contains('x-emoji-add-btn'))
    ) {
      continue
    }
    if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
      needsScan = true
      break
    }
  }
  if (needsScan) break
}
```

**Explanation**: Added a check to skip mutations caused by adding our own emoji buttons. This prevents the observer from triggering when we inject buttons into the DOM, avoiding potential recursive scanning. This is a **secondary fix** that improves performance.

## How the Fix Works

1. **Eliminates Duplicate Processing (PRIMARY)**: By filtering out nested elements before processing, we ensure each logical image is only processed once, even if multiple selectors match different parts of the same image structure.

2. **Prevents Redundant Scans (SECONDARY)**: By checking `isInjected(tgt)` for all attribute changes, we ensure that once an element is processed and marked as injected, subsequent attribute changes won't trigger another scan.

3. **Avoids Self-Triggering (SECONDARY)**: By filtering out our own button additions in the childList mutations, we prevent the observer from reacting to changes we make ourselves.

4. **Maintains Functionality**: The fix still allows:
   - New images to be detected and processed
   - Legitimate DOM changes (new carousels, new tweets) to trigger scans
   - Initial injection to work correctly
   - All existing selectors to continue working

## Testing Recommendations

To verify the fix works correctly:

1. **Manual Testing**:
   - Visit x.com/twitter.com with images
   - Scroll through a timeline with multiple images
   - Open image carousels/lightboxes
   - **Verify each image has exactly ONE emoji button** (not two!)
   - Change tabs, scroll, and interact with the page
   - Verify buttons don't duplicate

2. **Edge Cases to Test**:
   - Images in carousels
   - Standalone images on pbs.twimg.com
   - Images in dialogs/modals
   - Images in tweets with multiple images
   - Profile images (should be excluded)
   - SVG images (should be excluded)
   - Images with `data-testid="swipe-to-dismiss"`
   - Images in `article[data-testid="tweet"]`

3. **Performance Testing**:
   - Monitor console logs for `[XCarousel] Processed X carousel elements (Y total matched)`
   - The filtered count should be roughly half of the total matched count
   - Verify the count doesn't keep increasing for the same images
   - Check that the mutation observer isn't triggering excessive rescans

4. **Console Log Verification**:
   - Look for: `[XCarousel] Processed 5 carousel elements (10 total matched)`
   - This indicates the filtering is working (10 elements matched, but only 5 unique images processed)

## Related Files

- `src/content/x/image/carousel.ts` - Main file containing the fix
- `src/content/x/xImages.ts` - Initializes the carousel scanning
- `src/content/x/xMain.ts` - Entry point for x.com main pages
- `src/content/x/xMedia.ts` - Entry point for pbs.twimg.com media pages
- `src/content/x/utils.ts` - Utility functions including `isInjected()`

## Prevention

To prevent similar issues in the future:

1. **Be careful with overlapping CSS selectors**: When using multiple selectors that might match parent and child elements, always filter out nested matches
2. **Always check if elements are already processed** before re-processing them in mutation observers
3. **Filter out self-triggered mutations** to avoid recursive behavior
4. **Use WeakSet/WeakMap** for tracking processed elements (already implemented)
5. **Add comprehensive logging** during development to catch duplication early
6. **Test with mutation observer debugging** to understand what triggers rescans
7. **Log both matched and processed counts** to detect filtering issues

## Key Insight

The bug was caused by **selector overlap**, not just mutation observer issues. The selectors were designed to be comprehensive and catch images in various structures, but this meant they would often match both:
- The container element (e.g., `div[aria-label="Image"]`)
- The image element inside it (e.g., `img`)

This is a common pattern in web scraping/injection code and requires careful filtering to avoid duplicate processing.

## Commit Message

```
fix: prevent duplicate x.com image button injection

Fixed a bug where x.com images were being injected with exactly 2
duplicate emoji buttons. The root cause was overlapping CSS selectors
matching both container elements and their child img tags.

Primary fix:
- Filter out nested elements before processing in scanAndInjectCarousel
- Only process the outermost matched element in a hierarchy

Secondary fixes:
- Skip all attribute changes on elements marked as injected
- Filter out mutations caused by adding our own buttons
- Prevents redundant scans while maintaining functionality

Fixes: #issue-number (Image duplication on x.com/twitter.com)
```

