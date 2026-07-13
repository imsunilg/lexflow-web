// Swapped in for `environment.ts` by the `staging` build configuration
// (angular.json `fileReplacements`) — used only for the staging deploy in
// lexflow-api's `.github/workflows/release.yml`, which `sed`-replaces the
// placeholder below with the real staging API URL (`LEXFLOW_STAGING_API_URL`
// secret) immediately before running `ng build --configuration
// production,staging`. Never committed with a real value — if you see
// anything other than the placeholder here outside that one CI step
// running, something's wrong.
export const environment = {
  apiBaseUrl: '__LEXFLOW_STAGING_API_URL__/api/v1',
};
