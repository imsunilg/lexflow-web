import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { PortalAuthService } from '../../core/services/portal-auth.service';

/** Always responds 200 regardless of whether the tenant/email match (enumeration-safe, mirrors staff's `/auth/forgot`) — the UI shows one generic confirmation either way. */
@Component({
  selector: 'lf-portal-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.page.html',
  styleUrl: './login.page.scss',
})
export class ForgotPasswordPage {
  private readonly authService = inject(PortalAuthService);

  readonly form = new FormGroup({
    tenantSlug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  readonly submitted = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.authService.forgotPassword(this.form.getRawValue()).subscribe(() => {
      this.submitted.set(true);
    });
  }
}
