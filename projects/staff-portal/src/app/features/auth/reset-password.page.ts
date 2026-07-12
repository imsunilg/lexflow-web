import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from 'shared';
import { AuthCardComponent } from './auth-card.component';

/** Both fields must match before submit is enabled — checked at the group level so the error can be shown once rather than duplicated per field. */
export function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword && confirmPassword && newPassword !== confirmPassword
      ? { passwordsMismatch: true }
      : null;
  };
}

/** `?token=` reset-link landing page (PRD §17 `POST /auth/reset`). Password policy per §20(2): ≥10 chars — server re-validates (incl. breach-list check) regardless. */
@Component({
  selector: 'lf-staff-reset-password-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RouterLink,
    AuthCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-staff-auth-card title="Choose a new password" i18n-title="@@auth.resetPassword.title">
      @if (!token()) {
        <p class="auth-error" role="alert" i18n="@@auth.resetPassword.missingTokenMessage">
          This reset link is missing its token. Request a new one from the sign-in page.
        </p>
        <a
          class="auth-link"
          routerLink="/forgot-password"
          i18n="@@auth.resetPassword.requestNewLinkLink"
          >Request a new link</a
        >
      } @else if (succeeded()) {
        <p i18n="@@auth.resetPassword.successMessage">
          Your password has been reset. You can now sign in.
        </p>
        <a class="auth-link" routerLink="/login" i18n="@@auth.resetPassword.signInLink">Sign in</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="auth-field">
            <mat-label i18n="@@auth.resetPassword.newPasswordLabel">New password</mat-label>
            <input
              matInput
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            />
            @if (
              form.controls.newPassword.hasError('required') && form.controls.newPassword.touched
            ) {
              <mat-error i18n="@@auth.resetPassword.newPasswordRequiredError"
                >New password is required.</mat-error
              >
            }
            @if (
              form.controls.newPassword.hasError('minlength') && form.controls.newPassword.touched
            ) {
              <mat-error i18n="@@auth.resetPassword.passwordMinLengthError"
                >Password must be at least 10 characters.</mat-error
              >
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="auth-field">
            <mat-label i18n="@@auth.resetPassword.confirmPasswordLabel">Confirm password</mat-label>
            <input
              matInput
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
            @if (
              form.controls.confirmPassword.hasError('required') &&
              form.controls.confirmPassword.touched
            ) {
              <mat-error i18n="@@auth.resetPassword.confirmPasswordRequiredError"
                >Confirm your new password.</mat-error
              >
            }
          </mat-form-field>

          @if (form.hasError('passwordsMismatch') && form.controls.confirmPassword.touched) {
            <p class="auth-error" role="alert" i18n="@@auth.resetPassword.passwordsMismatchError">
              Passwords don't match.
            </p>
          }

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
              <ng-container i18n="@@auth.resetPassword.resetPasswordButton"
                >Reset password</ng-container
              >
            }
          </button>
        </form>
      }
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

    .auth-link {
      align-self: center;
      color: var(--lf-primary);
      font-size: var(--lf-text-sm);
      text-decoration: none;
    }

    .auth-link:hover {
      text-decoration: underline;
    }
  `,
})
export class ResetPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token'));
  readonly submitting = signal(false);
  readonly succeeded = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(10)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatchValidator() },
  );

  submit(): void {
    if (this.form.invalid || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService
      .resetPassword({ token: this.token()!, newPassword: this.form.getRawValue().newPassword })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.succeeded.set(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.errorMessage.set('This reset link is invalid or has expired.');
          } else {
            this.errorMessage.set('Something went wrong. Please try again.');
          }
        },
      });
  }
}
