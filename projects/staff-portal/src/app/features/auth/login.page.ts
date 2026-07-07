import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

/** Placeholder login page — real auth flow (JWT + 2FA, PRD §20) lands in Prompt C-1/D-1. */
@Component({
  selector: 'lf-staff-login-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page title="Sign in" description="Login form not built yet." />`,
})
export class LoginPage {}
