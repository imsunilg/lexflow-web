import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  EmptyStateComponent,
  SettingsAuditEntryDto,
  SettingsService,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

/** Best-effort pretty-print of a `before`/`after` JSON string; falls back to the raw text if it doesn't parse. */
function prettyPrint(value: string | null): string | null {
  if (value === null) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/**
 * Settings/gateway change log (PRD Module 15 §30). `GET /settings/audit` is
 * the ONLY audit-read endpoint in the backend — it is scoped to settings and
 * payment-gateway changes, filters only by `section` (the settings payload's
 * own key/provider string, not a real column across entities), and its DTO
 * has no IP/UA/traceId. This page must not be presented as a general
 * cross-entity audit browser; see the honesty note in the template.
 */
@Component({
  selector: 'lf-audit-log-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.page.html',
  styleUrl: './audit-log.page.scss',
})
export class AuditLogPage {
  private readonly settingsService = inject(SettingsService);
  private readonly usersService = inject(UsersService);

  readonly sectionControl = new FormControl<string>('');

  readonly entries = signal<SettingsAuditEntryDto[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);

  private readonly users = signal<Map<string, UserSummary>>(new Map());

  readonly rows = computed(() =>
    this.entries().map((entry) => ({
      entry,
      actorLabel: this.actorLabel(entry.actorUserId),
      beforePretty: prettyPrint(entry.before),
      afterPretty: prettyPrint(entry.after),
    })),
  );

  constructor() {
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(new Map(users.map((u) => [u.id, u])));
      },
      error: () => {
        // Actor-name resolution is a nice-to-have; fall back to raw IDs silently.
      },
    });
    this.search();
  }

  search(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const section = this.sectionControl.value?.trim() || undefined;
    this.settingsService.audit(section).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.errorMessage.set('Could not load the audit log.');
      },
    });
  }

  toggleDiff(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  private actorLabel(actorUserId: string | null): string {
    if (!actorUserId) return '—';
    return this.users().get(actorUserId)?.name ?? actorUserId;
  }
}
