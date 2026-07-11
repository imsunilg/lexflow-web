import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from 'shared';
import { AuthCardComponent } from './auth-card.component';
import { passwordsMatchValidator } from './reset-password.page';

/**
 * `?token=` invitation-link landing page (`POST /users/invite` issues a 72h
 * activation link — Module 14 line 775/784). ASSUMPTION, flagged because it's not
 * confirmed anywhere: neither PRD §16/§17 nor the generated API client define a
 * distinct "accept invitation" endpoint — there is no `POST /auth/accept-invitation`
 * or similar. This page reuses `POST /auth/reset` with the invitation token in
 * place of a reset token (same "opaque token sets a new password" shape), which is
 * the only endpoint in the C-1 auth surface that fits. If a dedicated invitation
 * endpoint is added later, only `submit()` below needs to change.
 */
@Component({
  selector: 'lf-staff-accept-invitation-page',
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
    <lf-staff-auth-card
      title="Welcome to LexFlow"
      subtitle="Set a password to activate your account"
    >
      @if (!token()) {
        <p class="auth-error" role="alert">
          This invitation link is missing its token. Ask your administrator to resend it.
        </p>
        <a class="auth-link" routerLink="/login">Back to sign in</a>
      } @else if (succeeded()) {
        <p>Your account is active. You can now sign in.</p>
        <a class="auth-link" routerLink="/login">Sign in</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="auth-field">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            />
            @if (
              form.controls.newPassword.hasError('required') && form.controls.newPassword.touched
            ) {
              <mat-error>Password is required.</mat-error>
            }
            @if (
              form.controls.newPassword.hasError('minlength') && form.controls.newPassword.touched
            ) {
              <mat-error>Password must be at least 10 characters.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="auth-field">
            <mat-label>Confirm password</mat-label>
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
              <mat-error>Confirm your password.</mat-error>
            }
          </mat-form-field>

          @if (form.hasError('passwordsMismatch') && form.controls.confirmPassword.touched) {
            <p class="auth-error" role="alert">Passwords don't match.</p>
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
              Activate account
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
export class AcceptInvitationPage {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

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
            this.errorMessage.set('This invitation link is invalid or has expired.');
          } else {
            this.errorMessage.set('Something went wrong. Please try again.');
          }
        },
      });
  }
}
