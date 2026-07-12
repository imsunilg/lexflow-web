import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, of } from 'rxjs';
import {
  ReportExportFormat,
  ReportRunParams,
  ReportScheduleDto,
  ReportScheduleFrequency,
  ReportScheduleRecipient,
  ReportSchedulesService,
  UserSummary,
  UsersService,
} from 'shared';

export interface ScheduleDialogData {
  reportKey: string | null;
  reportDefinitionId: string | null;
  params: ReportRunParams | null;
}

interface RecipientRow {
  label: string;
  recipient: ReportScheduleRecipient;
}

/**
 * Schedule dialog (PRD Module 13 UI Components: "schedule dialog"). Recipients
 * that are firm users get real delivery via `ReportSchedulerService`'s
 * Hangfire recurring job; email-only recipients are recorded but never
 * actually receive an attachment yet (no attachment-capable SMTP sender
 * exists server-side) — surfaced below as an explicit caveat, not hidden.
 */
@Component({
  selector: 'lf-schedule-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@reports.scheduleDialog.title">Schedule this report</h2>
    <mat-dialog-content class="schedule-dialog">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@reports.scheduleDialog.frequencyLabel">Frequency</mat-label>
        <mat-select [formControl]="frequency">
          <mat-option value="daily" i18n="@@reports.scheduleDialog.frequencyDaily"
            >Daily</mat-option
          >
          <mat-option value="weekly" i18n="@@reports.scheduleDialog.frequencyWeekly"
            >Weekly</mat-option
          >
          <mat-option value="monthly" i18n="@@reports.scheduleDialog.frequencyMonthly"
            >Monthly</mat-option
          >
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@reports.scheduleDialog.formatLabel">Format</mat-label>
        <mat-select [formControl]="format">
          <mat-option value="pdf">PDF</mat-option>
          <mat-option value="xlsx">XLSX</mat-option>
          <mat-option value="csv">CSV</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-chip-set>
        @for (row of recipients(); track row.label) {
          <mat-chip (removed)="removeRecipient(row)">
            {{ row.label }}
            @if (row.recipient.email) {
              <mat-icon
                matChipTrailingIcon
                matTooltip="External emails aren't sent an attachment yet — no attachment-capable mail sender exists server-side."
                i18n-matTooltip="@@reports.scheduleDialog.externalEmailTooltip"
              >
                info
              </mat-icon>
            }
            <button matChipRemove><mat-icon>cancel</mat-icon></button>
          </mat-chip>
        }
      </mat-chip-set>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@reports.scheduleDialog.addFirmUserLabel">Add firm user</mat-label>
        <input matInput [formControl]="userQuery" [matAutocomplete]="userAuto" />
        <mat-autocomplete #userAuto="matAutocomplete" (optionSelected)="onUserSelected($event)">
          @for (user of userResults(); track user.id) {
            <mat-option [value]="user.name">{{ user.name }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      <div class="schedule-dialog__email-row">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@reports.scheduleDialog.addExternalEmailLabel"
            >Add external email</mat-label
          >
          <input matInput [formControl]="emailInput" (keydown.enter)="addEmail()" />
        </mat-form-field>
        <button
          mat-stroked-button
          type="button"
          (click)="addEmail()"
          i18n="@@reports.scheduleDialog.addButton"
        >
          Add
        </button>
      </div>

      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (error()) {
        <p class="schedule-dialog__error">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@reports.scheduleDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="recipients().length === 0 || submitting()"
        (click)="submit()"
        i18n="@@reports.scheduleDialog.scheduleButton"
      >
        Schedule
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .schedule-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      min-width: 420px;
    }

    .schedule-dialog__email-row {
      display: flex;
      align-items: flex-start;
      gap: var(--lf-space-1);
    }

    .schedule-dialog__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class ScheduleDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<ScheduleDialogComponent, ReportScheduleDto | undefined>>(MatDialogRef);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);
  private readonly reportSchedulesService = inject(ReportSchedulesService);
  private readonly usersService = inject(UsersService);

  readonly frequency = new FormControl<ReportScheduleFrequency>('weekly', { nonNullable: true });
  readonly format = new FormControl<ReportExportFormat>('pdf', { nonNullable: true });
  readonly userQuery = new FormControl('', { nonNullable: true });
  readonly userResults = signal<UserSummary[]>([]);
  readonly emailInput = new FormControl('', { nonNullable: true });
  readonly recipients = signal<RecipientRow[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.userQuery.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q.trim()) {
          this.userResults.set([]);
          return;
        }
        this.usersService
          .list()
          .pipe(catchError(() => of<UserSummary[]>([])))
          .subscribe((users) =>
            this.userResults.set(
              users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())),
            ),
          );
      });
  }

  onUserSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const user = this.userResults().find((u) => u.name === label);
    if (!user) return;
    this.recipients.update((rows) => [
      ...rows,
      { label: user.name, recipient: { userId: user.id } },
    ]);
    this.userQuery.setValue('');
  }

  addEmail(): void {
    const email = this.emailInput.value.trim();
    if (!email) return;
    this.recipients.update((rows) => [...rows, { label: email, recipient: { email } }]);
    this.emailInput.setValue('');
  }

  removeRecipient(row: RecipientRow): void {
    this.recipients.update((rows) => rows.filter((r) => r !== row));
  }

  submit(): void {
    this.submitting.set(true);
    this.error.set(null);
    this.reportSchedulesService
      .create({
        reportKey: this.data.reportKey,
        reportDefinitionId: this.data.reportDefinitionId,
        frequency: this.frequency.value,
        format: this.format.value,
        params: this.data.params,
        recipients: this.recipients().map((r) => r.recipient),
      })
      .subscribe({
        next: (schedule) => this.dialogRef.close(schedule),
        error: () => {
          this.submitting.set(false);
          this.error.set('Could not create this schedule.');
        },
      });
  }
}
