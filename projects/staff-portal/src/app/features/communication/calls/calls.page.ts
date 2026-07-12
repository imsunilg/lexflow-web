import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CallLog, ClientsService, CommCallsService, EmptyStateComponent } from 'shared';
import { CommTabsComponent } from '../comm-tabs.component';
import { CallLogDialogComponent, CallLogDialogData } from './call-log-dialog.component';

interface ClientOption {
  id: string;
  label: string;
}

/** Calls tab: pick a client, view its call history, log/click-to-call (PRD Module 11). */
@Component({
  selector: 'lf-calls-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    CommTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calls.page.html',
  styleUrl: './calls.page.scss',
})
export class CallsPage {
  private readonly clientsService = inject(ClientsService);
  private readonly commCallsService = inject(CommCallsService);
  private readonly dialog = inject(MatDialog);

  readonly clientControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<ClientOption[]>([]);
  readonly activeClient = signal<ClientOption | null>(null);

  readonly loading = signal(false);
  readonly calls = signal<CallLog[]>([]);

  constructor() {
    this.clientControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.clientResults.set([]);
          return;
        }
        this.clientsService.list({ q }).subscribe((clients) => {
          this.clientResults.set(
            clients.map((c) => ({ id: c.id, label: c.displayName ?? c.legalName ?? c.number })),
          );
        });
      });
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const client = this.clientResults().find((c) => c.label === label);
    if (!client) return;
    this.activeClient.set(client);
    this.load();
  }

  load(): void {
    const client = this.activeClient();
    if (!client) return;
    this.loading.set(true);
    this.commCallsService.listForClient(client.id).subscribe({
      next: (calls) => {
        this.calls.set(calls);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openLogDialog(): void {
    const client = this.activeClient();
    this.dialog
      .open<CallLogDialogComponent, CallLogDialogData, CallLog>(CallLogDialogComponent, {
        data: { clientId: client?.id ?? null, matterId: null },
      })
      .afterClosed()
      .subscribe((log) => {
        if (log) this.load();
      });
  }
}
