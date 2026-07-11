import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import {
  CONFIDENTIALITY_LEVELS,
  ConfidentialityLevel,
  ConfirmDialogComponent,
  DOCUMENT_TYPES,
  DocumentsService,
  DocumentType,
  DocumentVersion,
  EmptyStateComponent,
  FileUploaderComponent,
  LfDocument,
  StatusChipComponent,
} from 'shared';

/**
 * Document detail drawer (PRD Module 7 UI Components: "detail drawer
 * (metadata, versions, activity, sharing)"). Always mounted in the explorer
 * page's DOM; renders nothing while `document()` is null and slides in from
 * the right once a document is set.
 *
 * The Activity tab is a confirmed gap: no `document_activity` endpoint
 * exists on the backend despite the PRD/DB describing one, so it shows an
 * honest empty state rather than fabricated history. The Sharing tab is a
 * read-only summary — full link/team/portal management lives in the
 * separate share dialog opened via `shareRequested`.
 */
@Component({
  selector: 'lf-document-detail-drawer',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    EmptyStateComponent,
    FileUploaderComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-detail-drawer.component.html',
  styleUrl: './document-detail-drawer.component.scss',
})
export class DocumentDetailDrawerComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly dialog = inject(MatDialog);

  readonly document = input<LfDocument | null>(null);
  readonly closed = output<void>();
  readonly metadataSaved = output<LfDocument>();
  readonly documentDeleted = output<string>();
  readonly shareRequested = output<LfDocument>();
  readonly signRequested = output<LfDocument>();
  readonly previewRequested = output<LfDocument>();

  readonly docTypes = DOCUMENT_TYPES;
  readonly confidentialityLevels = CONFIDENTIALITY_LEVELS;

  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly versions = signal<DocumentVersion[]>([]);
  readonly versionsLoading = signal(false);
  readonly uploadingVersion = signal(false);
  readonly uploadProgress = signal<number | null>(null);

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    docType: new FormControl<DocumentType>(DOCUMENT_TYPES[0], { nonNullable: true }),
    confidentiality: new FormControl<ConfidentialityLevel>(CONFIDENTIALITY_LEVELS[0], {
      nonNullable: true,
    }),
  });

  constructor() {
    effect(() => {
      const doc = this.document();
      this.errorMessage.set(null);
      if (!doc) {
        this.versions.set([]);
        return;
      }
      this.form.reset({
        title: doc.title,
        docType: doc.docType,
        confidentiality: doc.confidentiality,
      });
      this.loadVersions(doc.id);
    });
  }

  loadVersions(id: string): void {
    this.versionsLoading.set(true);
    this.documentsService.listVersions(id).subscribe({
      next: (versions) => {
        this.versions.set(versions);
        this.versionsLoading.set(false);
      },
      error: () => this.versionsLoading.set(false),
    });
  }

  close(): void {
    this.closed.emit();
  }

  saveMetadata(): void {
    const doc = this.document();
    if (!doc || this.form.invalid) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    this.documentsService
      .updateMetadata(doc.id, {
        title: value.title,
        docType: value.docType,
        confidentiality: value.confidentiality,
        folderId: doc.folderId,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.metadataSaved.emit(updated);
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Could not save changes. Please try again.');
        },
      });
  }

  deleteDocument(): void {
    const doc = this.document();
    if (!doc) return;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete document',
          message: `Delete "${doc.title}"? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleting.set(true);
        this.documentsService.delete(doc.id).subscribe({
          next: () => {
            this.deleting.set(false);
            this.documentDeleted.emit(doc.id);
          },
          error: () => {
            this.deleting.set(false);
            this.errorMessage.set('Could not delete document. Please try again.');
          },
        });
      });
  }

  requestPreview(): void {
    const doc = this.document();
    if (doc) this.previewRequested.emit(doc);
  }

  requestShare(): void {
    const doc = this.document();
    if (doc) this.shareRequested.emit(doc);
  }

  requestSign(): void {
    const doc = this.document();
    if (doc) this.signRequested.emit(doc);
  }

  downloadUrl(versionDocId: string): string {
    return this.documentsService.downloadUrl(versionDocId);
  }

  restoreVersion(versionNo: number): void {
    const doc = this.document();
    if (!doc) return;
    this.documentsService.restoreVersion(doc.id, versionNo).subscribe({
      next: () => this.loadVersions(doc.id),
      error: () => this.errorMessage.set('Could not restore that version. Please try again.'),
    });
  }

  uploadNewVersion(files: File[]): void {
    const doc = this.document();
    const file = files[0];
    if (!doc || !file) return;

    this.uploadingVersion.set(true);
    this.uploadProgress.set(0);
    this.documentsService.uploadVersion(doc.id, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response) {
          this.uploadingVersion.set(false);
          this.uploadProgress.set(null);
          this.loadVersions(doc.id);
        }
      },
      error: () => {
        this.uploadingVersion.set(false);
        this.uploadProgress.set(null);
        this.errorMessage.set('Could not upload new version. Please try again.');
      },
    });
  }

  isCurrentVersion(version: DocumentVersion): boolean {
    return version.id === this.document()?.currentVersionId;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
