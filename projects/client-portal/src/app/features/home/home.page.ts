import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { EmptyStateComponent, LfCurrencyPipe, StatusChipComponent } from 'shared';
import { PortalAppointmentsService } from '../../core/services/portal-appointments.service';
import { PortalDocumentsService } from '../../core/services/portal-documents.service';
import { PortalInvoicesService } from '../../core/services/portal-invoices.service';
import { PortalMattersService } from '../../core/services/portal-matters.service';
import { PortalSessionService } from '../../core/services/portal-session.service';
import {
  PortalAppointment,
  PortalDocument,
  PortalInvoiceSummary,
  PortalMatterSummary,
} from '../../core/models/portal.models';

/** Home (PRD Module 17 step 2): my matters, unpaid invoices, recent documents, next appointment — four independent, parallel reads. */
@Component({
  selector: 'lf-portal-home-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    StatusChipComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly mattersService = inject(PortalMattersService);
  private readonly invoicesService = inject(PortalInvoicesService);
  private readonly documentsService = inject(PortalDocumentsService);
  private readonly appointmentsService = inject(PortalAppointmentsService);
  private readonly session = inject(PortalSessionService);
  private readonly router = inject(Router);

  readonly user = this.session.user;

  readonly mattersLoading = signal(true);
  readonly matters = signal<PortalMatterSummary[]>([]);

  readonly invoicesLoading = signal(true);
  readonly unpaidInvoices = computed(() =>
    this.invoices().filter((invoice) => invoice.openBalance > 0),
  );
  private readonly invoices = signal<PortalInvoiceSummary[]>([]);

  readonly documentsLoading = signal(true);
  readonly recentDocuments = computed(() =>
    [...this.documents()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  );
  private readonly documents = signal<PortalDocument[]>([]);

  readonly appointmentsLoading = signal(true);
  readonly nextAppointment = computed(() => {
    const upcoming = this.appointments()
      .filter((appointment) => new Date(appointment.requestedStart).getTime() > Date.now())
      .sort((a, b) => new Date(a.requestedStart).getTime() - new Date(b.requestedStart).getTime());
    return upcoming[0] ?? null;
  });
  private readonly appointments = signal<PortalAppointment[]>([]);

  constructor() {
    this.mattersService.getMyMatters().subscribe((matters) => {
      this.matters.set(matters);
      this.mattersLoading.set(false);
    });

    this.invoicesService.list().subscribe((invoices) => {
      this.invoices.set(invoices);
      this.invoicesLoading.set(false);
    });

    this.documentsService.list().subscribe((documents) => {
      this.documents.set(documents);
      this.documentsLoading.set(false);
    });

    this.appointmentsService.list().subscribe((appointments) => {
      this.appointments.set(appointments);
      this.appointmentsLoading.set(false);
    });
  }

  goToAppointments(): void {
    this.router.navigate(['/appointments']);
  }
}
