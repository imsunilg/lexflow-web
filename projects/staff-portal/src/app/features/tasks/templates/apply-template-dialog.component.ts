import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Matter, MattersService, OpsTask, TaskTemplate, TaskTemplatesService } from 'shared';

export interface ApplyTemplateDialogData {
  template: TaskTemplate;
}

export interface ApplyTemplateDialogResult {
  createdCount: number;
}

/**
 * Apply-template-to-matter dialog. `applyToMatter` is idempotent (matched by
 * a `templateKey`) — re-applying the same template to a matter it was already
 * applied to returns `[]` rather than an error, which this dialog reports as
 * "already applied" rather than a failure.
 */
@Component({
  selector: 'lf-apply-template-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apply-template-dialog.component.html',
  styleUrl: './apply-template-dialog.component.scss',
})
export class ApplyTemplateDialogComponent {
  readonly data = inject<ApplyTemplateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ApplyTemplateDialogComponent, ApplyTemplateDialogResult | undefined>>(
      MatDialogRef,
    );
  private readonly mattersService = inject(MattersService);
  private readonly templatesService = inject(TaskTemplatesService);

  readonly matterControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly matterResults = signal<Matter[]>([]);
  private selectedMatterId: string | null = null;

  readonly anchorDate = new FormControl<Date | null>(new Date(), {
    validators: [Validators.required],
  });

  submitting = false;
  error: string | null = null;

  constructor() {
    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedMatterId = null;
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });
  }

  matterLabel(matter: Matter): string {
    return `${matter.number} — ${matter.title}`;
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => this.matterLabel(m) === label);
    this.selectedMatterId = matter?.id ?? null;
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.matterControl.markAsTouched();
    if (!this.selectedMatterId || !this.anchorDate.value) {
      return;
    }

    this.submitting = true;
    this.error = null;
    this.templatesService
      .applyToMatter(this.selectedMatterId, this.data.template.id, {
        relativeFromDate: this.anchorDate.value.toISOString().slice(0, 10),
      })
      .subscribe({
        next: (created: OpsTask[]) => {
          this.dialogRef.close({ createdCount: created.length });
        },
        error: () => {
          this.submitting = false;
          this.error = 'Could not apply the template — please try again.';
        },
      });
  }
}
