// Lightweight touch drag helper for reordering items and cross-list moves.
// Usage: attachTouchDrag(document, '.item-selector', { onDrop: ({fromContainer, fromIndex, toContainer, toIndex, item}) => {} })

type DropInfo = {
  fromContainer: Element | null;
  fromIndex: number;
  toContainer: Element | null;
  toIndex: number;
  item: Element;
};

export function attachTouchDrag(root: Element | Document, itemSelector: string, opts: { onDrop: (info: DropInfo) => void }) {
  let draggingEl: Element | null = null;
  let placeholder: HTMLElement | null = null;
  let originContainer: Element | null = null;
  let originIndex = -1;

  function findItemEl(el: Element | null) {
    while (el && el !== (root as Element)) {
      if ((el as Element).matches && (el as Element).matches(itemSelector)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function onTouchStart(e: TouchEvent) {
    if (!e.target) return;
    const t = e.target as Element;
    const item = findItemEl(t);
    if (!item) return;
    e.preventDefault();
    draggingEl = item;
    originContainer = item.parentElement;
    originIndex = indexWithinParent(item);

    // create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'touch-drag-placeholder';
    placeholder.style.height = (item as HTMLElement).getBoundingClientRect().height + 'px';
    placeholder.style.background = 'rgba(0,0,0,0.04)';
    placeholder.style.border = '1px dashed rgba(0,0,0,0.08)';
    placeholder.style.boxSizing = 'border-box';

    item.parentElement?.insertBefore(placeholder, item.nextSibling);

    // make dragged element fixed so it follows touch
    (item as HTMLElement).style.transition = 'none';
    (item as HTMLElement).style.position = 'fixed';
    (item as HTMLElement).style.left = item.getBoundingClientRect().left + 'px';
    (item as HTMLElement).style.top = item.getBoundingClientRect().top + 'px';
    (item as HTMLElement).style.width = item.getBoundingClientRect().width + 'px';
    (item as HTMLElement).style.zIndex = '9999';
    (item as HTMLElement).style.pointerEvents = 'none';

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function onTouchMove(e: TouchEvent) {
    if (!draggingEl) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = draggingEl as HTMLElement;
    el.style.left = touch.clientX - el.offsetWidth / 2 + 'px';
    el.style.top = touch.clientY - el.offsetHeight / 2 + 'px';

    // find element under the touch
    const target = document.elementFromPoint(touch.clientX, touch.clientY) as Element | null;
    const overItem = findItemEl(target);
    if (overItem && placeholder && overItem.parentElement) {
      const rect = overItem.getBoundingClientRect();
      const before = (touch.clientY < rect.top + rect.height / 2);
      const parent = overItem.parentElement;
      if (before) parent.insertBefore(placeholder, overItem);
      else parent.insertBefore(placeholder, overItem.nextSibling);
    } else if (target && target instanceof Element) {
      // if over a container but not an item, append at end
      const container = findClosestContainer(target);
      if (container && placeholder && container !== placeholder.parentElement) {
        container.appendChild(placeholder);
      }
    }
  }

  function onTouchEnd(_e: TouchEvent) {
    if (!draggingEl || !placeholder) return cleanup();

    const toContainer = placeholder.parentElement;
    const toIndex = indexWithinParent(placeholder);

    // remove placeholder and restore dragged element
    const dragged = draggingEl;
    cleanup();

    // call drop callback
    opts.onDrop({
      fromContainer: originContainer,
      fromIndex: originIndex,
      toContainer: toContainer,
      toIndex: toIndex,
      item: dragged,
    });
  }

  function cleanup() {
    if (draggingEl) {
      // remove inline styles
      const el = draggingEl as HTMLElement;
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
      el.style.zIndex = '';
      el.style.pointerEvents = '';
      el.style.transition = '';
    }
    if (placeholder && placeholder.parentElement) {
      placeholder.parentElement.removeChild(placeholder);
    }
    placeholder = null;
    draggingEl = null;
    originContainer = null;
    originIndex = -1;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }

  function indexWithinParent(node: Element | null) {
    if (!node || !node.parentElement) return -1;
    return Array.prototype.indexOf.call(node.parentElement.children, node);
  }

  function findClosestContainer(el: Element | null) {
    while (el && el !== (root as Element)) {
      if (el instanceof Element && el.children && el.children.length) return el;
      el = el.parentElement;
    }
    return null;
  }

  // bind with Event and assert to TouchEvent inside handlers to avoid TS errors
  const boundTouchStart = (ev: Event) => onTouchStart(ev as TouchEvent);
  const boundTouchMove = (ev: Event) => onTouchMove(ev as TouchEvent);
  const boundTouchEnd = (ev: Event) => onTouchEnd(ev as TouchEvent);

  root.addEventListener('touchstart', boundTouchStart as EventListener, { passive: false } as AddEventListenerOptions);

  return {
    detach() {
      root.removeEventListener('touchstart', onTouchStart as EventListener);
      document.removeEventListener('touchmove', onTouchMove as EventListener);
      document.removeEventListener('touchend', onTouchEnd as EventListener);
    }
  };
}
