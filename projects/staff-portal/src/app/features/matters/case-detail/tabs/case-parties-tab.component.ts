import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  CaseParty,
  CasePartyInput,
  ConfirmDialogComponent,
  CourtCasesService,
  EmptyStateComponent,
} from 'shared';

interface PartyFormValue {
  partyRole: string;
  name: string;
  advocateName: string;
  contact: string;
}

function buildPartyForm(party?: CaseParty): FormGroup<{
  partyRole: FormControl<string>;
  name: FormControl<string>;
  advocateName: FormControl<string>;
  contact: FormControl<string>;
}> {
  return new FormGroup({
    partyRole: new FormControl(party?.partyRole ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    name: new FormControl(party?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    advocateName: new FormControl(party?.advocateName ?? '', { nonNullable: true }),
    contact: new FormControl(party?.contact ?? '', { nonNullable: true }),
  });
}

function toInput(value: PartyFormValue): CasePartyInput {
  return {
    partyRole: value.partyRole,
    name: value.name,
    advocateName: value.advocateName || null,
    contact: value.contact || null,
  };
}

/**
 * Parties & Advocates sub-grid for the case detail page (PRD Module 5).
 * `partyRole` is free text (not a fixed enum) since court party roles vary
 * per case type. Self-contained: fetches its own parties from `caseId`.
 */
@Component({
  selector: 'lf-case-parties-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="parties-tab">
      @if (loading()) {
        <div class="parties-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load parties"
          message="Something went wrong while loading parties & advocates."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else {
        @if (parties().length === 0 && !addingNew()) {
          <lf-empty-state
            icon="groups"
            title="No parties added yet"
            ctaLabel="Add party"
            (cta)="startAdd()"
          />
        } @else {
          <table class="parties-tab__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Advocate</th>
                <th>Contact</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (party of parties(); track party.id) {
                @if (editingId() === party.id) {
                  <tr class="parties-tab__edit-row">
                    <td colspan="6">
                      <form [formGroup]="editForm!" class="parties-tab__form">
                        <mat-form-field appearance="outline">
                          <mat-label>Name</mat-label>
                          <input matInput formControlName="name" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Role</mat-label>
                          <input matInput formControlName="partyRole" placeholder="Petitioner" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Advocate name</mat-label>
                          <input matInput formControlName="advocateName" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Contact</mat-label>
                          <input matInput formControlName="contact" />
                        </mat-form-field>
                        <div class="parties-tab__form-actions">
                          <button mat-button type="button" (click)="cancelEdit()">Cancel</button>
                          <button
                            mat-flat-button
                            color="primary"
                            type="button"
                            [disabled]="editForm!.invalid || saving()"
                            (click)="submitEdit(party)"
                          >
                            @if (saving()) {
                              <mat-spinner diameter="18" />
                            } @else {
                              Save
                            }
                          </button>
                        </div>
                        @if (errorMessage()) {
                          <p class="parties-tab__error" role="alert">{{ errorMessage() }}</p>
                        }
                      </form>
                    </td>
                  </tr>
                } @else {
                  <tr>
                    <td>{{ party.name }}</td>
                    <td>{{ party.partyRole }}</td>
                    <td>{{ party.advocateName ?? '—' }}</td>
                    <td>{{ party.contact ?? '—' }}</td>
                    <td>
                      <button
                        mat-icon-button
                        type="button"
                        aria-label="Edit party"
                        (click)="startEdit(party)"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                    </td>
                    <td>
                      <button
                        mat-icon-button
                        type="button"
                        aria-label="Delete party"
                        (click)="deleteParty(party)"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }

        @if (addingNew()) {
          <form [formGroup]="addForm" class="parties-tab__form parties-tab__form--add">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" />
              @if (addForm.controls.name.hasError('required') && addForm.controls.name.touched) {
                <mat-error>Name is required.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Role</mat-label>
              <input matInput formControlName="partyRole" placeholder="Petitioner" />
              @if (
                addForm.controls.partyRole.hasError('required') &&
                addForm.controls.partyRole.touched
              ) {
                <mat-error>Role is required.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Advocate name</mat-label>
              <input matInput formControlName="advocateName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Contact</mat-label>
              <input matInput formControlName="contact" />
            </mat-form-field>
            <div class="parties-tab__form-actions">
              <button mat-button type="button" (click)="cancelAdd()">Cancel</button>
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="addForm.invalid || saving()"
                (click)="submitAdd()"
              >
                @if (saving()) {
                  <mat-spinner diameter="18" />
                } @else {
                  Add party
                }
              </button>
            </div>
            @if (errorMessage()) {
              <p class="parties-tab__error" role="alert">{{ errorMessage() }}</p>
            }
          </form>
        } @else if (parties().length > 0) {
          <button mat-stroked-button type="button" (click)="startAdd()">
            <mat-icon>add</mat-icon>
            Add party
          </button>
        }
      }
    </div>
  `,
  styles: `
    .parties-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .parties-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .parties-tab__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--lf-text-sm);
    }

    .parties-tab__table th {
      text-align: left;
      color: var(--lf-on-surface-variant);
      font-weight: 600;
      font-size: var(--lf-text-xs);
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .parties-tab__table td {
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
      vertical-align: middle;
    }

    .parties-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      align-items: start;
      padding: var(--lf-space-2) 0;
    }

    .parties-tab__form--add {
      border-top: 1px dashed var(--lf-surface-variant);
      margin-top: var(--lf-space-1);
    }

    .parties-tab__form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .parties-tab__error {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CasePartiesTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);
  private readonly dialog = inject(MatDialog);

  readonly caseId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly parties = signal<CaseParty[]>([]);

  readonly addingNew = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  addForm = buildPartyForm();
  editForm: ReturnType<typeof buildPartyForm> | null = null;

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
    this.courtCasesService.listParties(this.caseId()).subscribe({
      next: (parties) => {
        this.parties.set(parties);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  startAdd(): void {
    this.addForm = buildPartyForm();
    this.errorMessage.set(null);
    this.addingNew.set(true);
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.errorMessage.set(null);
  }

  submitAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const input = toInput(this.addForm.getRawValue());
    this.courtCasesService.addParty(this.caseId(), input).subscribe({
      next: (party) => {
        this.parties.update((parties) => [...parties, party]);
        this.saving.set(false);
        this.addingNew.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }

  startEdit(party: CaseParty): void {
    this.editForm = buildPartyForm(party);
    this.errorMessage.set(null);
    this.editingId.set(party.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editForm = null;
    this.errorMessage.set(null);
  }

  submitEdit(party: CaseParty): void {
    if (!this.editForm || this.editForm.invalid) {
      this.editForm?.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const input = toInput(this.editForm.getRawValue());
    this.courtCasesService.updateParty(this.caseId(), party.id, input).subscribe({
      next: (updated) => {
        this.parties.update((parties) =>
          parties.map((existing) => (existing.id === updated.id ? updated : existing)),
        );
        this.saving.set(false);
        this.editingId.set(null);
        this.editForm = null;
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }

  deleteParty(party: CaseParty): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Remove this party?',
          message: `"${party.name}" will be removed from this case's party list.`,
          confirmLabel: 'Remove',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.courtCasesService.deleteParty(this.caseId(), party.id).subscribe({
          next: () => {
            this.parties.update((parties) => parties.filter((p) => p.id !== party.id));
          },
          error: () => {
            this.errorMessage.set('Failed to remove party. Please try again.');
          },
        });
      });
  }
}
