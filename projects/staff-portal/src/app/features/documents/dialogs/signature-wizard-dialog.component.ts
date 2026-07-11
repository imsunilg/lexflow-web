import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import {
  DocumentsService,
  LfDocument,
  SIGNATURE_PROVIDERS,
  SignatureEnvelope,
  SignatureProvider,
} from 'shared';

export interface SignatureWizardDialogData {
  document: LfDocument;
}

interface SignerRow {
  name: FormControl<string>;
  email: FormControl<string>;
  orderNo: FormControl<number>;
}

/**
 * Signature wizard (PRD Module 7 §8 Sign): pick provider → add signers →
 * review & send. Per the PRD Edge Case (signer email bounces → envelope
 * status `Alerted`), this only displays whatever status the backend
 * returns after send — it doesn't build a resend/correct flow.
 */
@Component({
  selector: 'lf-signature-wizard-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatStepperModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature-wizard-dialog.component.html',
  styleUrl: './signature-wizard-dialog.component.scss',
})
export class SignatureWizardDialogComponent {
  private readonly documentsService = inject(DocumentsService);
  readonly data = inject<SignatureWizardDialogData>(MAT_DIALOG_DATA);

  readonly providers = SIGNATURE_PROVIDERS;

  readonly providerControl = new FormControl<SignatureProvider>(SIGNATURE_PROVIDERS[0], {
    nonNullable: true,
  });

  readonly signers = new FormArray<FormGroup<SignerRow>>([]);

  readonly sending = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly envelope = signal<SignatureEnvelope | null>(null);

  constructor() {
    this.addSigner();
  }

  addSigner(): void {
    const orderNo = this.signers.length + 1;
    this.signers.push(
      new FormGroup<SignerRow>({
        name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        email: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required, Validators.email],
        }),
        orderNo: new FormControl(orderNo, { nonNullable: true }),
      }),
    );
  }

  removeSigner(index: number): void {
    this.signers.removeAt(index);
    this.signers.controls.forEach((group, i) => group.controls.orderNo.setValue(i + 1));
  }

  canProceedToSigners(): boolean {
    return !!this.providerControl.value;
  }

  canProceedToReview(): boolean {
    return this.signers.length > 0 && this.signers.valid;
  }

  send(): void {
    if (!this.canProceedToReview()) return;

    this.sending.set(true);
    this.errorMessage.set(null);
    this.documentsService
      .sendForSignature(this.data.document.id, {
        provider: this.providerControl.value,
        signers: this.signers.controls.map((group) => group.getRawValue()),
      })
      .subscribe({
        next: (result) => {
          this.sending.set(false);
          this.envelope.set(result);
        },
        error: () => {
          this.sending.set(false);
          this.errorMessage.set('Could not send for signature. Please try again.');
        },
      });
  }
}
