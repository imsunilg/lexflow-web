import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Sort, MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => string;
}

/**
 * Generic server-side data table shell (PRD §12 grids/tables): sort/filter/page
 * are all emitted as events for the caller to refetch — this component holds
 * no data-fetching logic of its own. Rows > 100 render through a virtual-scroll
 * viewport instead of a paginator, per the ">100 rows virtualized" rule.
 */
@Component({
  selector: 'lf-data-table',
  standalone: true,
  imports: [
    ScrollingModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (virtualized()) {
      <div class="lf-data-table__header-row">
        @for (col of columns(); track col.key) {
          <span class="lf-data-table__header-cell">{{ col.header }}</span>
        }
      </div>
      <cdk-virtual-scroll-viewport itemSize="48" class="lf-data-table__viewport">
        <div
          *cdkVirtualFor="let row of rows()"
          class="lf-data-table__row"
          role="button"
          tabindex="0"
          (click)="rowClick.emit(row)"
          (keydown.enter)="rowClick.emit(row)"
          (keydown.space)="rowClick.emit(row)"
        >
          @for (col of columns(); track col.key) {
            <span class="lf-data-table__cell">{{ col.cell ? col.cell(row) : row[col.key] }}</span>
          }
        </div>
      </cdk-virtual-scroll-viewport>
    } @else {
      <table mat-table [dataSource]="rows()" matSort (matSortChange)="sortChange.emit($event)">
        @for (col of columns(); track col.key) {
          <ng-container [matColumnDef]="col.key">
            <th mat-header-cell *matHeaderCellDef [mat-sort-header]="col.sortable ? col.key : ''">
              {{ col.header }}
            </th>
            <td mat-cell *matCellDef="let row">{{ col.cell ? col.cell(row) : row[col.key] }}</td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
        <tr mat-row *matRowDef="let row; columns: columnKeys()" (click)="rowClick.emit(row)"></tr>
      </table>

      <mat-paginator
        [length]="totalCount()"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="[10, 25, 50, 100]"
        (page)="pageChange.emit($event)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    table {
      width: 100%;
    }

    tr[mat-row] {
      cursor: pointer;
    }

    .lf-data-table__viewport {
      height: 480px;
    }

    .lf-data-table__header-row,
    .lf-data-table__row {
      display: flex;
      gap: var(--lf-space-2);
      padding: 0 var(--lf-space-2);
      align-items: center;
      min-height: 48px;
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .lf-data-table__header-row {
      font-weight: 600;
      position: sticky;
      top: 0;
      background: var(--lf-surface);
      z-index: 1;
    }

    .lf-data-table__row {
      cursor: pointer;
    }

    .lf-data-table__header-cell,
    .lf-data-table__cell {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class DataTableComponent<T extends Record<string, unknown>> {
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly totalCount = input(0);
  readonly pageSize = input(25);
  readonly pageIndex = input(0);
  readonly loading = input(false);
  /** Explicit override; defaults to virtualizing once the current page exceeds 100 rows. */
  readonly virtualizeOverride = input<boolean>();

  readonly sortChange = output<Sort>();
  readonly pageChange = output<PageEvent>();
  readonly rowClick = output<T>();

  readonly columnKeys = computed(() => this.columns().map((col) => col.key));
  readonly virtualized = computed(() => this.virtualizeOverride() ?? this.rows().length > 100);
}
