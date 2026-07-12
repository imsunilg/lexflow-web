import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { EmptyStateComponent, WorkflowRuleDto, WorkflowRulesService } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

/**
 * Workflow rules list (PRD §23). "Seed default rules" calls the real,
 * idempotent `POST /workflow-rules/seed-defaults` — but most of the 12 seeded
 * rules use trigger event names nothing in this codebase actually publishes
 * (see `workflow-rules.models.ts`'s file-header comment), so they'll sit
 * dormant until their publishers exist. Seeding them is still worthwhile
 * (they're real, editable rows once seeded) — just don't expect them to fire.
 */
@Component({
  selector: 'lf-workflow-rules-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-rules-list.page.html',
  styleUrl: './workflow-rules-list.page.scss',
})
export class WorkflowRulesListPage {
  private readonly workflowRulesService = inject(WorkflowRulesService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly rules = signal<WorkflowRuleDto[]>([]);
  readonly seeding = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.workflowRulesService.list().subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.router.navigate(['/admin/workflow-rules/new']);
  }

  openRule(rule: WorkflowRuleDto): void {
    this.router.navigate(['/admin/workflow-rules', rule.id]);
  }

  seedDefaults(): void {
    this.seeding.set(true);
    this.workflowRulesService.seedDefaults().subscribe({
      next: () => {
        this.seeding.set(false);
        this.snackBar.open('Default rules seeded.', 'Dismiss', { duration: 4000 });
        this.load();
      },
      error: () => {
        this.seeding.set(false);
        this.snackBar.open('Could not seed default rules.', 'Dismiss', { duration: 4000 });
      },
    });
  }
}
