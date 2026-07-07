# Locale

`messages.xlf` is generated (not hand-edited) by:
```
npm run i18n:extract:client-portal
```
`messages.hi.xlf` is the Hindi translation — hand-maintained, `<target>` per unit.
Add more locales by adding a `<locale>: { translation: ... }` entry to
`angular.json`'s `projects.client-portal.i18n.locales` and building with
`npm run build:client-portal:i18n` (uses `ng build --localize`).
