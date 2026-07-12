import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'shared';
import { AuthCardComponent } from './auth-card.component';

/**
 * Completes a login that returned HTTP 428 (PRD §17/§20: TOTP, RFC 6238). The
 * pending-login challenge travels as a short-lived httpOnly cookie set by
 * `POST /auth/login`, not as any state this page needs to carry itself — reaching
 * this route with a 6-digit code is the entire contract.
 */
@Component({
  selector: 'lf-staff-two-fa-challenge-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    AuthCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-staff-auth-card
      title="Two-factor verification"
      i18n-title="@@auth.twoFaChallenge.title"
      subtitle="Enter the 6-digit code from your authenticator app"
      i18n-subtitle="@@auth.twoFaChallenge.subtitle"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" class="auth-field">
          <mat-label i18n="@@auth.twoFaChallenge.codeLabel">Verification code</mat-label>
          <input
            matInput
            formControlName="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
          />
          @if (form.controls.code.hasError('required') && form.controls.code.touched) {
            <mat-error i18n="@@auth.twoFaChallenge.codeRequiredError">Enter the 6-digit code.</mat-error>
          }
          @if (form.controls.code.hasError('pattern') && form.controls.code.touched) {
            <mat-error i18n="@@auth.twoFaChallenge.codePatternError">Code must be 6 digits.</mat-error>
          }
        </mat-form-field>

        @if (errorMessage()) {
          <p class="auth-error" role="alert">{{ errorMessage() }}</p>
        }

        <button
          mat-flat-button
          color="primary"
          type="submit"
          class="auth-submit"
          [disabled]="form.invalid || submitting()"
        >
          @if (submitting()) {
            <mat-spinner diameter="20" />
          } @else {
            <ng-container i18n="@@auth.twoFaChallenge.verifyButton">Verify</ng-container>
          }
        </button>
      </form>
    </lf-staff-auth-card>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .auth-field {
      width: 100%;
    }

    .auth-error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class TwoFaChallengePage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.verifyTwoFactor(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.errorMessage.set('Invalid or expired code. Please try again.');
        } else {
          this.errorMessage.set('Something went wrong. Please try again.');
        }
      },
    });
  }
}
