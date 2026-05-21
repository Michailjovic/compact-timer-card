/**
 * Compact Timer Card
 * A sleek, fully customizable timer card for Home Assistant
 * with live countdown and linear progress bar.
 *
 * https://github.com/michalic/compact-timer-card
 */

// ─── Visual Editor ────────────────────────────────────────────────────────────

class CompactTimerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    const c = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 4px 0;
        }
        h4 {
          margin: 4px 0 0;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.8px;
          color: var(--secondary-text-color);
          font-weight: 700;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .field label {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .field input[type="text"] {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color);
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        }
        .field input[type="color"] {
          width: 100%;
          height: 38px;
          padding: 3px 6px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          cursor: pointer;
          box-sizing: border-box;
        }
        .field input[type="number"] {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color);
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        }
        .check-field {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .check-field input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--primary-color, #63b3ed);
        }
        .check-field label {
          font-size: 13px;
          color: var(--primary-text-color);
          cursor: pointer;
          user-select: none;
        }
        .divider {
          border: none;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.1));
          margin: 0;
        }
      </style>
      <div class="form">

        <h4>Basic</h4>

        <div class="field">
          <label>Entity (required)</label>
          <input type="text" id="entity" value="${c.entity || ''}" placeholder="timer.example" />
        </div>
        <div class="field">
          <label>Name (leave empty to use friendly name)</label>
          <input type="text" id="name" value="${c.name || ''}" placeholder="My Timer" />
        </div>
        <div class="field">
          <label>Icon</label>
          <input type="text" id="icon" value="${c.icon || ''}" placeholder="mdi:timer-outline" />
        </div>
        <div class="field">
          <label>Accent color</label>
          <input type="color" id="color" value="${c.color || '#63b3ed'}" />
        </div>

        <hr class="divider" />
        <h4>Display</h4>

        <div class="check-field">
          <input type="checkbox" id="show_when_idle" ${c.show_when_idle ? 'checked' : ''} />
          <label for="show_when_idle">Show when timer is idle</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="show_duration" ${c.show_duration ? 'checked' : ''} />
          <label for="show_duration">Show total duration (1:23 / 30:00)</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="gradient_bar" ${c.gradient_bar !== false ? 'checked' : ''} />
          <label for="gradient_bar">Gradient progress bar</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="pulse_icon" ${c.pulse_icon !== false ? 'checked' : ''} />
          <label for="pulse_icon">Pulse icon when active</label>
        </div>
        <div class="field">
          <label>Progress bar height (px)</label>
          <input type="number" id="bar_height" value="${c.bar_height ?? 3}" min="1" max="20" step="1" />
        </div>

        <hr class="divider" />
        <h4>Action</h4>

        <div class="check-field">
          <input type="checkbox" id="cancel_on_tap" ${c.cancel_on_tap !== false ? 'checked' : ''} />
          <label for="cancel_on_tap">Tap to cancel the timer</label>
        </div>
        <div class="field">
          <label>Cancel button label</label>
          <input type="text" id="cancel_label" value="${c.cancel_label || ''}" placeholder="Cancel" />
        </div>

      </div>
    `;

    const textFields = ['entity', 'name', 'icon', 'color', 'cancel_label', 'bar_height'];
    textFields.forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._valueChanged());
    });

    const checkFields = ['show_when_idle', 'show_duration', 'gradient_bar', 'pulse_icon', 'cancel_on_tap'];
    checkFields.forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._valueChanged());
    });
  }

  _valueChanged() {
    const get = (id) => this.shadowRoot.getElementById(id);

    const newConfig = {
      ...this._config,
      entity: get('entity').value,
    };

    const name = get('name').value;
    if (name) newConfig.name = name; else delete newConfig.name;

    const icon = get('icon').value;
    if (icon) newConfig.icon = icon; else delete newConfig.icon;

    newConfig.color = get('color').value;
    newConfig.show_when_idle = get('show_when_idle').checked;
    newConfig.show_duration = get('show_duration').checked;
    newConfig.gradient_bar = get('gradient_bar').checked;
    newConfig.pulse_icon = get('pulse_icon').checked;
    newConfig.cancel_on_tap = get('cancel_on_tap').checked;
    newConfig.bar_height = parseInt(get('bar_height').value, 10) || 3;

    const cancelLabel = get('cancel_label').value;
    if (cancelLabel) newConfig.cancel_label = cancelLabel; else delete newConfig.cancel_label;

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('compact-timer-card-editor', CompactTimerCardEditor);

// ─── Main Card ────────────────────────────────────────────────────────────────

class CompactTimerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval = null;
    this._config = {};
    this._hass = null;
    this._initialized = false;
    this._lastState = null;

    // Native click — browser handles tap detection reliably on all devices.
    // Listener is on the host element, so it survives every _tick() and _build().
    this.addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleTap();
    });
  }

  static getConfigElement() {
    return document.createElement('compact-timer-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'timer.example',
      name: 'My Timer',
      icon: 'mdi:timer-outline',
      color: '#63b3ed',
      cancel_on_tap: true,
      cancel_label: 'Cancel',
      show_duration: false,
      show_when_idle: false,
      gradient_bar: true,
      pulse_icon: true,
      bar_height: 3,
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config = {
      name: '',
      icon: 'mdi:timer-outline',
      color: '#63b3ed',
      cancel_on_tap: true,
      cancel_label: 'Cancel',
      show_duration: false,
      show_when_idle: false,
      gradient_bar: true,
      pulse_icon: true,
      bar_height: 3,
      tap_action: null,
      ...config,
    };
    this._initialized = false;
    this._lastState = null;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    const currentState = stateObj ? stateObj.state : 'unknown';

    // Rebuild DOM when state changes (idle↔active↔paused need different badges/styles)
    if (!this._initialized || currentState !== this._lastState) {
      this._lastState = currentState;
      this._build();
    } else {
      this._tick();
    }
    this._startInterval();
  }

  connectedCallback() {
    if (this._hass) this._startInterval();
  }

  disconnectedCallback() {
    this._stopInterval();
  }

  // ─── Interval ──────────────────────────────────────────────────────────────

  _startInterval() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), 1000);
  }

  _stopInterval() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _colorAlpha(color, a) {
    const hex = (color || '#63b3ed').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  _parseTimeSec(str) {
    // Parse "H:MM:SS" or "M:SS" or "0:30:00" → seconds
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return 0;
  }

  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // ─── Timer data ────────────────────────────────────────────────────────────

  _getTimerData() {
    if (!this._hass || !this._config.entity) return null;
    const stateObj = this._hass.states[this._config.entity];

    if (!stateObj) {
      return { state: 'unknown', pct: 0, timeStr: '–', totalStr: null, isActive: false, isPaused: false, isIdle: false };
    }

    const state = stateObj.state;
    const attrs = stateObj.attributes;
    const durationSec = this._parseTimeSec(attrs.duration || '0:00:00');
    const totalStr = this._config.show_duration && durationSec > 0 ? this._formatTime(durationSec) : null;

    if (state === 'active') {
      let remainingSec = 0;
      if (attrs.finishes_at) {
        remainingSec = Math.max(0, (new Date(attrs.finishes_at) - new Date()) / 1000);
      }
      const pct = durationSec > 0 ? Math.min(100, ((durationSec - remainingSec) / durationSec) * 100) : 0;
      return { state, pct, timeStr: this._formatTime(remainingSec), totalStr, isActive: true, isPaused: false, isIdle: false };
    }

    if (state === 'paused') {
      const remainingSec = this._parseTimeSec(attrs.remaining || '0:00:00');
      const pct = durationSec > 0 ? Math.min(100, ((durationSec - remainingSec) / durationSec) * 100) : 0;
      return { state, pct, timeStr: this._formatTime(remainingSec), totalStr, isActive: false, isPaused: true, isIdle: false };
    }

    // idle
    const idleTimeStr = durationSec > 0 ? this._formatTime(durationSec) : '0:00';
    return { state, pct: 0, timeStr: idleTimeStr, totalStr, isActive: false, isPaused: false, isIdle: true };
  }

  // ─── Tap handling ──────────────────────────────────────────────────────────

  _handleTap() {
    if (!this._hass || !this._config.entity) return;

    if (this._config.tap_action) {
      const action = this._config.tap_action;
      if (action.action === 'call-service' || action.action === 'perform-action') {
        const [domain, service] = (action.service || action.perform_action || '').split('.');
        this._hass.callService(domain, service, action.service_data || action.data || {});
      } else if (action.action === 'navigate') {
        history.pushState(null, '', action.navigation_path);
        window.dispatchEvent(new Event('location-changed'));
      } else if (action.action === 'more-info') {
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true, composed: true,
          detail: { entityId: this._config.entity },
        }));
      }
      return;
    }

    if (this._config.cancel_on_tap) {
      const stateObj = this._hass.states[this._config.entity];
      if (stateObj && (stateObj.state === 'active' || stateObj.state === 'paused')) {
        this._hass.callService('timer', 'cancel', { entity_id: this._config.entity });
      }
    }
  }

  // ─── Build DOM ─────────────────────────────────────────────────────────────

  _build() {
    const color = this._config.color || '#63b3ed';
    const ca = (a) => this._colorAlpha(color, a);
    const data = this._getTimerData();

    // Self-hide when idle and show_when_idle is false.
    // Use shadow DOM CSS — this.style.display='none' can be overridden by HA's hui-card wrapper.
    if (!this._config.show_when_idle && data && data.isIdle) {
      this.shadowRoot.innerHTML = '<style>:host { display: none !important; }</style>';
      this._initialized = true;
      this._stopInterval();
      return;
    }
    this.style.display = '';

    const stateObj = this._hass && this._hass.states[this._config.entity];
    const name = this._config.name ||
      (stateObj && stateObj.attributes.friendly_name) ||
      this._config.entity;

    const isActive = data && data.isActive;
    const isPaused = data && data.isPaused;
    const isUnknown = data && data.state === 'unknown';
    const showCancel = this._config.cancel_on_tap && !this._config.tap_action;

    // Status badge HTML
    let statusBadge = '';
    if (isPaused) {
      statusBadge = `<span class="status-badge paused">⏸ Paused</span>`;
    } else if (isUnknown) {
      statusBadge = `<span class="status-badge error">!</span>`;
    } else if (showCancel && isActive) {
      statusBadge = `<span class="cancel-badge">${this._config.cancel_label || 'Cancel'}</span>`;
    }

    // Total duration text
    const totalStr = data && data.totalStr ? `<span class="time-total" id="time-total">/ ${data.totalStr}</span>` : '';

    // Progress bar
    const barHeight = Math.max(1, parseInt(this._config.bar_height, 10) || 3);
    const gradientBar = this._config.gradient_bar !== false;
    const barBg = gradientBar
      ? `linear-gradient(90deg, ${ca(0.55)} 0%, ${color} 100%)`
      : color;

    // Icon pulse animation
    const doPulse = this._config.pulse_icon !== false && isActive;

    // Time color: dimmed when paused or idle
    const timeColor = isActive ? color : ca(0.45);

    // Bar opacity: dimmed when paused
    const barOpacity = isPaused ? '0.45' : '1';

    // Current time/pct
    const timeStr = data ? data.timeStr : '0:00';
    const pct = data ? data.pct : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .card {
          background: ${ca(0.05)};
          border: 1px solid ${ca(0.18)};
          border-radius: 14px;
          padding: 10px 14px;
          transition: background 0.12s ease, transform 0.1s ease;
        }

        :host(:active) .card {
          background: ${ca(0.14)};
          transform: scale(0.98);
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        ha-icon {
          color: ${ca(isActive ? 0.8 : 0.45)};
          --mdc-icon-size: 15px;
          flex-shrink: 0;
          ${doPulse ? 'animation: pulse-icon 2s ease-in-out infinite;' : ''}
        }

        @keyframes pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.85); }
        }

        .label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.8px;
          color: var(--secondary-text-color, rgba(255,255,255,0.28));
          font-family: sans-serif;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .time {
          font-size: 13px;
          font-weight: 700;
          color: ${timeColor};
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
          transition: color 0.3s;
        }

        .time-total {
          font-size: 11px;
          font-weight: 500;
          color: var(--secondary-text-color, rgba(255,255,255,0.28));
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
        }

        .cancel-badge {
          font-size: 9px;
          color: var(--secondary-text-color, rgba(255,255,255,0.22));
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          line-height: 1.6;
          white-space: nowrap;
        }

        .status-badge {
          font-size: 9px;
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          line-height: 1.6;
          white-space: nowrap;
        }

        .status-badge.paused {
          color: ${ca(0.7)};
          border: 1px solid ${ca(0.3)};
        }

        .status-badge.error {
          color: var(--error-color, #f87171);
          border: 1px solid var(--error-color, #f87171);
          font-weight: 700;
        }

        .bar-wrap {
          margin-top: 8px;
          width: 100%;
          height: ${barHeight}px;
          background: ${ca(0.12)};
          border-radius: ${barHeight}px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          width: 0%;
          background: ${barBg};
          border-radius: ${barHeight}px;
          box-shadow: 0 0 ${barHeight * 2}px ${ca(0.55)};
          transition: width 0.9s linear;
          opacity: ${barOpacity};
        }

        /* Inner elements never intercept the click */
        .card, .row, .left, .right, .bar-wrap,
        ha-icon, .label, .time, .time-total,
        .cancel-badge, .status-badge, .bar-fill {
          pointer-events: none;
        }
      </style>

      <div class="card">
        <div class="row">
          <div class="left">
            <ha-icon icon="${this._config.icon}"></ha-icon>
            <span class="label">${name}</span>
          </div>
          <div class="right">
            <span class="time" id="time-display">${timeStr}</span>
            ${totalStr}
            ${statusBadge}
          </div>
        </div>
        <div class="bar-wrap">
          <div class="bar-fill" id="bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;

    this._initialized = true;
  }
  // Tick — updates only the changing values (runs every second)

  _tick() {
    if (!this._initialized) return;
    const data = this._getTimerData();
    if (!data) return;

    // Stop ticking when not active (paused/idle don't need per-second updates)
    if (!data.isActive) {
      this._stopInterval();
    }

    const timeEl = this.shadowRoot.getElementById('time-display');
    const barEl = this.shadowRoot.getElementById('bar-fill');
    const totalEl = this.shadowRoot.getElementById('time-total');

    if (timeEl) timeEl.textContent = data.timeStr;
    if (barEl) barEl.style.width = `${data.pct}%`;
    if (totalEl && data.totalStr) totalEl.textContent = `/ ${data.totalStr}`;
  }

  getCardSize() {
    return 1;
  }
}

customElements.define('compact-timer-card', CompactTimerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'compact-timer-card',
  name: 'Compact Timer Card',
  description: 'Sleek timer card with live countdown, paused state support, and linear progress bar.',
  preview: false,
});
