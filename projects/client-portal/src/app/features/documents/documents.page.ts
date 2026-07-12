import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmptyStateComponent } from 'shared';
import {
  PORTAL_MAX_UPLOAD_BYTES,
  PortalDocument,
  PortalMatterSummary,
} from '../../core/models/portal.models';
import { PortalDocumentsService } from '../../core/services/portal-documents.service';
import { PortalMattersService } from '../../core/services/portal-matters.service';

/**
 * Documents (PRD Module 17 step 5): documents the firm has published to the
 * portal (view/download), plus upload-to-firm into the matter's "Client
 * Uploads" folder. Backend enforces a 25 MB cap and re-uses the staff
 * upload pipeline (AV-scan included) — mirrored client-side only for instant
 * feedback, not as the source of truth.
 */
@Component({
  selector: 'lf-portal-documents-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
})
export class DocumentsPage {
  private readonly documentsService = inject(PortalDocumentsService);
  private readonly mattersService = inject(PortalMattersService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly documents = signal<PortalDocument[]>([]);
  readonly matters = signal<PortalMatterSummary[]>([]);

  readonly uploadForm = new FormGroup({
    matterId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly selectedFile = signal<File | null>(null);
  readonly fileTooLarge = signal(false);
  readonly uploading = signal(false);

  constructor() {
    this.documentsService.list().subscribe((documents) => {
      this.documents.set(documents);
      this.loading.set(false);
    });
    this.mattersService.getMyMatters().subscribe((matters) => this.matters.set(matters));
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileTooLarge.set(!!file && file.size > PORTAL_MAX_UPLOAD_BYTES);
    this.selectedFile.set(file);
  }

  download(document: PortalDocument): void {
    this.documentsService.getDownloadUrl(document.id).subscribe((result) => {
      window.open(result.url, '_blank', 'noopener');
    });
  }

  upload(): void {
    const file = this.selectedFile();
    if (this.uploadForm.invalid || !file || this.fileTooLarge()) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    const value = this.uploadForm.getRawValue();
    this.documentsService.upload(file, value).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.uploadForm.reset({ matterId: '', title: '' });
          if (event.body) {
            this.documents.update((documents) => [event.body!.data, ...documents]);
          }
          this.snackBar.open('Document uploaded — your lawyer has been notified.', 'Dismiss', {
            duration: 4000,
          });
        }
      },
      error: () => {
        this.uploading.set(false);
        this.snackBar.open('Upload failed. Please try again.', 'Dismiss', { duration: 5000 });
      },
    });
  }
}
