import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ApiErrorEnvelope,
  BranchDto,
  BranchesService,
  EmptyStateComponent,
  TaxRateDto,
  TaxRatesService,
} from 'shared';
import { AdminTabsComponent } from '../../admin-tabs.component';

const COMMON_TAX_TYPES = ['CGST', 'SGST', 'IGST', 'VAT', 'GST'];

/**
 * Tax rates (PRD Module 15 §8, `TaxRatesController`). `countryCode`/`taxType`
 * are free strings server-side (no enforced enum) — the common values below
 * are offered only as autocomplete suggestions. Rate percentages/breakdowns
 * live entirely inside the opaque `componentsJson` blob; there is no
 * first-class HSN/SAC or place-of-supply field.
 */
@Component({
  selector: 'lf-tax-rates-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-rates.page.html',
  styleUrl: './tax-rates.page.scss',
})
export class TaxRatesPage {
  private readonly taxRatesService = inject(TaxRatesService);
  private readonly branchesService = inject(BranchesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly commonTaxTypes = COMMON_TAX_TYPES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly rates = signal<TaxRateDto[]>([]);
  readonly branches = signal<BranchDto[]>([]);
  readonly showNewForm = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly newForm = this.buildForm();
  readonly editForm = this.buildForm();

  constructor() {
    this.load();
    this.branchesService.list().subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => this.branches.set([]),
    });
  }

  private buildForm() {
    return new FormGroup({
      countryCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      taxType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      componentsJson: new FormControl('{}', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      isActive: new FormControl(true, { nonNullable: true }),
      branchId: new FormControl<string | null>(null),
    });
  }

  load(): void {
    this.loading.set(true);
    this.taxRatesService.list().subscribe({
      next: (rates) => {
        this.rates.set(rates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  branchName(branchId: string | null): string {
    if (!branchId) return 'All branches';
    return this.branches().find((b) => b.id === branchId)?.name ?? branchId;
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const envelope = err.error as Partial<ApiErrorEnvelope> | null;
      return envelope?.error?.message ?? fallback;
    }
    return fallback;
  }

  private validateComponentsJson(form: typeof this.newForm): boolean {
    try {
      JSON.parse(form.controls.componentsJson.value);
      return true;
    } catch {
      this.snackBar.open('Components must be valid JSON.', 'Dismiss', { duration: 5000 });
      return false;
    }
  }

  toggleNewForm(): void {
    this.showNewForm.update((v) => !v);
  }

  createRate(): void {
    this.newForm.markAllAsTouched();
    if (this.newForm.invalid || !this.validateComponentsJson(this.newForm)) return;
    const v = this.newForm.getRawValue();
    this.saving.set(true);
    this.taxRatesService
      .create({
        countryCode: v.countryCode,
        taxType: v.taxType,
        componentsJson: v.componentsJson,
        isActive: v.isActive,
        branchId: v.branchId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showNewForm.set(false);
          this.newForm.reset({
            countryCode: '',
            taxType: '',
            componentsJson: '{}',
            isActive: true,
            branchId: null,
          });
          this.load();
          this.snackBar.open('Tax rate created.', 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackBar.open(
            this.extractErrorMessage(err, 'Could not create tax rate.'),
            'Dismiss',
            {
              duration: 6000,
            },
          );
        },
      });
  }

  startEdit(rate: TaxRateDto): void {
    this.editingId.set(rate.id);
    this.editForm.setValue({
      countryCode: rate.countryCode,
      taxType: rate.taxType,
      componentsJson: rate.componentsJson,
      isActive: rate.isActive,
      branchId: rate.branchId,
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(rate: TaxRateDto): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid || !this.validateComponentsJson(this.editForm)) return;
    const v = this.editForm.getRawValue();
    this.saving.set(true);
    this.taxRatesService
      .update(rate.id, {
        countryCode: v.countryCode,
        taxType: v.taxType,
        componentsJson: v.componentsJson,
        isActive: v.isActive,
        branchId: v.branchId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          this.load();
          this.snackBar.open('Tax rate updated.', 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackBar.open(
            this.extractErrorMessage(err, 'Could not update tax rate.'),
            'Dismiss',
            {
              duration: 6000,
            },
          );
        },
      });
  }

  deleteRate(rate: TaxRateDto): void {
    this.taxRatesService.delete(rate.id).subscribe({
      next: () => {
        this.load();
        this.snackBar.open('Tax rate deleted.', 'Dismiss', { duration: 3000 });
      },
      error: (err: unknown) => {
        this.snackBar.open(this.extractErrorMessage(err, 'Could not delete tax rate.'), 'Dismiss', {
          duration: 6000,
        });
      },
    });
  }
}
