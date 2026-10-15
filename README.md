# Safety Fieldbook

A mobile-friendly, local-first university safety inspection app. No build dependencies.

## Run locally

From this directory: `python3 -m http.server 8772`, then open http://localhost:8772. Camera capture uses the phone's file-picker camera option; use HTTPS hosting on phones. Desktop localhost is a secure context. Do not open index.html directly with a file URL.

## Current functionality

- Multiple inspection drafts with title, date, inspector, editable findings and review state.
- Multi-image import and phone camera input. Browser-supported image formats only; JPEG/PNG recommended.
- Original image bytes retained in IndexedDB; editable normalized vector annotations stored separately. Arrow, ellipse, rectangle, text; move, recolor, text edit, delete and undo.
- ZIP export with a readable HTML report, per-finding photo folders, CSV registers and JSON annotation metadata. Choose smaller archive, compact sharing or full quality.
- Clear local-saving/saved/failure status. A save is confirmed only when the IndexedDB transaction completes.
- Review reset when findings, photos or annotations change; incomplete drafts are visibly labelled in the exported report.
- Delete one inspection from its inspection page, or clear all local inspections and photos from Storage & export. Destructive actions require confirmation; bulk clearing requires typing DELETE. Offline app files and downloaded exports are retained. Close other app tabs before deleting.

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

## Organised exports and photo size

Every ZIP has a date-first inspection folder containing:

- START-HERE.html — a report that opens offline after extraction, with a finding index, priorities, locations, review state and linked photo previews.
- findings.csv — one row per finding; photos.csv — one row per photo, including file paths and dimensions.
- inspection.json — schema version 2, full record IDs, normalized editable annotations, exported image sizes and export profile.
- findings/F001_location_short-id/ — finding.txt plus P01_original and P01_annotated photo pairs as applicable. F001/P01 reflect order in that export; use the full IDs to match records across exports.

Profiles:

| Profile | Original photos | Annotated photos |
| --- | --- | --- |
| Smaller archive (default) | Included unchanged | JPEG, longest edge at most 1600 px, quality 82% |
| Compact sharing | Omitted from ZIP; retained in local app | JPEG, same size/quality limit |
| Full quality | Included unchanged | Full-resolution PNG |

JPEG is lossy; inspect originals for fine detail. Transparent images use a white JPEG background. Images are never enlarged. Savings vary; JPEG/PNG camera files are already compressed, so image resizing and avoiding duplicate full-resolution PNGs have more effect than ZIP compression alone. ZIP assembly remains in memory: use smaller inspections on memory-limited devices.

Compact sharing is not a complete archive. JSON keeps annotation objects but cannot recreate a pristine original from a flattened photo. ZIP restore/import is not implemented. Spreadsheet users should import room/floor/ID columns as text to preserve leading zeroes. Keep the extracted directory structure intact so report links work.

Run `node test-export.mjs`, `node test-storage.mjs` and `node test-sw.mjs`. Export checks cover all profiles, exact originals, paths, CSV safety, report escaping, missing photos and errors. Storage-adapter tests cover transaction-confirmed deletion, scoped clearing and abort rejection. Browser checks cover real JPEG/PNG exports, file sizes, install placement, deletion guards and cancellation.

## Local voice notes

Use **Voice note** on a finding to record (microphone permission and a supported HTTPS browser required), or attach an existing audio file. Stop to review playback, enter or edit transcript text, and save the note. Recordings stop after five minutes or when the app becomes hidden. Audio is stored in IndexedDB with its finding, and remains available offline once the app is cached. Transcripts can be generated on-device after optional speech-model setup, or typed manually. Verify safety details against the audio. No audio is transmitted for transcription.

Every ZIP profile retains audio bytes unchanged. Finding folders include A01_title.webm/m4a/etc. and A01_title_transcript.txt; audio.csv and JSON link them to their finding, and the offline HTML report offers playback and transcript text. Supported playback formats vary by browser. Imported uncompressed audio may be large; photo compression modes do not compress audio. Deleting a finding/inspection or clearing local records also removes its audio and transcripts.

`node test-voice.mjs` checks recorder lifecycle with a synthetic media source, microphone denial/cancellation, track cleanup and audio exports. A real microphone session on the target phone remains an acceptance test.

Mobile inspection forms stack Date and Inspector vertically, constrain native control widths and use zero-minimum grid columns to prevent overlap.

## On-device English transcription

Open a voice note and choose **Set up on-device transcription** while online. This explicitly downloads the pinned Transformers.js 3.8.1 runtime and quantized Xenova/whisper-tiny.en model (revision 79fb389fc764e7c395bd330e9531d9d32ada7049) from Hugging Face. Expect about 65 MB and additional working memory. After successful setup these assets are cached for offline use in this browser. Browser eviction or clearing site data requires setup again.

New recordings and attached audio are automatically transcribed when enabled. Existing notes have a Transcribe audio button. Audio is decoded and processed in a local worker using WASM; no recording is uploaded. Model downloads disclose normal network request information to their hosts. English only; five-minute limit. Slow or memory-limited phones may fail: saved audio and manual transcript editing remain available. Always verify names, locations, numbers and safety details against audio. Edits made during inference are preserved with an option to append generated text. Saving or closing the dialog cancels unfinished inference.

Storage & export can remove the optional model without deleting inspections. Exports include unchanged audio, editable transcript text and transcript source/model metadata; the model itself is not exported. See bundled third-party licenses.
