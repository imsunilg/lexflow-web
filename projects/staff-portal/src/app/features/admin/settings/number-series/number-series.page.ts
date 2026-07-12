import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ApiErrorEnvelope,
  BranchDto,
  BranchesService,
  EmptyStateComponent,
  NumberSeriesDto,
  NumberSeriesService,
} from 'shared';
import { AdminTabsComponent } from '../../admin-tabs.component';

/**
 * Number series (PRD Module 15 §10, `NumberSeriesController`). Only
 * `{SEQ}`/`{SEQ:n}`, `{SERIES}`, `{FY}`, `{BR}` tokens are supported — there
 * is no reset-policy field, a new fiscal year is a new series row instead.
 * Existing rows only support pattern edits (`updatePattern`) and delete.
 */
@Component({
  selector: 'lf-number-series-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './number-series.page.html',
  styleUrl: './number-series.page.scss',
})
export class NumberSeriesPage {
  private readonly numberSeriesService = inject(NumberSeriesService);
  private readonly branchesService = inject(BranchesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly series = signal<NumberSeriesDto[]>([]);
  readonly branches = signal<BranchDto[]>([]);
  readonly showNewForm = signal(false);
  readonly previewing = signal<string | null>(null);
  readonly previewResults = signal<Record<string, string>>({});
  readonly editingId = signal<string | null>(null);

  readonly newForm = new FormGroup({
    seriesKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fiscalYear: new FormControl(new Date().getFullYear(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    formatPattern: new FormControl('{SERIES}/{FY}/{SEQ:4}', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    branchId: new FormControl<string | null>(null),
  });

  readonly patternForm = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    this.load();
    this.branchesService.list().subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => this.branches.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.numberSeriesService.list().subscribe({
      next: (series) => {
        this.series.set(series);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  previewFor(seriesId: string): string {
    return this.previewResults()[seriesId] ?? '';
  }

  branchName(branchId: string | null): string {
    if (!branchId) return 'All branches';
    return this.branches().find((b) => b.id === branchId)?.name ?? branchId;
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const envelope = err.error as Partial<ApiErrorEnvelope> | null;
      return envelope?.error?.message ?? fallback;
    }
    return fallback;
  }

  toggleNewForm(): void {
    this.showNewForm.update((v) => !v);
  }

  createSeries(): void {
    this.newForm.markAllAsTouched();
    if (this.newForm.invalid) return;
    const v = this.newForm.getRawValue();
    this.saving.set(true);
    this.numberSeriesService
      .create({
        seriesKey: v.seriesKey,
        fiscalYear: v.fiscalYear,
        formatPattern: v.formatPattern,
        branchId: v.branchId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showNewForm.set(false);
          this.newForm.reset({
            seriesKey: '',
            fiscalYear: new Date().getFullYear(),
            formatPattern: '{SERIES}/{FY}/{SEQ:4}',
            branchId: null,
          });
          this.load();
          this.snackBar.open('Number series created.', 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackBar.open(this.extractErrorMessage(err, 'Could not create series.'), 'Dismiss', {
            duration: 6000,
          });
        },
      });
  }

  startEditPattern(series: NumberSeriesDto): void {
    this.editingId.set(series.id);
    this.patternForm.setValue(series.formatPattern);
  }

  cancelEditPattern(): void {
    this.editingId.set(null);
  }

  saveEditPattern(series: NumberSeriesDto): void {
    this.patternForm.markAsTouched();
    if (this.patternForm.invalid) return;
    this.saving.set(true);
    this.numberSeriesService
      .updatePattern(series.id, { formatPattern: this.patternForm.value })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          this.load();
          this.snackBar.open('Pattern updated.', 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackBar.open(
            this.extractErrorMessage(err, 'Could not update pattern.'),
            'Dismiss',
            {
              duration: 6000,
            },
          );
        },
      });
  }

  deleteSeries(series: NumberSeriesDto): void {
    this.numberSeriesService.delete(series.id).subscribe({
      next: () => {
        this.load();
        this.snackBar.open('Number series deleted.', 'Dismiss', { duration: 3000 });
      },
      error: (err: unknown) => {
        this.snackBar.open(this.extractErrorMessage(err, 'Could not delete series.'), 'Dismiss', {
          duration: 6000,
        });
      },
    });
  }

  previewNext(series: NumberSeriesDto): void {
    this.previewing.set(series.id);
    this.numberSeriesService.preview(series.id).subscribe({
      next: (result) => {
        this.previewing.set(null);
        this.previewResults.update((current) => ({ ...current, [series.id]: result.preview }));
      },
      error: (err: unknown) => {
        this.previewing.set(null);
        this.snackBar.open(
          this.extractErrorMessage(err, 'Could not preview next number.'),
          'Dismiss',
          {
            duration: 6000,
          },
        );
      },
    });
  }
}
