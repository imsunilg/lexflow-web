import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import {
  UserSummary,
  UsersService,
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_TRIGGERS,
  WorkflowAction,
  WorkflowActionType,
  WorkflowConditionLeaf,
  WorkflowRuleDto,
  WorkflowRulesService,
  WorkflowRunDto,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

/**
 * Workflow rule builder (PRD §23: "trigger picker -> condition builder
 * (visual groups) -> action steps (sequential cards) -> test-with-sample-
 * record -> activate"). Scope decisions, both documented rather than hidden:
 *
 * - The condition builder exposes one flat AND/OR group, not the backend's
 *   full recursive nesting (`WorkflowConditionGroup.and`/`.or` can nest
 *   groups-of-groups) — the same simplification this codebase already made
 *   for the custom-report builder's filter groups, for the same reason (the
 *   common case is flat; recursive group-of-groups UI is a large effort for
 *   marginal value here).
 * - The trigger picker only offers the 5 event names actually published
 *   anywhere in the codebase (`WORKFLOW_TRIGGERS`) — the other 7 PRD-listed
 *   triggers would create a rule that silently never fires.
 * - "Simulate" is the real one-shot `POST {id}/test` against a sample
 *   payload — there is no persistent "simulation mode (log-only, 24h)"
 *   toggle server-side, so this step doesn't pretend to offer one.
 */
@Component({
  selector: 'lf-workflow-rule-builder-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatStepperModule,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-rule-builder.page.html',
  styleUrl: './workflow-rule-builder.page.scss',
})
export class WorkflowRuleBuilderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workflowRulesService = inject(WorkflowRulesService);
  private readonly usersService = inject(UsersService);
  private readonly snackBar = inject(MatSnackBar);

  readonly triggers = WORKFLOW_TRIGGERS;
  readonly actionTypes = WORKFLOW_ACTION_TYPES;
  readonly conditionOperators = WORKFLOW_CONDITION_OPERATORS;

  readonly ruleId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly users = signal<UserSummary[]>([]);

  readonly basicsForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    triggerEvent: new FormControl<string>(this.triggers[0].event, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    runOrder: new FormControl(0, { nonNullable: true }),
  });

  readonly conditionLogic = new FormControl<'AND' | 'OR'>('AND', { nonNullable: true });
  readonly conditions = signal<WorkflowConditionLeaf[]>([]);
  readonly actions = signal<WorkflowAction[]>([]);

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly testing = signal(false);
  readonly testError = signal<string | null>(null);
  readonly testResult = signal<WorkflowRunDto | null>(null);
  readonly samplePayload = new FormControl('{}', { nonNullable: true });

  readonly isNew = computed(() => this.ruleId() === null);

  constructor() {
    this.usersService.list().subscribe((users) => this.users.set(users));

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.ruleId.set(id);
      this.loading.set(true);
      this.workflowRulesService.get(id).subscribe({
        next: (rule) => {
          this.applyRule(rule);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  private applyRule(rule: WorkflowRuleDto): void {
    this.basicsForm.setValue({
      name: rule.name,
      triggerEvent: rule.triggerEvent,
      active: rule.active,
      runOrder: rule.runOrder,
    });
    try {
      const parsed = JSON.parse(rule.conditionsJson || '{}') as {
        and?: WorkflowConditionLeaf[];
        or?: WorkflowConditionLeaf[];
      };
      if (parsed.or) {
        this.conditionLogic.setValue('OR');
        this.conditions.set(parsed.or as WorkflowConditionLeaf[]);
      } else if (parsed.and) {
        this.conditionLogic.setValue('AND');
        this.conditions.set(parsed.and as WorkflowConditionLeaf[]);
      } else {
        this.conditions.set([]);
      }
    } catch {
      this.conditions.set([]);
    }
    try {
      this.actions.set(JSON.parse(rule.actionsJson || '[]') as WorkflowAction[]);
    } catch {
      this.actions.set([]);
    }
  }

  addCondition(): void {
    this.conditions.update((rows) => [...rows, { field: '', op: 'eq', value: '' }]);
  }

  updateCondition(index: number, patch: Partial<WorkflowConditionLeaf>): void {
    this.conditions.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  removeCondition(index: number): void {
    this.conditions.update((rows) => rows.filter((_, i) => i !== index));
  }

  addAction(): void {
    this.actions.update((rows) => [...rows, { type: 'notify', config: {} }]);
  }

  updateActionType(index: number, type: WorkflowActionType | string): void {
    this.actions.update((rows) => rows.map((row, i) => (i === index ? { type, config: {} } : row)));
  }

  updateActionConfig(index: number, patch: Record<string, unknown>): void {
    this.actions.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, config: { ...row.config, ...patch } } : row)),
    );
  }

  moveAction(index: number, delta: number): void {
    this.actions.update((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const updated = [...rows];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated;
    });
  }

  removeAction(index: number): void {
    this.actions.update((rows) => rows.filter((_, i) => i !== index));
  }

  splitChannels(value: string): string[] {
    return value.split(',').map((s) => s.trim());
  }

  configString(action: WorkflowAction, key: string): string {
    const value = action.config[key];
    return typeof value === 'string' ? value : Array.isArray(value) ? value.join(',') : '';
  }

  configNumber(action: WorkflowAction, key: string): number | null {
    const value = action.config[key];
    return typeof value === 'number' ? value : null;
  }

  save(): void {
    if (this.basicsForm.invalid) {
      this.basicsForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    const basics = this.basicsForm.getRawValue();
    const conditionsJson = JSON.stringify(
      this.conditions().length === 0
        ? {}
        : { [this.conditionLogic.value.toLowerCase()]: this.conditions() },
    );
    const actionsJson = JSON.stringify(this.actions());

    const request = {
      name: basics.name,
      triggerEvent: basics.triggerEvent,
      conditionsJson,
      actionsJson,
      active: basics.active,
      runOrder: basics.runOrder,
    };

    const save$ = this.ruleId()
      ? this.workflowRulesService.update(this.ruleId()!, request)
      : this.workflowRulesService.create(request);

    save$.subscribe({
      next: (rule) => {
        this.saving.set(false);
        this.ruleId.set(rule.id);
        this.snackBar.open('Rule saved.', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save this rule.');
      },
    });
  }

  runTest(): void {
    const id = this.ruleId();
    if (!id) return;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(this.samplePayload.value);
    } catch {
      this.testError.set('Sample payload must be valid JSON.');
      return;
    }

    this.testing.set(true);
    this.testError.set(null);
    this.testResult.set(null);
    this.workflowRulesService.test(id, payload).subscribe({
      next: (result) => {
        this.testing.set(false);
        this.testResult.set(result);
      },
      error: () => {
        this.testing.set(false);
        this.testError.set('Test run failed.');
      },
    });
  }

  goToList(): void {
    this.router.navigate(['/admin/workflow-rules']);
  }
}
