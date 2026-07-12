import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CreateTaskTemplateRequest,
  OPS_TASK_CATEGORIES,
  OpsTaskCategory,
  TaskTemplate,
  TaskTemplatesService,
} from 'shared';

interface TemplateItemGroup {
  title: FormControl<string>;
  relativeDueDays: FormControl<number>;
  category: FormControl<OpsTaskCategory | null>;
  isMandatory: FormControl<boolean>;
}

function buildItemGroup(): FormGroup<TemplateItemGroup> {
  return new FormGroup<TemplateItemGroup>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    relativeDueDays: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl<OpsTaskCategory | null>(null),
    isMandatory: new FormControl(false, { nonNullable: true }),
  });
}

/**
 * Create-template dialog (PRD Module 10 UI Components: "template manager").
 * There is no fixed enum for `matterType` server-side — it's a free-text
 * field — and template items have no `priority` field: applying a template
 * always hardcodes `priority: Medium` and `ownerId: null` server-side
 * regardless of anything editable here, so those controls are deliberately
 * omitted rather than built and silently discarded.
 */
@Component({
  selector: 'lf-template-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-form-dialog.component.html',
  styleUrl: './template-form-dialog.component.scss',
})
export class TemplateFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TemplateFormDialogComponent, TaskTemplate | undefined>>(MatDialogRef);
  private readonly templatesService = inject(TaskTemplatesService);

  readonly categories = OPS_TASK_CATEGORIES;

  readonly name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });
  readonly matterType = new FormControl('', { nonNullable: true });
  readonly items = new FormArray<FormGroup<TemplateItemGroup>>([buildItemGroup()]);

  submitting = false;
  error: string | null = null;

  addItem(): void {
    this.items.push(buildItemGroup());
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.name.markAsTouched();
    this.items.controls.forEach((group) => group.controls.title.markAsTouched());

    if (this.name.invalid || this.items.invalid || this.items.length === 0) {
      return;
    }

    const request: CreateTaskTemplateRequest = {
      name: this.name.value,
      matterType: this.matterType.value.trim() || null,
      items: this.items.controls.map((group, index) => ({
        title: group.controls.title.value,
        relativeDueDays: group.controls.relativeDueDays.value,
        category: group.controls.category.value,
        sortOrder: index,
        isMandatory: group.controls.isMandatory.value,
      })),
    };

    this.submitting = true;
    this.error = null;
    this.templatesService.create(request).subscribe({
      next: (template) => this.dialogRef.close(template),
      error: () => {
        this.submitting = false;
        this.error = 'Could not create the template — please try again.';
      },
    });
  }
}
