import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

/**
 * Shared Badge Component
 *
 * Small status or count indicator with consistent styling.
 * Used for labels, tags, status indicators, and notification counts.
 *
 * Features:
 * - Multiple variants (primary, success, warning, danger, info, neutral)
 * - Multiple sizes (sm, md, lg)
 * - Optional icon support
 * - Rounded or pill-shaped
 * - Dot indicator mode
 *
 * Usage:
 * ```html
 * <!-- Status badge -->
 * <app-badge variant="success">Active</app-badge>
 *
 * <!-- Count badge -->
 * <app-badge variant="danger" size="sm">5</app-badge>
 *
 * <!-- With icon -->
 * <app-badge variant="warning" [icon]="AlertTriangle">Pending</app-badge>
 *
 * <!-- Dot indicator -->
 * <app-badge variant="success" [dot]="true">Online</app-badge>
 *
 * <!-- Pill shape -->
 * <app-badge variant="primary" [pill]="true">New</app-badge>
 * ```
 */

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <span [class]="getBadgeClasses()" role="status">
      @if (dot()) {
        <span class="badge-dot"></span>
      }
      @if (icon() && !dot()) {
        <lucide-icon [img]="icon()!" [size]="getIconSize()" class="badge-icon"></lucide-icon>
      }
      <span class="badge-content">
        <ng-content></ng-content>
      </span>
    </span>
  `,
  styleUrl: './badge.component.css'
})
export class BadgeComponent {
  // Inputs
  variant = input<BadgeVariant>('neutral');
  size = input<BadgeSize>('md');
  icon = input<LucideIconData | null>(null);
  dot = input<boolean>(false);
  pill = input<boolean>(false);

  /**
   * Generate badge CSS classes
   */
  getBadgeClasses(): string {
    const classes: string[] = ['badge'];

    // Variant class
    classes.push(`badge-${this.variant()}`);

    // Size class
    classes.push(`badge-${this.size()}`);

    // Shape
    if (this.pill()) classes.push('badge-pill');

    // States
    if (this.dot()) classes.push('badge-with-dot');
    if (this.icon()) classes.push('badge-with-icon');

    return classes.join(' ');
  }

  /**
   * Get icon size based on badge size
   */
  getIconSize(): number {
    const sizes = {
      sm: 12,
      md: 14,
      lg: 16
    };
    return sizes[this.size()];
  }
}
