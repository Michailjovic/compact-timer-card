# Compact Timer Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/michalic/compact-timer-card.svg)](https://github.com/michalic/compact-timer-card/releases)

A sleek, fully customizable Home Assistant timer card with **live per-second countdown** and a **linear progress bar with glow effect**.

Built as a companion to [Universal Remote Card](https://github.com/nicufodineanu/universal-remote-card) to implement a **deadman switch** for TV auto-shutoff — but works with any HA timer entity.

![Preview](https://raw.githubusercontent.com/michalic/compact-timer-card/main/assets/preview.png)

## The Problem This Solves

Universal Remote Card is great for controlling media devices, but it has no native way to display a running timer inline. This card fills that gap — specifically for the **deadman switch pattern**:

> You set a sleep timer. If you fall asleep and stop interacting with the remote, the TV turns off automatically. The timer is visible directly in the remote panel, and you can cancel it with a single tap if you're still watching.

## Required Helper — HA Timer Entity

This card works with Home Assistant's built-in `timer` domain. You need to create a timer helper for each timer you want to display.

### Creating the timer helper

**Via UI:**
1. Go to **Settings → Devices & Services → Helpers**
2. Click **+ Create helper**
3. Choose **Timer**
4. Set a name (e.g. `TV Sleep Timer`) and optionally a default duration
5. Note the generated entity ID (e.g. `timer.tv_sleep_timer`)

**Via YAML** (in `configuration.yaml`):

```yaml
timer:
  tv_sleep_timer:
    name: TV Sleep Timer
    duration: "01:00:00"
    restore: true
  tv_auto_inactivity:
    name: TV Auto Inactivity
    duration: "00:05:00"
    restore: true
```

> **Note:** Setting `restore: true` preserves the timer state across HA restarts.

### Automations to make the deadman switch work

The timer itself doesn't do anything — you need automations to act on it. Here's a minimal example that turns off the TV when the sleep timer finishes:

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

For the inactivity variant, reset the timer on every remote button press using a script or automation that calls `timer.start` on each interaction.

## Installation

### Via HACS (recommended)

1. Open **HACS → Frontend**
2. Click the three-dot menu **⋮ → Custom repositories**
3. Add the URL of this repository and select category **Lovelace**
4. Find **Compact Timer Card** and click **Install**
5. Clear browser cache or reload the page

### Manual

1. Download `dist/compact-timer-card.js` from the latest release
2. Copy it to `/config/www/compact-timer-card.js`
3. Add it as a Lovelace resource:

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
cancel_on_tap: true
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | **required** | Timer entity ID |
| `name` | string | friendly_name | Label displayed on the card |
| `icon` | string | `mdi:timer-outline` | Any MDI icon |
| `color` | string | `#63b3ed` | Accent color (hex). Controls bar, icon, and time text. |
| `cancel_on_tap` | boolean | `true` | Tap the card to cancel the timer |
| `tap_action` | object | — | Custom tap action (overrides cancel_on_tap) |

### tap_action object

| Action | Description |
|---|---|
| `call-service` | Call any HA service |
| `navigate` | Navigate to a dashboard path |
| `more-info` | Open the more-info dialog |
| `none` | Disable tap |

## Full Example — Universal Remote Card + Deadman Switch

This is the intended use case. The compact timer cards appear inside the remote panel only when their timers are active.

```yaml
type: grid
columns: 1
square: false
cards:

  # Universal Remote Card
  - type: custom:universal-remote-card
    # ... your remote config here

  # Sleep timer buttons — tap to set duration
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

  # Inactivity timer — shown only when active
  - type: conditional
    conditions:
      - condition: state
        entity: timer.tv_auto_inactivity
        state: active
    card:
      type: custom:compact-timer-card
      entity: timer.tv_auto_inactivity
      name: Inactivity – Auto Off
      icon: mdi:motion-sensor-off
      color: "#63b3ed"
      cancel_on_tap: true

  # Sleep timer — shown only when active
  - type: conditional
    conditions:
      - condition: state
        entity: timer.tv_sleep_timer
        state: active
    card:
      type: custom:compact-timer-card
      entity: timer.tv_sleep_timer
      name: Sleep Timer
      icon: mdi:power-sleep
      color: "#63b3ed"
      cancel_on_tap: true
```

## Design

```
[ icon ]  LABEL NAME              12:34  [ Cancel ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- **Left:** configurable MDI icon + uppercase label
- **Right:** live per-second countdown + optional cancel badge
- **Bottom:** 3 px linear progress bar with color glow
- All colors derived from the single `color` option — the card always looks cohesive

## Contributing

Pull requests and issues are welcome. If you add support for a new feature or fix a bug, please open a PR against the `main` branch.

## License

MIT © Michal Ič
