import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-angular';

/**
 * Shared Pagination Component
 *
 * Accessible pagination control with multiple navigation options.
 * Supports page numbers, next/previous, and first/last page navigation.
 *
 * Features:
 * - Page number display
 * - Next/Previous buttons
 * - First/Last page buttons
 * - Current page indicator
 * - Total items and page info
 * - Keyboard navigation
 * - Customizable page size
 * - Disabled states
 *
 * Usage:
 * ```html
 * <app-pagination
 *   [currentPage]="page()"
 *   [totalItems]="totalCount()"
 *   [pageSize]="10"
 *   [showFirstLast]="true"
 *   (pageChanged)="onPageChange($event)">
 * </app-pagination>
 * ```
 */

export interface PageChangeEvent {
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="pagination" role="navigation" aria-label="Pagination">
      <!-- Items Info -->
      <div class="pagination-info">
        Showing {{ startItem() }}-{{ endItem() }} of {{ totalItems() }}
      </div>

      <!-- Page Controls -->
      <div class="pagination-controls">
        <!-- First Page -->
        @if (showFirstLast()) {
          <button
            class="pagination-button"
            [disabled]="isFirstPage()"
            (click)="goToPage(1)"
            aria-label="Go to first page"
            title="First page">
            <lucide-icon [img]="ChevronsLeft" [size]="16"></lucide-icon>
          </button>
        }

        <!-- Previous Page -->
        <button
          class="pagination-button"
          [disabled]="isFirstPage()"
          (click)="goToPage(currentPage() - 1)"
          aria-label="Go to previous page"
          title="Previous page">
          <lucide-icon [img]="ChevronLeft" [size]="16"></lucide-icon>
        </button>

        <!-- Page Numbers -->
        <div class="page-numbers">
          @for (page of visiblePages(); track page) {
            @if (page === -1) {
              <span class="page-ellipsis">...</span>
            } @else {
              <button
                class="page-button"
                [class.active]="page === currentPage()"
                [attr.aria-current]="page === currentPage() ? 'page' : null"
                (click)="goToPage(page)">
                {{ page }}
              </button>
            }
          }
        </div>

        <!-- Next Page -->
        <button
          class="pagination-button"
          [disabled]="isLastPage()"
          (click)="goToPage(currentPage() + 1)"
          aria-label="Go to next page"
          title="Next page">
          <lucide-icon [img]="ChevronRight" [size]="16"></lucide-icon>
        </button>

        <!-- Last Page -->
        @if (showFirstLast()) {
          <button
            class="pagination-button"
            [disabled]="isLastPage()"
            (click)="goToPage(totalPages())"
            aria-label="Go to last page"
            title="Last page">
            <lucide-icon [img]="ChevronsRight" [size]="16"></lucide-icon>
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './pagination.component.css'
})
export class PaginationComponent {
  // Inputs
  currentPage = input<number>(1);
  totalItems = input<number>(0);
  pageSize = input<number>(10);
  showFirstLast = input<boolean>(true);
  maxVisiblePages = input<number>(5);

  // Outputs
  pageChanged = output<PageChangeEvent>();

  // Icons
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly ChevronsLeft = ChevronsLeft;
  readonly ChevronsRight = ChevronsRight;

  // Computed values
  totalPages = computed(() => {
    const pageSize = this.pageSize();
    const totalItems = this.totalItems();

    // Guard against zero page size or zero items
    if (pageSize <= 0 || totalItems <= 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(totalItems / pageSize));
  });

  startItem = computed(() => {
    const totalItems = this.totalItems();

    // Return 0 for empty data set
    if (totalItems === 0) {
      return 0;
    }

    return Math.min((this.currentPage() - 1) * this.pageSize() + 1, totalItems);
  });

  endItem = computed(() => {
    const totalItems = this.totalItems();

    // Return 0 for empty data set
    if (totalItems === 0) {
      return 0;
    }

    return Math.min(this.currentPage() * this.pageSize(), totalItems);
  });
  isFirstPage = computed(() => this.currentPage() === 1);
  isLastPage = computed(() => this.currentPage() >= this.totalPages());

  /**
   * Calculate visible page numbers with ellipsis
   */
  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const max = this.maxVisiblePages();

    if (total <= max) {
      // Show all pages
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const halfMax = Math.floor(max / 2);

    // Always show first page
    pages.push(1);

    let start: number;
    let end: number;

    if (current <= halfMax + 1) {
      // Near the start
      start = 2;
      end = max - 1;
    } else if (current >= total - halfMax) {
      // Near the end
      start = total - max + 2;
      end = total - 1;
    } else {
      // In the middle
      start = current - halfMax + 1;
      end = current + halfMax - 1;
    }

    // Add ellipsis after first page if needed
    if (start > 2) {
      pages.push(-1); // Ellipsis marker
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (end < total - 1) {
      pages.push(-1); // Ellipsis marker
    }

    // Always show last page
    if (total > 1) {
      pages.push(total);
    }

    return pages;
  });

  /**
   * Navigate to specific page
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.pageChanged.emit({
      page,
      pageSize: this.pageSize()
    });
  }
}
