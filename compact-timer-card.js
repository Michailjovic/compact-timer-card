/**
 * Compact Timer Card
 * A sleek, fully customizable timer card for Home Assistant
 * with live countdown, warning colors, configurable progress bar,
 * and multi-timer stacked mode.
 *
 * https://github.com/michalic/compact-timer-card
 */

// ============================================================
//  Visual Editor
// ============================================================

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
    const wt = c.warning_threshold ?? 20;
    const ct = c.critical_threshold ?? 5;

    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
        h4 { margin: 4px 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1.8px;
             color: var(--secondary-text-color); font-weight: 700; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; color: var(--secondary-text-color); }
        .field input[type="text"],
        .field input[type="number"],
        .field select {
          width: 100%; padding: 8px 10px; border-radius: 8px; outline: none;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color); font-size: 14px; box-sizing: border-box;
        }
        .field input[type="color"] {
          width: 100%; height: 38px; padding: 3px 6px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          box-sizing: border-box;
        }
        .check-field { display: flex; align-items: center; gap: 10px; }
        .check-field label { font-size: 13px; color: var(--primary-text-color); cursor: pointer; user-select: none; }
        .check-field input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary-color, #63b3ed); }
        .divider { border: none; border-top: 1px solid var(--divider-color, rgba(255,255,255,0.1)); margin: 0; }
        .threshold-block { padding-left: 26px; display: flex; flex-direction: column; gap: 6px; }
        .threshold-block label { font-size: 12px; color: var(--secondary-text-color); }
        .slider-row { display: flex; align-items: center; gap: 10px; }
        .slider-row input[type="range"] { flex: 1; accent-color: var(--primary-color, #63b3ed); }
        .slider-row .val { font-size: 13px; font-weight: 700; color: var(--primary-text-color);
                           min-width: 36px; text-align: right; }
        .note { font-size: 11px; color: var(--secondary-text-color); font-style: italic; }
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
        <div class="field">
          <label>Progress bar direction</label>
          <select id="bar_direction">
            <option value="ltr" ${(c.bar_direction || 'ltr') === 'ltr' ? 'selected' : ''}>&#x2192; Fill (shows elapsed time)</option>
            <option value="rtl" ${c.bar_direction === 'rtl' ? 'selected' : ''}>&#x2190; Empty (shows remaining time)</option>
          </select>
        </div>
        <div class="field">
          <label>Progress bar position</label>
          <select id="bar_position">
            <option value="bottom" ${(c.bar_position || 'bottom') === 'bottom' ? 'selected' : ''}>Bottom</option>
            <option value="top" ${c.bar_position === 'top' ? 'selected' : ''}>Top</option>
          </select>
        </div>

        <hr class="divider" />
        <h4>Warning Colors</h4>
        <p class="note">Thresholds are % of time <strong>remaining</strong>. Colors switch automatically.</p>

        <div class="check-field">
          <input type="checkbox" id="warning_enabled" ${c.warning_color ? 'checked' : ''} />
          <label for="warning_enabled">Warning color</label>
        </div>
        <div class="threshold-block">
          <div class="field">
            <input type="color" id="warning_color" value="${c.warning_color || '#f6ad55'}" />
          </div>
          <label>Activate when this much time remains:</label>
          <div class="slider-row">
            <input type="range" id="warning_threshold" min="5" max="50" step="5" value="${wt}" />
            <span class="val" id="wt_display">${wt}%</span>
          </div>
        </div>

        <div class="check-field">
          <input type="checkbox" id="critical_enabled" ${c.critical_color ? 'checked' : ''} />
          <label for="critical_enabled">Critical color</label>
        </div>
        <div class="threshold-block">
          <div class="field">
            <input type="color" id="critical_color" value="${c.critical_color || '#fc8181'}" />
          </div>
          <label>Activate when this much time remains:</label>
          <div class="slider-row">
            <input type="range" id="critical_threshold" min="1" max="25" step="1" value="${ct}" />
            <span class="val" id="ct_display">${ct}%</span>
          </div>
        </div>

        <hr class="divider" />
        <h4>Action</h4>
        <div class="field">
          <label>Tap action</label>
          <select id="tap">
            <option value="cancel"       ${(c.tap || 'cancel') === 'cancel'       ? 'selected' : ''}>Cancel timer</option>
            <option value="toggle_pause" ${c.tap === 'toggle_pause'               ? 'selected' : ''}>Pause / Resume</option>
            <option value="none"         ${c.tap === 'none'                       ? 'selected' : ''}>None</option>
          </select>
        </div>
        <div class="field">
          <label>Hold action (long press ~500 ms)</label>
          <select id="hold">
            <option value="none"         ${(c.hold || 'none') === 'none'          ? 'selected' : ''}>None</option>
            <option value="cancel"       ${c.hold === 'cancel'                    ? 'selected' : ''}>Cancel timer</option>
            <option value="toggle_pause" ${c.hold === 'toggle_pause'              ? 'selected' : ''}>Pause / Resume</option>
          </select>
        </div>
        <div class="field">
          <label>Cancel badge label</label>
          <input type="text" id="cancel_label" value="${c.cancel_label || ''}" placeholder="Cancel" />
        </div>

        <hr class="divider" />
        <p class="note">For multiple timers in one card, use the <strong>entities</strong> list in YAML.</p>

      </div>
    `;

    // Text / color / number / select fields
    ['entity', 'name', 'icon', 'color', 'cancel_label', 'bar_height',
     'bar_direction', 'bar_position', 'warning_color', 'critical_color', 'tap', 'hold'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._valueChanged());
    });

    // Checkboxes
    ['show_when_idle', 'show_duration', 'gradient_bar', 'pulse_icon',
     'warning_enabled', 'critical_enabled'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._valueChanged());
    });

    // Range sliders — live label update + fire on release
    const wSlider = this.shadowRoot.getElementById('warning_threshold');
    const wDisplay = this.shadowRoot.getElementById('wt_display');
    if (wSlider) {
      wSlider.addEventListener('input', () => { if (wDisplay) wDisplay.textContent = wSlider.value + '%'; });
      wSlider.addEventListener('change', () => this._valueChanged());
    }
    const cSlider = this.shadowRoot.getElementById('critical_threshold');
    const cDisplay = this.shadowRoot.getElementById('ct_display');
    if (cSlider) {
      cSlider.addEventListener('input', () => { if (cDisplay) cDisplay.textContent = cSlider.value + '%'; });
      cSlider.addEventListener('change', () => this._valueChanged());
    }
  }

  _valueChanged() {
    const get = (id) => this.shadowRoot.getElementById(id);
    const newConfig = { ...this._config };

    newConfig.entity = get('entity').value;

    const name = get('name').value;
    if (name) newConfig.name = name; else delete newConfig.name;

    const icon = get('icon').value;
    if (icon) newConfig.icon = icon; else delete newConfig.icon;

    newConfig.color = get('color').value;
    newConfig.show_when_idle = get('show_when_idle').checked;
    newConfig.show_duration = get('show_duration').checked;
    newConfig.gradient_bar = get('gradient_bar').checked;
    newConfig.pulse_icon = get('pulse_icon').checked;
    newConfig.bar_height = parseInt(get('bar_height').value, 10) || 3;
    newConfig.bar_direction = get('bar_direction').value;
    newConfig.bar_position = get('bar_position').value;
    newConfig.tap  = get('tap').value;
    newConfig.hold = get('hold').value;

    const cancelLabel = get('cancel_label').value;
    if (cancelLabel) newConfig.cancel_label = cancelLabel; else delete newConfig.cancel_label;

    if (get('warning_enabled').checked) {
      newConfig.warning_color = get('warning_color').value;
      newConfig.warning_threshold = parseInt(get('warning_threshold').value, 10);
    } else {
      delete newConfig.warning_color;
      delete newConfig.warning_threshold;
    }

    if (get('critical_enabled').checked) {
      newConfig.critical_color = get('critical_color').value;
      newConfig.critical_threshold = parseInt(get('critical_threshold').value, 10);
    } else {
      delete newConfig.critical_color;
      delete newConfig.critical_threshold;
    }

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('compact-timer-card-editor', CompactTimerCardEditor);

// ============================================================
//  Main Card
// ============================================================

class CompactTimerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval = null;
    this._config = {};
    this._hass = null;
    this._initialized = false;
    this._lastZones = null;

    // Stop propagation so HA's card wrapper doesn't handle our clicks.
    // The actual tap action is handled by a delegated listener added in _build().
    this.addEventListener('click', (e) => e.stopPropagation());
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
      tap: 'cancel',
      hold: 'none',
      cancel_label: 'Cancel',
      show_duration: false,
      show_when_idle: false,
      gradient_bar: true,
      pulse_icon: true,
      bar_height: 3,
      bar_direction: 'ltr',
      bar_position: 'bottom',
    };
  }

  setConfig(config) {
    const hasEntity = config.entity;
    const hasEntities = Array.isArray(config.entities) && config.entities.length > 0;
    if (!hasEntity && !hasEntities) throw new Error('entity or entities is required');

    this._config = {
      icon: 'mdi:timer-outline',
      color: '#63b3ed',
      tap: 'cancel',
      hold: 'none',
      cancel_label: 'Cancel',
      show_duration: false,
      show_when_idle: false,
      gradient_bar: true,
      pulse_icon: true,
      bar_height: 3,
      bar_direction: 'ltr',
      bar_position: 'bottom',
      tap_action: null,
      ...config,
    };
    this._initialized = false;
    this._lastZones = null;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    const newZones = this._getCurrentZones();

    if (!this._initialized || newZones !== this._lastZones) {
      this._lastZones = newZones;
      this._build();
    } else {
      this._tick();
    }

    // Run interval only while at least one timer is active
    const hasActive = this._normalizeEntities()
      .some(ec => this._getTimerData(ec.entity)?.isActive);
    if (hasActive) this._startInterval(); else this._stopInterval();
  }

  connectedCallback() { if (this._hass) this._startInterval(); }
  disconnectedCallback() { this._stopInterval(); }

  // ── Interval ───────────────────────────────────────────────

  _startInterval() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), 1000);
  }

  _stopInterval() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  // ── Action resolution (backward compat with cancel_on_tap) ─

  _getTapAction() {
    if (this._config.tap) return this._config.tap;
    // Legacy: cancel_on_tap
    return this._config.cancel_on_tap !== false ? 'cancel' : 'none';
  }

  _getHoldAction() {
    return this._config.hold || 'none';
  }

  _executeTimerAction(action, entityId) {
    if (!this._hass || !entityId || action === 'none') return;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return;

    if (action === 'cancel') {
      if (stateObj.state === 'active' || stateObj.state === 'paused') {
        this._hass.callService('timer', 'cancel', { entity_id: entityId });
      }
    } else if (action === 'toggle_pause') {
      if (stateObj.state === 'active') {
        this._hass.callService('timer', 'pause', { entity_id: entityId });
      } else if (stateObj.state === 'paused') {
        this._hass.callService('timer', 'start', { entity_id: entityId });
      }
    } else if (action === 'more_info') {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles: true, composed: true,
        detail: { entityId },
      }));
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  _rgba(hex, a) {
    const h = (hex || '#63b3ed').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  _parseTimeSec(str) {
    if (!str) return 0;
    const p = str.split(':').map(Number);
    if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
    if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0);
    return 0;
  }

  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // ── Entity normalization ────────────────────────────────────

  _normalizeEntities() {
    if (Array.isArray(this._config.entities) && this._config.entities.length > 0) {
      return this._config.entities.map(e => ({
        // Global defaults that entity config can override
        icon: this._config.icon,
        color: this._config.color,
        warning_color: this._config.warning_color,
        warning_threshold: this._config.warning_threshold,
        critical_color: this._config.critical_color,
        critical_threshold: this._config.critical_threshold,
        ...e,
      }));
    }
    return [{
      entity: this._config.entity,
      name: this._config.name,
      icon: this._config.icon,
      color: this._config.color,
      warning_color: this._config.warning_color,
      warning_threshold: this._config.warning_threshold,
      critical_color: this._config.critical_color,
      critical_threshold: this._config.critical_threshold,
    }];
  }

  // ── Timer data ─────────────────────────────────────────────

  _getTimerData(entityId) {
    if (!this._hass || !entityId) return null;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) {
      return { state: 'unknown', pct: 0, timeStr: '–', totalStr: null,
               isActive: false, isPaused: false, isIdle: false };
    }

    const state = stateObj.state;
    const attrs = stateObj.attributes;
    const durationSec = this._parseTimeSec(attrs.duration || '0:00:00');
    const totalStr = this._config.show_duration && durationSec > 0
      ? this._formatTime(durationSec) : null;

    if (state === 'active') {
      let remainingSec = 0;
      if (attrs.finishes_at) {
        remainingSec = Math.max(0, (new Date(attrs.finishes_at) - new Date()) / 1000);
      }
      const pct = durationSec > 0
        ? Math.min(100, ((durationSec - remainingSec) / durationSec) * 100) : 0;
      return { state, pct, timeStr: this._formatTime(remainingSec), totalStr,
               isActive: true, isPaused: false, isIdle: false };
    }

    if (state === 'paused') {
      const remainingSec = this._parseTimeSec(attrs.remaining || '0:00:00');
      const pct = durationSec > 0
        ? Math.min(100, ((durationSec - remainingSec) / durationSec) * 100) : 0;
      return { state, pct, timeStr: this._formatTime(remainingSec), totalStr,
               isActive: false, isPaused: true, isIdle: false };
    }

    const idleStr = durationSec > 0 ? this._formatTime(durationSec) : '0:00';
    return { state, pct: 0, timeStr: idleStr, totalStr,
             isActive: false, isPaused: false, isIdle: true };
  }

  // ── Warning color thresholds ───────────────────────────────

  _getThresholdZone(data, entityCfg) {
    if (!data?.isActive) return 'normal';
    const pctRemaining = 100 - data.pct;
    const critThresh = entityCfg.critical_threshold ?? 5;
    const warnThresh = entityCfg.warning_threshold ?? 20;
    if (entityCfg.critical_color && pctRemaining <= critThresh) return 'critical';
    if (entityCfg.warning_color && pctRemaining <= warnThresh) return 'warning';
    return 'normal';
  }

  _getActiveColor(data, entityCfg) {
    const zone = this._getThresholdZone(data, entityCfg);
    if (zone === 'critical') return entityCfg.critical_color;
    if (zone === 'warning') return entityCfg.warning_color;
    return entityCfg.color || '#63b3ed';
  }

  _getCurrentZones() {
    const zones = {};
    for (const ec of this._normalizeEntities()) {
      const data = this._getTimerData(ec.entity);
      zones[ec.entity] = `${data?.state}|${this._getThresholdZone(data, ec)}`;
    }
    return JSON.stringify(zones);
  }

  // ── Tap / Hold handling ────────────────────────────────────

  _handleTapForEntity(entityId) {
    if (!this._hass || !entityId) return;

    // Advanced tap_action object (YAML) takes priority over simple 'tap' string
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
          detail: { entityId },
        }));
      }
      return;
    }

    this._executeTimerAction(this._getTapAction(), entityId);
  }

  _handleHoldForEntity(entityId) {
    this._executeTimerAction(this._getHoldAction(), entityId);
  }

  // ── Build DOM ──────────────────────────────────────────────

  _buildTimerRowHtml(entityCfg, data) {
    const entityId = entityCfg.entity;
    const stateObj = this._hass && this._hass.states[entityId];
    const name = entityCfg.name
      || stateObj?.attributes.friendly_name
      || entityId;

    const color = this._getActiveColor(data, entityCfg);
    const baseColor = entityCfg.color || '#63b3ed';
    const ca = (a) => this._rgba(color, a);
    const baseCa = (a) => this._rgba(baseColor, a);

    const isActive = data.isActive;
    const isPaused = data.isPaused;
    const isUnknown = data.state === 'unknown';
    const tapAction = this._getTapAction();
    const doPulse = this._config.pulse_icon !== false && isActive;
    const isRTL = this._config.bar_direction === 'rtl';
    const isBarTop = this._config.bar_position === 'top';
    const barHeight = Math.max(1, parseInt(this._config.bar_height, 10) || 3);

    const timeColor = isActive ? color : ca(0.45);
    const barOpacity = isPaused ? '0.45' : '1';
    const barWidth = isRTL ? (100 - data.pct) : data.pct;

    const gradientBar = this._config.gradient_bar !== false;
    const barBg = gradientBar
      ? (isRTL
        ? `linear-gradient(90deg, ${color} 0%, ${ca(0.55)} 100%)`
        : `linear-gradient(90deg, ${ca(0.55)} 0%, ${color} 100%)`)
      : color;

    let statusBadge = '';
    if (isUnknown) {
      statusBadge = `<span class="s-badge s-error">!</span>`;
    } else if (isPaused) {
      if (tapAction === 'toggle_pause') {
        statusBadge = `<span class="s-cancel">&#x25B6; Resume</span>`;
      } else {
        statusBadge = `<span class="s-badge" style="color:${ca(0.7)};border-color:${ca(0.3)};">&#x23F8; Paused</span>`;
      }
    } else if (isActive) {
      if (tapAction === 'toggle_pause') {
        statusBadge = `<span class="s-cancel">&#x23F8; Pause</span>`;
      } else if (tapAction === 'cancel' && !this._config.tap_action) {
        statusBadge = `<span class="s-cancel">${this._config.cancel_label || 'Cancel'}</span>`;
      }
    }

    const totalHtml = data.totalStr
      ? `<span class="time-total" data-t="${entityId}">/ ${data.totalStr}</span>` : '';

    const barMargin = isBarTop ? 'margin:0 0 6px 0' : 'margin:6px 0 0 0';

    const barHtml = `
      <div class="bar-wrap${isRTL ? ' bar-rtl' : ''}"
           style="${barMargin};height:${barHeight}px;border-radius:${barHeight}px;background:${baseCa(0.12)};">
        <div class="bar-fill" data-b="${entityId}"
             style="width:${barWidth}%;background:${barBg};border-radius:${barHeight}px;
                    box-shadow:0 0 ${barHeight * 2}px ${ca(0.55)};opacity:${barOpacity};"></div>
      </div>`;

    const rowHtml = `
      <div class="info-row">
        <div class="left">
          <ha-icon icon="${entityCfg.icon || 'mdi:timer-outline'}"
            style="color:${ca(isActive ? 0.8 : 0.45)};${doPulse ? 'animation:pulse-icon 2s ease-in-out infinite;' : ''}"></ha-icon>
          <span class="label">${name}</span>
        </div>
        <div class="right">
          <span class="time" data-d="${entityId}" style="color:${timeColor};">${data.timeStr}</span>
          ${totalHtml}
          ${statusBadge}
        </div>
      </div>`;

    const content = isBarTop ? `${barHtml}${rowHtml}` : `${rowHtml}${barHtml}`;
    return `<div class="timer-row" data-entity="${entityId}">${content}</div>`;
  }

  _build() {
    const entities = this._normalizeEntities();
    const entityData = entities.map(ec => ({
      cfg: ec,
      data: this._getTimerData(ec.entity),
    }));

    const visible = entityData.filter(({ data }) =>
      this._config.show_when_idle || !data.isIdle
    );

    if (visible.length === 0) {
      this.shadowRoot.innerHTML = '<style>:host { display: none !important; }</style>';
      this._initialized = true;
      this._stopInterval();
      return;
    }

    this.style.display = '';

    const firstCfg = visible[0].cfg;
    const firstData = visible[0].data;
    const accentColor = this._getActiveColor(firstData, firstCfg);
    const cardCa = (a) => this._rgba(accentColor, a);

    const rowsHtml = visible.map(({ cfg, data }, i) => {
      const row = this._buildTimerRowHtml(cfg, data);
      return i < visible.length - 1 ? `${row}<div class="row-sep"></div>` : row;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .card {
          background: ${cardCa(0.05)};
          border: 1px solid ${cardCa(0.18)};
          border-radius: 14px;
          padding: 10px 14px;
          transition: background 0.12s ease;
        }
        .timer-row {
          cursor: pointer;
          pointer-events: auto;
          border-radius: 6px;
          transition: opacity 0.1s ease, transform 0.1s ease;
        }
        .timer-row:active {
          opacity: 0.75;
          transform: scale(0.99);
        }
        .info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          pointer-events: none;
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
          --mdc-icon-size: 15px;
          flex-shrink: 0;
          pointer-events: none;
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
          pointer-events: none;
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
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
          pointer-events: none;
        }
        .time-total {
          font-size: 11px;
          font-weight: 500;
          color: var(--secondary-text-color, rgba(255,255,255,0.28));
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
          pointer-events: none;
        }
        .time-total {
          font-size: 11px;
          font-weight: 500;
          color: var(--secondary-text-color, rgba(255,255,255,0.28));
          font-variant-numeric: tabular-nums;
          font-family: sans-serif;
          line-height: 1;
          pointer-events: none;
        }
        .s-cancel {
          font-size: 9px;
          color: var(--secondary-text-color, rgba(255,255,255,0.22));
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          line-height: 1.6;
          white-space: nowrap;
          pointer-events: none;
        }
        .s-badge {
          font-size: 9px;
          border: 1px solid;
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          line-height: 1.6;
          white-space: nowrap;
          pointer-events: none;
        }
        .s-error {
          color: var(--error-color, #f87171) !important;
          border-color: var(--error-color, #f87171) !important;
          font-weight: 700;
        }
        .bar-wrap {
          width: 100%;
          overflow: hidden;
          pointer-events: none;
        }
        .bar-wrap.bar-rtl {
          display: flex;
          flex-direction: row-reverse;
        }
        .bar-fill {
          height: 100%;
          width: 0%;
          transition: width 0.9s linear;
          pointer-events: none;
        }
        .row-sep {
          height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.08));
          margin: 8px 0;
          pointer-events: none;
        }
      </style>
      <div class="card">${rowsHtml}</div>
    `;

    const cardEl = this.shadowRoot.querySelector('.card');
    if (cardEl) {
      let holdTimer = null;
      let holdFired = false;

      const startHold = (entityId) => {
        holdFired = false;
        holdTimer = setTimeout(() => {
          holdFired = true;
          this._handleHoldForEntity(entityId);
          navigator.vibrate?.(40);
        }, 500);
      };

      const cancelHold = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      };

      cardEl.addEventListener('mousedown', (e) => {
        const row = e.target.closest('[data-entity]');
        if (row) startHold(row.dataset.entity);
      });
      cardEl.addEventListener('mouseup', cancelHold);
      cardEl.addEventListener('mouseleave', cancelHold);

      cardEl.addEventListener('touchstart', (e) => {
        const row = e.target.closest('[data-entity]');
        if (row) startHold(row.dataset.entity);
      }, { passive: true });
      cardEl.addEventListener('touchend', cancelHold);
      cardEl.addEventListener('touchmove', cancelHold, { passive: true });

      cardEl.addEventListener('click', (e) => {
        if (holdFired) { holdFired = false; return; }
        const row = e.target.closest('[data-entity]');
        if (row) this._handleTapForEntity(row.dataset.entity);
      });
    }

    this._initialized = true;
  }

  // Tick -- updates only changing values each second

  _tick() {
    if (!this._initialized) return;

    for (const ec of this._normalizeEntities()) {
      const data = this._getTimerData(ec.entity);
      if (!data?.isActive) continue;

      const eid = ec.entity;
      const isRTL = this._config.bar_direction === 'rtl';
      const barWidth = isRTL ? (100 - data.pct) : data.pct;

      const timeEl = this.shadowRoot.querySelector(`[data-d="${eid}"]`);
      const barEl  = this.shadowRoot.querySelector(`[data-b="${eid}"]`);
      const totEl  = this.shadowRoot.querySelector(`[data-t="${eid}"]`);

      if (timeEl) timeEl.textContent = data.timeStr;
      if (barEl)  barEl.style.width = `${barWidth}%`;
      if (totEl && data.totalStr) totEl.textContent = `/ ${data.totalStr}`;
    }
  }

  getCardSize() {
    return Math.max(1, this._normalizeEntities().length);
  }
}

customElements.define('compact-timer-card', CompactTimerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'compact-timer-card',
  name: 'Compact Timer Card',
  description: 'Sleek timer card with live countdown, warning colors, configurable bar, pause support, and multi-timer stacked mode.',
  preview: false,
});
