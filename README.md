# Compact Timer Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/michalic/compact-timer-card.svg)](https://github.com/michalic/compact-timer-card/releases)

A sleek, fully customizable Home Assistant timer card with **live per-second countdown**, **warning/critical color zones**, **paused state support**, a **gradient progress bar with glow effect**, and a **built-in visual editor**.

Built as a companion to [Universal Remote Card](https://github.com/nicufodineanu/universal-remote-card) to implement a **deadman switch** for TV auto-shutoff — but works with any HA timer entity.

![Hero](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/hero.png)

## The Problem This Solves

Universal Remote Card is great for controlling media devices, but it has no native way to display a running timer inline. This card fills that gap — specifically for the **deadman switch pattern**:

> You set a sleep timer. If you fall asleep and stop interacting with the remote, the TV turns off automatically. The timer is visible directly in the remote panel, and you can cancel it with a single tap if you're still watching.

## Features

- Live per-second countdown computed from `finishes_at`
- Warning and critical color zones with configurable thresholds
- Optional bar pulse animation when entering warning/critical zone
- Paused state with dimmed bar and badge
- Tap and hold actions (cancel, pause/resume, or custom)
- Progress bar: gradient, direction (ltr/rtl), position (top/bottom), height
- Pulsing icon animation while active
- `show_when_idle: false` hides the card automatically — no conditional card wrapper needed
- Stacked mode: display multiple timers in a single card via `entities:`
- Built-in visual GUI editor

## Timer States

![States](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/preview.png)

| State | Visual |
|---|---|
| **active** | Live countdown, full color, pulsing icon, action badge |
| **paused** | Remaining time (dimmed), ⏸ Paused badge, dimmed bar |
| **idle** | Hidden (if `show_when_idle: false`) or shows full duration |
| **unknown** | `!` error badge — entity not found |

### Warning and Critical zones

The bar and icon color change automatically as the timer runs down.

![Warning state](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/warning.png)

![Critical state](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/critical.png)

## Required Helper — HA Timer Entity

This card works with Home Assistant's built-in `timer` domain.

**Via YAML** (in `configuration.yaml`):

```yaml
timer:
  tv_sleep_timer:
    name: TV Sleep Timer
    duration: "00:30:00"
    restore: true
  tv_auto_inactivity:
    name: TV Auto Inactivity
    duration: "00:05:00"
    restore: true
```

> **Note:** `restore: true` preserves timer state across HA restarts.

**Via UI:** Settings → Devices & Services → Helpers → + Create helper → Timer

### Automations for the deadman switch

```yaml
alias: TV Sleep Timer – Turn Off
triggers:
  - trigger: event
    event_type: timer.finished
    event_data:
      entity_id: timer.tv_sleep_timer
actions:
  - action: media_player.turn_off
    target:
      entity_id: media_player.your_tv
```

For the inactivity variant, call `timer.start` on every remote button press to reset the countdown.

## Installation

### Via HACS (recommended)

1. Open **HACS → Frontend**
2. Click the three-dot menu **⋮ → Custom repositories**
3. Add the URL of this repository, category **Lovelace**
4. Find **Compact Timer Card** and click **Install**
5. Hard-reload the browser (Ctrl+Shift+R)

### Manual

1. Download `compact-timer-card.js` from the latest release
2. Copy it to `/config/www/compact-timer-card.js`
3. Add as a Lovelace resource:

```yaml
- url: /local/compact-timer-card.js
  type: module
```

## Configuration

```yaml
type: custom:compact-timer-card
entity: timer.tv_sleep_timer
name: Sleep Timer
icon: mdi:power-sleep
color: "#63b3ed"
tap: cancel
hold: none
cancel_label: Cancel
show_duration: true
show_when_idle: false
gradient_bar: true
pulse_icon: true
pulse_bar: false
bar_height: 3
bar_direction: ltr
bar_position: bottom
warning_color: "#f6ad55"
warning_threshold: 30
critical_color: "#fc8181"
critical_threshold: 10
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | **required** | Timer entity ID |
| `entities` | list | — | Multiple timers in one card (see Stacked mode below) |
| `name` | string | friendly_name | Label displayed on the card |
| `icon` | string | `mdi:timer-outline` | Any MDI icon |
| `color` | string | `#63b3ed` | Base accent color (hex) — controls bar, icon, and time text |
| `tap` | string | `cancel` | Tap action: `cancel`, `toggle_pause`, `none` |
| `hold` | string | `none` | Hold action (~500 ms): `none`, `cancel`, `toggle_pause` |
| `cancel_label` | string | `Cancel` | Text shown on the cancel badge |
| `show_duration` | boolean | `false` | Show total duration next to remaining time (e.g. `1:23 / 30:00`) |
| `show_when_idle` | boolean | `false` | Keep card visible when timer is idle |
| `gradient_bar` | boolean | `true` | Gradient on the progress bar instead of flat color |
| `pulse_icon` | boolean | `true` | Pulse icon animation while active |
| `pulse_bar` | boolean | `false` | Pulse bar animation when in warning or critical zone |
| `bar_height` | number | `3` | Progress bar height in pixels |
| `bar_direction` | string | `ltr` | `ltr` = fills left→right (elapsed); `rtl` = empties right→left (remaining) |
| `bar_position` | string | `bottom` | `bottom` or `top` |
| `warning_color` | string | — | Color when warning threshold is reached (e.g. `#f6ad55`) |
| `warning_threshold` | number | `20` | % of time remaining that triggers warning color |
| `critical_color` | string | — | Color when critical threshold is reached (e.g. `#fc8181`) |
| `critical_threshold` | number | `5` | % of time remaining that triggers critical color |
| `tap_action` | object | — | Advanced tap action object (overrides `tap`) |

### tap_action object

| Action | Description |
|---|---|
| `call-service` / `perform-action` | Call any HA service |
| `navigate` | Navigate to a dashboard path |
| `more-info` | Open the more-info dialog |
| `none` | Disable tap |

### Visual editor

The card includes a built-in GUI editor. In the HA dashboard editor click **+ Add card**, search for **Compact Timer Card**, and configure all options without writing YAML.

### Stacked mode

Display multiple timers in a single card. Each timer can override the global color and threshold settings:

```yaml
type: custom:compact-timer-card
color: "#63b3ed"
warning_color: "#f6ad55"
warning_threshold: 30
critical_color: "#fc8181"
critical_threshold: 10
show_when_idle: false
show_duration: true
tap: cancel
entities:
  - entity: timer.tv_auto_inactivity
    name: NEAKTIVITA – AUTO OFF
    icon: mdi:motion-sensor-off
  - entity: timer.tv_sleep_timer
    name: VYPNUTÍ TV
    icon: mdi:power-sleep
    cancel_label: End
```

## Full Example — Universal Remote Card + Deadman Switch

This is the intended use case. The compact timer cards appear inline within the remote panel only when their timers are active.

![Full setup](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/hero.png)

```yaml
type: grid
columns: 1
square: false
cards:

  # Universal Remote Card
  - type: custom:universal-remote-card
    # ... your remote config here

  # Sleep timer duration buttons — tap to set and start
  - type: horizontal-stack
    cards:
      - type: custom:button-card
        show_icon: false
        show_name: false
        tap_action:
          action: call-service
          service: timer.start
          service_data:
            entity_id: timer.tv_sleep_timer
            duration: "0:30:00"
        custom_fields:
          label: |
            [[[
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:800;color:#63b3ed;line-height:1;">30</span>
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                             color:rgba(255,255,255,0.25);font-weight:600;">min</span>
              </div>`;
            ]]]
        styles:
          card:
            - background: rgba(99,179,237,0.06)
            - border: 1px solid rgba(99,179,237,0.2)
            - border-radius: 14px
            - padding: 12px 4px
            - box-shadow: none
          grid:
            - grid-template-areas: '"label"'
          custom_fields:
            label:
              - width: 100%
      - type: custom:button-card
        show_icon: false
        show_name: false
        tap_action:
          action: call-service
          service: timer.start
          service_data:
            entity_id: timer.tv_sleep_timer
            duration: "1:00:00"
        custom_fields:
          label: |
            [[[
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:800;color:#63b3ed;line-height:1;">60</span>
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                             color:rgba(255,255,255,0.25);font-weight:600;">min</span>
              </div>`;
            ]]]
        styles:
          card:
            - background: rgba(99,179,237,0.06)
            - border: 1px solid rgba(99,179,237,0.2)
            - border-radius: 14px
            - padding: 12px 4px
            - box-shadow: none
          grid:
            - grid-template-areas: '"label"'
          custom_fields:
            label:
              - width: 100%
      - type: custom:button-card
        show_icon: false
        show_name: false
        tap_action:
          action: call-service
          service: timer.start
          service_data:
            entity_id: timer.tv_sleep_timer
            duration: "2:00:00"
        custom_fields:
          label: |
            [[[
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:800;color:#63b3ed;line-height:1;">120</span>
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                             color:rgba(255,255,255,0.25);font-weight:600;">min</span>
              </div>`;
            ]]]
        styles:
          card:
            - background: rgba(99,179,237,0.06)
            - border: 1px solid rgba(99,179,237,0.2)
            - border-radius: 14px
            - padding: 12px 4px
            - box-shadow: none
          grid:
            - grid-template-areas: '"label"'
          custom_fields:
            label:
              - width: 100%
      - type: custom:button-card
        show_icon: false
        show_name: false
        tap_action:
          action: call-service
          service: timer.start
          service_data:
            entity_id: timer.tv_sleep_timer
            duration: "4:00:00"
        custom_fields:
          label: |
            [[[
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:800;color:#63b3ed;line-height:1;">240</span>
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                             color:rgba(255,255,255,0.25);font-weight:600;">min</span>
              </div>`;
            ]]]
        styles:
          card:
            - background: rgba(99,179,237,0.06)
            - border: 1px solid rgba(99,179,237,0.2)
            - border-radius: 14px
            - padding: 12px 4px
            - box-shadow: none
          grid:
            - grid-template-areas: '"label"'
          custom_fields:
            label:
              - width: 100%

  # Both timers in one stacked card
  # show_when_idle: false — the card hides itself when both timers are idle
  - type: custom:compact-timer-card
    color: "#63b3ed"
    warning_color: "#f6ad55"
    warning_threshold: 30
    critical_color: "#fc8181"
    critical_threshold: 10
    pulse_bar: true
    show_when_idle: false
    show_duration: true
    tap: cancel
    entities:
      - entity: timer.tv_auto_inactivity
        name: NEAKTIVITA – AUTO OFF
        icon: mdi:motion-sensor-off
      - entity: timer.tv_sleep_timer
        name: VYPNUTÍ TV
        icon: mdi:power-sleep
        cancel_label: End
```

## Design

```
[ icon ]  LABEL NAME              1:23 / 30:00  [ Cancel ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- **Left:** pulsing MDI icon (when active) + uppercase label
- **Right:** live per-second countdown + optional total duration + state badge
- **Bottom:** gradient progress bar with color glow
- Colors switch automatically from base → warning → critical as time runs out
- All colors derived from a single hex value — the card always looks cohesive
- Adapts to both dark and light HA themes via CSS variables

## Contributing

Pull requests and issues are welcome. If you add support for a new feature or fix a bug, please open a PR against the `main` branch.

## License

MIT © Michal Ič
