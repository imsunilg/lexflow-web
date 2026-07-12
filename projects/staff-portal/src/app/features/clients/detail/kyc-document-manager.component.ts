import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ClientIdentityDocument,
  ClientsService,
  EmptyStateComponent,
  FileUploaderComponent,
  StatusChipComponent,
  StatusChipTone,
} from 'shared';

const DOC_KINDS = [
  'PAN',
  'Aadhaar',
  'Passport',
  'DriverLicense',
  'IncorporationCertificate',
  'BoardResolution',
  'GstCertificate',
] as const;

const EXPIRY_WARNING_DAYS = 30;

function verifyStatusTone(status: ClientIdentityDocument['verifyStatus']): StatusChipTone {
  switch (status) {
    case 'Verified':
      return 'success';
    case 'Pending':
      return 'warn';
    case 'Rejected':
    case 'Expired':
      return 'error';
  }
}

/** Days between today and `expiryDate`; negative when already past. */
function daysUntil(expiryDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / msPerDay);
}

/**
 * KYC identity document manager for the client 360 detail page (PRD Module 3,
 * AC-C2: documents expiring within 30 days are flagged client-side). Masks
 * document numbers to last4 only, per the PII rule — never renders more.
 */
@Component({
  selector: 'lf-kyc-document-manager',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    EmptyStateComponent,
    FileUploaderComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kyc-manager">
      @if (loading()) {
        <div class="kyc-manager__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load identity documents"
          i18n-title="@@clients.kycDocumentManager.loadErrorTitle"
          message="Something went wrong while loading KYC documents."
          i18n-message="@@clients.kycDocumentManager.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@clients.kycDocumentManager.retryCta"
          (cta)="load()"
        />
      } @else {
        @if (documents().length === 0) {
          <lf-empty-state
            icon="badge"
            title="No identity documents uploaded yet."
            i18n-title="@@clients.kycDocumentManager.emptyTitle"
          />
        } @else {
          <div class="kyc-manager__list">
            @for (doc of documents(); track doc.id) {
              <div class="kyc-manager__card">
                <div class="kyc-manager__card-main">
                  <span class="kyc-manager__doc-kind">{{ doc.docKind }}</span>
                  <span class="kyc-manager__last4">•••• {{ doc.last4 }}</span>
                  <span class="kyc-manager__expiry">
                    {{ doc.expiryDate ? 'Expires ' + doc.expiryDate : 'No expiry' }}
                  </span>
                  <lf-status-chip [label]="doc.verifyStatus" [toneOverride]="tone(doc)" />
                  @if (expiryFlag(doc.expiryDate); as flag) {
                    <lf-status-chip [label]="flag" toneOverride="warn" />
                  }
                </div>
                @if (doc.verifyStatus === 'Pending') {
                  <div class="kyc-manager__card-actions">
                    @if (verifyErrorId() === doc.id && verifyErrorMessage()) {
                      <p class="kyc-manager__error" role="alert">{{ verifyErrorMessage() }}</p>
                    }
                    <button
                      mat-stroked-button
                      type="button"
                      [disabled]="verifyingId() === doc.id"
                      (click)="verify(doc, true)"
                    >
                      <span i18n="@@clients.kycDocumentManager.approveButton">Approve</span>
                    </button>
                    <button
                      mat-stroked-button
                      color="warn"
                      type="button"
                      [disabled]="verifyingId() === doc.id"
                      (click)="verify(doc, false)"
                    >
                      <span i18n="@@clients.kycDocumentManager.rejectButton">Reject</span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="kyc-manager__upload">
          <h3
            class="kyc-manager__upload-title"
            i18n="@@clients.kycDocumentManager.uploadSectionTitle"
          >
            Upload document
          </h3>
          <form [formGroup]="uploadForm" class="kyc-manager__upload-form">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.kycDocumentManager.docTypeLabel">Document type</mat-label>
              <mat-select formControlName="docKind">
                @for (kind of docKinds; track kind) {
                  <mat-option [value]="kind">{{ kind }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.kycDocumentManager.docNumberLabel"
                >Document number</mat-label
              >
              <input matInput formControlName="docNumber" />
              @if (
                uploadForm.controls.docNumber.hasError('required') &&
                uploadForm.controls.docNumber.touched
              ) {
                <mat-error i18n="@@clients.kycDocumentManager.docNumberRequiredError"
                  >Document number is required.</mat-error
                >
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@clients.kycDocumentManager.expiryDateLabel"
                >Expiry date (optional)</mat-label
              >
              <input matInput [matDatepicker]="picker" formControlName="expiryDate" />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
            </mat-form-field>
          </form>

          <lf-file-uploader
            accept=".pdf,.jpg,.jpeg,.png"
            (filesSelected)="onFilesSelected($event)"
          />

          @if (selectedFile()) {
            <p
              class="kyc-manager__selected-file"
              i18n="@@clients.kycDocumentManager.selectedFileText"
            >
              Selected: {{ selectedFile()!.name }}
            </p>
          }

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="!canUpload() || uploading()"
            (click)="upload()"
          >
            @if (uploading()) {
              <mat-spinner diameter="18" />
            } @else {
              <span i18n="@@clients.kycDocumentManager.uploadButton">Upload</span>
            }
          </button>

          @if (uploadErrorMessage()) {
            <p class="kyc-manager__error" role="alert">{{ uploadErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .kyc-manager {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .kyc-manager__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .kyc-manager__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .kyc-manager__card {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .kyc-manager__card-main {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--lf-space-1);
    }

    .kyc-manager__doc-kind {
      font-weight: 600;
    }

    .kyc-manager__last4,
    .kyc-manager__expiry {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .kyc-manager__card-actions {
      display: flex;
      align-items: center;
      gap: var(--lf-space-1);
    }

    .kyc-manager__upload {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .kyc-manager__upload-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .kyc-manager__upload-form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0 var(--lf-space-2);
    }

    .kyc-manager__selected-file {
      margin: 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .kyc-manager__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class KycDocumentManagerComponent {
  private readonly clientsService = inject(ClientsService);

  readonly clientId = input.required<string>();

  readonly docKinds = DOC_KINDS;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly documents = signal<ClientIdentityDocument[]>([]);

  readonly verifyingId = signal<string | null>(null);
  readonly verifyErrorId = signal<string | null>(null);
  readonly verifyErrorMessage = signal<string | null>(null);

  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadErrorMessage = signal<string | null>(null);

  readonly uploadForm = new FormGroup({
    docKind: new FormControl<string>(DOC_KINDS[0], { nonNullable: true }),
    docNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    expiryDate: new FormControl<Date | null>(null),
  });

  readonly canUpload = computed(
    () => !!this.selectedFile() && this.uploadForm.controls.docNumber.valid,
  );

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
    this.clientsService.listIdentityDocuments(this.clientId()).subscribe({
      next: (documents) => {
        this.documents.set(documents);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  tone(doc: ClientIdentityDocument): StatusChipTone {
    return verifyStatusTone(doc.verifyStatus);
  }

  expiryFlag(expiryDate: string | null): string | null {
    if (!expiryDate) {
      return null;
    }
    const days = daysUntil(expiryDate);
    if (days < 0) {
      return 'Expired';
    }
    if (days <= EXPIRY_WARNING_DAYS) {
      return 'Expires soon';
    }
    return null;
  }

  onFilesSelected(files: File[]): void {
    this.selectedFile.set(files[0] ?? null);
    this.uploadErrorMessage.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file || this.uploadForm.controls.docNumber.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    this.uploadErrorMessage.set(null);
    const value = this.uploadForm.getRawValue();
    const expiryIso = value.expiryDate ? value.expiryDate.toISOString().slice(0, 10) : null;

    this.clientsService
      .uploadIdentityDocument(this.clientId(), file, value.docKind, value.docNumber, expiryIso)
      .subscribe({
        next: (doc) => {
          this.documents.update((documents) => [doc, ...documents]);
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.uploadForm.reset({ docKind: DOC_KINDS[0], docNumber: '', expiryDate: null });
        },
        error: (err: unknown) => {
          this.uploading.set(false);
          if (err instanceof HttpErrorResponse && err.error?.code === 'MALWARE_DETECTED') {
            this.uploadErrorMessage.set('This file failed a malware scan and was rejected.');
          } else {
            this.uploadErrorMessage.set('Failed to upload document. Please try again.');
          }
        },
      });
  }

  verify(doc: ClientIdentityDocument, approve: boolean): void {
    this.verifyingId.set(doc.id);
    this.verifyErrorId.set(null);
    this.verifyErrorMessage.set(null);
    this.clientsService.verifyIdentityDocument(this.clientId(), doc.id, approve).subscribe({
      next: (updated) => {
        this.documents.update((documents) =>
          documents.map((existing) => (existing.id === updated.id ? updated : existing)),
        );
        this.verifyingId.set(null);
      },
      error: (err: unknown) => {
        this.verifyingId.set(null);
        this.verifyErrorId.set(doc.id);
        if (err instanceof HttpErrorResponse && err.error?.code === 'IDENTITY_DOCUMENT_EXPIRED') {
          this.verifyErrorMessage.set("This document has already expired and can't be verified.");
        } else {
          this.verifyErrorMessage.set('Failed to update verification status. Please try again.');
        }
      },
    });
  }
}
