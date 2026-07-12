import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmptyStateComponent, TaskTemplate, TaskTemplatesService } from 'shared';
import { TasksTabsComponent } from '../tasks-tabs.component';
import {
  ApplyTemplateDialogComponent,
  ApplyTemplateDialogData,
  ApplyTemplateDialogResult,
} from './apply-template-dialog.component';
import { TemplateFormDialogComponent } from './template-form-dialog.component';

/**
 * Template manager (PRD Module 10 UI Components: "template manager" for
 * `task_templates`/`task_template_items`, applied via
 * `POST /matters/{id}/apply-task-template/{templateId}`). Only `POST`/`GET
 * /task-templates` exist server-side — there is no edit or delete endpoint,
 * so this page only supports creating new templates and applying existing
 * ones to a matter.
 */
@Component({
  selector: 'lf-template-manager-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    TasksTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-manager.page.html',
  styleUrl: './template-manager.page.scss',
})
export class TemplateManagerPage {
  private readonly templatesService = inject(TaskTemplatesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly templates = signal<TaskTemplate[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.templatesService.list().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNewTemplate(): void {
    this.dialog
      .open(TemplateFormDialogComponent)
      .afterClosed()
      .subscribe((created) => {
        if (created) this.load();
      });
  }

  openApply(template: TaskTemplate): void {
    this.dialog
      .open<
        ApplyTemplateDialogComponent,
        ApplyTemplateDialogData,
        ApplyTemplateDialogResult | undefined
      >(ApplyTemplateDialogComponent, { data: { template } })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        if (result.createdCount === 0) {
          this.snackBar.open(
            'No new tasks were created — this template was likely already applied to this matter.',
            'Dismiss',
            { duration: 6000 },
          );
        } else {
          this.snackBar.open(
            `${result.createdCount} task${result.createdCount === 1 ? '' : 's'} created.`,
            'Dismiss',
            { duration: 4000 },
          );
        }
      });
  }
}
