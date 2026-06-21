import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService, RoundFormat } from '../../../../../core/services/tournament.service';

@Component({
  selector: 'app-match-rules-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-rules-step.component.html',
  styleUrls: ['./match-rules-step.component.css']
})
export class MatchRulesStepComponent implements OnChanges {
  private tournamentService = inject(TournamentService);

  @Input() tournamentFormat = 'SINGLE_ELIMINATION';
  @Input() maxPlayers = 32;
  @Output() formatsChange = new EventEmitter<RoundFormat[]>();

  roundFormats = signal<RoundFormat[]>([]);
  loading = signal(false);

  readonly FORMAT_OPTIONS: { value: RoundFormat['match_format']; label: string }[] = [
    { value: 'BEST_OF_3',  label: 'Best of 3' },
    { value: 'BEST_OF_5',  label: 'Best of 5' },
    { value: 'BEST_OF_7',  label: 'Best of 7' },
    { value: 'RACE_TO_5',  label: 'Race to 5' },
    { value: 'RACE_TO_11', label: 'Race to 11' },
    { value: 'RACE_TO_21', label: 'Race to 21' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tournamentFormat'] || changes['maxPlayers']) {
      this.loadDefaults();
    }
  }

  loadDefaults(): void {
    this.loading.set(true);
    this.tournamentService.previewRoundFormats(this.tournamentFormat, this.maxPlayers).subscribe({
      next: (formats) => {
        this.roundFormats.set(formats);
        this.loading.set(false);
        this.formatsChange.emit(formats);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  updateFormat(roundNumber: number, format: string): void {
    this.roundFormats.update(rounds =>
      rounds.map(r => r.round_number === roundNumber
        ? { ...r, match_format: format as RoundFormat['match_format'] }
        : r
      )
    );
    this.formatsChange.emit(this.roundFormats());
  }

  getValue(): RoundFormat[] {
    return this.roundFormats();
  }

  getFormatDescription(fmt: string): string {
    const map: Record<string, string> = {
      'BEST_OF_3':  'First to win 2 games',
      'BEST_OF_5':  'First to win 3 games',
      'BEST_OF_7':  'First to win 4 games',
      'RACE_TO_5':  'First to 5 points',
      'RACE_TO_11': 'First to 11 points',
      'RACE_TO_21': 'First to 21 points',
    };
    return map[fmt] ?? fmt;
  }
}
