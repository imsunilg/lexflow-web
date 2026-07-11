import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  Client,
  ClientFilter,
  ClientStatus,
  ClientType,
  ClientsService,
  DataTableColumn,
  DataTableComponent,
  EmptyStateComponent,
  StatusChipComponent,
} from 'shared';

type ClientRow = Client & Record<string, unknown>;
type ViewMode = 'card' | 'table';

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function clientDisplayName(client: Client): string {
  return (
    client.displayName ??
    `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() ??
    client.legalName ??
    ''
  );
}

/**
 * Client list view (PRD Module 3 UI Components: "Client list (cards/table
 * toggle, alpha index, filters: type/status/practice area/owner/branch)").
 * `ClientFilter` (the actual server DTO) only carries type/status/ownerId/
 * branchId/q — there's no "practice area" concept on a client record (that
 * belongs to leads/matters) — so that filter isn't wired here. owner/branch
 * filters are also skipped: there's no lookup service yet to source a
 * picklist of owners/branches for this module, and a free-text id filter
 * would be poor UX, so those two are left out until such a lookup exists.
 */
@Component({
  selector: 'lf-staff-clients-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    DataTableComponent,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients-list.page.html',
  styleUrl: './clients-list.page.scss',
})
export class ClientsListPage {
  private readonly clientsService = inject(ClientsService);
  private readonly router = inject(Router);

  readonly types: ClientType[] = ['Individual', 'Corporate'];
  readonly statuses: ClientStatus[] = ['Active', 'Dormant', 'Deceased', 'Blocked'];
  readonly alphabet = ALPHABET;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly clients = signal<Client[]>([]);
  readonly viewMode = signal<ViewMode>('table');
  readonly activeLetter = signal<string | null>(null);

  readonly form = new FormGroup({
    type: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    q: new FormControl('', { nonNullable: true }),
  });

  readonly columns: DataTableColumn<ClientRow>[] = [
    { key: 'number', header: 'Number', sortable: true },
    { key: 'name', header: 'Name', cell: (row) => clientDisplayName(row) || '—' },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'email', header: 'Email', cell: (row) => row.email ?? '—' },
    { key: 'phoneE164', header: 'Phone', cell: (row) => row.phoneE164 ?? '—' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'portalEnabled', header: 'Portal', cell: (row) => (row.portalEnabled ? '✓' : '—') },
  ];

  readonly filteredClients = computed<Client[]>(() => {
    const letter = this.activeLetter();
    const all = this.clients();
    if (!letter) {
      return all;
    }
    return all.filter((client) => clientDisplayName(client).toUpperCase().startsWith(letter));
  });

  readonly rows = computed(() => this.filteredClients() as ClientRow[]);

  readonly lettersWithMatches = computed<Set<string>>(() => {
    const set = new Set<string>();
    for (const client of this.clients()) {
      const name = clientDisplayName(client);
      if (name) {
        set.add(name[0]!.toUpperCase());
      }
    }
    return set;
  });

  constructor() {
    this.form.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());

    this.load();
  }

  private currentFilter(): ClientFilter {
    const value = this.form.getRawValue();
    const filter: ClientFilter = {};
    if (value.type) {
      filter.type = value.type as ClientType;
    }
    if (value.status) {
      filter.status = value.status as ClientStatus;
    }
    if (value.q) {
      filter.q = value.q;
    }
    return filter;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.clientsService
      .list(this.currentFilter())
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (clients) => {
          this.clients.set(clients);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  clearFilters(): void {
    this.form.reset({ type: '', status: '', q: '' });
    this.activeLetter.set(null);
    this.load();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  selectLetter(letter: string): void {
    this.activeLetter.set(this.activeLetter() === letter ? null : letter);
  }

  clearLetter(): void {
    this.activeLetter.set(null);
  }

  displayName(client: Client): string {
    return clientDisplayName(client) || '—';
  }

  openClient(client: Client): void {
    this.router.navigate(['/clients', client.id]);
  }

  createClient(): void {
    this.router.navigate(['/clients', 'new']);
  }
}
