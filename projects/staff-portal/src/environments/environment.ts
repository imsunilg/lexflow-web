// Default (dev + production) environment: relative paths, same-origin proxy
// (dev-server `proxy.conf.json`/`proxy.full.conf.json`) or same-origin
// reverse proxy in front of both static assets and the API in a real
// production deploy. Only `environment.staging.ts` (swapped in via the
// `staging` build configuration, see angular.json) needs an absolute URL,
// because Azure Static Web Apps (staging) and the AKS-hosted API are on
// different origins there.
export const environment = {
  apiBaseUrl: '/api/v1',
};
