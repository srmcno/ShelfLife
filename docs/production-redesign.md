# The September cabinet edition

## Acceptance criteria

- Meet a real creature on the first screen. The chosen face, name and personality
  reach the creator unchanged and persist after adoption and reload.
- Keep everyday care directly below the cabinet, before scene controls. Preserve
  the six-column shelf and every existing resident, drawing and activity.
- Show six distinct, readable Playroom destinations on phones and desktops.
- Boot, create, care and enter activities without browser errors; guard those
  paths in the release pipeline as well as the existing domain tests.
- Publish the tested revision to Pages; finish with a clean main and no branches
  containing forgotten release work.

## Design

The actual creatures are the invitation. Mabel, Pip and Oswald are editable
creator drafts, not preinstalled residents. Their portrait artwork is exactly
the same generated data used in the studio. The cabinet's dusty rose wood,
lamplight, handwritten notes and dark comedy remain the game's identity.

Typography uses bundled Gloock for titles, Karla for controls and Caveat for
resident writing. The working palette is plum `#241830`, rose `#eab0bf`, sage
`#7fd8c0`, lamplight `#f2c083` and bone `#f2e9dc`; existing room themes continue
to supply their own materials. Plain labels and larger spaces replace excess
small capitals. New mobile geometry keeps six real shelf positions per row.

The home module owns invitation presentation; the studio still owns creation
and Main still owns adopting a resident. No parallel save path was introduced.
The Playroom remains one entry point for all existing activity modules.

## Verification

- 711 Node regression tests passed, including malformed saves, duplicate
  expedition payouts and native-event focus timing.
- Four Python launcher tests passed, including invalid requests and origin checks.
- 40 Playwright scenarios passed across desktop Chromium, phone Chromium and
  iPhone WebKit, with no observed page/console errors or horizontal overflow.
- Both Chromium projects passed offline reload and subsequent saved care.
- Two scenarios are intentionally skipped: mobile tabs on the desktop layout,
  and WebKit offline emulation, unsupported by Playwright's service-worker tooling.
- Manual Chromium review included 320px nearly-full and drawing-heavy shelves,
  a complete Chase result and its saved personal record, creator previews,
  all six activity launch/return paths and legacy market routes.
- Independent standards/security review found no actionable issues. Spec review
  identified the furniture-only household regression; the fixed vacancy guard
  keeps furniture, notes, creation and former-resident history accessible.
- A WebKit run exposed opener focus expiring between capture/target listeners.
  The focus controller now retains it for the event task; regression and browser
  checks cover returning to Help, care and activity launchers.

Browser fixtures are synthetic and excluded from the published game. Automated
phone viewports do not prove physical iOS or Android device behavior. In
particular, actual iOS offline operation has not been verified in this revision.

## Release

Pages publication requires the reusable Game checks workflow. The package uses
one commit identity for both `release.json` and its service-worker cache, and
contains no test harness, dependency directory or source-control files. The
Actions deployment record and live `release.json` identify the published revision.
Only `main` existed locally/remotely at the release preflight; there were no open
pull requests or stashes to reconcile.
