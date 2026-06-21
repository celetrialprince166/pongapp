import { Component, input, output, effect, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

/**
 * Shared Modal Component
 *
 * Accessible modal dialog with focus trap, backdrop, and keyboard support.
 * Follows WAI-ARIA dialog pattern for accessibility.
 *
 * Features:
 * - Focus trap (focus stays within modal)
 * - Escape key to close
 * - Backdrop click to close (optional)
 * - Proper ARIA attributes
 * - Smooth animations
 * - Multiple sizes
 *
 * Usage:
 * ```html
 * <app-modal
 *   [open]="showModal()"
 *   [title]="'Confirm Action'"
 *   [size]="'md'"
 *   (closed)="onModalClose()">
 *   <p>Are you sure you want to proceed?</p>
 *   <div slot="footer">
 *     <app-button variant="secondary" (clicked)="onCancel()">Cancel</app-button>
 *     <app-button variant="primary" (clicked)="onConfirm()">Confirm</app-button>
 *   </div>
 * </app-modal>
 * ```
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (open()) {
      <div class="modal-backdrop" (click)="onBackdropClick()" [@fadeIn]>
        <div
          #modalContent
          class="modal-content"
          [class]="getModalClasses()"
          (click)="$event.stopPropagation()"
          role="dialog"
          [attr.aria-modal]="true"
          [attr.aria-labelledby]="title() ? 'modal-title' : null"
          [@slideIn]>

          <!-- Header -->
          <div class="modal-header">
            @if (title()) {
              <h2 id="modal-title" class="modal-title">{{ title() }}</h2>
            }
            @if (showClose()) {
              <button
                class="modal-close"
                (click)="close()"
                aria-label="Close modal"
                type="button">
                <lucide-icon [img]="X" [size]="20"></lucide-icon>
              </button>
            }
          </div>

          <!-- Body -->
          <div class="modal-body">
            <ng-content></ng-content>
          </div>

          <!-- Footer -->
          @if (hasFooter()) {
            <div class="modal-footer">
              <ng-content select="[slot='footer']"></ng-content>
            </div>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './modal.component.css',
  animations: [] // Animations defined in CSS
})
export class ModalComponent {
  // Inputs
  open = input<boolean>(false);
  title = input<string>('');
  size = input<ModalSize>('md');
  showClose = input<boolean>(true);
  closeOnBackdrop = input<boolean>(true);
  closeOnEscape = input<boolean>(true);

  // Outputs
  closed = output<void>();

  // Icons
  readonly X = X;

  // Internal state
  @ViewChild('modalContent') modalContent?: ElementRef<HTMLDivElement>;
  private previouslyFocusedElement: HTMLElement | null = null;
  hasFooter = signal(false);

  constructor(private elementRef: ElementRef) {
    // Handle open/close state changes
    effect(() => {
      if (this.open()) {
        this.onOpen();
      } else {
        this.onClose();
      }
    });
  }

  /**
   * Get modal CSS classes based on size
   */
  getModalClasses(): string {
    return `modal-${this.size()}`;
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.close();
    }
  }

  /**
   * Close modal
   */
  close(): void {
    this.closed.emit();
  }

  /**
   * Handle modal opening
   */
  private onOpen(): void {
    // Store currently focused element
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add keyboard listener
    document.addEventListener('keydown', this.handleKeyDown);

    // Focus first focusable element in modal
    setTimeout(() => {
      this.focusFirstElement();
    }, 100);

    // Check if footer slot has content
    setTimeout(() => {
      const footerSlot = this.elementRef.nativeElement.querySelector('[slot="footer"]');
      this.hasFooter.set(!!footerSlot && footerSlot.children.length > 0);
    }, 0);
  }

  /**
   * Handle modal closing
   */
  private onClose(): void {
    // Restore body scroll
    document.body.style.overflow = '';

    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleKeyDown);

    // Restore focus
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    // Close on Escape
    if (event.key === 'Escape' && this.closeOnEscape()) {
      event.preventDefault();
      this.close();
      return;
    }

    // Trap focus within modal
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  };

  /**
   * Focus first focusable element in modal
   */
  private focusFirstElement(): void {
    try {
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    } catch (error) {
      console.warn('Failed to focus first element in modal:', error);
      // Fallback: try to focus the modal content itself
      try {
        this.modalContent?.nativeElement.focus();
      } catch (fallbackError) {
        console.warn('Failed to focus modal content:', fallbackError);
      }
    }
  }

  /**
   * Trap focus within modal
   */
  private trapFocus(event: KeyboardEvent): void {
    try {
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    } catch (error) {
      console.warn('Failed to trap focus in modal:', error);
      // Allow default tab behavior if focus trap fails
    }
  }

  /**
   * Get all focusable elements within modal
   */
  private getFocusableElements(): HTMLElement[] {
    try {
      if (!this.modalContent) return [];

      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const elements = this.modalContent.nativeElement.querySelectorAll(selector);
      return Array.from(elements) as HTMLElement[];
    } catch (error) {
      console.warn('Failed to get focusable elements in modal:', error);
      return [];
    }
  }
}
