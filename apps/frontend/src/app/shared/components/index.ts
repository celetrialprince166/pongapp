/**
 * Shared Components Index
 *
 * Barrel export file for all shared/reusable components.
 * Import components from this file for cleaner imports.
 *
 * Usage:
 * ```typescript
 * import { ButtonComponent, ModalComponent, BadgeComponent } from '@shared/components';
 * ```
 */

// Core UI Components
export { ButtonComponent } from './button.component';
export type { ButtonVariant, ButtonSize } from './button.component';

export { ModalComponent } from './modal.component';
export type { ModalSize } from './modal.component';

export { BadgeComponent } from './badge.component';
export type { BadgeVariant, BadgeSize } from './badge.component';

export { CardComponent } from './card.component';
export type { CardPadding } from './card.component';

// Form Components
export { FormInputComponent } from './form-input.component';
export type { InputType } from './form-input.component';

// Navigation Components
export { PaginationComponent } from './pagination.component';
export type { PageChangeEvent } from './pagination.component';
