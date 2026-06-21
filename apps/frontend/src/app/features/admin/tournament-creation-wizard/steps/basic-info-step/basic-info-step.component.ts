import { Component, OnInit, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeasonService } from '../../../../../core/services/season.service';

export interface BasicInfoData {
  name: string;
  season: number | null;
  location: string;
  format: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';
  maxParticipants: number;
}

interface FormatOption {
  id: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-basic-info-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './basic-info-step.component.html',
  styleUrl: './basic-info-step.component.css'
})
export class BasicInfoStepComponent implements OnInit {
  private seasonService = inject(SeasonService);

  data = input.required<BasicInfoData>();
  dataChange = output<BasicInfoData>();

  seasonLoading = signal(true);
  hasActiveSeason = signal(false);
  activeSeasonOption = signal<{ value: number; label: string } | null>(null);

  formats: FormatOption[] = [
    {
      id: 'SINGLE_ELIMINATION',
      title: 'Single Elimination',
      description: 'Fast-paced, high-stakes brackets. Players leave after one loss.',
      icon: 'account_tree'
    },
    {
      id: 'ROUND_ROBIN',
      title: 'Round Robin',
      description: 'Maximum play time. Every participant plays against all others.',
      icon: 'sync'
    },
    {
      id: 'GROUP_KNOCKOUT',
      title: 'Groups + KO',
      description: 'Hybrid format. Pool play leads into a final championship bracket.',
      icon: 'layers'
    }
  ];

  ngOnInit(): void {
    this.seasonService.getActiveSeason().subscribe({
      next: (season) => {
        this.activeSeasonOption.set({ value: season.id, label: season.name });
        this.hasActiveSeason.set(true);
        this.seasonLoading.set(false);
        // Auto-select the active season if none is selected yet
        if (!this.data().season) {
          this.updateField('season', season.id);
        }
      },
      error: () => {
        // 404 = no active season exists
        this.hasActiveSeason.set(false);
        this.seasonLoading.set(false);
        this.updateField('season', null);
      }
    });
  }

  updateField(field: keyof BasicInfoData, value: any): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value
    });
  }

  selectFormat(formatId: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUP_KNOCKOUT'): void {
    this.updateField('format', formatId);
  }

  isFormatSelected(formatId: string): boolean {
    return this.data().format === formatId;
  }
}
