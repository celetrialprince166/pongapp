import { Component, input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule, LucideIconData, AlertCircle } from 'lucide-angular';

/**
 * Shared Form Input Component
 *
 * Reusable form input with consistent styling, validation, and accessibility.
 * Implements ControlValueAccessor for Angular forms integration.
 *
 * Features:
 * - Multiple input types (text, email, password, number, textarea)
 * - Label and placeholder support
 * - Error message display
 * - Helper text
 * - Icon support (prefix/suffix)
 * - Disabled and readonly states
 * - Full accessibility (ARIA labels, descriptions)
 * - Form integration (works with ngModel and Reactive Forms)
 *
 * Usage:
 * ```html
 * <!-- With ngModel -->
 * <app-form-input
 *   [(ngModel)]="username"
 *   [label]="'Username'"
 *   [placeholder]="'Enter your username'"
 *   [error]="usernameError()">
 * </app-form-input>
 *
 * <!-- With icon -->
 * <app-form-input
 *   [(ngModel)]="email"
 *   [label]="'Email'"
 *   [type]="'email'"
 *   [prefixIcon]="Mail"
 *   [error]="emailError()">
 * </app-form-input>
 *
 * <!-- Textarea -->
 * <app-form-input
 *   [(ngModel)]="description"
 *   [label]="'Description'"
 *   [inputType]="'textarea'"
 *   [rows]="4">
 * </app-form-input>
 * ```
 */

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'textarea';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="form-input-wrapper" [class.has-error]="error()">
      <!-- Label -->
      @if (label()) {
        <label [for]="inputId" class="form-label">
          {{ label() }}
          @if (required()) {
            <span class="required-indicator" aria-label="required">*</span>
          }
        </label>
      }

      <!-- Input Container -->
      <div class="input-container">
        <!-- Prefix Icon -->
        @if (prefixIcon()) {
          <div class="input-icon input-icon-prefix">
            <lucide-icon [img]="prefixIcon()!" [size]="18"></lucide-icon>
          </div>
        }

        <!-- Text Input -->
        @if (inputType() !== 'textarea') {
          <input
            [id]="inputId"
            [type]="inputType()"
            [placeholder]="placeholder()"
            [disabled]="isDisabled"
            [readonly]="readonly()"
            [required]="required()"
            [attr.aria-invalid]="error() ? 'true' : null"
            [attr.aria-describedby]="getAriaDescribedBy()"
            [class]="getInputClasses()"
            [(ngModel)]="value"
            (ngModelChange)="onValueChange($event)"
            (blur)="onTouched()" />
        }

        <!-- Textarea -->
        @if (inputType() === 'textarea') {
          <textarea
            [id]="inputId"
            [placeholder]="placeholder()"
            [disabled]="isDisabled"
            [readonly]="readonly()"
            [required]="required()"
            [rows]="rows()"
            [attr.aria-invalid]="error() ? 'true' : null"
            [attr.aria-describedby]="getAriaDescribedBy()"
            [class]="getInputClasses()"
            [(ngModel)]="value"
            (ngModelChange)="onValueChange($event)"
            (blur)="onTouched()"></textarea>
        }

        <!-- Suffix Icon -->
        @if (suffixIcon()) {
          <div class="input-icon input-icon-suffix">
            <lucide-icon [img]="suffixIcon()!" [size]="18"></lucide-icon>
          </div>
        }

        <!-- Error Icon -->
        @if (error() && !suffixIcon()) {
          <div class="input-icon input-icon-suffix error-icon">
            <lucide-icon [img]="AlertCircle" [size]="18"></lucide-icon>
          </div>
        }
      </div>

      <!-- Helper Text -->
      @if (helperText() && !error()) {
        <p [id]="helperId" class="helper-text">{{ helperText() }}</p>
      }

      <!-- Error Message -->
      @if (error()) {
        <p [id]="errorId" class="error-message" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styleUrl: './form-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormInputComponent),
      multi: true
    }
  ]
})
export class FormInputComponent implements ControlValueAccessor {
  // Inputs
  label = input<string>('');
  placeholder = input<string>('');
  inputType = input<InputType>('text');
  error = input<string>('');
  helperText = input<string>('');
  required = input<boolean>(false);
  readonly = input<boolean>(false);
  rows = input<number>(3); // For textarea
  prefixIcon = input<LucideIconData | null>(null);
  suffixIcon = input<LucideIconData | null>(null);

  // Icons
  readonly AlertCircle = AlertCircle;

  // Unique IDs for accessibility
  private static nextId = 0;
  inputId = `form-input-${FormInputComponent.nextId++}`;
  errorId = `${this.inputId}-error`;
  helperId = `${this.inputId}-helper`;

  // Internal state
  value: any = '';
  isDisabled = false;

  // ControlValueAccessor callbacks
  private onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  /**
   * Get input CSS classes
   */
  getInputClasses(): string {
    const classes = ['form-input'];

    if (this.prefixIcon()) classes.push('has-prefix-icon');
    if (this.suffixIcon() || this.error()) classes.push('has-suffix-icon');
    if (this.error()) classes.push('input-error');
    if (this.readonly()) classes.push('input-readonly');

    return classes.join(' ');
  }

  /**
   * Get ARIA described by attribute
   */
  getAriaDescribedBy(): string | null {
    const ids: string[] = [];

    if (this.helperText() && !this.error()) {
      ids.push(this.helperId);
    }

    if (this.error()) {
      ids.push(this.errorId);
    }

    return ids.length > 0 ? ids.join(' ') : null;
  }

  /**
   * Handle value change
   */
  onValueChange(value: any): void {
    this.onChange(value);
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}
