import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

/** Shared date-range filter control used across list/report toolbars (PRD §12, §26). */
@Component({
  selector: 'lf-date-range-picker',
  standalone: true,
  imports: [ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field [formGroup]="range" appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <mat-date-range-input [rangePicker]="picker">
        <input
          matStartDate
          formControlName="start"
          placeholder="Start date"
          (dateChange)="emitChange()"
        />
        <input
          matEndDate
          formControlName="end"
          placeholder="End date"
          (dateChange)="emitChange()"
        />
      </mat-date-range-input>
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-date-range-picker #picker />
    </mat-form-field>
  `,
})
export class DateRangePickerComponent {
  readonly label = input('Date range');
  readonly rangeChange = output<DateRange>();

  readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  emitChange(): void {
    this.rangeChange.emit({
      start: this.range.value.start ?? null,
      end: this.range.value.end ?? null,
    });
  }
}
