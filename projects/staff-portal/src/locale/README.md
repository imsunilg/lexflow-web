# Locale

`messages.xlf` is generated (not hand-edited) by:
```
npm run i18n:extract:staff-portal
```
`messages.hi.xlf` is the Hindi translation — hand-maintained, `<target>` per unit.
Add more locales by adding a `<locale>: { translation: ... }` entry to
`angular.json`'s `projects.staff-portal.i18n.locales` and building with
`npm run build:staff-portal:i18n` (uses `ng build --localize`).
