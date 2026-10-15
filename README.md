# Safety Fieldbook

A mobile-friendly, local-first university safety inspection app. No build dependencies.

## Run locally

From this directory: `python3 -m http.server 8772`, then open http://localhost:8772. Camera capture uses the phone's file-picker camera option; use HTTPS hosting on phones. Desktop localhost is a secure context. Do not open index.html directly with a file URL.

## Current functionality

- Multiple inspection drafts with title, date, inspector, editable findings and review state.
- Multi-image import and phone camera input. Browser-supported image formats only; JPEG/PNG recommended.
- Original image bytes retained in IndexedDB; editable normalized vector annotations stored separately. Arrow, ellipse, rectangle, text; move, recolor, text edit, delete and undo.
- ZIP download with original photos, full-resolution annotated PNGs, CSV and JSON including annotation objects and photo paths.
- Clear local-saving/saved/failure status. A save is confirmed only when the IndexedDB transaction completes.
- Review reset when findings, photos or annotations change; incomplete drafts can still be explicitly exported.

Local drafts belong to the browser profile and origin. Preview and deployed domains have separate local storage. Clearing site data removes drafts. Export backups regularly; persistence requests are browser-controlled. ZIP generation is in memory, uses uncompressed ZIP, and supports under 4 GB archives; keep inspections reasonably sized for phone memory. A downloaded ZIP is not cloud upload. ZIP restore/import is not implemented. The app shell is cached for offline use after its first successful online load.

## Storage extension boundary

`storage.js` contains LocalStorageAdapter and unavailable cloud provider descriptors. Future cloud adapters must implement connect(), upload(exportBundle), disconnect(), return confirmed upload state only after a provider success response, and retain local drafts on failure. No OAuth app or cloud connection is configured.

Dropbox: register a scoped OAuth application, use Authorization Code with PKCE, configure exact HTTPS redirect URLs, and have each user consent. SharePoint: register a Microsoft identity application, select delegated Graph permissions and tenant policy, configure redirects, and select site/drive/folder. Teams channel files live in the corresponding SharePoint library. Administrator consent availability must be established. A personal account does not establish central storage: agree a shared destination first.

Never place passwords, client secrets or permanent tokens in frontend assets. Prefer a backend token broker with secure session cookies for refresh credentials; use PKCE for public clients. OAuth, token lifecycle and upload confirmation must be implemented and tested before enabling cloud controls.

## Verification

Browser-tested: inspection creation, finding tags/priority, image import, all annotation types, text edit, review state, recovery after reload, ZIP download, and 390px viewport. Export independently checked using Python zipfile: CRC integrity, CSV/JSON fields, four annotation objects, edited text, byte-exact original, and a distinct annotated PNG. Hardware phone camera and managed university browsers require device acceptance testing.

## Install and use offline

Open the HTTPS app online once and wait for **Ready for offline use**. On iPhone/iPad, open in Safari, then Share → Add to Home Screen. On Android/desktop, choose Install app if offered or use the browser install menu. Installation is optional: a supported browser can use the cached app offline too.

The service worker caches only bundled app files. Photos and drafts remain in IndexedDB; nothing is uploaded. The UI shows network availability separately from offline readiness and local save status. Browser network status does not confirm internet access or cloud upload. Clearing site data removes both the offline app and drafts. A new device/browser or a new hosting address needs an online first load and has separate drafts.

New app versions wait until you choose Update & reload (or close all app tabs). Finish editing and wait for local saves before applying an update. Service worker cache cleanup only touches this app's scoped caches and never deletes the draft database. Increment VERSION in sw.js when changing app-shell files.

## PWA verification

Run `node test-sw.mjs`. Checks cover full-shell caching, GitHub Pages subdirectory paths, offline requests, unrelated-cache isolation, explicit update activation, failed installation and manifest assets. Browser-tested app reload and access to a previously saved photo with all annotations while the preview server was stopped. Physical phone installation and camera capture still need device acceptance testing.
