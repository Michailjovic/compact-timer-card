# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.4.0] — 2026-08-20

### Added

- **Preset buttons** — `presets: [30, 60, 120, 240]` renders buttons that call `timer.start` with a fixed duration, so a timer can be *started* from the card instead of only cancelled. Two looks via `preset_style`: `buttons` (default, full-width grid with a unit caption) or `chips` (inline, next to the countdown). `preset_position: top | bottom` places the grid relative to the timer row, `preset_unit` overrides the `MIN` caption, and entries may be objects — `{ minutes: 90, label: "1½h" }`. Tapping a preset on a running timer restarts it with the new duration. This replaces the external `button-card` stack the README previously recommended for the job.
  - A row that has presets stays visible even with `show_when_idle: false` — hiding it would put the only way to start the timer permanently out of reach.
- **Unknown-option warning** — `setConfig()` now logs every option the card does not understand, for the card itself and for each entry in `entities:`. Options removed in earlier releases name their replacement (e.g. `cancel_on_tap` → `tap:`). Keys injected by HA, card-mod, and layout tooling are not reported.
- **Haptic feedback** on preset and extend buttons (HA `haptic` event).

### Changed

- **An explicit `*_threshold_sec` now suppresses the implicit percentage threshold.** The two are OR-combined, so whichever fires first wins — which made the *default* percentage silently defeat the absolute one it was added for: `critical_threshold` defaults to 5 %, and 5 % of a 4-hour timer is 12 minutes, so `critical_threshold_sec: 60` never got a chance. Setting only `critical_threshold_sec` now means exactly that; set the percentage explicitly alongside it to get both. Configs that use percentages only are unaffected.
- **`extend_buttons` accepts negative values and works on paused timers** — `[-10, 10, 30]` renders `−10m / +10m / +30m`, and `timer.change` is now called for `paused` timers as well, not only `active` ones.
- **Server clock skew is calibrated for already-running timers.** Previously the offset was only measured on a live transition into `active`, so a timer that was already running when the page loaded — the common case after a reload — always assumed a correct client clock. The card now samples the offset from any incoming state update, and additionally probes the server's `Date` response header once per page load (shared across all card instances, silently skipped when unavailable).
- `getStubConfig()` picks a real timer from the instance, so the card-picker preview shows a working card instead of the `!` badge for the non-existent `timer.example`.

### Fixed

- **Per-entity `tap_action` was silently ignored.** `_handleTap()` read the card-level `tap_action` only, so in stacked mode one entity's custom action was applied to every row — the same class of bug fixed for `tap`/`hold` in 1.3.0, which this option was missed by. `tap_action` is now inherited from card level and overridable per entity, and the `Cancel` badge is suppressed per row rather than card-wide.
- **A row with `tap: none` no longer pretends to be a button.** It rendered with `role="button"`, `tabindex="0"`, a pointer cursor, a press animation, and a focus ring — all for an action that does nothing — and keyboard activation reached a no-op handler. `role`/`tabindex`/focus ring now appear only when a tap action exists; the press affordance only when tap *or* hold does something.
- **Enter/Space on an extend chip triggered the row's tap action** (typically cancelling the timer) instead of extending it, because the row's keydown handler matched the chip via `closest()` and called `preventDefault()`, suppressing the button's native activation. Chips and presets now sit outside the row's `[data-i]` tap target entirely, so pointer, hold, and keyboard handling skip them structurally rather than by guard.
- `aria-label` on a timer row now carries the remaining time and is updated as it counts down; it was previously the name alone.
- Extend and preset buttons have a visible `:focus-visible` ring.
- `_holdReset` is cleared in `disconnectedCallback()` alongside `_holdTimer`.

## [1.3.0] — 2026-06-11

### Added

- **Absolute-seconds thresholds** — `warning_threshold_sec` and `critical_threshold_sec` trigger zones at a fixed number of remaining seconds, OR-combined with the existing percentage thresholds. A 4-hour sleep timer can now go critical at 60 s instead of at "5 % = 12 minutes".
- **Extend buttons** — `extend_buttons: [10, 30]` renders `+10m` / `+30m` chips on active timers, calling the `timer.change` service. Replaces the external button-card preset hack for adding time.
- **Timestamp-sensor support** — the card now counts down to any `sensor` with a future timestamp state (`device_class: timestamp`): washers, dryers, voice-assistant timers. Optional per-entity `duration` enables the progress bar; tap falls back to more-info since timer services don't apply.
- **Finished flash** — a localized "✓ Done" badge is shown for 5 s when a timer finishes naturally (detected locally at zero-crossing, with a state-transition fallback for throttled background tabs). Cancelling does not trigger it. Disable with `show_finished: false`, customize with `finished_label`.
- **End-time display** — `show_ends_at: true` shows the wall-clock finish time (`→ 23:45`), locale-formatted, refreshed live after extends.
- **`more_info` tap/hold action** — now available in the visual editor and documented (it existed in code but was unreachable from the UI).
- **Localized default labels** — Cancel/Pause/Resume/Paused/Done badges default to the HA UI language (en, cs, sk, de, fr, es, it, nl, pl); explicit `*_label` options still override.
- **`use_ha_card` option** — render inside `ha-card` so theme card background, border, and border-radius apply instead of the accent-tinted chrome.
- **Keyboard accessibility** — rows are focusable (`role="button"`, `tabindex`), Enter/Space triggers the tap action, with a visible focus ring; animations honor `prefers-reduced-motion`.
- **Sections layout support** — implemented `getGridOptions()` for the modern grid/sections dashboard layout.
- Visual editor: entity input now suggests timer entities and timestamp sensors from your instance; new fields for seconds thresholds, extend buttons, end time, finished badge, and `use_ha_card`.
- Version banner in the browser console and `documentationURL` in the card registry entry.

### Changed

- **Countdown uses `Math.ceil`** — a 30:00 timer now starts at 30:00 (not 29:59) and never shows 0:00 while still running.
- **Paused timers keep their warning/critical zone color** (dimmed) instead of reverting to the base color.
- **Card accent follows the most severe zone** of all visible timers in stacked mode, not just the first row.
- **Server↔client clock-skew compensation** — the countdown is calibrated against `last_updated` on live start transitions, so a wrong client clock no longer shifts the remaining time.
- **Theme integration** — typography uses `--ha-font-family-body`/`--primary-font-family` instead of hard-coded `sans-serif`; color fallbacks are now theme-neutral instead of dark-theme-only; all alpha tints are derived via `color-mix()`.
- Idle rows no longer duplicate the duration (`30:00 / 30:00`) when `show_duration` is on.
- Badge font size bumped from 9 px to 10 px for legibility.
- Tick interval refined to 250 ms with change-detection (DOM is only touched when a rendered value changes) for accurate countdown flips at near-zero cost; ticks also fire on tab-visibility restore.

### Fixed

- **Warning/critical colors now switch on time** — zone transitions are evaluated by the internal ticker. Previously they were only re-evaluated when *any* entity in HA pushed a state update, so on a quiet instance the color could change late or never.
- **Per-entity `tap`/`hold` overrides in `entities:` were silently ignored** — both the executed action and the rendered badge always used the global setting.
- **All display options are now overridable per entity** in stacked mode (`bar_height`, `bar_direction`, `bar_position`, `gradient_bar`, `pulse_icon`, `pulse_bar`, `show_when_idle`, `show_duration`, …) — previously only colors and labels were.
- **Stale hold flag on touch devices** — after a long-press where the browser suppressed the synthetic click, the next tap was swallowed. The flag now auto-resets.
- **Orphaned hold timeout after rebuild** — a DOM rebuild during a long-press could fire the hold action (e.g. cancel) ~500 ms later even though the finger was lifted. Hold timers are now owned by the card instance and cleared on every rebuild.
- **`unavailable` entities rendered as idle** (and silently disappeared with `show_when_idle: false`) — they now show the `!` error badge like missing entities.
- **HTML injection / markup breakage** — names, labels, and entity IDs are now escaped everywhere; a name containing `"`, `<`, or `&` no longer breaks the card or the editor inputs. Config colors are validated (`#rgb`/`#rrggbb`) before being inserted into generated CSS.
- **3-digit hex colors** (`#abc`) are now parsed correctly instead of producing `rgba(NaN,…)`; invalid colors fall back to the default accent.
- **Progress percentage is clamped at both ends** (0–100) — client clock drift could previously yield negative bar widths.
- **Performance:** unrelated `hass` updates are now ignored entirely (previously every state change in HA triggered entity normalization, zone serialization, and DOM queries); normalized entity configs are cached at `setConfig`; per-tick `querySelector` lookups replaced by cached element references; zone color changes update CSS custom properties in place instead of rebuilding the whole card DOM.
- Duplicate `customElements.define` registration is now guarded, so loading the resource twice no longer throws.
- `CARD_VERSION` constant brought in line with the release tag.

## [1.0.1] — earlier

- Initial public release line (live countdown, warning/critical zones, gradient bar, stacked mode, visual editor).
