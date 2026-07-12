import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { KbMatterPin, KbMatterPinsService, KbRefKind, KbSearchHit, KbSearchService } from 'shared';

export interface KbPinDialogData {
  matterId: string;
}

const KIND_ICONS: Record<string, string> = {
  Act: 'gavel',
  ActSection: 'menu_book',
  Judgment: 'balance',
  Article: 'article',
};

/**
 * Pin-from-matter dialog (PRD Module 12 UI Components: "pin dialog from
 * matter research tab"). Opened from the Matter workspace's Research tab.
 * Searches the same real, ES-backed KB search endpoint used by the KB home
 * page, then pins the chosen item via `POST /matters/{id}/kb-pins` — the
 * server freezes a text snapshot at pin time, so later edits to the source
 * never affect what's shown once pinned.
 */
@Component({
  selector: 'lf-kb-pin-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@matters.kbPinDialog.title">Pin from Knowledge Base</h2>
    <mat-dialog-content class="kb-pin">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@matters.kbPinDialog.searchLabel"
          >Search Acts, judgments, articles…</mat-label
        >
        <input matInput [formControl]="query" />
      </mat-form-field>

      @if (searching()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (!selected()) {
        <ul class="kb-pin__hits">
          @for (hit of hits(); track hit.kind + hit.id) {
            <li>
              <button type="button" class="kb-pin__hit-row" (click)="selectHit(hit)">
                <mat-icon>{{ iconFor(hit.kind) }}</mat-icon>
                <span>{{ hit.title }}</span>
                <span class="kb-pin__hit-kind">{{ hit.kind }}</span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <div class="kb-pin__selected">
          <mat-icon>{{ iconFor(selected()!.kind) }}</mat-icon>
          <span>{{ selected()!.title }}</span>
          <button
            mat-button
            type="button"
            (click)="selected.set(null)"
            i18n="@@matters.kbPinDialog.changeButton"
          >
            Change
          </button>
        </div>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@matters.kbPinDialog.noteLabel">Note (optional)</mat-label>
          <textarea matInput [formControl]="note" rows="3"></textarea>
        </mat-form-field>

        @if (error()) {
          <p class="kb-pin__error">{{ error() }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@matters.kbPinDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!selected() || submitting()"
        (click)="submit()"
        i18n="@@matters.kbPinDialog.pinButton"
      >
        Pin to matter
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .kb-pin {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .kb-pin__hits {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 240px;
      overflow-y: auto;
    }

    .kb-pin__hit-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      border-radius: var(--lf-radius);

      &:hover {
        background: var(--lf-surface-variant);
      }
    }

    .kb-pin__hit-kind {
      margin-left: auto;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .kb-pin__selected {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--lf-surface-variant);
      border-radius: var(--lf-radius);
      padding: 6px 10px;
    }

    .kb-pin__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class KbPinDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<KbPinDialogComponent, KbMatterPin | undefined>>(MatDialogRef);
  readonly data = inject<KbPinDialogData>(MAT_DIALOG_DATA);
  private readonly kbSearchService = inject(KbSearchService);
  private readonly kbMatterPinsService = inject(KbMatterPinsService);

  readonly query = new FormControl('', { nonNullable: true });
  readonly note = new FormControl('', { nonNullable: true });
  readonly searching = signal(false);
  readonly hits = signal<KbSearchHit[]>([]);
  readonly selected = signal<KbSearchHit | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q.trim()) {
          this.hits.set([]);
          return;
        }
        this.searching.set(true);
        this.kbSearchService.search({ q }).subscribe({
          next: (result) => {
            this.hits.set(result.hits);
            this.searching.set(false);
          },
          error: () => this.searching.set(false),
        });
      });
  }

  iconFor(kind: string): string {
    return KIND_ICONS[kind] ?? 'description';
  }

  selectHit(hit: KbSearchHit): void {
    this.selected.set(hit);
  }

  submit(): void {
    const hit = this.selected();
    if (!hit) return;

    this.submitting.set(true);
    this.error.set(null);
    this.kbMatterPinsService
      .pin(this.data.matterId, {
        kbRefKind: hit.kind as KbRefKind,
        kbRefId: hit.id,
        note: this.note.value || null,
      })
      .subscribe({
        next: (pin) => this.dialogRef.close(pin),
        error: () => {
          this.submitting.set(false);
          this.error.set('Could not pin that item.');
        },
      });
  }
}
