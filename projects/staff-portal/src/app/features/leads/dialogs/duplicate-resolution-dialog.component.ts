import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DuplicateMatch } from 'shared';

export interface DuplicateResolutionDialogData {
  matches: DuplicateMatch[];
}

export type DuplicateResolutionResult =
  { action: 'create-anyway' } | { action: 'attach-to-existing'; leadId: string };

/**
 * PRD Module 2 User Flow step 2: "if match ≥ threshold, show side-by-side
 * merge/attach-to-existing dialog." No `POST /leads/merge` endpoint exists
 * anywhere in lexflow-api (confirmed) — the PRD's own Edge Cases entry for
 * this exact scenario is "allow duplicate override → linked leads," which
 * this dialog implements literally: attach to (navigate to) the existing
 * lead, or override and create a new one anyway. There's no backend support
 * for an atomic field-by-field merge, so that's out of scope here.
 */
@Component({
  selector: 'lf-duplicate-resolution-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@leads.duplicateResolutionDialog.title">
      Possible duplicate leads found
    </h2>
    <mat-dialog-content>
      <p i18n="@@leads.duplicateResolutionDialog.intro">
        This looks similar to {{ data.matches.length }} existing lead{{
          data.matches.length === 1 ? '' : 's'
        }}. Attach to one of them, or continue creating a new lead anyway.
      </p>
      <mat-nav-list>
        @for (match of data.matches; track match.leadId) {
          <button
            mat-list-item
            type="button"
            (click)="attachToExisting(match.leadId)"
            class="duplicate-row"
          >
            <mat-icon matListItemIcon>person</mat-icon>
            <span matListItemTitle>{{ match.displayName }}</span>
            <span matListItemLine i18n="@@leads.duplicateResolutionDialog.matchDetail">
              {{ match.email || match.phoneE164 || 'No contact info' }} · matched on
              {{ match.matchKind }} ({{ (match.similarity * 100).toFixed(0) }}%)
            </span>
          </button>
        }
      </mat-nav-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@leads.duplicateResolutionDialog.cancelButton"
      >
        Cancel
      </button>
      <button mat-flat-button type="button" color="primary" (click)="createAnyway()">
        <span i18n="@@leads.duplicateResolutionDialog.createAnywayButton">Create anyway</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .duplicate-row {
      height: auto;
      padding: var(--lf-space-1) 0;
    }
  `,
})
export class DuplicateResolutionDialogComponent {
  readonly data = inject<DuplicateResolutionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<DuplicateResolutionDialogComponent, DuplicateResolutionResult>>(
      MatDialogRef,
    );

  attachToExisting(leadId: string): void {
    this.dialogRef.close({ action: 'attach-to-existing', leadId });
  }

  createAnyway(): void {
    this.dialogRef.close({ action: 'create-anyway' });
  }
}
