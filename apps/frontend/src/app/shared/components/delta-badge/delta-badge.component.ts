import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeltaIndicator } from '../../../core/services/admin-dashboard.service';

@Component({
  selector: 'app-delta-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (delta().direction === 'neutral' || delta().value === null) {
      <span class="delta neutral">—</span>
    } @else {
      <span class="delta" [class.up]="delta().direction === 'up'"
                          [class.down]="delta().direction === 'down'">
        {{ delta().direction === 'up' ? '▲' : '▼' }}
        {{ delta().value }}%
        <span class="period">vs last 30d</span>
      </span>
    }
  `,
  styles: [`
    .delta {
      font-size: 0.75rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .up      { color: #22c55e; }
    .down    { color: #ef4444; }
    .neutral { color: #9ca3af; }
    .period  { font-weight: 400; color: inherit; opacity: 0.8; }
  `]
})
export class DeltaBadgeComponent {
  delta = input.required<DeltaIndicator>();
}
