import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  EmptyStateComponent,
  PermissionService,
  ReportCatalogItem,
  ReportFavoritesService,
  ReportsService,
} from 'shared';
import { ReportsTabsComponent } from '../reports-tabs.component';

/**
 * Reports hub (PRD Module 13 UI Components: "reports hub (catalog cards,
 * favorites, recent)"). "Recent" is skipped — no run-history-per-user
 * endpoint exists (see `reports.models.ts`); favorites are client-only
 * (`ReportFavoritesService`, localStorage — same documented-gap pattern as
 * `SavedLeadViewsService`).
 */
@Component({
  selector: 'lf-reports-hub-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    EmptyStateComponent,
    ReportsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-hub.page.html',
  styleUrl: './reports-hub.page.scss',
})
export class ReportsHubPage {
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly favoritesService = inject(ReportFavoritesService);

  readonly loading = signal(true);
  readonly catalog = signal<ReportCatalogItem[]>([]);
  readonly hasFinancialAccess = this.permissionService.has('reports.financial');

  readonly favoriteItems = computed(() =>
    this.catalog().filter((item) => this.favoritesService.keys().has(item.key)),
  );

  readonly categorized = computed(() => {
    const groups = new Map<string, ReportCatalogItem[]>();
    for (const item of this.catalog()) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()];
  });

  constructor() {
    this.reportsService.catalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isLocked(item: ReportCatalogItem): boolean {
    return item.requiresFinancialPermission && !this.hasFinancialAccess;
  }

  isFavorite(key: string): boolean {
    return this.favoritesService.isFavorite(key);
  }

  toggleFavorite(key: string, event: Event): void {
    event.stopPropagation();
    this.favoritesService.toggle(key);
  }

  open(item: ReportCatalogItem): void {
    if (this.isLocked(item)) return;
    this.router.navigate(['/reports/view/standard', item.key]);
  }
}
