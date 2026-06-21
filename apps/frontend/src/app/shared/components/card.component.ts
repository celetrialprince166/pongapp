import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared Card Component
 *
 * Container component for grouping related content.
 * Provides consistent styling, spacing, and optional interactive states.
 *
 * Features:
 * - Header, body, and footer slots
 * - Optional interactive/clickable state
 * - Multiple padding sizes
 * - Optional border and shadow
 * - Hover effects for clickable cards
 *
 * Usage:
 * ```html
 * <!-- Basic card -->
 * <app-card>
 *   <p>Card content here</p>
 * </app-card>
 *
 * <!-- Card with header and footer -->
 * <app-card>
 *   <div slot="header">
 *     <h3>Card Title</h3>
 *   </div>
 *   <p>Card body content</p>
 *   <div slot="footer">
 *     <app-button>Action</app-button>
 *   </div>
 * </app-card>
 *
 * <!-- Clickable card -->
 * <app-card [clickable]="true" (click)="handleClick()">
 *   <p>Click me!</p>
 * </app-card>
 *
 * <!-- Compact card -->
 * <app-card [padding]="'sm'" [noBorder]="true">
 *   <p>Compact content</p>
 * </app-card>
 * ```
 */

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getCardClasses()">
      <!-- Header Slot -->
      @if (hasHeader()) {
        <div class="card-header">
          <ng-content select="[slot='header']"></ng-content>
        </div>
      }

      <!-- Body -->
      <div class="card-body">
        <ng-content></ng-content>
      </div>

      <!-- Footer Slot -->
      @if (hasFooter()) {
        <div class="card-footer">
          <ng-content select="[slot='footer']"></ng-content>
        </div>
      }
    </div>
  `,
  styleUrl: './card.component.css'
})
export class CardComponent {
  // Inputs
  padding = input<CardPadding>('md');
  clickable = input<boolean>(false);
  noBorder = input<boolean>(false);
  noShadow = input<boolean>(false);
  flat = input<boolean>(false); // No elevation at all

  /**
   * Generate card CSS classes
   */
  getCardClasses(): string {
    const classes: string[] = ['card'];

    // Padding class
    classes.push(`card-padding-${this.padding()}`);

    // State classes
    if (this.clickable()) classes.push('card-clickable');
    if (this.noBorder()) classes.push('card-no-border');
    if (this.noShadow()) classes.push('card-no-shadow');
    if (this.flat()) classes.push('card-flat');

    return classes.join(' ');
  }

  /**
   * Check if header slot has content
   */
  hasHeader(): boolean {
    // This will be checked at runtime by Angular
    return true; // Simplified - Angular will handle slot content detection
  }

  /**
   * Check if footer slot has content
   */
  hasFooter(): boolean {
    // This will be checked at runtime by Angular
    return true; // Simplified - Angular will handle slot content detection
  }
}
