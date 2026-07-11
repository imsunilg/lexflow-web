import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CLIENT_ADDRESS_KINDS,
  Client,
  ClientAddress,
  ClientCommunication,
  ClientSummary,
  ClientsService,
  EmptyStateComponent,
  LfCurrencyPipe,
  StatusChipComponent,
} from 'shared';
import { ContactSubGridComponent } from './contact-sub-grid.component';
import { KycDocumentManagerComponent } from './kyc-document-manager.component';
import {
  MergeClientsDialogComponent,
  MergeClientsDialogData,
} from './merge-clients-dialog.component';
import { PortalAccessManagerComponent } from './portal-access-manager.component';
import { RelationshipGraphComponent } from './relationship-graph.component';

/**
 * Client 360° detail (PRD Module 3): sticky header + 8 tabs
 * (Overview | Matters | Invoices & Payments | Documents | Contracts |
 * Communication | Notes | Portal). The PRD doesn't break down per-tab
 * content beyond naming the 8 tabs — Overview is built here as "everything
 * about the client record itself" (profile, contacts, addresses, KYC,
 * relationships), since none of those has its own tab slot in the PRD's
 * list. Matters/Invoices/Documents/Contracts/Notes render honest empty
 * states: the backend's own `ClientSummaryDto`/communications endpoint
 * already return zeros/empty lists for these because the Legal/Fin/DMS/Comm
 * modules haven't shipped yet (per `IClientService.cs`'s own comments).
 */
@Component({
  selector: 'lf-staff-client-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    EmptyStateComponent,
    LfCurrencyPipe,
    StatusChipComponent,
    ContactSubGridComponent,
    KycDocumentManagerComponent,
    PortalAccessManagerComponent,
    RelationshipGraphComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-detail.page.html',
  styleUrl: './client-detail.page.scss',
})
export class ClientDetailPage {
  private readonly clientsService = inject(ClientsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly client = signal<Client | null>(null);
  readonly summary = signal<ClientSummary | null>(null);

  readonly addresses = signal<ClientAddress[]>([]);
  readonly addressKinds = CLIENT_ADDRESS_KINDS;
  readonly addingAddress = signal(false);

  readonly communications = signal<ClientCommunication[]>([]);
  readonly communicationsLoading = signal(false);
  readonly channelFilter = new FormControl('', { nonNullable: true });

  readonly addressForm = new FormGroup({
    kind: new FormControl(CLIENT_ADDRESS_KINDS[0], { nonNullable: true }),
    line1: new FormControl('', { nonNullable: true }),
    line2: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    stateCode: new FormControl('', { nonNullable: true }),
    postal: new FormControl('', { nonNullable: true }),
    country: new FormControl('', { nonNullable: true }),
    isPrimaryOfKind: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(false);

    this.clientsService.get(id).subscribe({
      next: (client) => {
        // AC-C3: the API returns the tombstoned record (with mergedIntoClientId set) for a merged client's old id.
        if (client.mergedIntoClientId) {
          this.router.navigate(['/clients', client.mergedIntoClientId], { replaceUrl: true });
          return;
        }
        this.client.set(client);
        this.loading.set(false);
        this.loadSummary(id);
        this.loadAddresses(id);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadSummary(id: string): void {
    this.clientsService.summary(id).subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => undefined,
    });
  }

  private loadAddresses(id: string): void {
    this.clientsService.listAddresses(id).subscribe({
      next: (addresses) => this.addresses.set(addresses),
      error: () => undefined,
    });
  }

  addAddress(): void {
    const client = this.client();
    if (!client) {
      return;
    }
    const value = this.addressForm.getRawValue();
    if (!value.line1.trim()) {
      return;
    }

    this.clientsService
      .addAddress(client.id, {
        kind: value.kind,
        line1: value.line1,
        line2: value.line2 || null,
        city: value.city || null,
        stateCode: value.stateCode || null,
        postal: value.postal || null,
        country: value.country || null,
        isPrimaryOfKind: value.isPrimaryOfKind,
      })
      .subscribe((address) => {
        this.addresses.update((items) => [...items, address]);
        this.addingAddress.set(false);
        this.addressForm.reset({
          kind: CLIENT_ADDRESS_KINDS[0],
          line1: '',
          line2: '',
          city: '',
          stateCode: '',
          postal: '',
          country: '',
          isPrimaryOfKind: false,
        });
      });
  }

  loadCommunications(): void {
    const client = this.client();
    if (!client) {
      return;
    }
    this.communicationsLoading.set(true);
    this.clientsService.communications(client.id, this.channelFilter.value || undefined).subscribe({
      next: (items) => {
        this.communications.set(items);
        this.communicationsLoading.set(false);
      },
      error: () => this.communicationsLoading.set(false),
    });
  }

  onPortalToggled(updated: Client): void {
    this.client.set(updated);
  }

  openMergeDialog(): void {
    const client = this.client();
    if (!client) {
      return;
    }
    this.dialog
      .open<MergeClientsDialogComponent, MergeClientsDialogData, boolean>(
        MergeClientsDialogComponent,
        { data: { client }, width: '520px' },
      )
      .afterClosed()
      .subscribe((merged) => {
        if (merged) {
          this.load();
        }
      });
  }
}
