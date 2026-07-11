import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from 'shared';
import { AuthCardComponent } from './auth-card.component';

/**
 * Real login screen (PRD §11/§17/§20), replacing the C-1/D-1 placeholder. On a
 * successful, non-2FA login the returned access token + hydrated session
 * (`AuthService.login` calls `PermissionService.loadSession/loadCatalog`) are
 * enough for the shell's guards to let the user through immediately.
 *
 * A 428 response means 2FA is required — the pending challenge lives in a
 * short-lived httpOnly cookie the browser already holds (`AuthController.cs`), so
 * navigating to `/2fa` needs nothing from this response body beyond that signal.
 */
@Component({
  selector: 'lf-staff-login-page',
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
    <lf-staff-auth-card title="Sign in" subtitle="Sign in to your LexFlow workspace">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" class="auth-field">
          <mat-label>Firm workspace</mat-label>
          <input matInput formControlName="tenantSlug" autocomplete="organization" />
          @if (form.controls.tenantSlug.hasError('required') && form.controls.tenantSlug.touched) {
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

        <mat-form-field appearance="outline" class="auth-field">
          <mat-label>Password</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
          @if (form.controls.password.hasError('required') && form.controls.password.touched) {
            <mat-error>Password is required.</mat-error>
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
            Sign in
          }
        </button>

        <a class="auth-link" routerLink="/forgot-password">Forgot password?</a>
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

    .auth-submit {
      margin-top: var(--lf-space-1);
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
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    tenantSlug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        if (response.requires2fa) {
          this.goToTwoFactorChallenge();
          return;
        }
        this.submitting.set(false);
        this.router.navigateByUrl(this.returnUrl());
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.handleError(error);
      },
    });
  }

  private handleError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.errorMessage.set('Something went wrong. Please try again.');
      return;
    }

    switch (error.status) {
      case 428:
        this.goToTwoFactorChallenge();
        return;
      case 423:
        this.errorMessage.set(
          'This account is temporarily locked after repeated failed attempts. Try again later.',
        );
        return;
      case 401:
        this.errorMessage.set('Email or password is incorrect.');
        return;
      default:
        this.errorMessage.set('Something went wrong. Please try again.');
    }
  }

  private goToTwoFactorChallenge(): void {
    this.submitting.set(false);
    this.router.navigate(['/2fa'], { queryParams: { returnUrl: this.returnUrl() } });
  }

  private returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
  }
}
