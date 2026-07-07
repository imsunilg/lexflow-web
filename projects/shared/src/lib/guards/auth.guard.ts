import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthTokenService } from '../services/auth-token.service';

/** Blocks navigation to authenticated routes when no access token is held. */
export const authGuard: CanActivateFn = (_route, state) => {
  const authTokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (authTokenService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
