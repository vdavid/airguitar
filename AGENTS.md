# Air guitar

A browser instrument: stretch strings in the air with your hands (webcam + MediaPipe, up to eight hands), pluck them with your fingertips. A typed, modular rewrite of Hashem Al-Ghaili's Music Maker. Kids play it too, so no gesture may depend on timing or holding still. Public at `https://airguitar.veszelovszki.com`, repo `vdavid/airguitar` (public, MIT).

- Spec: `docs/specs/v1.md` (what v1 is, and what changed from Music Maker). Read it before feature work.
- Music Maker's source (the reference for looks, synth recipes, beats, recording, setups): `gh api repos/Hashem-Al-Ghaili/music-maker/contents/index.html -H "Accept: application/vnd.github.raw"`.

## Stack and commands

- Vite + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), no framework: canvas for the stage, plain DOM for the top bar and dialogs.
- TypeScript stays on 6.x: typescript-eslint doesn't support TS 7 yet (peer range `<6.1`).
- Node, pnpm, and Go come from `mise.toml`. `pnpm-workspace.yaml` holds the supply-chain settings (3-day `minimumReleaseAge`). Renovate keeps dependencies fresh.
- `pnpm dev`: dev server at `http://127.0.0.1:24731`. `pnpm build` then `pnpm preview` (port 24732) for the production build.
- `pnpm check` (= `./scripts/check.sh`): the Go check runner. Runs oxfmt (auto-formats locally, check-only with `--ci`), ESLint (`strictTypeChecked` + `stylisticTypeChecked`, zero warnings), tsc, Vitest, the Vite build, and go vet/test for itself. `--check <id>` runs one. See `scripts/check/CLAUDE.md`.
- Unit tests sit next to the code as `*.test.ts`. Pure logic (pinch, pluck crossing, pitch, hit tests, the gesture controller, the picker layout, snapshots) is tested; canvas and Web Audio code isn't.
- `window.__airguitar` is the live `AppContext`, for console debugging and headless checks (drive it with mouse events after clicking "Play with the mouse instead").

## Map

- `src/main.ts`: boot. Wires camera hands and the mouse to gestures and plucking, runs the frame loop.
- `src/app.ts`: `AppContext`, the services every feature gets. `src/features.ts`: where features mount (one line each).
- `src/state/`: `stage.ts` (the serializable stage: strings, key, tone, new-string instrument; all changes go through `StageStore` and emit `StageChange`s), `app.ts` (Build/Play mode, input source), `settings.ts`.
- `src/gestures/`: `controller.ts` (pinch → action, the same for every hand and the mouse), `mode.ts` (what Build and Play allow), `pinch.ts` (pinch detection with hysteresis), `expression.ts` (the plug-in point for bend and air sweep).
- `src/strings/`: `model.ts` (hit tests, merge-delete rule), `pluck.ts` (crossing detection), `player.ts` (plucks → sound, keeps ringing notes in tune, per-string visual state).
- `src/music/`: `theory.ts` (keys, tones incl. "Free", snapping, note names), `pitch.ts` (length → pitch).
- `src/tracking/`: `landmarker.ts` (camera + MediaPipe, 8 hands, frame skipping when slow), `hands.ts` (stable hand ids, smoothing, pinch events), `match.ts`.
- `src/audio/`: `engine.ts` (the live context), `graph.ts` (the mix graph, buildable on an offline context too), `reverb.ts`, `instruments/` (catalog, registry, one file per family: `plucked.ts` Karplus–Strong, `keys.ts`, `mallets.ts`, `orchestra.ts`, `electronic.ts`, `drums.ts`; `synth.ts` turns an oscillator recipe into a `Voice`; `range.ts` folds out-of-range pitches by octaves).
- `src/render/`: `renderer.ts` (the stage), `picker.ts` (the palette), `icons.ts` (the 24 instrument icons, to canvas and to SVG), `effects.ts` (particles, note pops, ripples), `style.ts`.
- `src/ui/`: `topbar.ts`, `dropdown.ts`, `icons.ts` (top bar SVGs), `core-controls.ts` (brand, Build/Play, key, tone, new-string instrument), `picker.ts` (picker layout and state), `hand-press.ts` (hands pressing HTML buttons), `messages.ts` (hint, toast), `style.css` (Music Maker's palette and fonts).
- `src/settings/` (Settings dialog, persistence), `src/help/` (How to play), `src/setups/` (Setups dialog, named setups in localStorage, files, `starters.ts`: ready-made layouts cut to exact lengths per note). Shared bits: `ui/modal.ts` + `ui/dialogs.css` (dialogs; hands pinching the backdrop close them, pinches never fall through to the stage), `ui/storage.ts` (localStorage that never throws).
- `src/beats/`: `patterns.ts` (Music Maker's six beats as data, pure step → events; bass and chords follow the key and the tone's parent scale), `scheduler.ts` (look-ahead scheduling on the audio clock, pure), `drums.ts` (the beat's synthesized kit), `player.ts` (`BeatPlayer`: live playback into `graph.beats`, offline `render` for stems), `controls.ts` (beat dropdown with the tempo at its bottom, parts checklist). The player is `ctx.beats` (`AppContext`); its `state.bpm` is the session tempo, which the sweep echo follows.
- `src/record/`: `recorder.ts` (stage canvas copied into a fixed-size canvas + the final mix → MediaRecorder; sound-only takes), `tap.ts` (AudioWorklet PCM tap on `graph.output`), `wav.ts`, `zip.ts` (stored zip), `stems.ts` (each beat part rendered offline), `mp3.ts` (lazy-loads lamejs), `controls.ts` (mode, shape, record, stems, and the "Your recording" dialog). lamejs 1.2.1 is vendored unmodified in `public/vendor/lamejs/` (LGPL-3.0, with its license texts; no maintained npm package exists), loaded only when saving an MP3; oxfmt and ESLint skip `public/vendor/`.
- MediaPipe's WebAssembly is served from our origin (`/mediapipe/`, a small plugin in `vite.config.ts`); the hand model loads from Google's model storage.

## Seams (for parallel feature work)

Each feature lives in its own folder and mounts itself from `src/features.ts` with the shared `AppContext`. Don't edit another feature's folder; if a seam is missing, add it to the core in a small, separate commit.

- **Top bar**: `ctx.topBar.mount(el, { slot, order })`. Slots `start` (core: brand 0, Build/Play 10, key 20, tone 30, new-string instrument 40) and `end` (beats 100–199, recording 200–299, setups/help/settings 300–399). Build controls with `iconButton` (`ui/topbar.ts`), `selectDropdown` / `checklistDropdown` (`ui/dropdown.ts`), and icons from `ui/icons.ts`. One line, SVG icons with `aria-label` + tooltip, no text labels. Hands press any `<button>` in `#top`, `.dd-panel`, or `.modal` with a pinch (`ui/hand-press.ts`), so use real buttons, never native `<select>`.
- **Instruments**: each id has its own `Instrument` (`audio/instruments/types.ts`) in a family file, registered in `registry.ts`. Ids, names, colors, octaves, and per-instrument mix (gain, reverb send, drive, peak, lowpass) are in `catalog.ts`; keep ids stable (setups store them). A `Voice` supports `setPitch` (strings retune when resized), `bend`, and `release`. `Instrument.hold` says what a resting finger does (sustain, roll, once); `Instrument.label` overrides the note name (drums name the drum, picked by string length).
- **Expression gestures**: `src/expression/` (`handler.ts` mounts the `ExpressionHandler`; `shapes.ts` is the pure pull and sweep math). The controller offers it pinches on a string body (bend) and in empty air (sweep) only in Play (`gestures/mode.ts`). Bending and pulls go through `StringPlayer.bend` / `setPull`; the sweep overlay is `effects.sweep`. Resting a finger is `strings/rest.ts`, fed from `StringPlayer.feed`; `StringPlayer.update(t)` runs each frame for rolls and lost holds. The controller calls `release` for a deliberate let-go (a bend snaps and plays) and `cancel` for an interrupted pinch (hand lost, mode switch: it straightens quietly).
- **Beats and recording (agent B)**: `ctx.audio.graph` (after `ctx.unlockAudio()`) has `beats` (connect the beat player here), `output` (the final mix: tap it with a `MediaStreamAudioDestinationNode` to record), and `instrumentBus(id, bus)` to play instruments into any bus. `createMixGraph(offlineCtx)` (`audio/graph.ts`) builds the same graph offline for stems. The canvas is `#stage`; `ctx.stage.setSize(w, h)` switches landscape/vertical (strings scale to fit). lamejs: npm package if maintained, else vendored in its own file with its LGPL notice.
- **Settings, help, setups (agent C)**: `ctx.settings.set(patch)` (the core reads `ctx.settings.state` every frame; persistence is C's). Setups: `ctx.stage.snapshot()` gives a JSON-safe `StageSnapshot`; `ctx.stage.load(data)` validates (`parseSnapshot`) and replaces the stage, throwing a readable `Error` on bad data. Dialogs use the `.modal` / `.card` styles in `ui/style.css`.

## Gesture rules (keep them)

- A pinch's meaning is fixed when it starts (`GestureController.resolve`): open picker first, then HTML controls under a hand, then endpoint (Build), middle → picker (Build), body → expression (Play), empty air → new string (Build, hands pair with the nearest waiting hand) or air sweep (Play).
- No dwell, no countdowns, no "hold still". The picker picks on a pinch/click on a tile and closes on a pinch outside or on its close button.
- Plucking is crossing-based (`strings/pluck.ts`): a side memory per (pointer, string), a 3-unit dead zone, a 0.11 s cooldown, and a 0.4 s grace for newborn strings.
- One pitch per string: `music/pitch.ts` maps length (relative to the stage diagonal) to pitch ∝ 1/length, then snaps to key + tone. Where you cross doesn't matter.

## Deploy

Every push and PR runs `.github/workflows/deploy.yml` (`./scripts/check.sh --ci`). A push to `main` also runs `wrangler deploy`: a static-assets Cloudflare Worker (`wrangler.jsonc`) on the custom domain `airguitar.veszelovszki.com`, public, no Access. Secrets: `CLOUDFLARE_API_TOKEN` (same as `secret CLOUDFLARE_API_TOKEN`) and `CLOUDFLARE_ACCOUNT_ID`. Manual deploy from the laptop: `pnpm build && CLOUDFLARE_API_TOKEN=$(secret CLOUDFLARE_API_TOKEN) CLOUDFLARE_ACCOUNT_ID=6a4433bf11c3cf86feda057f76f47991 pnpm exec wrangler deploy`.

## Conventions

- Stage coordinates are stage units (1280 × 720 in landscape), never CSS pixels. Convert with `ctx.toStage` / `ctx.toClient`.
- Music Maker's look: `ui/style.css` tokens and `render/style.ts` (ivory `#fbf6e9`, amber `#ffc24a`, ink `#0b0d11`, Avenir Next). Dark theme only.
- UI copy follows David's style: sentence case, friendly, short, no em dashes.
