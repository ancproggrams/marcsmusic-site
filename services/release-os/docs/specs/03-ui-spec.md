# UI Spec

The UI is an internal cloud operations dashboard, not a landing page. It uses a
professional cloud dashboard style: left navigation, top status bar, compact
cards, dense forms, status panels and a result log.

## Sections

- Release metadata.
- Artist selection and quick artist creation.
- Artwork/audio upload.
- Platform target selection.
- Publication plan/result.
- Player sync and download links.
- EspoCRM recipient filters.
- New music campaign preview/test/send.
- Result log.

## States

`idle`, `uploading`, `validating`, `syncing_player`, `planning`, `publishing`,
`previewing_campaign`, `sending_test`, `sending_campaign`, `completed`, `failed`.

