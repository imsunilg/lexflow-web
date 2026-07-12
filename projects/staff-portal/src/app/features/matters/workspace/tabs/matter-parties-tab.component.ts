import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  MATTER_PARTY_ROLES,
  MatterParty,
  MatterPartyInput,
  MatterPartyRole,
  MattersService,
  StatusChipComponent,
} from 'shared';

interface PartyFormValue {
  name: string;
  partyRole: MatterPartyRole;
  advocateName: string;
  contact: string;
}

function buildPartyForm(party?: MatterParty): FormGroup<{
  name: FormControl<string>;
  partyRole: FormControl<MatterPartyRole>;
  advocateName: FormControl<string>;
  contact: FormControl<string>;
}> {
  return new FormGroup({
    name: new FormControl(party?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    partyRole: new FormControl<MatterPartyRole>(party?.partyRole ?? 'Client', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    advocateName: new FormControl(party?.advocateName ?? '', { nonNullable: true }),
    contact: new FormControl(party?.contact ?? '', { nonNullable: true }),
  });
}

function toInput(value: PartyFormValue): MatterPartyInput {
  return {
    name: value.name,
    partyRole: value.partyRole,
    advocateName: value.advocateName || null,
    contact: value.contact || null,
  };
}

/**
 * Parties tab for the matter workspace (PRD Module 4).
 * Self-contained CRUD sub-grid: fetches its own data from `matterId` and
 * manages its own loading/error/empty states, mirroring the shape of
 * `ContactSubGridComponent` in the Clients module.
 */
@Component({
  selector: 'lf-matter-parties-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
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
    <div class="matter-parties-tab">
      @if (loading()) {
        <div class="matter-parties-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load parties"
          i18n-title="@@matters.matterPartiesTab.loadErrorTitle"
          message="Something went wrong while loading parties."
          i18n-message="@@matters.matterPartiesTab.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@matters.matterPartiesTab.retryButton"
          (cta)="load()"
        />
      } @else {
        @if (parties().length === 0 && !addingNew()) {
          <lf-empty-state
            icon="groups"
            title="No parties yet"
            i18n-title="@@matters.matterPartiesTab.emptyTitle"
            ctaLabel="Add party"
            i18n-ctaLabel="@@matters.matterPartiesTab.addPartyButton"
            (cta)="startAdd()"
          />
        } @else {
          <table class="matter-parties-tab__table">
            <thead>
              <tr>
                <th i18n="@@matters.matterPartiesTab.nameColumn">Name</th>
                <th i18n="@@matters.matterPartiesTab.roleColumn">Role</th>
                <th i18n="@@matters.matterPartiesTab.advocateColumn">Advocate</th>
                <th i18n="@@matters.matterPartiesTab.contactColumn">Contact</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (party of parties(); track party.id) {
                @if (editingId() === party.id) {
                  <tr class="matter-parties-tab__edit-row">
                    <td colspan="6">
                      <form [formGroup]="editForm!" class="matter-parties-tab__form">
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.matterPartiesTab.nameLabel">Name</mat-label>
                          <input matInput formControlName="name" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.matterPartiesTab.roleLabel">Role</mat-label>
                          <mat-select formControlName="partyRole">
                            @for (role of partyRoles; track role) {
                              <mat-option [value]="role">{{ role }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.matterPartiesTab.advocateNameLabel"
                            >Advocate name</mat-label
                          >
                          <input matInput formControlName="advocateName" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@matters.matterPartiesTab.contactLabel"
                            >Contact</mat-label
                          >
                          <input matInput formControlName="contact" />
                        </mat-form-field>
                        <div class="matter-parties-tab__form-actions">
                          <button
                            mat-button
                            type="button"
                            (click)="cancelEdit()"
                            i18n="@@matters.matterPartiesTab.cancelButton"
                          >
                            Cancel
                          </button>
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
                              <span i18n="@@matters.matterPartiesTab.saveButton">Save</span>
                            }
                          </button>
                        </div>
                        @if (errorMessage()) {
                          <p class="matter-parties-tab__error" role="alert">{{ errorMessage() }}</p>
                        }
                      </form>
                    </td>
                  </tr>
                } @else {
                  <tr>
                    <td>{{ party.name }}</td>
                    <td><lf-status-chip [label]="party.partyRole" toneOverride="info" /></td>
                    <td>{{ party.advocateName ?? '—' }}</td>
                    <td>{{ party.contact ?? '—' }}</td>
                    <td>
                      <button
                        mat-icon-button
                        type="button"
                        aria-label="Edit party"
                        i18n-aria-label="@@matters.matterPartiesTab.editPartyAriaLabel"
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
                        i18n-aria-label="@@matters.matterPartiesTab.deletePartyAriaLabel"
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
          <form
            [formGroup]="addForm"
            class="matter-parties-tab__form matter-parties-tab__form--add"
          >
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.matterPartiesTab.nameLabel">Name</mat-label>
              <input matInput formControlName="name" />
              @if (addForm.controls.name.hasError('required') && addForm.controls.name.touched) {
                <mat-error i18n="@@matters.matterPartiesTab.nameRequiredError"
                  >Name is required.</mat-error
                >
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.matterPartiesTab.roleLabel">Role</mat-label>
              <mat-select formControlName="partyRole">
                @for (role of partyRoles; track role) {
                  <mat-option [value]="role">{{ role }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.matterPartiesTab.advocateNameLabel"
                >Advocate name</mat-label
              >
              <input matInput formControlName="advocateName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.matterPartiesTab.contactLabel">Contact</mat-label>
              <input matInput formControlName="contact" />
            </mat-form-field>
            <div class="matter-parties-tab__form-actions">
              <button
                mat-button
                type="button"
                (click)="cancelAdd()"
                i18n="@@matters.matterPartiesTab.cancelButton"
              >
                Cancel
              </button>
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
                  <span i18n="@@matters.matterPartiesTab.addPartyButton">Add party</span>
                }
              </button>
            </div>
            @if (errorMessage()) {
              <p class="matter-parties-tab__error" role="alert">{{ errorMessage() }}</p>
            }
          </form>
        } @else if (parties().length > 0) {
          <button mat-stroked-button type="button" (click)="startAdd()">
            <mat-icon>add</mat-icon>
            <span i18n="@@matters.matterPartiesTab.addPartyButton">Add party</span>
          </button>
        }
      }
    </div>
  `,
  styles: `
    .matter-parties-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .matter-parties-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .matter-parties-tab__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--lf-text-sm);
    }

    .matter-parties-tab__table th {
      text-align: left;
      color: var(--lf-on-surface-variant);
      font-weight: 600;
      font-size: var(--lf-text-xs);
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .matter-parties-tab__table td {
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
      vertical-align: middle;
    }

    .matter-parties-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      align-items: start;
      padding: var(--lf-space-2) 0;
    }

    .matter-parties-tab__form--add {
      border-top: 1px dashed var(--lf-surface-variant);
      margin-top: var(--lf-space-1);
    }

    .matter-parties-tab__form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .matter-parties-tab__error {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class MatterPartiesTabComponent {
  private readonly mattersService = inject(MattersService);
  private readonly dialog = inject(MatDialog);

  readonly matterId = input.required<string>();

  readonly partyRoles = MATTER_PARTY_ROLES;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly parties = signal<MatterParty[]>([]);

  readonly addingNew = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  addForm = buildPartyForm();
  editForm: ReturnType<typeof buildPartyForm> | null = null;

  constructor() {
    effect(() => {
      const id = this.matterId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.mattersService.listParties(this.matterId()).subscribe({
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
    this.mattersService.addParty(this.matterId(), input).subscribe({
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

  startEdit(party: MatterParty): void {
    this.editForm = buildPartyForm(party);
    this.errorMessage.set(null);
    this.editingId.set(party.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editForm = null;
    this.errorMessage.set(null);
  }

  submitEdit(party: MatterParty): void {
    if (!this.editForm || this.editForm.invalid) {
      this.editForm?.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const input = toInput(this.editForm.getRawValue());
    this.mattersService.updateParty(this.matterId(), party.id, input).subscribe({
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

  deleteParty(party: MatterParty): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Remove this party?',
          message: `"${party.name}" will be removed from this matter's parties list.`,
          confirmLabel: 'Remove',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.mattersService.deleteParty(this.matterId(), party.id).subscribe({
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
