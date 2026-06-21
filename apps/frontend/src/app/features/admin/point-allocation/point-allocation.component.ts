import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PointAllocationService } from '../../../core/services/point-allocation.service';
import { PointAllocation } from '../../../core/models/point-allocation.model';

@Component({
  selector: 'app-point-allocation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './point-allocation.component.html',
  styleUrls: ['./point-allocation.component.css']
})
export class PointAllocationComponent implements OnInit {
  private pointAllocationService = inject(PointAllocationService);

  allocations = signal<PointAllocation[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Track edited values separately to detect dirty state
  editedValues = signal<Map<number, number>>(new Map());

  isDirty = computed(() => this.editedValues().size > 0);

  ngOnInit(): void {
    this.loadAllocations();
  }

  loadAllocations(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pointAllocationService.getPointAllocations().subscribe({
      next: (data) => {
        this.allocations.set(data);
        this.editedValues.set(new Map());
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load point allocation rules.');
        this.loading.set(false);
      }
    });
  }

  onPointsChange(allocationId: number, value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      const map = new Map(this.editedValues());
      map.set(allocationId, num);
      this.editedValues.set(map);
    }
  }

  getDisplayPoints(allocation: PointAllocation): number {
    return this.editedValues().get(allocation.id) ?? allocation.points;
  }

  isValidPoints(value: number): boolean {
    return value >= 0 && value <= 9999;
  }

  allValid(): boolean {
    for (const [, val] of this.editedValues()) {
      if (!this.isValidPoints(val)) return false;
    }
    return true;
  }

  onSave(): void {
    if (!this.allValid()) {
      this.error.set('All point values must be between 0 and 9999.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    // Merge edited values back into allocations
    const updated = this.allocations().map(a => ({
      ...a,
      points: this.editedValues().get(a.id) ?? a.points
    }));

    this.pointAllocationService.updatePointAllocations(updated).subscribe({
      next: (saved) => {
        this.allocations.set(saved);
        this.editedValues.set(new Map());
        this.saving.set(false);
        this.successMessage.set('Point allocation rules saved successfully.');
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to save changes. The backend endpoint is not yet available.');
      }
    });
  }

  onDiscard(): void {
    this.editedValues.set(new Map());
    this.error.set(null);
  }
}
