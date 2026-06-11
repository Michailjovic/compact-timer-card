# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
