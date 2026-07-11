import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  CreateInvoiceRequest,
  Invoice,
  InvoiceExtraLine,
  InvoicesService,
  LfCurrencyPipe,
  Matter,
  MattersService,
  StatusChipComponent,
} from 'shared';

interface ExtraLineRow {
  type: FormControl<string>;
  description: FormControl<string>;
  qty: FormControl<number>;
  unit: FormControl<string>;
  rate: FormControl<number>;
}

/**
 * Invoice editor (PRD Module 8 UI Components: "invoice editor (line grid, tax
 * auto-calc panel, preview pane)"). There is no client-side tax engine or a
 * tax-preview endpoint — taxes are computed server-side and only known after
 * a save, so the "auto-calc panel" here recalculates on every Save (PUT),
 * not on every keystroke; that's an honest limitation, not a missing
 * feature. There's also no WIP-listing endpoint to browse unbilled time
 * entries, so `pullTimeEntryIds` is entered as a manual comma-separated list
 * of IDs (a stopgap pending a real picker once the Time module ships).
 */
@Component({
  selector: 'lf-invoice-editor-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-editor.page.html',
  styleUrl: './invoice-editor.page.scss',
})
export class InvoiceEditorPage {
  private readonly invoicesService = inject(InvoicesService);
  private readonly mattersService = inject(MattersService);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly invoiceId = signal<string | null>(null);
  readonly isNew = computed(() => this.invoiceId() === null);

  readonly invoice = signal<Invoice | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  readonly selectedMatterId = signal<string | null>(null);

  readonly form = new FormGroup({
    dueInDays: new FormControl(30, { nonNullable: true, validators: [Validators.min(0)] }),
    discount: new FormControl<number | null>(null),
    notes: new FormControl('', { nonNullable: true }),
    timeEntryIdsCsv: new FormControl('', { nonNullable: true }),
  });
  readonly issueDateControl = new FormControl<Date | null>(new Date());

  readonly extraLines = new FormArray<FormGroup<ExtraLineRow>>([]);

  readonly canEdit = computed(() => this.isNew() || this.invoice()?.status === 'Draft');

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'new') {
      this.invoiceId.set(idParam);
      this.load(idParam);
    } else {
      this.addLine();
    }

    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });
  }

  selectMatter(matter: Matter): void {
    this.selectedMatterId.set(matter.id);
    this.matterControl.setValue(`${matter.number} — ${matter.title}`, { emitEvent: false });
    this.matterResults.set([]);
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    if (matter) this.selectMatter(matter);
  }

  load(id: string): void {
    this.loading.set(true);
    this.invoicesService.get(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.selectedMatterId.set(invoice.matterId);
        this.form.patchValue({ notes: invoice.notes ?? '' });
        this.issueDateControl.setValue(invoice.issueDate ? new Date(invoice.issueDate) : null);
        this.loading.set(false);
        this.loadPdfPreview(id);
      },
      error: () => this.loading.set(false),
    });
  }

  loadPdfPreview(id: string): void {
    this.http.get(this.invoicesService.pdfUrl(id), { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
      },
      error: () => this.pdfPreviewUrl.set(null),
    });
  }

  addLine(): void {
    this.extraLines.push(
      new FormGroup({
        type: new FormControl('Fee', { nonNullable: true, validators: [Validators.required] }),
        description: new FormControl('', { nonNullable: true }),
        qty: new FormControl(1, { nonNullable: true, validators: [Validators.min(0.01)] }),
        unit: new FormControl('', { nonNullable: true }),
        rate: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
      }),
    );
  }

  removeLine(index: number): void {
    this.extraLines.removeAt(index);
  }

  lineAmount(index: number): number {
    const row = this.extraLines.at(index).getRawValue();
    return row.qty * row.rate;
  }

  save(): void {
    const matterId = this.selectedMatterId();
    if (!matterId || this.extraLines.length === 0) {
      this.errorMessage.set('Select a matter and add at least one line.');
      return;
    }

    const value = this.form.getRawValue();
    const extraLines: InvoiceExtraLine[] = this.extraLines.controls.map((row) => {
      const raw = row.getRawValue();
      return {
        type: raw.type,
        description: raw.description || null,
        qty: raw.qty,
        unit: raw.unit || null,
        rate: raw.rate,
      };
    });
    const pullTimeEntryIds = value.timeEntryIdsCsv
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const request: CreateInvoiceRequest = {
      matterId,
      issueDate: this.issueDateControl.value?.toISOString().slice(0, 10) ?? null,
      dueInDays: value.dueInDays,
      pullTimeEntryIds,
      extraLines,
      discount: value.discount,
      notes: value.notes || null,
    };

    this.saving.set(true);
    this.errorMessage.set(null);

    const request$ = this.isNew()
      ? this.invoicesService.create(request)
      : this.invoicesService.update(this.invoiceId()!, request);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.invoice.set(saved);
        if (this.isNew()) {
          this.invoiceId.set(saved.id);
          this.router.navigate(['/billing/invoices', saved.id], { replaceUrl: true });
        }
        this.loadPdfPreview(saved.id);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please check the form and try again.');
      },
    });
  }

  submitInvoice(): void {
    const id = this.invoiceId();
    if (!id) return;
    this.invoicesService.submit(id).subscribe((invoice) => this.invoice.set(invoice));
  }

  sendInvoice(): void {
    const id = this.invoiceId();
    if (!id) return;
    this.invoicesService.send(id).subscribe((invoice) => this.invoice.set(invoice));
  }
}
