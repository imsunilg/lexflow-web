import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BranchDto, BranchesService, ConfirmDialogComponent, EmptyStateComponent } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import { BranchFormDialogComponent, BranchFormDialogData } from './branch-form-dialog.component';

/**
 * Branches list (PRD Module 14 UI Components: "Branches" tab).
 * `BranchesController` has full CRUD, so this page supports create, edit,
 * and delete. There's no holiday-calendar sub-resource on branches — Module
 * 15 covers holidays separately at the settings-blob level, so that's not
 * built here.
 */
@Component({
  selector: 'lf-branches-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branches-list.page.html',
  styleUrl: './branches-list.page.scss',
})
export class BranchesListPage {
  private readonly branchesService = inject(BranchesService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly branches = signal<BranchDto[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.branchesService.list().subscribe({
      next: (branches) => {
        this.branches.set(branches);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.dialog
      .open<BranchFormDialogComponent, BranchFormDialogData, BranchDto | undefined>(
        BranchFormDialogComponent,
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  openEdit(branch: BranchDto): void {
    this.dialog
      .open<BranchFormDialogComponent, BranchFormDialogData, BranchDto | undefined>(
        BranchFormDialogComponent,
        { data: { branch } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  deleteBranch(branch: BranchDto): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete branch',
          message: `Delete "${branch.name}"? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.branchesService.delete(branch.id).subscribe(() => this.load());
      });
  }
}
