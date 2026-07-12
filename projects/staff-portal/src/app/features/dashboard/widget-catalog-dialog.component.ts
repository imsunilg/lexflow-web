import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DashboardWidgetLayoutEntry, WidgetId } from 'shared';
import { WidgetCatalogEntry } from './widget-catalog';

export interface WidgetCatalogDialogData {
  catalog: WidgetCatalogEntry[];
  layout: DashboardWidgetLayoutEntry[];
}

/** "Add/remove widgets" dialog (PRD Module 1 User Flow step 4). Only shows widgets the user is permitted to see — revenue/outstanding/trust are already filtered out upstream for a user without `billing.read.*` (AC-D5). */
@Component({
  selector: 'lf-widget-catalog-dialog',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@dashboard.widgetCatalogDialog.title">Customize dashboard</h2>
    <mat-dialog-content>
      <ul class="catalog-list">
        @for (entry of data.catalog; track entry.id) {
          <li class="catalog-list__row">
            <mat-checkbox
              [checked]="isVisible(entry.id)"
              (change)="toggle(entry.id, $event.checked)"
            >
              <mat-icon class="catalog-list__icon">{{ entry.icon }}</mat-icon>
              {{ entry.title }}
            </mat-checkbox>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        (click)="dialogRef.close()"
        i18n="@@dashboard.widgetCatalogDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="save()"
        i18n="@@dashboard.widgetCatalogDialog.saveButton"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .catalog-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 320px;
    }

    .catalog-list__icon {
      vertical-align: middle;
      margin-right: var(--lf-space-1);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `,
})
export class WidgetCatalogDialogComponent {
  readonly dialogRef = inject(MatDialogRef<WidgetCatalogDialogComponent>);
  readonly data = inject<WidgetCatalogDialogData>(MAT_DIALOG_DATA);

  private readonly visibility = signal(
    new Map(this.data.layout.map((entry) => [entry.widgetId, entry.visible])),
  );

  isVisible(id: WidgetId): boolean {
    return this.visibility().get(id) ?? true;
  }

  toggle(id: WidgetId, checked: boolean): void {
    this.visibility.update((map) => new Map(map).set(id, checked));
  }

  save(): void {
    const updated = this.data.layout.map((entry) => ({
      ...entry,
      visible: this.visibility().get(entry.widgetId) ?? entry.visible,
    }));
    this.dialogRef.close(updated);
  }
}
