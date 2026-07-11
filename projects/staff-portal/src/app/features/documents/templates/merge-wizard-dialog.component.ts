import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import {
  ApiErrorEnvelope,
  DocumentTemplate,
  DocumentTemplatesService,
  LfDocument,
  Matter,
  MattersService,
} from 'shared';

export interface MergeWizardDialogData {
  template: DocumentTemplate;
}

/** PRD Module 7 User Flow 5: "Generate from template" → server-side merge → new draft doc in matter. */
@Component({
  selector: 'lf-merge-wizard-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatStepperModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './merge-wizard-dialog.component.html',
  styleUrl: './merge-wizard-dialog.component.scss',
})
export class MergeWizardDialogComponent {
  private readonly mattersService = inject(MattersService);
  private readonly documentTemplatesService = inject(DocumentTemplatesService);
  private readonly dialogRef =
    inject<MatDialogRef<MergeWizardDialogComponent, LfDocument | undefined>>(MatDialogRef);
  readonly data = inject<MergeWizardDialogData>(MAT_DIALOG_DATA);

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterOptions = signal<Matter[]>([]);
  readonly selectedMatter = signal<Matter | null>(null);

  readonly fieldsForm: FormGroup<Record<string, FormControl<string>>>;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly missingFieldLabels = signal<string[]>([]);

  constructor() {
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.data.template.fields) {
      controls[field.name] = new FormControl('', {
        nonNullable: true,
        validators: field.required ? [Validators.required] : [],
      });
    }
    this.fieldsForm = new FormGroup(controls);

    this.matterControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string' || !value.trim()) {
            return of<Matter[]>([]);
          }
          if (this.selectedMatter() && this.matterDisplay(this.selectedMatter()) === value) {
            return of<Matter[]>([]);
          }
          return this.mattersService.list({ q: value }).pipe(catchError(() => of<Matter[]>([])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((matters) => this.matterOptions.set(matters));
  }

  matterDisplay = (matter: Matter | null): string => {
    if (!matter) return '';
    return `${matter.number} — ${matter.title}`;
  };

  onMatterSelected(matter: Matter): void {
    this.selectedMatter.set(matter);
  }

  get canProceedToReview(): boolean {
    return !!this.selectedMatter() && this.fieldsForm.valid;
  }

  labelFor(fieldName: string): string {
    return this.data.template.fields.find((f) => f.name === fieldName)?.label ?? fieldName;
  }

  generate(): void {
    const matter = this.selectedMatter();
    if (!matter || this.fieldsForm.invalid) {
      this.fieldsForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.missingFieldLabels.set([]);

    this.documentTemplatesService
      .generate(this.data.template.id, {
        matterId: matter.id,
        overrides: this.fieldsForm.getRawValue(),
      })
      .pipe(
        catchError((error: unknown) => {
          this.submitting.set(false);
          this.handleGenerateError(error);
          return of(null);
        }),
      )
      .subscribe((document) => {
        if (document) {
          this.submitting.set(false);
          this.dialogRef.close(document);
        }
      });
  }

  private handleGenerateError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.errorMessage.set('Something went wrong. Please try again.');
      return;
    }

    const envelope = error.error as Partial<ApiErrorEnvelope> | null;
    const details = envelope?.error?.details;
    if (error.status === 422 && Array.isArray(details) && details.length > 0) {
      this.missingFieldLabels.set(details.map((d) => this.labelFor(d.field)));
      this.errorMessage.set('Template merge failed — required fields are missing:');
      return;
    }

    this.errorMessage.set(envelope?.error?.message ?? 'Something went wrong. Please try again.');
  }
}
