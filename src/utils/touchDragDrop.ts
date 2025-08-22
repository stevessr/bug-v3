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

  constructor(options: {
    onDragStart?: (element: HTMLElement) => void;
    onDragMove?: (element: HTMLElement, x: number, y: number) => void;
    onDragEnd?: (element: HTMLElement, dropTarget: HTMLElement | null) => void;
  }) {
    this.onDragStart = options.onDragStart;
    this.onDragMove = options.onDragMove;
    this.onDragEnd = options.onDragEnd;
  }

  addTouchEvents(element: HTMLElement, isDraggable: boolean = true) {
    if (!isDraggable) return;

    element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;

    this.state.isDragging = true;
    this.state.dragElement = target;
    this.state.startX = touch.clientX;
    this.state.startY = touch.clientY;
    this.state.currentX = touch.clientX;
    this.state.currentY = touch.clientY;

    // Create drag preview
    this.createDragPreview(target);

    if (this.onDragStart) {
      this.onDragStart(target);
    }
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
    this.resetState();
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
    if (this.state.dragPreview) {
      document.body.removeChild(this.state.dragPreview);
      this.state.dragPreview = null;
    }
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
    let current = element;
    while (current && current !== document.body) {
      if (current.classList.contains('group-item') || 
          current.classList.contains('emoji-item') ||
          current.hasAttribute('data-drop-target')) {
        return current;
      }
      current = current.parentElement;
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
    this.resetState();
  }
}