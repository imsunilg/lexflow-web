import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ClientContact,
  ClientContactInput,
  ClientsService,
  ConfirmDialogComponent,
  EmptyStateComponent,
  StatusChipComponent,
  catalogValidators,
} from 'shared';

interface ContactFormValue {
  name: string;
  designation: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

function buildContactForm(contact?: ClientContact): FormGroup<{
  name: FormControl<string>;
  designation: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  isPrimary: FormControl<boolean>;
}> {
  return new FormGroup({
    name: new FormControl(contact?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    designation: new FormControl(contact?.designation ?? '', { nonNullable: true }),
    email: new FormControl(contact?.email ?? '', {
      nonNullable: true,
      validators: catalogValidators('email'),
    }),
    phone: new FormControl(contact?.phone ?? '', { nonNullable: true }),
    isPrimary: new FormControl(contact?.isPrimary ?? false, { nonNullable: true }),
  });
}

function toInput(value: ContactFormValue): ClientContactInput {
  return {
    name: value.name,
    designation: value.designation || null,
    email: value.email || null,
    phone: value.phone || null,
    isPrimary: value.isPrimary,
  };
}

/**
 * Contact-person sub-grid for the client 360 detail page (PRD Module 3).
 * Self-contained: fetches its own data from `clientId` and manages its own
 * loading/error/empty states so it can be dropped into any host tab.
 */
@Component({
  selector: 'lf-contact-sub-grid',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="contact-sub-grid">
      @if (loading()) {
        <div class="contact-sub-grid__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load contacts"
          i18n-title="@@clients.contactSubGrid.loadErrorTitle"
          message="Something went wrong while loading contact persons."
          i18n-message="@@clients.contactSubGrid.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@clients.contactSubGrid.retryCta"
          (cta)="load()"
        />
      } @else {
        @if (contacts().length === 0 && !addingNew()) {
          <lf-empty-state
            icon="contacts"
            title="No contact persons yet"
            i18n-title="@@clients.contactSubGrid.emptyTitle"
            ctaLabel="Add contact"
            i18n-ctaLabel="@@clients.contactSubGrid.addContactCta"
            (cta)="startAdd()"
          />
        } @else {
          <table class="contact-sub-grid__table">
            <thead>
              <tr>
                <th i18n="@@clients.contactSubGrid.nameHeader">Name</th>
                <th i18n="@@clients.contactSubGrid.designationHeader">Designation</th>
                <th i18n="@@clients.contactSubGrid.emailHeader">Email</th>
                <th i18n="@@clients.contactSubGrid.phoneHeader">Phone</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (contact of contacts(); track contact.id) {
                @if (editingId() === contact.id) {
                  <tr class="contact-sub-grid__edit-row">
                    <td colspan="6">
                      <form [formGroup]="editForm!" class="contact-sub-grid__form">
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@clients.contactSubGrid.formNameLabel">Name</mat-label>
                          <input matInput formControlName="name" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@clients.contactSubGrid.formDesignationLabel"
                            >Designation</mat-label
                          >
                          <input matInput formControlName="designation" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@clients.contactSubGrid.formEmailLabel"
                            >Email</mat-label
                          >
                          <input matInput formControlName="email" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label i18n="@@clients.contactSubGrid.formPhoneLabel"
                            >Phone</mat-label
                          >
                          <input matInput formControlName="phone" />
                        </mat-form-field>
                        <mat-checkbox
                          formControlName="isPrimary"
                          i18n="@@clients.contactSubGrid.primaryCheckbox"
                          >Primary</mat-checkbox
                        >
                        <div class="contact-sub-grid__form-actions">
                          <button
                            mat-button
                            type="button"
                            (click)="cancelEdit()"
                            i18n="@@clients.contactSubGrid.cancelButton"
                          >
                            Cancel
                          </button>
                          <button
                            mat-flat-button
                            color="primary"
                            type="button"
                            [disabled]="editForm!.invalid || saving()"
                            (click)="submitEdit(contact)"
                          >
                            @if (saving()) {
                              <mat-spinner diameter="18" />
                            } @else {
                              <span i18n="@@clients.contactSubGrid.saveButton">Save</span>
                            }
                          </button>
                        </div>
                        @if (errorMessage()) {
                          <p class="contact-sub-grid__error" role="alert">{{ errorMessage() }}</p>
                        }
                      </form>
                    </td>
                  </tr>
                } @else {
                  <tr>
                    <td>
                      {{ contact.name }}
                      @if (contact.isPrimary) {
                        <lf-status-chip
                          label="Primary"
                          i18n-label="@@clients.contactSubGrid.primaryCheckbox"
                          toneOverride="info"
                        />
                      }
                    </td>
                    <td>{{ contact.designation ?? '—' }}</td>
                    <td>{{ contact.email ?? '—' }}</td>
                    <td>{{ contact.phone ?? '—' }}</td>
                    <td>
                      <button
                        mat-icon-button
                        type="button"
                        aria-label="Edit contact"
                        i18n-aria-label="@@clients.contactSubGrid.editAriaLabel"
                        (click)="startEdit(contact)"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                    </td>
                    <td>
                      <button
                        mat-icon-button
                        type="button"
                        aria-label="Delete contact"
                        i18n-aria-label="@@clients.contactSubGrid.deleteAriaLabel"
                        (click)="deleteContact(contact)"
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
          <form [formGroup]="addForm" class="contact-sub-grid__form contact-sub-grid__form--add">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.contactSubGrid.formNameLabel">Name</mat-label>
              <input matInput formControlName="name" />
              @if (addForm.controls.name.hasError('required') && addForm.controls.name.touched) {
                <mat-error i18n="@@clients.contactSubGrid.nameRequiredError"
                  >Name is required.</mat-error
                >
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.contactSubGrid.formDesignationLabel"
                >Designation</mat-label
              >
              <input matInput formControlName="designation" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.contactSubGrid.formEmailLabel">Email</mat-label>
              <input matInput formControlName="email" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.contactSubGrid.formPhoneLabel">Phone</mat-label>
              <input matInput formControlName="phone" />
            </mat-form-field>
            <mat-checkbox
              formControlName="isPrimary"
              i18n="@@clients.contactSubGrid.primaryCheckbox"
              >Primary</mat-checkbox
            >
            <div class="contact-sub-grid__form-actions">
              <button
                mat-button
                type="button"
                (click)="cancelAdd()"
                i18n="@@clients.contactSubGrid.cancelButton"
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
                  <span i18n="@@clients.contactSubGrid.addContactButton">Add contact</span>
                }
              </button>
            </div>
            @if (errorMessage()) {
              <p class="contact-sub-grid__error" role="alert">{{ errorMessage() }}</p>
            }
          </form>
        } @else if (contacts().length > 0) {
          <button mat-stroked-button type="button" (click)="startAdd()">
            <mat-icon>add</mat-icon>
            <span i18n="@@clients.contactSubGrid.addContactButton">Add contact</span>
          </button>
        }
      }
    </div>
  `,
  styles: `
    .contact-sub-grid {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .contact-sub-grid__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .contact-sub-grid__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--lf-text-sm);
    }

    .contact-sub-grid__table th {
      text-align: left;
      color: var(--lf-on-surface-variant);
      font-weight: 600;
      font-size: var(--lf-text-xs);
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .contact-sub-grid__table td {
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
      vertical-align: middle;
    }

    .contact-sub-grid__form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      align-items: start;
      padding: var(--lf-space-2) 0;
    }

    .contact-sub-grid__form--add {
      border-top: 1px dashed var(--lf-surface-variant);
      margin-top: var(--lf-space-1);
    }

    .contact-sub-grid__form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .contact-sub-grid__error {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class ContactSubGridComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly dialog = inject(MatDialog);

  readonly clientId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly contacts = signal<ClientContact[]>([]);

  readonly addingNew = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  addForm = buildContactForm();
  editForm: ReturnType<typeof buildContactForm> | null = null;

  constructor() {
    effect(() => {
      const id = this.clientId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.clientsService.listContacts(this.clientId()).subscribe({
      next: (contacts) => {
        this.contacts.set(contacts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  startAdd(): void {
    this.addForm = buildContactForm();
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
    this.clientsService.addContact(this.clientId(), input).subscribe({
      next: (contact) => {
        this.contacts.update((contacts) => [...contacts, contact]);
        this.saving.set(false);
        this.addingNew.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }

  startEdit(contact: ClientContact): void {
    this.editForm = buildContactForm(contact);
    this.errorMessage.set(null);
    this.editingId.set(contact.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editForm = null;
    this.errorMessage.set(null);
  }

  submitEdit(contact: ClientContact): void {
    if (!this.editForm || this.editForm.invalid) {
      this.editForm?.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const input = toInput(this.editForm.getRawValue());
    this.clientsService.updateContact(this.clientId(), contact.id, input).subscribe({
      next: (updated) => {
        this.contacts.update((contacts) =>
          contacts.map((existing) => (existing.id === updated.id ? updated : existing)),
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

  deleteContact(contact: ClientContact): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Remove this contact?',
          message: `"${contact.name}" will be removed from this client's contact list.`,
          confirmLabel: 'Remove',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.clientsService.deleteContact(this.clientId(), contact.id).subscribe({
          next: () => {
            this.contacts.update((contacts) => contacts.filter((c) => c.id !== contact.id));
          },
          error: () => {
            this.errorMessage.set('Failed to remove contact. Please try again.');
          },
        });
      });
  }
}
