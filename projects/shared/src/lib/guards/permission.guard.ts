import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

/**
 * Gate a route on a `data: { permission: 'module.action.scope' }` requirement
 * (PRD §20(4), §21). Deep links to forbidden routes redirect to a 403 page
 * rather than 404 — the difference between "doesn't exist" and "not allowed"
 * matters here because the user is already authenticated.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const required = route.data['permission'] as string | string[] | undefined;
  if (!required) {
    return true;
  }

  const requiredKeys = Array.isArray(required) ? required : [required];
  if (permissionService.hasAny(requiredKeys)) {
    return true;
  }

  return router.createUrlTree(['/forbidden']);
};
