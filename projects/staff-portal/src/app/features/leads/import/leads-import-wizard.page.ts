import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { interval, switchMap, takeWhile } from 'rxjs';
import { FileUploaderComponent, LeadImportBatch, LeadsService } from 'shared';
import { LeadsTabsComponent } from '../leads-tabs.component';

const TARGET_FIELDS = [
  'FirstName',
  'LastName',
  'Company',
  'Email',
  'Phone',
  'IssueSummary',
] as const;
type TargetField = (typeof TARGET_FIELDS)[number];

type WizardPhase = 'upload' | 'mapping' | 'uploading' | 'progress' | 'done';

/**
 * CSV/XLSX import wizard (PRD Module 2 UI Components / AC-L5). The backend's
 * `LeadImportParser` auto-detects columns by header name (`FirstName`,
 * `LastName`, `Company`, `Email`, `Phone`, `IssueSummary`, case-insensitive)
 * and has no mapping-payload API — so this wizard's mapping step actually
 * takes effect by rewriting the uploaded file's header row client-side to
 * match what the parser expects, for `.csv` files only. `.xlsx` mapping
 * would need a client-side spreadsheet library that isn't a dependency here,
 * so `.xlsx` files skip straight to upload and rely on the backend's own
 * auto-detection (which already reads headers by name).
 *
 * The parser used for preview is a minimal comma-split — it doesn't handle
 * quoted fields containing commas/newlines (a real RFC 4180 parser would);
 * good enough for a mapping preview, not a full CSV engine.
 */
@Component({
  selector: 'lf-staff-leads-import-wizard-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    FileUploaderComponent,
    LeadsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leads-import-wizard.page.html',
  styleUrl: './leads-import-wizard.page.scss',
})
export class LeadsImportWizardPage {
  private readonly leadsService = inject(LeadsService);

  readonly targetFields = TARGET_FIELDS;
  readonly phase = signal<WizardPhase>('upload');
  readonly errorMessage = signal<string | null>(null);

  readonly file = signal<File | null>(null);
  readonly isCsv = computed(() => this.file()?.name.toLowerCase().endsWith('.csv') ?? false);
  readonly sourceHeaders = signal<string[]>([]);
  readonly previewRows = signal<string[][]>([]);
  private csvRows: string[][] = [];
  readonly mapping = signal<Record<TargetField, number | null>>({
    FirstName: null,
    LastName: null,
    Company: null,
    Email: null,
    Phone: null,
    IssueSummary: null,
  });

  readonly uploadProgress = signal(0);
  readonly batch = signal<LeadImportBatch | null>(null);

  onFilesSelected(files: File[]): void {
    const file = files[0];
    if (!file) {
      return;
    }
    this.file.set(file);
    this.errorMessage.set(null);

    if (file.name.toLowerCase().endsWith('.csv')) {
      file.text().then((text) => this.parseCsvPreview(text));
      this.phase.set('mapping');
    } else {
      this.phase.set('mapping');
    }
  }

  setMapping(field: TargetField, columnIndex: number | null): void {
    this.mapping.update((current) => ({ ...current, [field]: columnIndex }));
  }

  confirmAndUpload(): void {
    const file = this.file();
    if (!file) {
      return;
    }

    this.phase.set('uploading');
    this.errorMessage.set(null);

    const uploadFile = this.isCsv() ? this.buildRemappedCsvFile(file) : file;

    this.leadsService.importFile(uploadFile).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.phase.set('progress');
        this.pollBatch(batch.id);
      },
      error: () => {
        this.phase.set('mapping');
        this.errorMessage.set('Upload failed. Please try again.');
      },
    });
  }

  downloadErrorFile(): void {
    const batch = this.batch();
    if (!batch) {
      return;
    }
    this.leadsService.downloadImportErrors(batch.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${batch.fileName}-errors.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  startOver(): void {
    this.phase.set('upload');
    this.file.set(null);
    this.sourceHeaders.set([]);
    this.previewRows.set([]);
    this.batch.set(null);
    this.errorMessage.set(null);
  }

  private parseCsvPreview(text: string): void {
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    const headers = (lines[0] ?? '').split(',').map((header) => header.trim());
    const dataRows = lines.slice(1).map((line) => line.split(','));

    this.sourceHeaders.set(headers);
    this.previewRows.set(dataRows.slice(0, 5));
    this.csvRows = dataRows;

    // Auto-map columns whose header name already matches a target field.
    const auto: Record<TargetField, number | null> = {
      FirstName: null,
      LastName: null,
      Company: null,
      Email: null,
      Phone: null,
      IssueSummary: null,
    };
    for (const field of TARGET_FIELDS) {
      const index = headers.findIndex((header) => header.toLowerCase() === field.toLowerCase());
      auto[field] = index === -1 ? null : index;
    }
    this.mapping.set(auto);
  }

  /** Rewrites the header row (and reorders columns) to the parser's expected names, using the full parsed row set — not just the 5-row preview. */
  private buildRemappedCsvFile(file: File): File {
    const mapping = this.mapping();
    const remappedRows = this.csvRows.map((row) =>
      TARGET_FIELDS.map((field) => {
        const columnIndex = mapping[field];
        return columnIndex === null ? '' : (row[columnIndex] ?? '');
      }),
    );
    const csvText = [TARGET_FIELDS.join(','), ...remappedRows.map((row) => row.join(','))].join(
      '\n',
    );
    return new File([csvText], file.name, { type: 'text/csv' });
  }

  private pollBatch(batchId: string): void {
    interval(2000)
      .pipe(
        switchMap(() => this.leadsService.getImportBatch(batchId)),
        takeWhile((batch) => batch.status === 'Pending' || batch.status === 'Running', true),
      )
      .subscribe((batch) => {
        this.batch.set(batch);
        if (batch.status === 'Completed' || batch.status === 'Failed') {
          this.phase.set('done');
        }
      });
  }
}
