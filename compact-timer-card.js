/**
 * Compact Timer Card
 * A sleek, fully customizable timer card for Home Assistant
 * with live countdown and linear progress bar.
 *
 * https://github.com/michalic/compact-timer-card
 */

class CompactTimerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval = null;
    this._config = {};
    this._hass = null;
    this._initialized = false;

    // Use pointerdown + pointerup instead of click
    // — more reliable across desktop and mobile in HA
    this._pointerDownTime = 0;
    this._pointerDownX = 0;
    this._pointerDownY = 0;

    this.addEventListener('pointerdown', (e) => {
      this._pointerDownTime = Date.now();
      this._pointerDownX = e.clientX;
      this._pointerDownY = e.clientY;
    });

    this.addEventListener('pointerup', (e) => {
      const dt = Date.now() - this._pointerDownTime;
      const dx = Math.abs(e.clientX - this._pointerDownX);
      const dy = Math.abs(e.clientY - this._pointerDownY);
      // Tap = short press (<400ms) with minimal movement (<8px)
      if (dt < 400 && dx < 8 && dy < 8) {
        e.preventDefault();
        e.stopPropagation();
        this._handleTap();
      }
    });
  }

  static getStubConfig() {
    return {
      entity: 'timer.example',
      name: 'My Timer',
      icon: 'mdi:timer-outline',
      color: '#63b3ed',
      cancel_on_tap: true,
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config = {
      name: config.name || '',
      icon: config.icon || 'mdi:timer-outline',
      color: config.color || '#63b3ed',
      cancel_on_tap: config.cancel_on_tap !== false,
      tap_action: config.tap_action || null,
      ...config,
    };
    this._initialized = false;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._build();
    } else {
      this._tick();
    }
    this._startInterval();
  }

  connectedCallback() {
    if (this._hass) {
      this._startInterval();
    }
  }

  disconnectedCallback() {
    this._stopInterval();
  }

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

  _colorAlpha(color, a) {
    const hex = (color || '#63b3ed').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  _getTimerData() {
    if (!this._hass || !this._config.entity) return null;
    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) return null;

    const state = stateObj.state;
    const attrs = stateObj.attributes;

    if (state !== 'active') {
      this._stopInterval();
      return { state, pct: 0, timeStr: '0:00', isActive: false };
    }

    this._startInterval();

    let remainingSec = 0;
    if (attrs.finishes_at) {
      remainingSec = Math.max(0, Math.floor((new Date(attrs.finishes_at) - new Date()) / 1000));
    }

    const durParts = (attrs.duration || '0:00:00').split(':').map(Number);
    const durationSec = (durParts[0] || 0) * 3600 + (durParts[1] || 0) * 60 + (durParts[2] || 0);
    const pct = durationSec > 0 ? Math.min(100, ((durationSec - remainingSec) / durationSec) * 100) : 0;

    const h = Math.floor(remainingSec / 3600);
    const m = Math.floor((remainingSec % 3600) / 60);
    const s = remainingSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;

    return { state, pct, timeStr, isActive: true };
  }

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
      this._hass.callService('timer', 'cancel', { entity_id: this._config.entity });
    }
  }

  _build() {
    const color = this._config.color || '#63b3ed';
    const ca = (a) => this._colorAlpha(color, a);

    const stateObj = this._hass && this._hass.states[this._config.entity];
    const name = this._config.name ||
      (stateObj && stateObj.attributes.friendly_name) ||
      this._config.entity;

    const showCancel = this._config.cancel_on_tap && !this._config.tap_action;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
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
          pointer-events: none;
        }

        ha-icon {
          color: ${ca(0.65)};
          --mdc-icon-size: 15px;
          flex-shrink: 0;
        }

        .label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.8px;
          color: rgba(255,255,255,0.28);
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
          pointer-events: none;
        }

        .time {
          font-size: 13px;
          font-weight: 700;
          color: ${color};
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
        }

        .cancel-badge {
          font-size: 9px;
          color: rgba(255,255,255,0.22);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          line-height: 1.6;
          white-space: nowrap;
        }

        .bar-wrap {
          margin-top: 8px;
          width: 100%;
          height: 3px;
          background: ${ca(0.12)};
          border-radius: 3px;
          overflow: hidden;
          pointer-events: none;
        }

        .bar-fill {
          height: 100%;
          width: 0%;
          background: ${color};
          border-radius: 3px;
          box-shadow: 0 0 6px ${ca(0.55)};
          transition: width 0.9s linear;
        }
      </style>

      <div class="card">
        <div class="row">
          <div class="left">
            <ha-icon icon="${this._config.icon}"></ha-icon>
            <span class="label">${name}</span>
          </div>
          <div class="right">
            <span class="time" id="time-display">0:00</span>
            ${showCancel ? '<span class="cancel-badge">Zrušit</span>' : ''}
          </div>
        </div>
        <div class="bar-wrap">
          <div class="bar-fill" id="bar-fill"></div>
        </div>
      </div>
    `;

    this._initialized = true;
    this._tick();
  }

  _tick() {
    if (!this._initialized) return;
    const data = this._getTimerData();
    if (!data) return;
    const timeEl = this.shadowRoot.getElementById('time-display');
    const barEl = this.shadowRoot.getElementById('bar-fill');
    if (timeEl) timeEl.textContent = data.timeStr;
    if (barEl) barEl.style.width = `${data.pct}%`;
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
  description: 'Sleek timer card with live countdown and linear progress bar.',
  preview: false,
});
