// Touch drag and drop utility for mobile devices
export interface TouchDragState {
  isDragging: boolean;
  dragElement: HTMLElement | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dragPreview: HTMLElement | null;
}

export class TouchDragHandler {
  private state: TouchDragState = {
    isDragging: false,
    dragElement: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragPreview: null,
  };

  private onDragStart?: (element: HTMLElement) => void;
  private onDragMove?: (element: HTMLElement, x: number, y: number) => void;
  private onDragEnd?: (element: HTMLElement, dropTarget: HTMLElement | null) => void;
  // Optional callback to decide whether a touchstart should begin a drag
  private shouldStartDrag?: (e: TouchEvent, element: HTMLElement) => boolean;
  // bound handlers so we can remove listeners added to document
  private boundTouchMove: ((e: TouchEvent) => void) | null = null;
  private boundTouchEnd: ((e: TouchEvent) => void) | null = null;
  private boundTouchCancel: ((e: TouchEvent) => void) | null = null;

  constructor(options: {
    onDragStart?: (element: HTMLElement) => void;
    onDragMove?: (element: HTMLElement, x: number, y: number) => void;
    onDragEnd?: (element: HTMLElement, dropTarget: HTMLElement | null) => void;
    shouldStartDrag?: (e: TouchEvent, element: HTMLElement) => boolean;
  }) {
    this.onDragStart = options.onDragStart;
    this.onDragMove = options.onDragMove;
    this.onDragEnd = options.onDragEnd;
    this.shouldStartDrag = options.shouldStartDrag;
  }

  addTouchEvents(element: HTMLElement, isDraggable: boolean = true) {
    if (!isDraggable) return;

  // Only listen for touchstart on the element. During touchstart we'll attach
  // move/end/cancel listeners to document so they fire even if the finger
  // leaves the original element.
  element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    // Allow caller to decide whether this touchstart should start a drag
    const target = e.currentTarget as HTMLElement;
    if (this.shouldStartDrag && !this.shouldStartDrag(e, target)) {
      return;
    }

    e.preventDefault();
    const touch = e.touches[0];

    this.state.isDragging = true;
    this.state.dragElement = target;
    this.state.startX = touch.clientX;
    this.state.startY = touch.clientY;
    this.state.currentX = touch.clientX;
    this.state.currentY = touch.clientY;

  // Ensure any leftover previews are removed, then create drag preview
  this.cleanupDragPreview();
  this.createDragPreview(target);

    if (this.onDragStart) {
      this.onDragStart(target);
    }
  // Attach document-level listeners to follow the touch until it ends
  this.boundTouchMove = this.handleTouchMove.bind(this);
  this.boundTouchEnd = this.handleTouchEnd.bind(this);
  this.boundTouchCancel = this.handleTouchCancel.bind(this);
  document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
  document.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  document.addEventListener('touchcancel', this.boundTouchCancel, { passive: false });
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.state.isDragging || !this.state.dragElement) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    this.state.currentX = touch.clientX;
    this.state.currentY = touch.clientY;

    // Update drag preview position
    if (this.state.dragPreview) {
      this.state.dragPreview.style.left = `${this.state.currentX - 50}px`;
      this.state.dragPreview.style.top = `${this.state.currentY - 50}px`;
    }

    if (this.onDragMove) {
      this.onDragMove(this.state.dragElement, this.state.currentX, this.state.currentY);
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (!this.state.isDragging || !this.state.dragElement) return;

    e.preventDefault();
    
    // Find drop target
    const dropTarget = this.findDropTarget(this.state.currentX, this.state.currentY);
    
    if (this.onDragEnd) {
      this.onDragEnd(this.state.dragElement, dropTarget);
    }

    // Clean up
    this.cleanupDragPreview();
  this.removeDocumentListeners();
  this.resetState();
  }

  private handleTouchCancel(e: TouchEvent) {
    // Called when the system cancels the touch (e.g., incoming call, gesture)
    if (!this.state.isDragging) return;
    e.preventDefault();
    this.cleanupDragPreview();
    this.removeDocumentListeners();
    this.resetState();
  }

  private removeDocumentListeners() {
    if (this.boundTouchMove) {
      document.removeEventListener('touchmove', this.boundTouchMove);
      this.boundTouchMove = null;
    }
    if (this.boundTouchEnd) {
      document.removeEventListener('touchend', this.boundTouchEnd);
      this.boundTouchEnd = null;
    }
    if (this.boundTouchCancel) {
      document.removeEventListener('touchcancel', this.boundTouchCancel);
      this.boundTouchCancel = null;
    }
  }

  private createDragPreview(element: HTMLElement) {
    const preview = element.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '9999';
    preview.style.opacity = '0.8';
    preview.style.transform = 'scale(0.8)';
    preview.style.left = `${this.state.currentX - 50}px`;
    preview.style.top = `${this.state.currentY - 50}px`;
    preview.classList.add('touch-drag-preview');
    
    document.body.appendChild(preview);
    this.state.dragPreview = preview;
  }

  private cleanupDragPreview() {
    // Remove any preview elements left in the DOM to avoid stale floating nodes
    try {
      const previews = Array.from(document.querySelectorAll('.touch-drag-preview')) as HTMLElement[];
      previews.forEach((p) => {
        if (p.parentElement) p.parentElement.removeChild(p);
      });
    } catch (err) {
      // ignore DOM errors
    }
    this.state.dragPreview = null;
  }

  private findDropTarget(x: number, y: number): HTMLElement | null {
    // Temporarily hide the drag preview to get the element underneath
    if (this.state.dragPreview) {
      this.state.dragPreview.style.display = 'none';
    }
    
    const elementBelow = document.elementFromPoint(x, y) as HTMLElement;
    
    if (this.state.dragPreview) {
      this.state.dragPreview.style.display = '';
    }

    // Find the closest drop target (group item or emoji item)
    return this.findClosestDropTarget(elementBelow);
  }

  private findClosestDropTarget(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;

    // Look for group items or emoji items
    let current: HTMLElement | null = element;
    while (current && current !== document.body) {
      if (
        current.classList.contains('group-item') ||
        current.classList.contains('emoji-item') ||
        current.hasAttribute('data-drop-target')
      ) {
        return current;
      }
      current = current.parentElement as HTMLElement | null;
    }
    
    return null;
  }

  private resetState() {
    this.state = {
      isDragging: false,
      dragElement: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dragPreview: null,
    };
  }

  destroy() {
  this.cleanupDragPreview();
  this.removeDocumentListeners();
  this.resetState();
  }
}