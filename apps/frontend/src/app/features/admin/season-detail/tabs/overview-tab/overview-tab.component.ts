import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Season } from '../../../../../core/services/season-management.service';

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview-tab.component.html',
  styleUrl: './overview-tab.component.css'
})
export class OverviewTabComponent {
  @Input({ required: true }) season!: Season;

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
