import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import {
  EffectivePermissionExplanation,
  EmptyStateComponent,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

/**
 * Effective-permission inspector (PRD Module 14: "why can Aditi see this
 * matter?" trace view, AC-U2). `GET /users/{id}/effective-permissions?resource=`
 * accepts a `resource` query param but the backend ignores it — it always
 * explains the user's full effective permission set, never a single
 * resource. This page is framed as "why can this user do X" generally, to
 * match what the endpoint actually answers, rather than implying a
 * resource-scoped trace that doesn't exist. Re-derived from DB tables
 * directly server-side (bypasses the Redis permission cache), matching the
 * "sensitive checks always DB-verified" security note.
 */
@Component({
  selector: 'lf-effective-permission-inspector-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './effective-permission-inspector.page.html',
  styleUrl: './effective-permission-inspector.page.scss',
})
export class EffectivePermissionInspectorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);

  readonly users = signal<UserSummary[]>([]);
  readonly userControl = new FormControl<string | null>(
    this.route.snapshot.queryParamMap.get('userId'),
  );

  readonly loading = signal(false);
  readonly explanations = signal<EffectivePermissionExplanation[] | null>(null);

  readonly groupedExplanations = computed(() => {
    const explanations = this.explanations();
    if (!explanations) return [];
    const groups = new Map<string, EffectivePermissionExplanation[]>();
    for (const explanation of explanations) {
      const list = groups.get(explanation.module) ?? [];
      list.push(explanation);
      groups.set(explanation.module, list);
    }
    return [...groups.entries()];
  });

  constructor() {
    this.usersService.list().subscribe((users) => this.users.set(users));

    this.userControl.valueChanges.subscribe((userId) => {
      if (!userId) {
        this.explanations.set(null);
        return;
      }
      this.loading.set(true);
      this.usersService.effectivePermissions(userId).subscribe({
        next: (explanations) => {
          this.explanations.set(explanations);
          this.loading.set(false);
        },
        error: () => {
          this.explanations.set(null);
          this.loading.set(false);
        },
      });
    });

    if (this.userControl.value) {
      this.userControl.setValue(this.userControl.value);
    }
  }

  sourceLabel(source: { sourceType: string; sourceName: string }): string {
    return source.sourceType === 'role'
      ? `via role: ${source.sourceName}`
      : `direct grant: ${source.sourceName}`;
  }
}
