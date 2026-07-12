import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  AI_DRAFT_KINDS,
  AiBadgeComponent,
  AiDraftResponse,
  AiService,
  ClientsService,
  DocumentsService,
  MattersService,
} from 'shared';
import { AiTabsComponent } from '../ai-tabs.component';

interface IntakeRow {
  key: string;
  value: string;
}

const SUGGESTED_FIELDS = ['parties', 'facts', 'demands', 'terms'];

/**
 * Draft Studio (PRD Module 16 feature 5: "guided intake form (parties
 * auto-filled from matter, facts, demands/terms) -> template-grounded
 * generation -> editor with regenerate-per-section"). Two real gaps,
 * documented rather than faked:
 *
 * - The backend does NOT auto-fill parties from the matter and does NOT
 *   ground generation against real firm templates (it renders a literal
 *   hardcoded "(firm default skeleton)" string) — `matterId` is only used
 *   for an access check. This page does its own best-effort auto-fill by
 *   fetching the matter's client name client-side and pre-populating a
 *   "parties" field — a frontend convenience, not something the backend did.
 * - There is no regenerate-per-section capability — `AiDraftResponse`
 *   returns one opaque `draftText` with no section boundaries, so
 *   "Regenerate" always re-runs the whole draft.
 *
 * "Save as document" uploads the draft text as a new document via the real
 * `DocumentsService.upload` — there is no AI-specific "save draft" endpoint.
 */
@Component({
  selector: 'lf-draft-studio-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    AiBadgeComponent,
    AiTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './draft-studio.page.html',
  styleUrl: './draft-studio.page.scss',
})
export class DraftStudioPage {
  private readonly route = inject(ActivatedRoute);
  private readonly aiService = inject(AiService);
  private readonly mattersService = inject(MattersService);
  private readonly clientsService = inject(ClientsService);
  private readonly documentsService = inject(DocumentsService);
  private readonly snackBar = inject(MatSnackBar);

  readonly kinds = AI_DRAFT_KINDS;

  readonly basicsForm = new FormGroup({
    kind: new FormControl<'notice' | 'agreement'>('notice', { nonNullable: true }),
    matterId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly loadingMatter = signal(false);
  readonly intakeRows = signal<IntakeRow[]>(SUGGESTED_FIELDS.map((key) => ({ key, value: '' })));

  readonly generating = signal(false);
  readonly generateError = signal<string | null>(null);
  readonly result = signal<AiDraftResponse | null>(null);
  readonly draftText = new FormControl('', { nonNullable: true });
  readonly saving = signal(false);

  constructor() {
    const matterId = this.route.snapshot.queryParamMap.get('matterId');
    if (matterId) {
      this.basicsForm.controls.matterId.setValue(matterId);
      this.loadMatterParties();
    }
  }

  loadMatterParties(): void {
    const matterId = this.basicsForm.controls.matterId.value;
    if (!matterId) return;

    this.loadingMatter.set(true);
    this.mattersService
      .get(matterId)
      .pipe(catchError(() => of(null)))
      .subscribe((matter) => {
        if (!matter) {
          this.loadingMatter.set(false);
          return;
        }
        this.clientsService
          .get(matter.clientId)
          .pipe(catchError(() => of(null)))
          .subscribe((client) => {
            this.loadingMatter.set(false);
            const partiesValue = [client?.displayName, matter.title].filter(Boolean).join(' — ');
            this.updateRow('parties', partiesValue);
          });
      });
  }

  private updateRow(key: string, value: string): void {
    this.intakeRows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, value } : row)),
    );
  }

  updateRowValue(index: number, value: string): void {
    this.intakeRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, value } : row)));
  }

  updateRowKey(index: number, key: string): void {
    this.intakeRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, key } : row)));
  }

  addRow(): void {
    this.intakeRows.update((rows) => [...rows, { key: '', value: '' }]);
  }

  removeRow(index: number): void {
    this.intakeRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  generate(): void {
    if (this.basicsForm.invalid) {
      this.basicsForm.markAllAsTouched();
      return;
    }

    const value = this.basicsForm.getRawValue();
    const intakeFields: Record<string, string> = {};
    for (const row of this.intakeRows()) {
      if (row.key.trim()) intakeFields[row.key.trim()] = row.value;
    }

    this.generating.set(true);
    this.generateError.set(null);
    this.aiService.draft({ kind: value.kind, matterId: value.matterId, intakeFields }).subscribe({
      next: (result) => {
        this.generating.set(false);
        this.result.set(result);
        this.draftText.setValue(result.draftText);
      },
      error: () => {
        this.generating.set(false);
        this.generateError.set('Could not generate a draft.');
      },
    });
  }

  regenerate(): void {
    this.generate();
  }

  saveAsDocument(): void {
    const result = this.result();
    const value = this.basicsForm.getRawValue();
    if (!result) return;

    const blob = new Blob([this.draftText.value], { type: 'text/plain' });
    const file = new File([blob], `${value.kind}-draft-${Date.now()}.txt`, { type: 'text/plain' });

    this.saving.set(true);
    this.documentsService
      .upload(file, {
        title: `${value.kind === 'agreement' ? 'Agreement' : 'Notice'} draft`,
        docType: 'Other',
        confidentiality: 'Normal',
        matterId: value.matterId,
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Response) {
            this.saving.set(false);
            this.snackBar.open('Draft saved as a document.', 'Dismiss', { duration: 4000 });
          }
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Could not save this draft.', 'Dismiss', { duration: 4000 });
        },
      });
  }
}
