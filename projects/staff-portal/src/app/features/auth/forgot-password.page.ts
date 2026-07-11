import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthService } from 'shared';
import { AuthCardComponent } from './auth-card.component';

/**
 * `POST /auth/forgot` always responds success regardless of whether the
 * tenant/email match (PRD §20(15): enumeration-safe) — so this page always shows
 * the same confirmation message rather than branching on the response, which
 * would otherwise leak whether an account exists.
 */
@Component({
  selector: 'lf-staff-forgot-password-page',
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
    <lf-staff-auth-card title="Reset your password" subtitle="We'll email you a reset link">
      @if (submitted()) {
        <p>
          If an account matching those details exists, we've sent a password-reset link to that
          email address. It expires in 30 minutes.
        </p>
        <a class="auth-link" routerLink="/login">Back to sign in</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="auth-field">
            <mat-label>Firm workspace</mat-label>
            <input matInput formControlName="tenantSlug" autocomplete="organization" />
            @if (
              form.controls.tenantSlug.hasError('required') && form.controls.tenantSlug.touched
            ) {
              <mat-error>Workspace is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="auth-field">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
            @if (form.controls.email.hasError('required') && form.controls.email.touched) {
              <mat-error>Email is required.</mat-error>
            }
            @if (form.controls.email.hasError('email') && form.controls.email.touched) {
              <mat-error>Enter a valid email.</mat-error>
            }
          </mat-form-field>

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
              Send reset link
            }
          </button>

          <a class="auth-link" routerLink="/login">Back to sign in</a>
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
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly submitted = signal(false);

  readonly form = new FormGroup({
    tenantSlug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.authService.forgotPassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      // Deliberately shows the same confirmation on error too — never reveal
      // whether the failure was "no such account" vs. a real server error.
      error: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
    });
  }
}
