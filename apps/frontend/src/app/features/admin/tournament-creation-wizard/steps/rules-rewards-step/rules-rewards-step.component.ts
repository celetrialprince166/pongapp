import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PrizeData {
  points: number;
  prize: string;
}

export interface RulesRewardsData {
  isRated: boolean;
  prizes: {
    first: PrizeData;
    second: PrizeData;
    third: PrizeData;
  };
  specialRules?: string;
}

@Component({
  selector: 'app-rules-rewards-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rules-rewards-step.component.html',
  styleUrl: './rules-rewards-step.component.css'
})
export class RulesRewardsStepComponent {
  data = input.required<RulesRewardsData>();
  dataChange = output<RulesRewardsData>();

  updateField(field: keyof RulesRewardsData, value: any): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value
    });
  }

  toggleRating(isRated: boolean): void {
    this.updateField('isRated', isRated);
  }

  updatePrize(place: 'first' | 'second' | 'third', field: 'points' | 'prize', value: any): void {
    this.dataChange.emit({
      ...this.data(),
      prizes: {
        ...this.data().prizes,
        [place]: {
          ...this.data().prizes[place],
          [field]: value
        }
      }
    });
  }

  getCharacterCount(): number {
    return this.data().specialRules?.length || 0;
  }
}
