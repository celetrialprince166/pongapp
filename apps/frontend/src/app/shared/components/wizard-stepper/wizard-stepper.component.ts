import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WizardStep {
  number: number;
  label: string;
  completed: boolean;
  active: boolean;
}

@Component({
  selector: 'app-wizard-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wizard-stepper.component.html',
  styleUrl: './wizard-stepper.component.css'
})
export class WizardStepperComponent {
  steps = input.required<WizardStep[]>();
  stepClick = output<number>();

  onStepClick(stepNumber: number, completed: boolean): void {
    // Only allow clicking on completed steps
    if (completed) {
      this.stepClick.emit(stepNumber);
    }
  }

  isLastStep(index: number): boolean {
    return index === this.steps().length - 1;
  }
}
