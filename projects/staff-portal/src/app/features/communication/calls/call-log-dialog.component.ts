import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { CallLog, CommCallsService } from 'shared';

export interface CallLogDialogData {
  clientId: string | null;
  matterId: string | null;
}

const DIRECTIONS = ['Inbound', 'Outbound'] as const;

/**
 * Call-log dialog (PRD Module 11 UI Components: "call-log dialog"). Two
 * modes: a manual log (any direction/duration/summary, optional follow-up
 * task) and click-to-call, a real Twilio Voice REST integration —
 * recording is gated on `consentGiven` at the Twilio API call itself, not
 * just client-side, and any recording that results is attached
 * asynchronously later via a status-callback webhook, never returned here.
 */
@Component({
  selector: 'lf-call-log-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Log a call</h2>
    <mat-dialog-content class="call-log">
      <mat-tab-group>
        <mat-tab label="Manual log">
          <div class="call-log__tab">
            <mat-form-field appearance="outline">
              <mat-label>Direction</mat-label>
              <mat-select [formControl]="direction">
                @for (d of directions; track d) {
                  <mat-option [value]="d">{{ d }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Duration (seconds)</mat-label>
              <input matInput type="number" min="0" [formControl]="durationSec" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Summary</mat-label>
              <textarea matInput [formControl]="summary" rows="3"></textarea>
            </mat-form-field>

            <mat-checkbox [formControl]="createFollowUpTask">Create a follow-up task</mat-checkbox>
            @if (createFollowUpTask.value) {
              <mat-form-field appearance="outline">
                <mat-label>Follow-up task title</mat-label>
                <input matInput [formControl]="followUpTaskTitle" />
              </mat-form-field>
            }

            @if (logError()) {
              <p class="call-log__error">{{ logError() }}</p>
            }
            <button
              mat-flat-button
              color="primary"
              type="button"
              [disabled]="logSubmitting()"
              (click)="submitLog()"
            >
              Save log
            </button>
          </div>
        </mat-tab>

        <mat-tab label="Click to call">
          <div class="call-log__tab">
            <p class="call-log__hint">
              Places a real call via the firm's configured Twilio Voice number. Recording only
              happens if consent is given below — the Twilio API call itself is gated on it.
            </p>
            <mat-form-field appearance="outline">
              <mat-label>Number to call</mat-label>
              <input matInput [formControl]="toNumber" placeholder="+91XXXXXXXXXX" />
            </mat-form-field>
            <mat-checkbox [formControl]="consentGiven">Recording consent given</mat-checkbox>

            @if (clickError()) {
              <p class="call-log__error">{{ clickError() }}</p>
            }
            <button
              mat-flat-button
              color="primary"
              type="button"
              [disabled]="clickSubmitting() || toNumber.invalid"
              (click)="submitClickToCall()"
            >
              Call now
            </button>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .call-log {
      min-width: 420px;
    }

    .call-log__tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding-top: var(--lf-space-2);
    }

    .call-log__hint {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
      margin: 0;
    }

    .call-log__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class CallLogDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<CallLogDialogComponent, CallLog | undefined>>(MatDialogRef);
  readonly data = inject<CallLogDialogData>(MAT_DIALOG_DATA);
  private readonly commCallsService = inject(CommCallsService);

  readonly directions = DIRECTIONS;
  readonly direction = new FormControl<(typeof DIRECTIONS)[number]>('Outbound', {
    nonNullable: true,
  });
  readonly durationSec = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });
  readonly summary = new FormControl('', { nonNullable: true });
  readonly createFollowUpTask = new FormControl(false, { nonNullable: true });
  readonly followUpTaskTitle = new FormControl('', { nonNullable: true });
  readonly logSubmitting = signal(false);
  readonly logError = signal<string | null>(null);

  readonly toNumber = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly consentGiven = new FormControl(false, { nonNullable: true });
  readonly clickSubmitting = signal(false);
  readonly clickError = signal<string | null>(null);

  submitLog(): void {
    this.logSubmitting.set(true);
    this.logError.set(null);
    this.commCallsService
      .log({
        clientId: this.data.clientId,
        matterId: this.data.matterId,
        userId: null,
        direction: this.direction.value,
        durationSec: this.durationSec.value,
        summary: this.summary.value || null,
        createFollowUpTask: this.createFollowUpTask.value,
        followUpTaskTitle: this.createFollowUpTask.value
          ? this.followUpTaskTitle.value || null
          : null,
      })
      .subscribe({
        next: (log) => this.dialogRef.close(log),
        error: () => {
          this.logSubmitting.set(false);
          this.logError.set('Could not save that call log.');
        },
      });
  }

  submitClickToCall(): void {
    if (this.toNumber.invalid) return;
    this.clickSubmitting.set(true);
    this.clickError.set(null);
    this.commCallsService
      .clickToCall({
        clientId: this.data.clientId,
        matterId: this.data.matterId,
        toNumber: this.toNumber.value,
        consentGiven: this.consentGiven.value,
      })
      .subscribe({
        next: (log) => this.dialogRef.close(log),
        error: () => {
          this.clickSubmitting.set(false);
          this.clickError.set('Call failed — check the Twilio Voice gateway is configured.');
        },
      });
  }
}
