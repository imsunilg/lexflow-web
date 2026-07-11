import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  ConfirmDialogComponent,
  DOCUMENT_TYPES,
  DocumentSearchHit,
  DocumentsService,
  DocumentTemplate,
  EmptyStateComponent,
  Folder,
  FoldersService,
  LfDocument,
  StatusChipComponent,
} from 'shared';
import { BulkTagDialogComponent } from './dialogs/bulk-tag-dialog.component';
import {
  CreateFolderDialogComponent,
  CreateFolderDialogData,
} from './dialogs/create-folder-dialog.component';
import {
  SelectFolderDialogComponent,
  SelectFolderDialogData,
} from './dialogs/select-folder-dialog.component';
import { ShareDialogComponent, ShareDialogData } from './dialogs/share-dialog.component';
import {
  SignatureWizardDialogComponent,
  SignatureWizardDialogData,
} from './dialogs/signature-wizard-dialog.component';
import { DocumentDetailDrawerComponent } from './detail/document-detail-drawer.component';
import { FolderTreeComponent } from './folder-tree.component';
import {
  PdfPreviewDialogComponent,
  PdfPreviewDialogData,
} from './preview/pdf-preview-dialog.component';
import {
  MergeWizardDialogComponent,
  MergeWizardDialogData,
} from './templates/merge-wizard-dialog.component';
import { TemplateGalleryDialogComponent } from './templates/template-gallery-dialog.component';
import { DocumentUploadQueueComponent } from './upload/document-upload-queue.component';

interface Breadcrumb {
  id: string | null;
  name: string;
}

/**
 * Documents explorer shell (PRD Module 7 UI Components: "Explorer (tree +
 * list/grid, breadcrumbs, keyboard nav)"). Owns the folder tree + document
 * grid/list, upload panel, bulk-action toolbar, and every dialog/drawer this
 * module launches; the drawer and heavier dialogs are separate components
 * wired in below.
 */
@Component({
  selector: 'lf-documents-explorer-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    EmptyStateComponent,
    StatusChipComponent,
    FolderTreeComponent,
    DocumentUploadQueueComponent,
    DocumentDetailDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents-explorer.page.html',
  styleUrl: './documents-explorer.page.scss',
})
export class DocumentsExplorerPage {
  private readonly documentsService = inject(DocumentsService);
  private readonly foldersService = inject(FoldersService);
  private readonly dialog = inject(MatDialog);

  readonly docTypes = DOCUMENT_TYPES;

  readonly folders = signal<Folder[]>([]);
  readonly currentFolderId = signal<string | null>(null);
  readonly documents = signal<LfDocument[]>([]);
  readonly loading = signal(true);
  readonly viewMode = signal<'list' | 'grid'>('grid');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly uploadPanelOpen = signal(false);
  readonly detailDocument = signal<LfDocument | null>(null);

  readonly searchResults = signal<DocumentSearchHit[] | null>(null);
  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly docTypeFilter = new FormControl<string | null>(null);

  readonly breadcrumbs = computed<Breadcrumb[]>(() => {
    const byId = new Map(this.folders().map((f) => [f.id, f]));
    const trail: Breadcrumb[] = [{ id: null, name: 'Firm root' }];
    const chain: Breadcrumb[] = [];
    let cursor = this.currentFolderId();
    while (cursor) {
      const folder = byId.get(cursor);
      if (!folder) break;
      chain.unshift({ id: folder.id, name: folder.name });
      cursor = folder.parentId;
    }
    return [...trail, ...chain];
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  constructor() {
    this.loadFolders();
    this.loadDocuments();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.runSearch(q));

    this.docTypeFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadDocuments());
  }

  loadFolders(): void {
    this.foldersService.list().subscribe((folders) => this.folders.set(folders));
  }

  loadDocuments(): void {
    this.loading.set(true);
    this.documentsService
      .list({
        folderId: this.currentFolderId() ?? undefined,
        docType: this.docTypeFilter.value ?? undefined,
      })
      .subscribe({
        next: (documents) => {
          this.documents.set(documents);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  runSearch(q: string): void {
    if (!q) {
      this.searchResults.set(null);
      return;
    }
    this.documentsService.search({ q }).subscribe((hits) => this.searchResults.set(hits));
  }

  navigateToFolder(id: string | null): void {
    this.currentFolderId.set(id);
    this.clearSelection();
    this.loadDocuments();
  }

  toggleViewMode(): void {
    this.viewMode.update((mode) => (mode === 'grid' ? 'list' : 'grid'));
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  openCreateFolder(): void {
    this.dialog
      .open<CreateFolderDialogComponent, CreateFolderDialogData>(CreateFolderDialogComponent, {
        data: { parentId: this.currentFolderId() },
      })
      .afterClosed()
      .subscribe((folder) => {
        if (folder) this.loadFolders();
      });
  }

  openUpload(): void {
    this.uploadPanelOpen.update((open) => !open);
  }

  onDocumentUploaded(): void {
    this.loadDocuments();
  }

  openDetail(document: LfDocument): void {
    this.detailDocument.set(document);
  }

  closeDetail(): void {
    this.detailDocument.set(null);
  }

  onMetadataSaved(updated: LfDocument): void {
    this.documents.update((docs) => docs.map((d) => (d.id === updated.id ? updated : d)));
    this.detailDocument.set(updated);
  }

  onDocumentDeleted(id: string): void {
    this.documents.update((docs) => docs.filter((d) => d.id !== id));
    this.detailDocument.set(null);
  }

  openPreview(document: LfDocument): void {
    this.dialog.open<PdfPreviewDialogComponent, PdfPreviewDialogData>(PdfPreviewDialogComponent, {
      data: { documentId: document.id, title: document.title },
      panelClass: 'lf-fullscreen-dialog',
    });
  }

  openShare(document: LfDocument): void {
    this.dialog.open<ShareDialogComponent, ShareDialogData>(ShareDialogComponent, {
      data: { document },
    });
  }

  openSign(document: LfDocument): void {
    this.dialog.open<SignatureWizardDialogComponent, SignatureWizardDialogData>(
      SignatureWizardDialogComponent,
      { data: { document } },
    );
  }

  openTemplateGallery(): void {
    this.dialog
      .open<TemplateGalleryDialogComponent, void, DocumentTemplate | undefined>(
        TemplateGalleryDialogComponent,
      )
      .afterClosed()
      .subscribe((template) => {
        if (!template) return;
        this.dialog
          .open<MergeWizardDialogComponent, MergeWizardDialogData, LfDocument | undefined>(
            MergeWizardDialogComponent,
            { data: { template } },
          )
          .afterClosed()
          .subscribe((generated) => {
            if (generated) this.loadDocuments();
          });
      });
  }

  bulkMove(): void {
    this.dialog
      .open<SelectFolderDialogComponent, SelectFolderDialogData, string | null | undefined>(
        SelectFolderDialogComponent,
        { data: { title: 'Move to folder' } },
      )
      .afterClosed()
      .subscribe((targetFolderId) => {
        if (targetFolderId === undefined) return;
        this.documentsService
          .bulkAction({ action: 'move', ids: [...this.selectedIds()], targetFolderId })
          .subscribe(() => {
            this.clearSelection();
            this.loadDocuments();
          });
      });
  }

  bulkTag(): void {
    this.dialog
      .open<BulkTagDialogComponent, void, string[] | undefined>(BulkTagDialogComponent)
      .afterClosed()
      .subscribe((tags) => {
        if (!tags) return;
        this.documentsService
          .bulkAction({ action: 'tag', ids: [...this.selectedIds()], tagNames: tags })
          .subscribe(() => {
            this.clearSelection();
            this.loadDocuments();
          });
      });
  }

  bulkDelete(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete documents',
          message: `Delete ${this.selectedCount()} document(s)? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.documentsService
          .bulkAction({ action: 'delete', ids: [...this.selectedIds()] })
          .subscribe(() => {
            this.clearSelection();
            this.loadDocuments();
          });
      });
  }

  bulkDownloadZip(): void {
    this.documentsService
      .bulkAction({ action: 'download-zip', ids: [...this.selectedIds()] })
      .subscribe(() => {
        // No confirmed response shape for this action (204 per the backend
        // inventory) — likely an async job; nothing to stream client-side yet.
      });
  }
}
