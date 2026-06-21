import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasicInfoData } from '../basic-info-step/basic-info-step.component';
import { RegistrationSetupData } from '../registration-setup-step/registration-setup-step.component';
import { RulesRewardsData } from '../rules-rewards-step/rules-rewards-step.component';

export interface ReviewSummaryData {
  basicInfo: BasicInfoData;
  registration: RegistrationSetupData;
  rulesRewards: RulesRewardsData;
}

@Component({
  selector: 'app-review-summary-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './review-summary-step.component.html',
  styleUrl: './review-summary-step.component.css'
})
export class ReviewSummaryStepComponent {
  data = input.required<ReviewSummaryData>();
  editStep = output<number>();

  onEditClick(step: number): void {
    this.editStep.emit(step);
  }

  getFormatLabel(format: string): string {
    const formatMap: { [key: string]: string } = {
      'SINGLE_ELIMINATION': 'Single Elimination',
      'ROUND_ROBIN': 'Round Robin',
      'GROUP_KNOCKOUT': 'Groups + KO'
    };
    return formatMap[format] || format;
  }

  getModeLabel(mode: string): string {
    return mode === 'AUTOMATIC' ? 'Automatic Approval' : 'Manual Approval';
  }

  getRatingLabel(isRated: boolean): string {
    return isRated ? 'Official Rated Match' : 'Practice / Casual';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'No deadline set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
