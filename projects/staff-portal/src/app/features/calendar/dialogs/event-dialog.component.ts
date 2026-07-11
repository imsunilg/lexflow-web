import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CALENDAR_EVENT_KINDS,
  CalendarEditScope,
  CalendarEvent,
  CalendarEventKind,
  CalendarService,
  REMINDER_CHANNELS,
  ReminderChannel,
  RRULE_FREQUENCIES,
  RRULE_WEEKDAYS,
  RecurrenceRule,
  RruleWeekday,
} from 'shared';
import { buildRrule, expandOccurrences, parseRrule } from '../rrule.util';

export interface EventDialogData {
  mode: 'create' | 'edit';
  event?: CalendarEvent;
  initialDate?: Date;
  matterId?: string | null;
}

interface ReminderRow {
  offsetMinutes: FormControl<number>;
  channel: FormControl<ReminderChannel>;
}

/**
 * Create/edit dialog for native calendar events (Meeting/Personal) — Hearings/
 * Tasks/Deadlines are read-linked projections edited at their source module
 * and never opened here (PRD User Flow 2). Houses the RRULE builder UI
 * (freq/interval/byday/until-or-count) with a live "next occurrences" preview.
 */
@Component({
  selector: 'lf-event-dialog',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-dialog.component.html',
  styleUrl: './event-dialog.component.scss',
})
export class EventDialogComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly dialogRef =
    inject<MatDialogRef<EventDialogComponent, CalendarEvent | undefined>>(MatDialogRef);
  readonly data = inject<EventDialogData>(MAT_DIALOG_DATA);

  readonly kinds = CALENDAR_EVENT_KINDS;
  readonly frequencies = RRULE_FREQUENCIES;
  readonly weekdays = RRULE_WEEKDAYS;
  readonly channels = REMINDER_CHANNELS;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly recurring = signal(false);
  readonly endCondition = signal<'never' | 'until' | 'count'>('never');

  readonly form = new FormGroup({
    kind: new FormControl<CalendarEventKind>('Meeting', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    allDay: new FormControl(false, { nonNullable: true }),
    location: new FormControl(''),
    videoLink: new FormControl(''),
  });

  readonly startControl = new FormControl<Date | null>(this.data.initialDate ?? new Date(), {
    validators: [Validators.required],
  });
  readonly endControl = new FormControl<Date | null>(
    this.data.initialDate
      ? new Date(this.data.initialDate.getTime() + 60 * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000),
    { validators: [Validators.required] },
  );

  readonly recurrenceForm = new FormGroup({
    freq: new FormControl<RecurrenceRule['freq']>('WEEKLY', { nonNullable: true }),
    interval: new FormControl(1, { nonNullable: true, validators: [Validators.min(1)] }),
    byDay: new FormControl<RruleWeekday[]>([], { nonNullable: true }),
  });
  readonly untilControl = new FormControl<Date | null>(null);
  readonly countControl = new FormControl(5, { validators: [Validators.min(1)] });

  readonly attendees = new FormArray<FormControl<string>>([]);
  readonly reminders = new FormArray<FormGroup<ReminderRow>>([]);

  readonly builtRrule = computed(() => {
    if (!this.recurring()) return null;
    const value = this.recurrenceForm.getRawValue();
    const rule: RecurrenceRule = {
      freq: value.freq,
      interval: value.interval,
      byDay: value.byDay,
      until:
        this.endCondition() === 'until'
          ? (this.untilControl.value?.toISOString().slice(0, 10) ?? null)
          : null,
      count: this.endCondition() === 'count' ? (this.countControl.value ?? null) : null,
    };
    return buildRrule(rule);
  });

  readonly upcomingOccurrences = computed(() => {
    const rrule = this.builtRrule();
    const start = this.startControl.value;
    if (!rrule || !start) return [];
    const rangeTo = new Date(start);
    rangeTo.setFullYear(rangeTo.getFullYear() + 2);
    return expandOccurrences(start.toISOString(), rrule, start, rangeTo).slice(0, 5);
  });

  constructor() {
    const event = this.data.event;
    if (event) {
      this.form.patchValue({
        kind: event.kind,
        title: event.title,
        allDay: event.allDay,
        location: event.location ?? '',
        videoLink: event.videoLink ?? '',
      });
      this.startControl.setValue(new Date(event.startsAt));
      this.endControl.setValue(new Date(event.endsAt));
      if (event.rrule) {
        this.recurring.set(true);
        const parsed = parseRrule(event.rrule);
        this.recurrenceForm.patchValue({
          freq: parsed.freq,
          interval: parsed.interval,
          byDay: parsed.byDay,
        });
        if (parsed.count) {
          this.endCondition.set('count');
          this.countControl.setValue(parsed.count);
        } else if (parsed.until) {
          this.endCondition.set('until');
          this.untilControl.setValue(new Date(parsed.until));
        }
      }
    }
  }

  toggleByDay(day: RruleWeekday): void {
    const current = this.recurrenceForm.controls.byDay.value;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    this.recurrenceForm.controls.byDay.setValue(next);
  }

  addAttendee(): void {
    if (this.attendees.length >= 100) return;
    this.attendees.push(new FormControl('', { nonNullable: true, validators: [Validators.email] }));
  }

  removeAttendee(index: number): void {
    this.attendees.removeAt(index);
  }

  addReminder(): void {
    this.reminders.push(
      new FormGroup({
        offsetMinutes: new FormControl(1440, {
          nonNullable: true,
          validators: [Validators.min(0), Validators.max(90 * 24 * 60)],
        }),
        channel: new FormControl<ReminderChannel>('Email', { nonNullable: true }),
      }),
    );
  }

  removeReminder(index: number): void {
    this.reminders.removeAt(index);
  }

  submit(): void {
    const start = this.startControl.value;
    const end = this.endControl.value;
    if (this.form.invalid || !start || !end) {
      this.form.markAllAsTouched();
      return;
    }
    if (end <= start) {
      this.errorMessage.set('End must be after start.');
      return;
    }
    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 14) {
      this.errorMessage.set('Duration cannot exceed 14 days.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    const attendees = this.attendees.controls
      .map((c) => c.value.trim())
      .filter((email) => email.length > 0)
      .map((email) => ({ email }));

    const payload = {
      kind: value.kind,
      title: value.title,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      allDay: value.allDay,
      location: value.location || null,
      videoLink: value.videoLink || null,
      matterId: this.data.matterId ?? null,
      rrule: this.builtRrule(),
      attendees,
    };

    const editingExisting = this.data.mode === 'edit' && this.data.event;
    const request$ = editingExisting
      ? this.calendarService.updateEvent(
          this.data.event!.id,
          payload,
          this.data.event!.rrule ? this.scopeForEdit() : undefined,
        )
      : this.calendarService.createEvent(payload);

    request$.subscribe({
      next: (saved) => {
        const reminderRequests = this.reminders.controls.map((row) =>
          this.calendarService
            .addReminder(saved.id, row.getRawValue())
            .pipe(catchError(() => of(null))),
        );
        const afterReminders$: Observable<unknown> =
          reminderRequests.length > 0 ? forkJoin(reminderRequests) : of(null);
        afterReminders$.subscribe(() => {
          this.saving.set(false);
          this.dialogRef.close(saved);
        });
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }

  private scopeForEdit(): CalendarEditScope {
    return 'series';
  }
}
