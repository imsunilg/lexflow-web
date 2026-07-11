import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { catchError, of } from 'rxjs';
import {
  ApiErrorEnvelope,
  ConflictMatch,
  Matter,
  MATTER_PRIORITIES,
  MATTER_TYPES,
  MatterPriority,
  MatterType,
  MattersService,
  requiredCatalogValidators,
} from 'shared';

/** §27-style rule mirroring the backend's "open date ≤ today" constraint for `openedOn`. */
function dateNotInFutureValidator(): (control: AbstractControl) => ValidationErrors | null {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date.getTime() > today.getTime() ? { dateNotInFuture: true } : null;
  };
}

function toIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/**
 * Create-matter dialog (PRD Module 4 User Flow step 1 + "matter create dialog
 * (2-step)"). Step 1 captures the core matter fields; step 2 collects
 * opposite-party names and runs the conflict check inline (AC-M1), requiring
 * an explicit override + reason before the create can proceed when matches
 * are found — mirroring `CreateMatterCommandValidator`'s
 * "ConflictOverrideReason required when OverrideConflict=true" rule.
 *
 * No client/practice-area/branch/lawyer picker components exist yet in this
 * codebase, so those fields are plain text inputs with a hint explaining the
 * gap, same workaround used elsewhere (e.g. Clients list skipping owner/branch
 * filters).
 */
@Component({
  selector: 'lf-create-matter-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatStepperModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-matter-dialog.component.html',
  styleUrl: './create-matter-dialog.component.scss',
})
export class CreateMatterDialogComponent {
  private readonly mattersService = inject(MattersService);
  private readonly dialogRef =
    inject<MatDialogRef<CreateMatterDialogComponent, Matter | undefined>>(MatDialogRef);

  readonly matterTypes = MATTER_TYPES;
  readonly priorities = MATTER_PRIORITIES;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly checkingConflicts = signal(false);
  readonly conflictCheckRun = signal(false);
  readonly conflicts = signal<ConflictMatch[]>([]);
  readonly overrideChecked = new FormControl(false, { nonNullable: true });
  readonly conflictOverrideReason = new FormControl('', { nonNullable: true });

  readonly detailsForm = new FormGroup({
    clientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', {
      nonNullable: true,
      validators: requiredCatalogValidators('title'),
    }),
    matterType: new FormControl<MatterType | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    practiceAreaId: new FormControl('', { nonNullable: true }),
    branchId: new FormControl('', { nonNullable: true }),
    responsibleLawyerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    priority: new FormControl<MatterPriority>('Medium', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    openedOn: new FormControl<Date | null>(new Date(), {
      validators: [Validators.required, dateNotInFutureValidator()],
    }),
    budget: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  readonly partyControls = signal<FormControl<string>[]>([
    new FormControl('', { nonNullable: true }),
  ]);

  get requiresOverride(): boolean {
    return this.conflictCheckRun() && this.conflicts().length > 0;
  }

  get canSubmit(): boolean {
    if (this.detailsForm.invalid || this.submitting()) {
      return false;
    }
    if (!this.requiresOverride) {
      return true;
    }
    if (!this.overrideChecked.value) {
      return false;
    }
    return this.conflictOverrideReason.value.trim().length > 0;
  }

  addParty(): void {
    this.partyControls.update((controls) => [
      ...controls,
      new FormControl('', { nonNullable: true }),
    ]);
  }

  removeParty(index: number): void {
    this.partyControls.update((controls) => controls.filter((_, i) => i !== index));
  }

  private currentPartyNames(): string[] {
    return this.partyControls()
      .map((control) => control.value.trim())
      .filter((name) => name.length > 0);
  }

  checkConflicts(): void {
    const names = this.currentPartyNames();
    if (names.length === 0) {
      this.conflicts.set([]);
      this.conflictCheckRun.set(true);
      return;
    }
    this.checkingConflicts.set(true);
    this.mattersService
      .checkConflicts(names)
      .pipe(
        catchError(() => {
          this.checkingConflicts.set(false);
          return of([] as ConflictMatch[]);
        }),
      )
      .subscribe((matches) => {
        this.checkingConflicts.set(false);
        this.conflictCheckRun.set(true);
        this.conflicts.set(matches);
        if (matches.length === 0) {
          this.overrideChecked.setValue(false);
          this.conflictOverrideReason.setValue('');
        }
      });
  }

  submit(): void {
    if (!this.canSubmit) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.detailsForm.getRawValue();
    const oppositePartyNames = this.currentPartyNames();
    const overrideConflict = this.requiresOverride && this.overrideChecked.value;

    this.mattersService
      .create({
        clientId: value.clientId,
        title: value.title,
        matterType: value.matterType as MatterType,
        practiceAreaId: value.practiceAreaId || null,
        branchId: value.branchId || null,
        responsibleLawyerId: value.responsibleLawyerId,
        priority: value.priority,
        description: value.description || null,
        openedOn: toIsoDate(value.openedOn!),
        budget: value.budget ?? null,
        oppositePartyNames,
        overrideConflict,
        conflictOverrideReason: overrideConflict ? this.conflictOverrideReason.value.trim() : null,
      })
      .pipe(
        catchError((error: unknown) => {
          this.submitting.set(false);
          this.handleCreateError(error);
          return of(null);
        }),
      )
      .subscribe((matter) => {
        if (matter) {
          this.submitting.set(false);
          this.dialogRef.close(matter);
        }
      });
  }

  private handleCreateError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.errorMessage.set('Something went wrong. Please try again.');
      return;
    }

    const envelope = error.error as Partial<ApiErrorEnvelope> | null;
    if (error.status === 422 && envelope?.error?.code === 'CONFLICT_OF_INTEREST_SUSPECTED') {
      const details = envelope.error.details;
      if (
        Array.isArray(details) &&
        details.every((d) => d && typeof d === 'object' && 'name' in d)
      ) {
        this.conflicts.set(details as unknown as ConflictMatch[]);
      }
      this.conflictCheckRun.set(true);
      this.errorMessage.set(
        'A potential conflict of interest was found. Review the matches below, check the override box, and provide a reason to proceed.',
      );
      return;
    }

    this.errorMessage.set(envelope?.error?.message ?? 'Something went wrong. Please try again.');
  }
}
