import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiErrorEnvelope, Client, ClientsService } from 'shared';

export interface MergeClientsDialogData {
  client: Client;
}

type MergeField = 'firstName' | 'lastName' | 'legalName' | 'email' | 'phoneE164' | 'gstin' | 'cin';
const MERGE_FIELDS: MergeField[] = [
  'firstName',
  'lastName',
  'legalName',
  'email',
  'phoneE164',
  'gstin',
  'cin',
];

type WizardStep = 'search' | 'survivor' | 'fields' | 'done';

/**
 * Merge duplicates wizard (PRD Module 3 User Flow step 7: "pick survivor,
 * field-level pick, all children re-parented, loser tombstoned with
 * redirect"). AC-C3.
 */
@Component({
  selector: 'lf-merge-clients-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Merge duplicate client</h2>
    <mat-dialog-content>
      @if (step() === 'search') {
        <p>Find the duplicate record to merge into {{ data.client.displayName }}.</p>
        <mat-form-field appearance="outline" class="merge-wizard__wide">
          <mat-label>Search clients</mat-label>
          <input matInput [formControl]="searchControl" />
        </mat-form-field>

        @if (searching()) {
          <mat-spinner diameter="24" />
        } @else if (candidates().length > 0) {
          <ul class="merge-wizard__candidates">
            @for (candidate of candidates(); track candidate.id) {
              <li>
                <button mat-stroked-button type="button" (click)="selectCandidate(candidate)">
                  {{ candidate.displayName }} ({{ candidate.number }})
                </button>
              </li>
            }
          </ul>
        } @else if (searchControl.value.length > 1) {
          <p class="merge-wizard__hint">No matches.</p>
        }
      }

      @if (step() === 'survivor' && duplicate()) {
        <p>Which record should survive the merge? The other will be tombstoned.</p>
        <mat-radio-group [formControl]="survivorControl">
          <mat-radio-button [value]="data.client.id">
            {{ data.client.displayName }} ({{ data.client.number }})
          </mat-radio-button>
          <mat-radio-button [value]="duplicate()!.id">
            {{ duplicate()!.displayName }} ({{ duplicate()!.number }})
          </mat-radio-button>
        </mat-radio-group>
        <div class="merge-wizard__actions">
          <button mat-button type="button" (click)="step.set('search')">Back</button>
          <button mat-flat-button color="primary" type="button" (click)="step.set('fields')">
            Next
          </button>
        </div>
      }

      @if (step() === 'fields' && duplicate()) {
        <p>Pick which value to keep for each field that differs.</p>
        @for (field of differingFields(); track field) {
          <div class="merge-wizard__field-row">
            <span class="merge-wizard__field-name">{{ field }}</span>
            <mat-radio-group [formControl]="fieldControls[field]">
              <mat-radio-button [value]="survivorRecord()![field] ?? ''">
                {{ survivorRecord()![field] || '(empty)' }}
              </mat-radio-button>
              <mat-radio-button [value]="duplicateRecord()![field] ?? ''">
                {{ duplicateRecord()![field] || '(empty)' }}
              </mat-radio-button>
            </mat-radio-group>
          </div>
        }

        @if (errorMessage()) {
          <p class="merge-wizard__error" role="alert">{{ errorMessage() }}</p>
        }

        <div class="merge-wizard__actions">
          <button mat-button type="button" (click)="step.set('survivor')">Back</button>
          <button
            mat-flat-button
            color="warn"
            type="button"
            [disabled]="merging()"
            (click)="confirmMerge()"
          >
            @if (merging()) {
              <mat-spinner diameter="20" />
            } @else {
              Merge
            }
          </button>
        </div>
      }

      @if (step() === 'done') {
        <p class="merge-wizard__success">Merge complete.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="step() === 'done'">
        {{ step() === 'done' ? 'Done' : 'Cancel' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .merge-wizard__wide {
      width: 100%;
    }

    .merge-wizard__candidates {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .merge-wizard__hint {
      color: var(--lf-on-surface-variant);
    }

    .merge-wizard__field-row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      padding: var(--lf-space-1) 0;
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .merge-wizard__field-name {
      min-width: 100px;
      font-weight: 600;
      text-transform: capitalize;
    }

    .merge-wizard__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
      margin-top: var(--lf-space-2);
    }

    .merge-wizard__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }

    .merge-wizard__success {
      color: var(--lf-success);
      font-weight: 600;
    }
  `,
})
export class MergeClientsDialogComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly dialogRef =
    inject<MatDialogRef<MergeClientsDialogComponent, boolean>>(MatDialogRef);
  readonly data = inject<MergeClientsDialogData>(MAT_DIALOG_DATA);

  readonly step = signal<WizardStep>('search');
  readonly searching = signal(false);
  readonly candidates = signal<Client[]>([]);
  readonly duplicate = signal<Client | null>(null);
  readonly merging = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly survivorControl = new FormControl(this.data.client.id, { nonNullable: true });

  readonly fieldControls: Record<MergeField, FormControl<string>> = MERGE_FIELDS.reduce(
    (controls, field) => {
      controls[field] = new FormControl('', { nonNullable: true });
      return controls;
    },
    {} as Record<MergeField, FormControl<string>>,
  );

  readonly survivorRecord = computed(() =>
    this.survivorControl.value === this.data.client.id ? this.data.client : this.duplicate(),
  );
  readonly duplicateRecord = computed(() =>
    this.survivorControl.value === this.data.client.id ? this.duplicate() : this.data.client,
  );

  readonly differingFields = computed<MergeField[]>(() => {
    const survivor = this.survivorRecord();
    const dup = this.duplicateRecord();
    if (!survivor || !dup) {
      return [];
    }
    return MERGE_FIELDS.filter((field) => (survivor[field] ?? '') !== (dup[field] ?? ''));
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.search(query));
  }

  private search(query: string): void {
    if (query.trim().length < 2) {
      this.candidates.set([]);
      return;
    }
    this.searching.set(true);
    this.clientsService.list({ q: query }).subscribe({
      next: (clients) => {
        this.candidates.set(clients.filter((c) => c.id !== this.data.client.id));
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  selectCandidate(candidate: Client): void {
    this.duplicate.set(candidate);
    for (const field of MERGE_FIELDS) {
      this.fieldControls[field].setValue(this.data.client[field] ?? '');
    }
    this.step.set('survivor');
  }

  confirmMerge(): void {
    const survivor = this.survivorRecord();
    const dup = this.duplicateRecord();
    if (!survivor || !dup) {
      return;
    }

    this.merging.set(true);
    this.errorMessage.set(null);

    const fieldChoices: Record<string, string> = {};
    for (const field of this.differingFields()) {
      const value = this.fieldControls[field].value;
      if (value) {
        fieldChoices[field] = value;
      }
    }

    this.clientsService
      .merge({ survivorId: survivor.id, duplicateId: dup.id, fieldChoices })
      .subscribe({
        next: () => {
          this.merging.set(false);
          this.step.set('done');
        },
        error: (error: unknown) => {
          this.merging.set(false);
          this.errorMessage.set(this.messageFor(error));
        },
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Something went wrong. Please try again.';
    }
    const envelope = error.error as Partial<ApiErrorEnvelope> | null;
    return envelope?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
