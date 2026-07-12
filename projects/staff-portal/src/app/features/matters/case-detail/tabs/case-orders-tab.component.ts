import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CourtCasesService, CourtOrder, EmptyStateComponent, FileUploaderComponent } from 'shared';

const COMPLIANCE_WARNING_DAYS = 7;

/** Rejects any date strictly after today (local midnight comparison). */
function notFutureDateValidator(control: FormControl<Date | null>): Record<string, true> | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(value);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() > today.getTime() ? { futureDate: true } : null;
}

/** Days between today and `dueDate`; negative when already past. */
function daysUntil(dueDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / msPerDay);
}

function buildUploadForm(): FormGroup<{
  orderDate: FormControl<Date | null>;
  gist: FormControl<string>;
  complianceDue: FormControl<Date | null>;
}> {
  return new FormGroup({
    orderDate: new FormControl<Date | null>(null, {
      validators: [Validators.required, notFutureDateValidator],
    }),
    gist: new FormControl('', { nonNullable: true }),
    complianceDue: new FormControl<Date | null>(null),
  });
}

/**
 * Orders tab for the case detail page (PRD Module 5). Self-contained:
 * fetches its own orders from `caseId` and manages loading/error/empty state.
 */
@Component({
  selector: 'lf-case-orders-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    FileUploaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="orders-tab">
      @if (loading()) {
        <div class="orders-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load orders"
          i18n-title="@@matters.caseOrdersTab.loadErrorTitle"
          message="Something went wrong while loading orders."
          i18n-message="@@matters.caseOrdersTab.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@matters.caseOrdersTab.retryButton"
          (cta)="load()"
        />
      } @else {
        @if (orders().length === 0) {
          <lf-empty-state
            icon="gavel"
            title="No orders yet"
            i18n-title="@@matters.caseOrdersTab.emptyTitle"
          />
        } @else {
          <div class="orders-tab__list">
            @for (order of orders(); track order.id) {
              <div class="orders-tab__card">
                <span class="orders-tab__date">{{ order.orderDate }}</span>
                <span class="orders-tab__gist">{{ order.gist ?? '—' }}</span>
                @if (order.complianceDue) {
                  <span
                    class="orders-tab__due"
                    [style.color]="complianceDueColor(order.complianceDue)"
                    i18n="@@matters.caseOrdersTab.complianceDue"
                  >
                    Compliance due {{ order.complianceDue }}
                  </span>
                }
              </div>
            }
          </div>
        }

        <div class="orders-tab__upload">
          <h3 class="orders-tab__upload-title" i18n="@@matters.caseOrdersTab.uploadTitle">
            Upload order
          </h3>
          <form [formGroup]="uploadForm" class="orders-tab__form">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseOrdersTab.orderDateLabel">Order date</mat-label>
              <input matInput [matDatepicker]="orderDatePicker" formControlName="orderDate" />
              <mat-datepicker-toggle matIconSuffix [for]="orderDatePicker" />
              <mat-datepicker #orderDatePicker />
              @if (
                uploadForm.controls.orderDate.hasError('futureDate') &&
                uploadForm.controls.orderDate.touched
              ) {
                <mat-error i18n="@@matters.caseOrdersTab.futureDateError"
                  >Order date can't be in the future.</mat-error
                >
              }
              @if (
                uploadForm.controls.orderDate.hasError('required') &&
                uploadForm.controls.orderDate.touched
              ) {
                <mat-error i18n="@@matters.caseOrdersTab.orderDateRequiredError"
                  >Order date is required.</mat-error
                >
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseOrdersTab.gistLabel">Gist</mat-label>
              <textarea matInput formControlName="gist"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@matters.caseOrdersTab.complianceDueLabel"
                >Compliance due (optional)</mat-label
              >
              <input matInput [matDatepicker]="dueDatePicker" formControlName="complianceDue" />
              <mat-datepicker-toggle matIconSuffix [for]="dueDatePicker" />
              <mat-datepicker #dueDatePicker />
            </mat-form-field>
          </form>

          <lf-file-uploader
            accept=".pdf,.jpg,.jpeg,.png"
            (filesSelected)="onFilesSelected($event)"
          />

          @if (selectedFile()) {
            <p class="orders-tab__selected-file" i18n="@@matters.caseOrdersTab.selectedFile">
              Selected: {{ selectedFile()!.name }}
            </p>
          }

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="!canUpload() || uploading()"
            (click)="upload()"
          >
            @if (uploading()) {
              <mat-spinner diameter="18" />
            } @else {
              <span i18n="@@matters.caseOrdersTab.uploadButton">Upload</span>
            }
          </button>

          @if (uploadErrorMessage()) {
            <p class="orders-tab__error" role="alert">{{ uploadErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .orders-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .orders-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .orders-tab__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .orders-tab__card {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .orders-tab__date {
      font-weight: 600;
    }

    .orders-tab__gist {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .orders-tab__due {
      font-size: var(--lf-text-sm);
      font-weight: 600;
    }

    .orders-tab__upload {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .orders-tab__upload-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .orders-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0 var(--lf-space-2);
    }

    .orders-tab__selected-file {
      margin: 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .orders-tab__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CaseOrdersTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);

  readonly caseId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly orders = signal<CourtOrder[]>([]);

  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadErrorMessage = signal<string | null>(null);

  uploadForm = buildUploadForm();

  constructor() {
    effect(() => {
      const id = this.caseId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.courtCasesService.listOrders(this.caseId()).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  complianceDueColor(complianceDue: string): string | null {
    const days = daysUntil(complianceDue);
    if (days < 0) {
      return 'var(--lf-error)';
    }
    if (days <= COMPLIANCE_WARNING_DAYS) {
      return 'var(--lf-warn)';
    }
    return null;
  }

  canUpload(): boolean {
    return !!this.selectedFile() && this.uploadForm.controls.orderDate.valid;
  }

  onFilesSelected(files: File[]): void {
    this.selectedFile.set(files[0] ?? null);
    this.uploadErrorMessage.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file || this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    this.uploadErrorMessage.set(null);
    const value = this.uploadForm.getRawValue();
    this.courtCasesService
      .uploadOrder(this.caseId(), file, {
        orderDate: value.orderDate!.toISOString().slice(0, 10),
        gist: value.gist || null,
        complianceDue: value.complianceDue ? value.complianceDue.toISOString().slice(0, 10) : null,
      })
      .subscribe({
        next: (order) => {
          this.orders.update((orders) => [order, ...orders]);
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.uploadForm = buildUploadForm();
        },
        error: () => {
          this.uploading.set(false);
          this.uploadErrorMessage.set('Failed to upload order. Please try again.');
        },
      });
  }
}
