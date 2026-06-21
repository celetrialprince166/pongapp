import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface RegistrationSetupData {
  mode: 'AUTOMATIC' | 'MANUAL';
  hasDeadline: boolean;
  deadline?: string;
  isFree: boolean;
  entryFee?: number;
  notes?: string;
}

@Component({
  selector: 'app-registration-setup-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registration-setup-step.component.html',
  styleUrl: './registration-setup-step.component.css'
})
export class RegistrationSetupStepComponent {
  data = input.required<RegistrationSetupData>();
  dataChange = output<RegistrationSetupData>();

  updateField(field: keyof RegistrationSetupData, value: any): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value
    });
  }

  toggleMode(mode: 'AUTOMATIC' | 'MANUAL'): void {
    this.updateField('mode', mode);
  }

  toggleDeadline(hasDeadline: boolean): void {
    this.updateField('hasDeadline', hasDeadline);
    if (!hasDeadline) {
      this.updateField('deadline', undefined);
    }
  }

  toggleFee(isFree: boolean): void {
    this.updateField('isFree', isFree);
    if (isFree) {
      this.updateField('entryFee', undefined);
    }
  }

  getCharacterCount(): number {
    return this.data().notes?.length || 0;
  }

  getMinDeadlineDate(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
}
