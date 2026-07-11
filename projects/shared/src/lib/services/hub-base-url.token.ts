import { InjectionToken } from '@angular/core';

/**
 * Base URL for SignalR hubs (`/hubs/notifications`, `/hubs/chat`, `/hubs/presence`,
 * `/hubs/jobs` — PRD §16 Realtime row). Hubs are mapped at the API's root, not under
 * `/api/v1`/`/api/portal/v1` like REST routes, so this is a separate token from
 * `API_BASE_URL` rather than derived from it. Falls back to `''` (same-origin root)
 * so staff-portal doesn't need to provide it explicitly in dev, where a proxy
 * typically forwards both `/api` and `/hubs` to the API process.
 */
export const HUB_BASE_URL = new InjectionToken<string>('HUB_BASE_URL');
