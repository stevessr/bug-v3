# X.com Image Duplication Bug Fix

## Problem Description

Images from x.com (Twitter) were being repeatedly injected with duplicate buttons in a stable pattern. Specifically, **exactly 2 buttons** would consistently appear for each image, creating a poor user experience.

### Update: Second Instance of Duplication

After the initial fix, a second duplication issue was discovered affecting regular tweet photos with `data-testid="tweetPhoto"`. The same pattern of exactly 2 buttons appearing at the same position was observed.

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

### Change 1: Add Missing Selectors for Tweet Photos (ADDITIONAL FIX)

**Location**: Lines 363-383 in `src/content/x/image/carousel.ts`

**Problem**: The selector list for `article[data-testid="tweet"]` was incomplete. It only had:
- `'article[data-testid="tweet"] div[aria-label="Image"]'`

But was missing selectors for:
- `div[data-testid="tweetPhoto"]` (the actual photo container)
- `div[style*="background-image"]` (background image divs)
- `img` (image tags)

This inconsistency meant that tweet photos weren't being properly matched and filtered.

**After**:
```typescript
const selectors = [
  // ... other selectors ...
  'article[data-testid="tweet"] div[aria-label="Image"]',
  'article[data-testid="tweet"] div[data-testid="tweetPhoto"]',  // NEW
  'article[data-testid="tweet"] div[style*="background-image"]',  // NEW
  'article[data-testid="tweet"] img'  // NEW
]
```

**Explanation**: Added the missing selectors to ensure tweet photos are properly detected and can be filtered by the ancestor-checking logic. This brings `article[data-testid="tweet"]` in line with all other container types which have three selectors each.

### Change 2: Update isInCarousel to Support tweetPhoto

**Location**: Lines 218-234 in `src/content/x/image/carousel.ts`

**Before**:
```typescript
function isInCarousel(el: Element): boolean {
  return !!(
    // ... other checks ...
    (el.closest('article[data-testid="tweet"]') &&
      (el.closest('div[aria-label="Image"]') || el.matches('div[aria-label="Image"]')))
  )
}
```

**After**:
```typescript
function isInCarousel(el: Element): boolean {
  return !!(
    // ... other checks ...
    (el.closest('article[data-testid="tweet"]') &&
      (el.closest('div[aria-label="Image"]') ||
        el.matches('div[aria-label="Image"]') ||
        el.closest('div[data-testid="tweetPhoto"]') ||  // NEW
        el.matches('div[data-testid="tweetPhoto"]')))   // NEW
  )
}
```

**Explanation**: Updated the `isInCarousel` function to recognize `div[data-testid="tweetPhoto"]` as a valid carousel container, ensuring these elements are processed correctly.

### Change 3: Filter Out Nested Elements in scanAndInjectCarousel (PRIMARY FIX)

**Location**: Lines 402-438 in `src/content/x/image/carousel.ts`

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
const skipped: Element[] = []

set.forEach(el => {
  let hasAncestorInSet = false
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    if (set.has(parent)) {
      hasAncestorInSet = true
      skipped.push(el)
      break
    }
    parent = parent.parentElement
  }
  if (!hasAncestorInSet) {
    filtered.add(el)
  }
})

// Log detailed information for debugging
if (skipped.length > 0) {
  console.log(
    `[XCarousel] Filtered out ${skipped.length} nested elements:`,
    skipped.map(el => ({
      tag: el.tagName,
      class: el.className,
      testid: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label')
    }))
  )
}

filtered.forEach(el => addCarouselButtonToEl(el))
console.log(`[XCarousel] Processed ${filtered.size} carousel elements (${set.size} total matched)`)
```

**Explanation**: This is the **primary fix** that solves the duplicate button issue. Before processing elements, we now filter out any element whose ancestor is also in the set. This ensures that for a structure like:
```html
<div aria-label="Image">  <!-- This will be processed -->
  <img src="...">         <!-- This will be filtered out -->
</div>
```
Or for tweet photos:
```html
<div data-testid="tweetPhoto">  <!-- This will be processed -->
  <div style="background-image: url(...)"></div>
  <img src="...">                <!-- This will be filtered out -->
</div>
```
Only the outermost container is processed, not both the container and its children. This prevents the double injection.

**Enhanced Debugging**: Added detailed logging to track which elements are being filtered out, including their tag name, class, data-testid, and aria-label. This helps diagnose any future duplication issues.

### Change 4: Skip All Attribute Changes on Injected Elements

**Location**: Lines 503-506 in `src/content/x/image/carousel.ts`

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

### Change 5: Skip Button Additions in childList Mutations

**Location**: Lines 478-485 in `src/content/x/image/carousel.ts`

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

1. **Complete Selector Coverage (NEW)**: By adding missing selectors for `article[data-testid="tweet"]`, we ensure tweet photos are properly detected and can be filtered like other image types.

2. **Proper Carousel Detection (NEW)**: By updating `isInCarousel` to recognize `div[data-testid="tweetPhoto"]`, we ensure tweet photos are treated as valid carousel containers.

3. **Eliminates Duplicate Processing (PRIMARY)**: By filtering out nested elements before processing, we ensure each logical image is only processed once, even if multiple selectors match different parts of the same image structure.

4. **Enhanced Debugging (NEW)**: Detailed logging shows which elements are being filtered out, making it easier to diagnose future issues.

5. **Prevents Redundant Scans (SECONDARY)**: By checking `isInjected(tgt)` for all attribute changes, we ensure that once an element is processed and marked as injected, subsequent attribute changes won't trigger another scan.

6. **Avoids Self-Triggering (SECONDARY)**: By filtering out our own button additions in the childList mutations, we prevent the observer from reacting to changes we make ourselves.

7. **Maintains Functionality**: The fix still allows:
   - New images to be detected and processed
   - Legitimate DOM changes (new carousels, new tweets) to trigger scans
   - Initial injection to work correctly
   - All existing selectors to continue working
   - Tweet photos with `data-testid="tweetPhoto"` to be properly handled

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
   - Look for: `[XCarousel] Filtered out X nested elements: [...]`
   - This shows which elements were skipped (should include IMG tags and nested divs)

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

## Key Insights

### Primary Issue: Selector Overlap

The bug was caused by **selector overlap**, not just mutation observer issues. The selectors were designed to be comprehensive and catch images in various structures, but this meant they would often match both:
- The container element (e.g., `div[aria-label="Image"]`, `div[data-testid="tweetPhoto"]`)
- The image element inside it (e.g., `img`)

This is a common pattern in web scraping/injection code and requires careful filtering to avoid duplicate processing.

### Secondary Issue: Incomplete Selector Coverage

The second instance of the bug revealed that `article[data-testid="tweet"]` had incomplete selector coverage. While other container types had three selectors each (div[aria-label], div[style*="background-image"], img), tweet articles only had one. This inconsistency meant:
1. Tweet photos weren't being properly matched by all relevant selectors
2. The filtering logic couldn't work correctly because not all elements were in the set
3. Adding the missing selectors allowed the existing filtering logic to work as intended

## Commit Message

```
fix: prevent duplicate x.com image button injection (including tweetPhoto)

Fixed a bug where x.com images were being injected with exactly 2
duplicate emoji buttons. The root cause was overlapping CSS selectors
matching both container elements and their child img tags, plus
incomplete selector coverage for tweet photos.

Primary fixes:
- Added missing selectors for article[data-testid="tweet"] images
  * div[data-testid="tweetPhoto"]
  * div[style*="background-image"]
  * img
- Updated isInCarousel to recognize tweetPhoto containers
- Filter out nested elements before processing in scanAndInjectCarousel
- Only process the outermost matched element in a hierarchy
- Added detailed debug logging for filtered elements

Secondary fixes:
- Skip all attribute changes on elements marked as injected
- Filter out mutations caused by adding our own buttons
- Prevents redundant scans while maintaining functionality

Fixes: #issue-number (Image duplication on x.com/twitter.com)
```

