import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { EmptyStateComponent, KbAct, KbActSection, KbActsService } from 'shared';

interface TreeRow {
  section: KbActSection;
  depth: number;
}

function buildFlatTree(sections: KbActSection[]): TreeRow[] {
  const byParent = new Map<string | null, KbActSection[]>();
  for (const section of sections) {
    const key = section.parentId;
    const list = byParent.get(key) ?? [];
    list.push(section);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }

  const rows: TreeRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const section of byParent.get(parentId) ?? []) {
      rows.push({ section, depth });
      visit(section.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/**
 * Act reader (PRD Module 12 UI Components: "Act reader (left tree of
 * sections, reader pane, next/prev, copy-with-citation)"). There is no
 * chapter/hierarchy endpoint — `GET /kb/acts/{id}/sections` returns a flat
 * list, so the tree here is reconstructed client-side from each section's
 * `parentId`. The as-on-date selector calls a real, DB-backed effective-dating
 * endpoint (`GET .../sections/{number}/as-of`), not a client-side guess.
 */
@Component({
  selector: 'lf-act-reader-page',
  standalone: true,
  imports: [
    ScrollingModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './act-reader.page.html',
  styleUrl: './act-reader.page.scss',
})
export class ActReaderPage {
  private readonly kbActsService = inject(KbActsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly act = signal<KbAct | null>(null);
  readonly sections = signal<KbActSection[]>([]);
  readonly selectedSectionId = signal<string | null>(null);

  readonly asOfDate = signal<Date | null>(null);
  readonly asOfSection = signal<KbActSection | null>(null);
  readonly asOfLoading = signal(false);

  readonly treeRows = computed(() => buildFlatTree(this.sections()));
  readonly selectedSection = computed(() =>
    this.sections().find((s) => s.id === this.selectedSectionId()),
  );
  /** The as-on-date result when active, otherwise the section's current text. */
  readonly displayedSection = computed(() => this.asOfSection() ?? this.selectedSection() ?? null);

  constructor() {
    const actId = this.route.snapshot.paramMap.get('id');
    if (!actId) return;

    this.kbActsService.getAct(actId).subscribe((act) => this.act.set(act));
    this.kbActsService.listSections(actId).subscribe((sections) => {
      this.sections.set(sections);
      this.loading.set(false);

      const requestedSectionId = this.route.snapshot.queryParamMap.get('sectionId');
      const initial = sections.find((s) => s.id === requestedSectionId) ?? sections[0];
      if (initial) this.selectSection(initial, false);
    });
  }

  selectSection(section: KbActSection, updateUrl = true): void {
    this.selectedSectionId.set(section.id);
    this.asOfDate.set(null);
    this.asOfSection.set(null);
    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { sectionId: section.id },
        queryParamsHandling: 'merge',
      });
    }
  }

  stepSection(delta: number): void {
    const rows = this.treeRows();
    const index = rows.findIndex((r) => r.section.id === this.selectedSectionId());
    const next = rows[index + delta];
    if (next) this.selectSection(next.section);
  }

  onAsOfDateChange(date: Date | null): void {
    this.asOfDate.set(date);
    const act = this.act();
    const section = this.selectedSection();
    if (!date || !act || !section) {
      this.asOfSection.set(null);
      return;
    }

    this.asOfLoading.set(true);
    const asOf = date.toISOString().slice(0, 10);
    this.kbActsService.sectionAsOf(act.id, section.number, asOf).subscribe({
      next: (historical) => {
        this.asOfSection.set(historical);
        this.asOfLoading.set(false);
      },
      error: () => this.asOfLoading.set(false),
    });
  }

  clearAsOf(): void {
    this.asOfDate.set(null);
    this.asOfSection.set(null);
  }

  copyWithCitation(): void {
    const act = this.act();
    const section = this.displayedSection();
    if (!act || !section) return;
    const citation = `${act.shortCode ?? act.name} s.${section.number}`;
    const text = `${citation}\n\n${section.body ?? ''}`;
    navigator.clipboard
      .writeText(text)
      .then(() => this.snackBar.open('Copied with citation', 'Dismiss', { duration: 2500 }));
  }

  depthIndent(depth: number): string {
    return `${depth * 16}px`;
  }
}
