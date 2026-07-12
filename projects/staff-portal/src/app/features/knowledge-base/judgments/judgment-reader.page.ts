import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  CourtLookupsService,
  DocumentsService,
  EmptyStateComponent,
  KbJudgment,
  KbJudgmentsService,
} from 'shared';

/** Same worker-URL requirement as `pdf-preview-dialog.component.ts` — must be a bundled asset URL, not a bare specifier, for esbuild to pick it up. */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PAGE_SCALE = 1.25;

/**
 * Judgment reader (PRD Module 12 UI Components: "judgment reader (metadata
 * header, headnote, PDF viewer, 'cited in N matters')"). The PDF viewer
 * reuses the same pdf.js technique as the Documents module's
 * `PdfPreviewDialogComponent` (Module 7), simplified to a plain pager since
 * this is an embedded read-only reader, not a search-in-PDF dialog.
 * "Cited in N matters" is a real backend-computed count
 * (`GET /kb/judgments/{id}/pin-count`), but it counts pin *rows*, not
 * distinct matters — a judgment pinned twice into the same matter would be
 * over-counted (no generic, correctly-deduped endpoint exists), so the UI
 * flags this caveat via a tooltip rather than presenting the number as exact.
 */
@Component({
  selector: 'lf-judgment-reader-page',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './judgment-reader.page.html',
  styleUrl: './judgment-reader.page.scss',
})
export class JudgmentReaderPage {
  private readonly http = inject(HttpClient);
  private readonly kbJudgmentsService = inject(KbJudgmentsService);
  private readonly documentsService = inject(DocumentsService);
  private readonly courtLookupsService = inject(CourtLookupsService);
  private readonly route = inject(ActivatedRoute);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  readonly loading = signal(true);
  readonly judgment = signal<KbJudgment | null>(null);
  readonly courtName = signal<string | null>(null);
  readonly pinCount = signal<number | null>(null);

  readonly pdfLoading = signal(false);
  readonly pdfFailed = signal(false);
  readonly numPages = signal(0);
  readonly currentPage = signal(1);
  private pdfDoc: PDFDocumentProxy | null = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.kbJudgmentsService.get(id).subscribe((judgment) => {
      this.judgment.set(judgment);
      this.loading.set(false);
      if (judgment.courtId) this.resolveCourtName(judgment.courtId);
      if (judgment.documentId) this.loadPdf(judgment.documentId);
    });

    this.kbJudgmentsService.pinCount(id).subscribe((count) => this.pinCount.set(count));
  }

  private resolveCourtName(courtId: string): void {
    this.courtLookupsService.courts().subscribe((courts) => {
      this.courtName.set(courts.find((c) => c.id === courtId)?.name ?? null);
    });
  }

  private loadPdf(documentId: string): void {
    this.pdfLoading.set(true);
    this.pdfFailed.set(false);
    this.http
      .get(this.documentsService.previewUrl(documentId), { responseType: 'arraybuffer' })
      .subscribe({
        next: async (buffer) => {
          try {
            this.pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
            this.numPages.set(this.pdfDoc.numPages);
            this.pdfLoading.set(false);
            await this.renderPage(1);
          } catch {
            this.pdfLoading.set(false);
            this.pdfFailed.set(true);
          }
        },
        error: () => {
          this.pdfLoading.set(false);
          this.pdfFailed.set(true);
        },
      });
  }

  async renderPage(pageNo: number): Promise<void> {
    if (!this.pdfDoc || pageNo < 1 || pageNo > this.numPages()) return;
    this.currentPage.set(pageNo);
    const page = await this.pdfDoc.getPage(pageNo);
    const viewport = page.getViewport({ scale: PAGE_SCALE });
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;
    canvasEl.width = viewport.width;
    canvasEl.height = viewport.height;
    await page.render({ canvas: canvasEl, viewport }).promise;
  }

  prevPage(): void {
    if (this.currentPage() > 1) void this.renderPage(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.numPages()) void this.renderPage(this.currentPage() + 1);
  }
}
