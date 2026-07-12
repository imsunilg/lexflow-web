import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ApiErrorEnvelope, EmptyStateComponent, StatusChipComponent } from 'shared';
import { PortalAppointment, PortalMatterSummary } from '../../core/models/portal.models';
import { PortalAppointmentsService } from '../../core/services/portal-appointments.service';
import { PortalMattersService } from '../../core/services/portal-matters.service';

const MIN_LEAD_HOURS = 24;

/**
 * Appointments (PRD Module 17 step 6). Two confirmed backend gaps this form
 * discloses rather than fakes:
 * - No lawyer-lookup endpoint exists anywhere in the portal API — requesting
 *   an appointment requires a raw `lawyerId` GUID that `GET /me/matters`
 *   never exposes (only the responsible lawyer's *name*). Until the backend
 *   adds a lookup, this app can only accept an ID the firm has shared
 *   out-of-band with the client — it does not invent or guess one.
 * - There is no confirm/reschedule endpoint (the domain models it, nothing
 *   calls it), so every request here stays "Requested" until a human process
 *   outside this app moves it along.
 */
@Component({
  selector: 'lf-portal-appointments-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointments.page.html',
  styleUrl: './appointments.page.scss',
})
export class AppointmentsPage {
  private readonly appointmentsService = inject(PortalAppointmentsService);
  private readonly mattersService = inject(PortalMattersService);

  readonly loading = signal(true);
  readonly appointments = signal<PortalAppointment[]>([]);
  readonly matters = signal<PortalMatterSummary[]>([]);

  readonly form = new FormGroup({
    matterId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lawyerId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    requestedStart: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    requestedEnd: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
  });

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.appointmentsService.list().subscribe((appointments) => {
      this.appointments.set(appointments);
      this.loading.set(false);
    });
    this.mattersService.getMyMatters().subscribe((matters) => this.matters.set(matters));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const requestedStart = new Date(value.requestedStart);
    const leadHours = (requestedStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (leadHours < MIN_LEAD_HOURS) {
      this.error.set(`Appointments must be requested at least ${MIN_LEAD_HOURS} hours ahead.`);
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.appointmentsService
      .request({
        matterId: value.matterId,
        lawyerId: value.lawyerId,
        requestedStart: requestedStart.toISOString(),
        requestedEnd: new Date(value.requestedEnd).toISOString(),
        notes: value.notes || undefined,
      })
      .subscribe({
        next: (appointment) => {
          this.submitting.set(false);
          this.appointments.update((appointments) => [appointment, ...appointments]);
          this.form.reset({
            matterId: '',
            lawyerId: '',
            requestedStart: '',
            requestedEnd: '',
            notes: '',
          });
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          const envelope = err.error as Partial<ApiErrorEnvelope> | null;
          this.error.set(envelope?.error?.message ?? 'Could not submit this request.');
        },
      });
  }
}
