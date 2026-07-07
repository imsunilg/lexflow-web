import { InjectionToken } from '@angular/core';

/**
 * API base path, provided per-app: staff-portal uses `/api/v1`, client-portal
 * uses `/api/portal/v1` (separate JWT audience, PRD §20(3)/Module 17). Services
 * in this library fall back to `/api/v1` when unset so staff-portal doesn't
 * need to provide it explicitly.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
