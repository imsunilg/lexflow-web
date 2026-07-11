import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';

type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type TextItem = TextContent['items'][number];
import { DocumentsService } from 'shared';

/**
 * The pdf.js worker MUST be resolved as a bundled asset URL (not a bare
 * specifier) for the esbuild-based `@angular/build:application` builder to
 * pick it up and emit it alongside the app bundle.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfPreviewDialogData {
  documentId: string;
  title: string;
}

interface PageTextCache {
  content: TextContent;
  joined: string;
}

interface SearchMatch {
  page: number;
  itemIndex: number;
}

const PAGE_SCALE = 1.25;

/**
 * PRD Module 7 UI Components: "preview modal with text-layer search".
 * User Flow 6: in-browser PDF viewer (pdf.js) with search-hit highlighting.
 */
@Component({
  selector: 'lf-pdf-preview-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-preview-dialog.component.html',
  styleUrl: './pdf-preview-dialog.component.scss',
})
export class PdfPreviewDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly documentsService = inject(DocumentsService);
  readonly data = inject<PdfPreviewDialogData>(MAT_DIALOG_DATA);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');
  private readonly textLayerRef = viewChild<ElementRef<HTMLDivElement>>('textLayerHost');

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly numPages = signal(0);
  readonly currentPage = signal(1);
  readonly rendering = signal(false);
  readonly searching = signal(false);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly matches = signal<SearchMatch[]>([]);
  readonly currentMatchIndex = signal(0);
  readonly hasSearched = signal(false);

  private pdfDoc: PDFDocumentProxy | null = null;
  private readonly pageTextCache = new Map<number, PageTextCache>();
  private activeTextLayer: TextLayer | null = null;
  private renderToken = 0;

  constructor() {
    this.loadDocument();
  }

  get downloadUrl(): string {
    return this.documentsService.downloadUrl(this.data.documentId);
  }

  private loadDocument(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.http
      .get(this.documentsService.previewUrl(this.data.documentId), { responseType: 'arraybuffer' })
      .subscribe({
        next: async (buffer) => {
          try {
            this.pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
            this.numPages.set(this.pdfDoc.numPages);
            this.loading.set(false);
            await this.renderPage(1);
          } catch {
            this.loading.set(false);
            this.loadFailed.set(true);
          }
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  private async getPageText(pageNo: number): Promise<PageTextCache> {
    const cached = this.pageTextCache.get(pageNo);
    if (cached) return cached;
    const page = await this.pdfDoc!.getPage(pageNo);
    const content = await page.getTextContent();
    const joined = content.items.map((item: TextItem) => ('str' in item ? item.str : '')).join(' ');
    const entry: PageTextCache = { content, joined };
    this.pageTextCache.set(pageNo, entry);
    return entry;
  }

  async renderPage(pageNo: number): Promise<void> {
    if (!this.pdfDoc || pageNo < 1 || pageNo > this.numPages()) return;
    const token = ++this.renderToken;
    this.rendering.set(true);
    this.currentPage.set(pageNo);

    const page = await this.pdfDoc.getPage(pageNo);
    if (token !== this.renderToken) return;
    const viewport = page.getViewport({ scale: PAGE_SCALE });

    const canvasEl = this.canvasRef()?.nativeElement;
    const textLayerEl = this.textLayerRef()?.nativeElement;
    if (!canvasEl || !textLayerEl) {
      this.rendering.set(false);
      return;
    }
    canvasEl.width = viewport.width;
    canvasEl.height = viewport.height;
    canvasEl.style.width = `${viewport.width}px`;
    canvasEl.style.height = `${viewport.height}px`;

    await page.render({ canvas: canvasEl, viewport }).promise;
    if (token !== this.renderToken) return;

    this.activeTextLayer?.cancel();
    textLayerEl.innerHTML = '';
    textLayerEl.style.width = `${viewport.width}px`;
    textLayerEl.style.height = `${viewport.height}px`;

    const { content } = await this.getPageText(pageNo);
    if (token !== this.renderToken) return;

    const textLayer = new TextLayer({
      textContentSource: content,
      container: textLayerEl,
      viewport,
    });
    this.activeTextLayer = textLayer;
    await textLayer.render();
    if (token !== this.renderToken) return;

    this.applyHighlights();
    this.rendering.set(false);

    void this.prefetchAdjacent(pageNo);
  }

  private async prefetchAdjacent(pageNo: number): Promise<void> {
    const targets = [pageNo - 1, pageNo + 1].filter((p) => p >= 1 && p <= this.numPages());
    for (const p of targets) {
      if (!this.pageTextCache.has(p)) {
        this.getPageText(p).catch(() => undefined);
      }
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) void this.renderPage(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.numPages()) void this.renderPage(this.currentPage() + 1);
  }

  private applyHighlights(): void {
    const query = this.searchControl.value.trim().toLowerCase();
    const textLayerEl = this.textLayerRef()?.nativeElement;
    if (!textLayerEl) return;
    const spans = Array.from(textLayerEl.querySelectorAll<HTMLElement>('span'));
    if (!query) {
      spans.forEach((span) => span.classList.remove('lf-search-hit', 'lf-search-hit--active'));
      return;
    }
    const currentMatch = this.matches()[this.currentMatchIndex()];
    spans.forEach((span, index) => {
      const isHit = (span.textContent ?? '').toLowerCase().includes(query);
      span.classList.toggle('lf-search-hit', isHit);
      const isActive =
        isHit &&
        !!currentMatch &&
        currentMatch.page === this.currentPage() &&
        currentMatch.itemIndex === index;
      span.classList.toggle('lf-search-hit--active', isActive);
      if (isActive) {
        span.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  async runSearch(): Promise<void> {
    const query = this.searchControl.value.trim().toLowerCase();
    this.hasSearched.set(true);
    if (!query || !this.pdfDoc) {
      this.matches.set([]);
      this.currentMatchIndex.set(0);
      this.applyHighlights();
      return;
    }
    this.searching.set(true);
    const found: SearchMatch[] = [];
    for (let pageNo = 1; pageNo <= this.numPages(); pageNo++) {
      const { content } = await this.getPageText(pageNo);
      content.items.forEach((item: TextItem, itemIndex: number) => {
        const str = 'str' in item ? item.str : '';
        if (str.toLowerCase().includes(query)) {
          found.push({ page: pageNo, itemIndex });
        }
      });
    }
    this.matches.set(found);
    this.currentMatchIndex.set(0);
    this.searching.set(false);
    if (found.length > 0) {
      await this.goToMatch(0);
    } else {
      this.applyHighlights();
    }
  }

  async goToMatch(index: number): Promise<void> {
    const matches = this.matches();
    if (index < 0 || index >= matches.length) return;
    this.currentMatchIndex.set(index);
    const match = matches[index];
    if (match.page !== this.currentPage()) {
      await this.renderPage(match.page);
    } else {
      this.applyHighlights();
    }
  }

  nextMatch(): void {
    if (this.matches().length === 0) return;
    void this.goToMatch((this.currentMatchIndex() + 1) % this.matches().length);
  }

  prevMatch(): void {
    if (this.matches().length === 0) return;
    const total = this.matches().length;
    void this.goToMatch((this.currentMatchIndex() - 1 + total) % total);
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.hasSearched.set(false);
    this.matches.set([]);
    this.currentMatchIndex.set(0);
    this.applyHighlights();
  }
}
