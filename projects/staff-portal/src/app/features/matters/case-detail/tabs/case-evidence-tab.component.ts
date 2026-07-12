import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  CourtCasesService,
  EVIDENCE_KINDS,
  EmptyStateComponent,
  EvidenceCustodyLogEntry,
  EvidenceItem,
  EvidenceKind,
  StatusChipComponent,
} from 'shared';

function buildAddEvidenceForm(): FormGroup<{
  exhibitNo: FormControl<string>;
  kind: FormControl<EvidenceKind>;
  description: FormControl<string>;
}> {
  return new FormGroup({
    exhibitNo: new FormControl('', { nonNullable: true }),
    kind: new FormControl<EvidenceKind>(EVIDENCE_KINDS[0], { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
  });
}

function buildCustodyForm(): FormGroup<{
  action: FormControl<string>;
  holder: FormControl<string>;
  note: FormControl<string>;
}> {
  return new FormGroup({
    action: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    holder: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });
}

/**
 * Evidence tab for the case detail page (PRD Module 5, AC-CC5). Self-contained:
 * fetches its own evidence from `caseId`. Custody log entries are append-only —
 * no edit/delete controls are rendered for them, matching AC-CC5.
 */
@Component({
  selector: 'lf-case-evidence-tab',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="evidence-tab">
      @if (loading()) {
        <div class="evidence-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load evidence"
          i18n-title="@@matters.caseEvidenceTab.loadErrorTitle"
          message="Something went wrong while loading evidence."
          i18n-message="@@matters.caseEvidenceTab.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@matters.caseEvidenceTab.retryButton"
          (cta)="load()"
        />
      } @else {
        @if (evidenceItems().length === 0) {
          <lf-empty-state
            icon="inventory_2"
            title="No evidence recorded yet"
            i18n-title="@@matters.caseEvidenceTab.emptyTitle"
          />
        } @else {
          <div class="evidence-tab__list">
            @for (item of evidenceItems(); track item.id) {
              <div class="evidence-tab__card">
                <div class="evidence-tab__card-main">
                  <span class="evidence-tab__exhibit">{{ item.exhibitNo ?? '—' }}</span>
                  <lf-status-chip [label]="item.kind" toneOverride="neutral" />
                  <span class="evidence-tab__description">{{ item.description ?? '—' }}</span>
                  @if (item.marked) {
                    <lf-status-chip
                      label="Marked"
                      i18n-label="@@matters.caseEvidenceTab.markedLabel"
                      toneOverride="success"
                    />
                  }
                  @if (item.objected) {
                    <lf-status-chip
                      label="Objected"
                      i18n-label="@@matters.caseEvidenceTab.objectedLabel"
                      toneOverride="error"
                    />
                  }
                  @if (item.custodyStatus) {
                    <span class="evidence-tab__custody-status">{{ item.custodyStatus }}</span>
                  }
                  <button mat-button type="button" (click)="toggleCustodyLog(item)">
                    @if (expandedId() === item.id) {
                      <span i18n="@@matters.caseEvidenceTab.hideCustodyLogButton"
                        >Hide custody log</span
                      >
                    } @else {
                      <span i18n="@@matters.caseEvidenceTab.chainOfCustodyButton"
                        >Chain of custody</span
                      >
                    }
                  </button>
                </div>

                @if (expandedId() === item.id) {
                  <div class="evidence-tab__custody">
                    @if (custodyLoading()) {
                      <mat-spinner diameter="24" />
                    } @else {
                      @if (custodyLog().length === 0) {
                        <p
                          class="evidence-tab__custody-empty"
                          i18n="@@matters.caseEvidenceTab.custodyEmpty"
                        >
                          No custody entries yet.
                        </p>
                      } @else {
                        <ul class="evidence-tab__custody-list">
                          @for (entry of custodyLog(); track entry.id) {
                            <li>
                              <strong>{{ entry.action }}</strong>
                              @if (entry.holder) {
                                <span> — {{ entry.holder }}</span>
                              }
                              <span class="evidence-tab__custody-at">
                                {{ entry.at | date: 'short' }}
                              </span>
                              @if (entry.note) {
                                <p class="evidence-tab__custody-note">{{ entry.note }}</p>
                              }
                            </li>
                          }
                        </ul>
                      }

                      <form [formGroup]="custodyForm" class="evidence-tab__custody-form">
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.caseEvidenceTab.custodyActionLabel"
                            >Action</mat-label
                          >
                          <input matInput formControlName="action" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.caseEvidenceTab.custodyHolderLabel"
                            >Holder</mat-label
                          >
                          <input matInput formControlName="holder" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.caseEvidenceTab.custodyNoteLabel"
                            >Note</mat-label
                          >
                          <textarea matInput formControlName="note"></textarea>
                        </mat-form-field>
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="custodyForm.invalid || addingCustodyEntry()"
                          (click)="addCustodyEntry(item)"
                        >
                          @if (addingCustodyEntry()) {
                            <mat-spinner diameter="18" />
                          } @else {
                            <span i18n="@@matters.caseEvidenceTab.addCustodyEntryButton"
                              >Add custody entry</span
                            >
                          }
                        </button>
                      </form>
                      @if (custodyErrorMessage()) {
                        <p class="evidence-tab__error" role="alert">{{ custodyErrorMessage() }}</p>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="evidence-tab__add">
          <h3 class="evidence-tab__add-title" i18n="@@matters.caseEvidenceTab.addTitle">
            Add evidence
          </h3>
          <form [formGroup]="addForm" class="evidence-tab__form">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseEvidenceTab.exhibitNoLabel">Exhibit no.</mat-label>
              <input matInput formControlName="exhibitNo" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseEvidenceTab.kindLabel">Kind</mat-label>
              <mat-select formControlName="kind">
                @for (kind of evidenceKinds; track kind) {
                  <mat-option [value]="kind">{{ kind }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseEvidenceTab.descriptionLabel">Description</mat-label>
              <textarea matInput formControlName="description"></textarea>
            </mat-form-field>
          </form>

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="addForm.invalid || addingEvidence()"
            (click)="addEvidence()"
          >
            @if (addingEvidence()) {
              <mat-spinner diameter="18" />
            } @else {
              <span i18n="@@matters.caseEvidenceTab.addEvidenceButton">Add evidence</span>
            }
          </button>

          @if (addErrorMessage()) {
            <p class="evidence-tab__error" role="alert">{{ addErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .evidence-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .evidence-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .evidence-tab__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .evidence-tab__card {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .evidence-tab__card-main {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--lf-space-1);
    }

    .evidence-tab__exhibit {
      font-weight: 600;
    }

    .evidence-tab__description,
    .evidence-tab__custody-status {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .evidence-tab__custody {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding: var(--lf-space-2);
      background: var(--lf-surface-variant);
      border-radius: 8px;
    }

    .evidence-tab__custody-list {
      margin: 0;
      padding-left: var(--lf-space-3);
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      font-size: var(--lf-text-sm);
    }

    .evidence-tab__custody-at {
      margin-left: var(--lf-space-1);
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .evidence-tab__custody-note {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .evidence-tab__custody-empty {
      margin: 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .evidence-tab__custody-form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0 var(--lf-space-2);
      align-items: start;
    }

    .evidence-tab__add {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .evidence-tab__add-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .evidence-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0 var(--lf-space-2);
    }

    .evidence-tab__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CaseEvidenceTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);

  readonly caseId = input.required<string>();
  readonly evidenceKinds = EVIDENCE_KINDS;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly evidenceItems = signal<EvidenceItem[]>([]);

  readonly addingEvidence = signal(false);
  readonly addErrorMessage = signal<string | null>(null);
  addForm = buildAddEvidenceForm();

  readonly expandedId = signal<string | null>(null);
  readonly custodyLoading = signal(false);
  readonly custodyLog = signal<EvidenceCustodyLogEntry[]>([]);
  readonly addingCustodyEntry = signal(false);
  readonly custodyErrorMessage = signal<string | null>(null);
  custodyForm = buildCustodyForm();

  constructor() {
    effect(() => {
      const id = this.caseId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.courtCasesService.listEvidence(this.caseId()).subscribe({
      next: (items) => {
        this.evidenceItems.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  addEvidence(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.addingEvidence.set(true);
    this.addErrorMessage.set(null);
    const value = this.addForm.getRawValue();
    this.courtCasesService
      .addEvidence(this.caseId(), {
        exhibitNo: value.exhibitNo || null,
        kind: value.kind,
        description: value.description || null,
      })
      .subscribe({
        next: (item) => {
          this.evidenceItems.update((items) => [item, ...items]);
          this.addingEvidence.set(false);
          this.addForm = buildAddEvidenceForm();
        },
        error: () => {
          this.addingEvidence.set(false);
          this.addErrorMessage.set('Failed to add evidence. Please try again.');
        },
      });
  }

  toggleCustodyLog(item: EvidenceItem): void {
    if (this.expandedId() === item.id) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(item.id);
    this.custodyForm = buildCustodyForm();
    this.custodyErrorMessage.set(null);
    this.custodyLoading.set(true);
    this.courtCasesService.listCustodyLog(item.id).subscribe({
      next: (log) => {
        this.custodyLog.set(log);
        this.custodyLoading.set(false);
      },
      error: () => {
        this.custodyLog.set([]);
        this.custodyLoading.set(false);
      },
    });
  }

  addCustodyEntry(item: EvidenceItem): void {
    if (this.custodyForm.invalid) {
      this.custodyForm.markAllAsTouched();
      return;
    }

    this.addingCustodyEntry.set(true);
    this.custodyErrorMessage.set(null);
    const value = this.custodyForm.getRawValue();
    this.courtCasesService
      .addCustodyLogEntry(item.id, {
        action: value.action,
        holder: value.holder || null,
        note: value.note || null,
      })
      .subscribe({
        next: (entry) => {
          this.custodyLog.update((log) => [...log, entry]);
          this.addingCustodyEntry.set(false);
          this.custodyForm = buildCustodyForm();
        },
        error: () => {
          this.addingCustodyEntry.set(false);
          this.custodyErrorMessage.set('Failed to add custody entry. Please try again.');
        },
      });
  }
}
