import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EMPTY, expand, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { DOCUMENT_TYPES, DocumentsService, FileUploaderComponent, LfDocument } from 'shared';

type PipelineStage = 'Uploading' | 'Scanning' | 'OCR' | 'Indexed' | 'OcrFailed' | 'Failed';

interface QueueItem {
  id: string;
  fileName: string;
  progress: number;
  stage: PipelineStage;
  document: LfDocument | null;
  error: string | null;
}

/**
 * Multi-file drag-drop uploader with a per-file pipeline-status chip
 * (PRD Module 7 UI Components: "uploader with per-file progress + pipeline
 * status chips (Scanning/OCR/Indexed)"). There's no SignalR hub for
 * upload/OCR progress specific to documents (confirmed against the backend —
 * only a generic `/hubs/jobs` exists with no confirmed document producer), so
 * post-upload pipeline status is approximated by polling
 * `GET /documents/{id}/versions` a few times rather than a live push.
 */
@Component({
  selector: 'lf-document-upload-queue',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, FileUploaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-file-uploader [multiple]="true" (filesSelected)="onFilesSelected($event)" />

    @if (items().length > 0) {
      <ul class="upload-queue">
        @for (item of items(); track item.id) {
          <li class="upload-queue__row">
            <mat-icon>description</mat-icon>
            <span class="upload-queue__name">{{ item.fileName }}</span>
            @if (item.stage === 'Uploading') {
              <mat-progress-bar
                mode="determinate"
                [value]="item.progress"
                class="upload-queue__bar"
              />
            }
            <span class="upload-queue__chip" [attr.data-stage]="item.stage">{{ item.stage }}</span>
            @if (item.error) {
              <span class="upload-queue__error">{{ item.error }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .upload-queue {
      list-style: none;
      margin: var(--lf-space-2) 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .upload-queue__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-1);
      padding: 4px var(--lf-space-1);
      border-radius: 6px;
      background: var(--lf-surface-variant);
    }

    .upload-queue__name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--lf-text-sm);
    }

    .upload-queue__bar {
      width: 100px;
    }

    .upload-queue__chip {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: var(--lf-text-xs);
      font-weight: 600;
      background: var(--lf-surface);
    }

    .upload-queue__chip[data-stage='Indexed'] {
      color: var(--lf-success);
    }

    .upload-queue__chip[data-stage='OcrFailed'],
    .upload-queue__chip[data-stage='Failed'] {
      color: var(--lf-error);
    }

    .upload-queue__error {
      color: var(--lf-error);
      font-size: var(--lf-text-xs);
    }
  `,
})
export class DocumentUploadQueueComponent {
  private readonly documentsService = inject(DocumentsService);

  readonly folderId = input<string | null>(null);
  readonly matterId = input<string | null>(null);

  readonly documentUploaded = output<LfDocument>();

  readonly items = signal<QueueItem[]>([]);

  onFilesSelected(files: File[]): void {
    for (const file of files) {
      const id = crypto.randomUUID();
      this.items.update((current) => [
        ...current,
        { id, fileName: file.name, progress: 0, stage: 'Uploading', document: null, error: null },
      ]);
      this.upload(id, file);
    }
  }

  private upload(id: string, file: File): void {
    this.documentsService
      .upload(file, {
        title: file.name,
        docType: DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1],
        confidentiality: 'Normal',
        folderId: this.folderId(),
        matterId: this.matterId(),
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const progress = Math.round((event.loaded / event.total) * 100);
            this.patch(id, { progress });
          } else if (event.type === HttpEventType.Response && event.body) {
            const document = event.body.data;
            this.patch(id, { stage: 'Scanning', document, progress: 100 });
            this.documentUploaded.emit(document);
            this.pollPipelineStatus(id, document.id);
          }
        },
        error: () => this.patch(id, { stage: 'Failed', error: 'Upload failed' }),
      });
  }

  private pollPipelineStatus(id: string, documentId: string): void {
    let attempts = 0;
    this.documentsService
      .listVersions(documentId)
      .pipe(
        catchError(() => of([])),
        expand((versions) => {
          attempts++;
          const current = versions[0];
          const settled = current && ['Indexed', 'OcrFailed'].includes(current.ocrStatus);
          if (settled || attempts >= 12) return EMPTY;
          return timer(5000).pipe(
            switchMap(() =>
              this.documentsService.listVersions(documentId).pipe(catchError(() => of([]))),
            ),
          );
        }),
      )
      .subscribe((versions) => {
        const current = versions[0];
        if (!current) return;
        const stage: PipelineStage =
          current.ocrStatus === 'Indexed'
            ? 'Indexed'
            : current.ocrStatus === 'OcrFailed'
              ? 'OcrFailed'
              : 'OCR';
        this.patch(id, { stage });
      });
  }

  private patch(id: string, changes: Partial<QueueItem>): void {
    this.items.update((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }
}
