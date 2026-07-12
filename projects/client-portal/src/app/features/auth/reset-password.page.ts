import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalAuthService } from '../../core/services/portal-auth.service';

/** Handles both password reset (link from `/auth/forgot`) and invite acceptance (link from Module 3's portal-access grant) — same backend endpoint, disambiguated only by the token's server-side purpose. */
@Component({
  selector: 'lf-portal-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.page.html',
  styleUrl: './login.page.scss',
})
export class ResetPasswordPage {
  private readonly authService = inject(PortalAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (this.form.invalid || !token) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.authService
      .resetPassword({ token, newPassword: this.form.getRawValue().newPassword })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/login']);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('This link is invalid or has expired.');
        },
      });
  }
}
