import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PermissionService, RoleDto, RolesService } from 'shared';

export interface RoleFormDialogData {
  role?: RoleDto;
}

/**
 * Custom-role builder (PRD Module 14: "custom roles (Enterprise) built from
 * permission catalog"). The server independently enforces "can't exceed
 * creator's grants" — this dialog doesn't pre-filter the catalog to the
 * current user's own grants, since the server is the actual gate and a
 * client-side pre-filter could hide permissions the current user could
 * legitimately assign via a role they don't personally hold outright (e.g. a
 * combination). Save surfaces the server's rejection message as-is on 403.
 */
@Component({
  selector: 'lf-role-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.role ? 'Edit role' : 'New custom role' }}</h2>
    <mat-dialog-content class="role-form">
      <form [formGroup]="form">
        @if (!data.role) {
          <mat-form-field appearance="outline">
            <mat-label>Key</mat-label>
            <input matInput formControlName="key" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
      </form>

      <div class="role-form__catalog">
        @for (group of groupedCatalog(); track group.module) {
          <div class="role-form__group">
            <h3>{{ group.module }}</h3>
            @for (entry of group.entries; track entry.key) {
              <mat-checkbox [checked]="selected().has(entry.key)" (change)="toggle(entry.key)">
                {{ entry.label ?? entry.key }}
              </mat-checkbox>
            }
          </div>
        }
      </div>

      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (error()) {
        <p class="role-form__error">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid || submitting()"
        (click)="submit()"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .role-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      min-width: 480px;
      max-width: 640px;
    }

    .role-form__catalog {
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .role-form__group h3 {
      margin: 0 0 4px;
      font-size: var(--lf-text-sm);
      text-transform: capitalize;
      color: var(--lf-on-surface-variant);
    }

    .role-form__group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .role-form__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class RoleFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<RoleFormDialogComponent, RoleDto | undefined>>(MatDialogRef);
  readonly data = inject<RoleFormDialogData>(MAT_DIALOG_DATA);
  private readonly rolesService = inject(RolesService);
  private readonly permissionService = inject(PermissionService);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set(this.data.role?.permissionIds ?? []));

  readonly groupedCatalog = computed(() => {
    const groups = new Map<string, { key: string; label: string | null }[]>();
    for (const entry of this.permissionService.catalog()) {
      const list = groups.get(entry.module) ?? [];
      list.push({ key: entry.id, label: entry.label ?? entry.key });
      groups.set(entry.module, list);
    }
    return [...groups.entries()].map(([module, entries]) => ({ module, entries }));
  });

  readonly form = new FormGroup({
    key: new FormControl(this.data.role?.key ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    name: new FormControl(this.data.role?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  toggle(permissionId: string): void {
    this.selected.update((keys) => {
      const updated = new Set(keys);
      if (updated.has(permissionId)) updated.delete(permissionId);
      else updated.add(permissionId);
      return updated;
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    const permissionIds = [...this.selected()];

    const save$ = this.data.role
      ? this.rolesService.update(this.data.role.id, { name: value.name, permissionIds })
      : this.rolesService.create({ key: value.key, name: value.name, permissionIds });

    save$.subscribe({
      next: (role) => this.dialogRef.close(role),
      error: () => {
        this.submitting.set(false);
        this.error.set(
          'Could not save this role — it may grant a permission you do not hold yourself.',
        );
      },
    });
  }
}
