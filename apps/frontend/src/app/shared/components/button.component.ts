import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

/**
 * Shared Button Component
 *
 * Reusable button with consistent styling across the application.
 * Supports multiple variants, sizes, icons, and loading states.
 *
 * Usage:
 * ```html
 * <app-button variant="primary" size="md" (clicked)="handleClick()">
 *   Click Me
 * </app-button>
 *
 * <app-button variant="secondary" [icon]="Plus" [loading]="isLoading()">
 *   Add Item
 * </app-button>
 * ```
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="getButtonClasses()"
      (click)="handleClick($event)">
      @if (loading()) {
        <span class="button-loader"></span>
      }
      @if (icon() && !loading()) {
        <lucide-icon [img]="icon()!" [size]="getIconSize()" class="button-icon"></lucide-icon>
      }
      <span class="button-content">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styleUrl: './button.component.css'
})
export class ButtonComponent {
  // Inputs
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  icon = input<LucideIconData | null>(null);
  type = input<'button' | 'submit' | 'reset'>('button');
  fullWidth = input<boolean>(false);

  // Outputs
  clicked = output<MouseEvent>();

  /**
   * Generate button CSS classes based on props
   */
  getButtonClasses(): string {
    const classes: string[] = ['button'];

    // Variant class
    classes.push(`button-${this.variant()}`);

    // Size class
    classes.push(`button-${this.size()}`);

    // State classes
    if (this.loading()) classes.push('button-loading');
    if (this.disabled()) classes.push('button-disabled');
    if (this.fullWidth()) classes.push('button-full-width');
    if (this.icon() && !this.loading()) classes.push('button-with-icon');

    return classes.join(' ');
  }

  /**
   * Get icon size based on button size
   */
  getIconSize(): number {
    const sizes = {
      sm: 14,
      md: 16,
      lg: 20
    };
    return sizes[this.size()];
  }

  /**
   * Handle click event
   */
  handleClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
