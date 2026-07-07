import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

/** Placeholder portal login — real flow (password + optional 2FA, PRD Module 17 step 1) lands later. */
@Component({
  selector: 'lf-portal-login-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="Sign in"
    description="Portal login form not built yet."
  />`,
})
export class LoginPage {}
