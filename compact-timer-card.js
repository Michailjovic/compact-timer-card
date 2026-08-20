/**
 * Compact Timer Card
 * A sleek, fully customizable timer card for Home Assistant
 * with live countdown, warning/critical color zones, configurable progress bar,
 * stacked multi-timer mode, timestamp-sensor countdowns, preset start buttons,
 * extend buttons, and a built-in visual editor.
 *
 * https://github.com/Michailjovic/compact-timer-card
 * @version 1.4.0
 */

const CARD_VERSION = '1.4.0';
const DEFAULT_COLOR = '#63b3ed';
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FINISHED_MS = 5000;
const HOLD_MS = 500;
const SKEW_MIN_MS = 1500;      // below this a difference is just network jitter
const SKEW_MAX_MS = 21600000;  // 6 h — beyond this the reading is bogus, ignore it

const STRINGS = {
  en: { cancel: 'Cancel', pause: 'Pause', resume: 'Resume', paused: 'Paused', done: 'Done' },
  cs: { cancel: 'Zrušit', pause: 'Pauza', resume: 'Pokračovat', paused: 'Pozastaveno', done: 'Hotovo' },
  sk: { cancel: 'Zrušiť', pause: 'Pauza', resume: 'Pokračovať', paused: 'Pozastavené', done: 'Hotovo' },
  de: { cancel: 'Abbrechen', pause: 'Pause', resume: 'Fortsetzen', paused: 'Pausiert', done: 'Fertig' },
  fr: { cancel: 'Annuler', pause: 'Pause', resume: 'Reprendre', paused: 'En pause', done: 'Terminé' },
  es: { cancel: 'Cancelar', pause: 'Pausa', resume: 'Reanudar', paused: 'En pausa', done: 'Listo' },
  it: { cancel: 'Annulla', pause: 'Pausa', resume: 'Riprendi', paused: 'In pausa', done: 'Fatto' },
  nl: { cancel: 'Annuleren', pause: 'Pauze', resume: 'Hervatten', paused: 'Gepauzeerd', done: 'Klaar' },
  pl: { cancel: 'Anuluj', pause: 'Pauza', resume: 'Wznów', paused: 'Wstrzymany', done: 'Gotowe' },
};

/** Escape user-provided strings before inserting into HTML. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** Only allow safe #rgb / #rrggbb values into generated CSS. */
function safeColor(c, fallback = DEFAULT_COLOR) {
  return COLOR_RE.test(c || '') ? c : fallback;
}

/** Parse "H:MM:SS", "MM:SS" or a plain number of seconds. */
function parseTimeSec(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.max(0, v);
  const p = String(v).split(':').map(Number);
  if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0);
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Format integer seconds as H:MM:SS or M:SS. */
function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function entityDomain(id) {
  return String(id || '').split('.')[0];
}

/** Short chip label: 90 -> "90m", 120 -> "2h". */
function formatPresetChip(min) {
  return (min >= 60 && min % 60 === 0) ? `${min / 60}h` : `${min}m`;
}

// ── Config validation ────────────────────────────────────────

/** Everything the card understands, plus keys Home Assistant injects itself. */
const KNOWN_KEYS = new Set([
  'type', 'entity', 'entities', 'name', 'icon', 'color',
  'tap', 'hold', 'tap_action',
  'cancel_label', 'pause_label', 'resume_label', 'paused_label', 'finished_label',
  'show_duration', 'show_ends_at', 'show_finished', 'show_when_idle',
  'gradient_bar', 'pulse_icon', 'pulse_bar',
  'bar_height', 'bar_direction', 'bar_position',
  'warning_color', 'warning_threshold', 'warning_threshold_sec',
  'critical_color', 'critical_threshold', 'critical_threshold_sec',
  'extend_buttons', 'presets', 'preset_style', 'preset_position', 'preset_unit',
  'duration', 'use_ha_card',
  // injected by HA / card-mod / layout tooling — not ours to complain about
  'view_layout', 'layout_options', 'grid_options', 'visibility', 'card_mod', 'style',
]);

/** Options removed in an earlier release, with the replacement to point at. */
const REMOVED_KEYS = {
  cancel_on_tap: "removed in 1.3.0 — use tap: cancel / tap: none",
};

/**
 * Warn (once per setConfig) about options the card will silently ignore.
 * Catches both typos and leftovers from older config schemas.
 */
function warnUnknownKeys(config) {
  const bad = [];
  const scan = (obj, prefix) => {
    Object.keys(obj || {}).forEach((k) => {
      if (KNOWN_KEYS.has(k)) return;
      bad.push(REMOVED_KEYS[k] ? `${prefix}${k} (${REMOVED_KEYS[k]})` : `${prefix}${k}`);
    });
  };
  scan(config, '');
  if (Array.isArray(config.entities)) {
    config.entities.forEach((e, i) => {
      if (e && typeof e === 'object') scan(e, `entities[${i}].`);
    });
  }
  if (bad.length) {
    console.warn(
      `[compact-timer-card] Ignoring unknown option(s): ${bad.join(', ')}`,
      '\nSee https://github.com/Michailjovic/compact-timer-card#options');
  }
}

// ── Server clock probe ───────────────────────────────────────

/**
 * One HTTP round trip per page load, shared by every card instance.
 * The `Date` response header is server time; comparing it against the midpoint
 * of the round trip gives the client's clock offset to ~1 s. That is enough,
 * because anything under SKEW_MIN_MS is discarded anyway.
 */
let serverSkewPromise = null;
function probeServerSkew(hass) {
  if (serverSkewPromise) return serverSkewPromise;
  serverSkewPromise = (async () => {
    try {
      if (typeof hass?.fetchWithAuth !== 'function') return 0;
      const t0 = Date.now();
      const res = await hass.fetchWithAuth('/api/', { cache: 'no-store' });
      const t1 = Date.now();
      const server = Date.parse(res?.headers?.get('date') || '');
      if (!Number.isFinite(server)) return 0;
      const off = server - (t0 + (t1 - t0) / 2);
      return (Math.abs(off) > SKEW_MIN_MS && Math.abs(off) < SKEW_MAX_MS) ? off : 0;
    } catch (e) {
      return 0;
    }
  })();
  return serverSkewPromise;
}

// ============================================================
//  Visual Editor
// ============================================================

class CompactTimerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._populateEntityList();
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _populateEntityList() {
    const dl = this.shadowRoot && this.shadowRoot.getElementById('ctc-entities');
    if (!dl || !this._hass || dl.childElementCount > 0) return;
    const ids = Object.keys(this._hass.states).filter((id) =>
      id.startsWith('timer.') ||
      (id.startsWith('sensor.') &&
        this._hass.states[id].attributes.device_class === 'timestamp'));
    dl.innerHTML = ids.sort().map((id) => `<option value="${esc(id)}"></option>`).join('');
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
          border: 1px solid var(--divider-color, rgba(127,127,127,0.25));
          background: var(--secondary-background-color, rgba(127,127,127,0.08));
          color: var(--primary-text-color); font-size: 14px; box-sizing: border-box;
        }
        .field input[type="color"] {
          width: 100%; height: 38px; padding: 3px 6px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--divider-color, rgba(127,127,127,0.25));
          background: var(--secondary-background-color, rgba(127,127,127,0.08));
          box-sizing: border-box;
        }
        .check-field { display: flex; align-items: center; gap: 10px; }
        .check-field label { font-size: 13px; color: var(--primary-text-color); cursor: pointer; user-select: none; }
        .check-field input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary-color, ${DEFAULT_COLOR}); }
        .divider { border: none; border-top: 1px solid var(--divider-color, rgba(127,127,127,0.2)); margin: 0; }
        .threshold-block { padding-left: 26px; display: flex; flex-direction: column; gap: 6px; }
        .threshold-block label { font-size: 12px; color: var(--secondary-text-color); }
        .slider-row { display: flex; align-items: center; gap: 10px; }
        .slider-row input[type="range"] { flex: 1; accent-color: var(--primary-color, ${DEFAULT_COLOR}); }
        .slider-row .val { font-size: 13px; font-weight: 700; color: var(--primary-text-color);
                           min-width: 36px; text-align: right; }
        .note { font-size: 11px; color: var(--secondary-text-color); font-style: italic; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      </style>
      <div class="form">

        <h4>Basic</h4>
        <div class="field">
          <label>Entity (required) — timer or timestamp sensor</label>
          <input type="text" id="entity" list="ctc-entities" value="${esc(c.entity || '')}" placeholder="timer.example" />
          <datalist id="ctc-entities"></datalist>
        </div>
        <div class="field">
          <label>Name (leave empty to use friendly name)</label>
          <input type="text" id="name" value="${esc(c.name || '')}" placeholder="My Timer" />
        </div>
        <div class="field">
          <label>Icon</label>
          <input type="text" id="icon" value="${esc(c.icon || '')}" placeholder="mdi:timer-outline" />
        </div>
        <div class="field">
          <label>Accent color</label>
          <input type="color" id="color" value="${safeColor(c.color)}" />
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
          <input type="checkbox" id="show_ends_at" ${c.show_ends_at ? 'checked' : ''} />
          <label for="show_ends_at">Show end time (&rarr; 23:45)</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="show_finished" ${c.show_finished !== false ? 'checked' : ''} />
          <label for="show_finished">Flash "Done" badge when timer finishes</label>
        </div>
        <div class="field">
          <label>Finished badge text (empty = auto by language)</label>
          <input type="text" id="finished_label" value="${esc(c.finished_label || '')}" placeholder="Done" />
        </div>
        <div class="check-field">
          <input type="checkbox" id="gradient_bar" ${c.gradient_bar !== false ? 'checked' : ''} />
          <label for="gradient_bar">Gradient progress bar</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="pulse_icon" ${c.pulse_icon !== false ? 'checked' : ''} />
          <label for="pulse_icon">Pulse icon when active</label>
        </div>
        <div class="check-field">
          <input type="checkbox" id="use_ha_card" ${c.use_ha_card ? 'checked' : ''} />
          <label for="use_ha_card">Use theme card background (ha-card)</label>
        </div>
        <div class="field">
          <label>Progress bar height (px)</label>
          <input type="number" id="bar_height" value="${c.bar_height ?? 3}" min="1" max="20" step="1" />
        </div>
        <div class="field">
          <label>Progress bar direction</label>
          <select id="bar_direction">
            <option value="ltr" ${(c.bar_direction || 'ltr') === 'ltr' ? 'selected' : ''}>&rarr; Fill (shows elapsed time)</option>
            <option value="rtl" ${c.bar_direction === 'rtl' ? 'selected' : ''}>&larr; Empty (shows remaining time)</option>
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
        <p class="note">Thresholds are % of time <strong>remaining</strong> and/or absolute seconds. Colors switch automatically.</p>

        <div class="check-field">
          <input type="checkbox" id="warning_enabled" ${c.warning_color ? 'checked' : ''} />
          <label for="warning_enabled">Warning color</label>
        </div>
        <div class="threshold-block">
          <div class="field">
            <input type="color" id="warning_color" value="${safeColor(c.warning_color, '#f6ad55')}" />
          </div>
          <label>Activate when this much time remains:</label>
          <div class="slider-row">
            <input type="range" id="warning_threshold" min="5" max="50" step="5" value="${wt}" />
            <span class="val" id="wt_display">${wt}%</span>
          </div>
          <label>…or when fewer than N seconds remain (empty = off):</label>
          <input type="number" id="warning_threshold_sec" min="1" step="1"
                 value="${c.warning_threshold_sec ?? ''}" placeholder="e.g. 300" />
        </div>

        <div class="check-field">
          <input type="checkbox" id="critical_enabled" ${c.critical_color ? 'checked' : ''} />
          <label for="critical_enabled">Critical color</label>
        </div>
        <div class="threshold-block">
          <div class="field">
            <input type="color" id="critical_color" value="${safeColor(c.critical_color, '#fc8181')}" />
          </div>
          <label>Activate when this much time remains:</label>
          <div class="slider-row">
            <input type="range" id="critical_threshold" min="1" max="25" step="1" value="${ct}" />
            <span class="val" id="ct_display">${ct}%</span>
          </div>
          <label>…or when fewer than N seconds remain (empty = off):</label>
          <input type="number" id="critical_threshold_sec" min="1" step="1"
                 value="${c.critical_threshold_sec ?? ''}" placeholder="e.g. 60" />
        </div>

        <div class="check-field" style="margin-top:4px;">
          <input type="checkbox" id="pulse_bar" ${c.pulse_bar ? 'checked' : ''} />
          <label for="pulse_bar">Pulse bar on warning / critical</label>
        </div>

        <hr class="divider" />
        <h4>Actions</h4>
        <div class="field">
          <label>Tap action</label>
          <select id="tap">
            <option value="cancel"       ${(c.tap || 'cancel') === 'cancel'       ? 'selected' : ''}>Cancel timer</option>
            <option value="toggle_pause" ${c.tap === 'toggle_pause'               ? 'selected' : ''}>Pause / Resume</option>
            <option value="more_info"    ${c.tap === 'more_info'                  ? 'selected' : ''}>More info</option>
            <option value="none"         ${c.tap === 'none'                       ? 'selected' : ''}>None</option>
          </select>
        </div>
        <div class="field">
          <label>Hold action (long press ~500 ms)</label>
          <select id="hold">
            <option value="none"         ${(c.hold || 'none') === 'none'          ? 'selected' : ''}>None</option>
            <option value="cancel"       ${c.hold === 'cancel'                    ? 'selected' : ''}>Cancel timer</option>
            <option value="toggle_pause" ${c.hold === 'toggle_pause'              ? 'selected' : ''}>Pause / Resume</option>
            <option value="more_info"    ${c.hold === 'more_info'                 ? 'selected' : ''}>More info</option>
          </select>
        </div>
        <div class="field">
          <label>Extend buttons — minutes, comma separated (empty = off)</label>
          <input type="text" id="extend_buttons"
                 value="${esc(Array.isArray(c.extend_buttons) ? c.extend_buttons.join(', ') : '')}"
                 placeholder="10, 30, -10" />
        </div>

        <hr class="divider" />
        <h4>Presets</h4>
        <p class="note">Buttons that start the timer with a fixed duration. A row with presets
        stays visible even when the timer is idle, otherwise you could never reach them.</p>
        <div class="field">
          <label>Preset durations — minutes, comma separated (empty = off)</label>
          <input type="text" id="presets"
                 value="${esc(Array.isArray(c.presets) ? c.presets.map((p) => (p && typeof p === 'object' ? p.minutes : p)).join(', ') : '')}"
                 placeholder="30, 60, 120, 240" />
        </div>
        <div class="field">
          <label>Preset style</label>
          <select id="preset_style">
            <option value="buttons" ${(c.preset_style || 'buttons') === 'buttons' ? 'selected' : ''}>Buttons (full-width grid)</option>
            <option value="chips"   ${c.preset_style === 'chips'                  ? 'selected' : ''}>Chips (inline, compact)</option>
          </select>
        </div>
        <div class="field">
          <label>Preset position (buttons style only)</label>
          <select id="preset_position">
            <option value="top"    ${(c.preset_position || 'top') === 'top' ? 'selected' : ''}>Above the timer row</option>
            <option value="bottom" ${c.preset_position === 'bottom'         ? 'selected' : ''}>Below the timer row</option>
          </select>
        </div>
        <div class="field">
          <label>Preset unit label (buttons style only)</label>
          <input type="text" id="preset_unit" value="${esc(c.preset_unit ?? '')}" placeholder="min" />
        </div>

        <hr class="divider" />
        <h4>Labels</h4>
        <p class="note">Badge texts default to your HA language. Override here if needed.</p>
        <div class="two-col">
          <div class="field">
            <label>Cancel badge</label>
            <input type="text" id="cancel_label" value="${esc(c.cancel_label || '')}" placeholder="Cancel" />
          </div>
          <div class="field">
            <label>Paused badge</label>
            <input type="text" id="paused_label" value="${esc(c.paused_label || '')}" placeholder="Paused" />
          </div>
          <div class="field">
            <label>Pause action</label>
            <input type="text" id="pause_label" value="${esc(c.pause_label || '')}" placeholder="Pause" />
          </div>
          <div class="field">
            <label>Resume action</label>
            <input type="text" id="resume_label" value="${esc(c.resume_label || '')}" placeholder="Resume" />
          </div>
        </div>

        <hr class="divider" />
        <p class="note">For multiple timers in one card, use the <strong>entities</strong> list in YAML. Every display option can be overridden per entity.</p>
        <p class="note" style="text-align:right;margin-top:4px;opacity:0.5;">Compact Timer Card v${CARD_VERSION}</p>

      </div>
    `;

    [
      'entity', 'name', 'icon', 'color',
      'cancel_label', 'pause_label', 'resume_label', 'paused_label', 'finished_label',
      'bar_height', 'bar_direction', 'bar_position',
      'warning_color', 'critical_color',
      'warning_threshold_sec', 'critical_threshold_sec',
      'extend_buttons', 'tap', 'hold',
      'presets', 'preset_style', 'preset_position', 'preset_unit',
      'show_when_idle', 'show_duration', 'show_ends_at', 'show_finished',
      'gradient_bar', 'pulse_icon', 'pulse_bar', 'use_ha_card',
      'warning_enabled', 'critical_enabled',
    ].forEach((id) => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._valueChanged());
    });

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

    this._populateEntityList();
  }

  _valueChanged() {
    const get = (id) => this.shadowRoot.getElementById(id);
    const newConfig = { ...this._config };

    const setOrDelete = (key, value) => {
      if (value) newConfig[key] = value; else delete newConfig[key];
    };

    newConfig.entity = get('entity').value;
    setOrDelete('name', get('name').value);
    setOrDelete('icon', get('icon').value);
    newConfig.color = get('color').value;
    newConfig.show_when_idle = get('show_when_idle').checked;
    newConfig.show_duration  = get('show_duration').checked;
    newConfig.show_ends_at   = get('show_ends_at').checked;
    newConfig.show_finished  = get('show_finished').checked;
    newConfig.gradient_bar   = get('gradient_bar').checked;
    newConfig.pulse_icon     = get('pulse_icon').checked;
    newConfig.pulse_bar      = get('pulse_bar').checked;
    newConfig.use_ha_card    = get('use_ha_card').checked;
    newConfig.bar_height     = parseInt(get('bar_height').value, 10) || 3;
    newConfig.bar_direction  = get('bar_direction').value;
    newConfig.bar_position   = get('bar_position').value;
    newConfig.tap            = get('tap').value;
    newConfig.hold           = get('hold').value;

    setOrDelete('cancel_label',   get('cancel_label').value);
    setOrDelete('pause_label',    get('pause_label').value);
    setOrDelete('resume_label',   get('resume_label').value);
    setOrDelete('paused_label',   get('paused_label').value);
    setOrDelete('finished_label', get('finished_label').value);

    const extend = get('extend_buttons').value.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n !== 0);
    if (extend.length > 0) newConfig.extend_buttons = extend;
    else delete newConfig.extend_buttons;

    const presets = get('presets').value.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (presets.length > 0) {
      newConfig.presets = presets;
      newConfig.preset_style = get('preset_style').value;
      newConfig.preset_position = get('preset_position').value;
      setOrDelete('preset_unit', get('preset_unit').value);
    } else {
      delete newConfig.presets;
      delete newConfig.preset_style;
      delete newConfig.preset_position;
      delete newConfig.preset_unit;
    }

    if (get('warning_enabled').checked) {
      newConfig.warning_color     = get('warning_color').value;
      newConfig.warning_threshold = parseInt(get('warning_threshold').value, 10);
      const ws = get('warning_threshold_sec').value;
      if (ws !== '') newConfig.warning_threshold_sec = parseInt(ws, 10);
      else delete newConfig.warning_threshold_sec;
    } else {
      delete newConfig.warning_color;
      delete newConfig.warning_threshold;
      delete newConfig.warning_threshold_sec;
    }

    if (get('critical_enabled').checked) {
      newConfig.critical_color     = get('critical_color').value;
      newConfig.critical_threshold = parseInt(get('critical_threshold').value, 10);
      const cs = get('critical_threshold_sec').value;
      if (cs !== '') newConfig.critical_threshold_sec = parseInt(cs, 10);
      else delete newConfig.critical_threshold_sec;
    } else {
      delete newConfig.critical_color;
      delete newConfig.critical_threshold;
      delete newConfig.critical_threshold_sec;
    }

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get('compact-timer-card-editor')) {
  customElements.define('compact-timer-card-editor', CompactTimerCardEditor);
}

// ============================================================
//  Main Card
// ============================================================

class CompactTimerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval      = null;
    this._config        = {};
    this._hass          = null;
    this._entities      = [];
    this._initialized   = false;
    this._structKey     = null;
    this._rowRefs       = [];
    this._skew          = 0;          // serverTime - clientTime (ms)
    this._skewFromState = false;      // a live state update beats the HTTP probe
    this._lastRemaining = {};         // entityId -> last seen remaining (s)
    this._finished      = {};         // entityId -> finished-badge expiry (ms)
    this._holdTimer     = null;
    this._holdReset     = null;
    this._holdFired     = false;
    this._timeFmt       = null;
    this._timeFmtLang   = null;
    this._onVisibility  = () => { if (!document.hidden) this._tick(); };

    this.addEventListener('click', (e) => e.stopPropagation());
  }

  static getConfigElement() {
    return document.createElement('compact-timer-card-editor');
  }

  /**
   * Pick a real timer from the user's instance so the card-picker preview shows
   * a working card instead of the "!" error badge for a non-existent entity.
   */
  static getStubConfig(hass, entities, entitiesFallback) {
    const isTimer = (id) => String(id).startsWith('timer.');
    const entity =
      (entities || []).find(isTimer) ||
      (entitiesFallback || []).find(isTimer) ||
      (hass && hass.states ? Object.keys(hass.states).find(isTimer) : null) ||
      'timer.example';
    return {
      entity,
      icon: 'mdi:timer-outline',
      color: DEFAULT_COLOR,
      tap: 'cancel',
      hold: 'none',
      show_duration: false,
      show_when_idle: true,   // the preview would otherwise be an empty card
      gradient_bar: true,
      pulse_icon: true,
      pulse_bar: false,
      bar_height: 3,
      bar_direction: 'ltr',
      bar_position: 'bottom',
    };
  }

  setConfig(config) {
    const hasEntity   = config.entity;
    const hasEntities = Array.isArray(config.entities) && config.entities.length > 0;
    if (!hasEntity && !hasEntities) throw new Error('entity or entities is required');
    warnUnknownKeys(config);

    this._config = {
      icon: 'mdi:timer-outline',
      color: DEFAULT_COLOR,
      tap: 'cancel',
      hold: 'none',
      show_duration: false,
      show_when_idle: false,
      show_ends_at: false,
      show_finished: true,
      gradient_bar: true,
      pulse_icon: true,
      pulse_bar: false,
      bar_height: 3,
      bar_direction: 'ltr',
      bar_position: 'bottom',
      preset_style: 'buttons',
      preset_position: 'top',
      preset_unit: 'min',
      use_ha_card: false,
      tap_action: null,
      ...config,
    };
    this._entities    = this._normalizeEntities();
    this._initialized = false;
    this._structKey   = null;
    this._finished    = {};
    this._build();
    this._syncInterval();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;

    if (!old) {
      // A timer that was already running when the card loaded never produces a
      // state transition to calibrate against, so ask the server for its clock.
      probeServerSkew(hass).then((off) => {
        if (off && !this._skewFromState && this._hass) {
          this._skew = off;
          this._refresh();
        }
      });
    }

    if (!this._initialized || !old) {
      this._refresh();
      return;
    }

    // Unrelated entity updates: nothing to do — the interval handles ticking.
    const changed = this._entities.some(
      (ec) => old.states[ec.entity] !== hass.states[ec.entity]);
    if (!changed) return;

    for (const ec of this._entities) {
      const os = old.states[ec.entity];
      const ns = hass.states[ec.entity];
      if (!os || !ns || os === ns) continue;

      // Any freshly arrived state carries a server timestamp of ~now, which is
      // the most accurate clock-skew sample available to the frontend.
      const off = Date.parse(ns.last_updated) - Date.now();
      if (Number.isFinite(off) && Math.abs(off) < SKEW_MAX_MS) {
        this._skew = Math.abs(off) > SKEW_MIN_MS ? off : 0;
        this._skewFromState = true;
      }

      if (ns.state === 'active' && os.state !== 'active') {
        delete this._finished[ec.entity];
      }

      // Natural finish backup detection (e.g. throttled background tab):
      // active -> idle with (almost) nothing remaining means it finished, not cancelled.
      if (os.state === 'active' && ns.state === 'idle' && ec.show_finished !== false) {
        const lr = this._lastRemaining[ec.entity];
        if (lr != null && lr <= 1.5) this._markFinished(ec.entity);
      }
    }

    this._refresh();
  }

  connectedCallback() {
    document.addEventListener('visibilitychange', this._onVisibility);
    if (this._hass) this._refresh();
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._stopInterval();
    clearTimeout(this._holdTimer);
    clearTimeout(this._holdReset);
  }

  // ── Refresh / structure ────────────────────────────────────

  /** Rebuild only when row structure changed; otherwise patch in place. */
  _refresh() {
    const key = this._structKey === null ? null : this._computeStructKey();
    if (!this._initialized || key === null || key !== this._structKey) {
      this._build();
    } else {
      this._applyZones();
      this._tick();
    }
    this._syncInterval();
  }

  _computeStructKey() {
    return this._entities.map((ec) => {
      const data = this._getTimerData(ec);
      const fin = this._isFinished(ec.entity) && !data.isActive ? 1 : 0;
      return `${data.state}|${this._isVisible(ec, data) ? 1 : 0}|${fin}`;
    }).join(';');
  }

  _isVisible(ec, data) {
    if (data.isError) return true;
    // Presets are the way to *start* the timer, so hiding the row while idle
    // would put them permanently out of reach. They win over show_when_idle.
    if (this._presetList(ec).length > 0) return true;
    if (this._isFinished(ec.entity) && ec.show_finished !== false) return true;
    return ec.show_when_idle ? true : !data.isIdle;
  }

  // ── Presets ────────────────────────────────────────────────

  /** Normalize `presets:` to [{min, label}] — accepts numbers or {minutes, label}. */
  _presetList(ec) {
    if (entityDomain(ec.entity) !== 'timer') return [];
    if (!Array.isArray(ec.presets)) return [];
    return ec.presets.map((p) => {
      const isObj = p !== null && typeof p === 'object';
      const min = Number(isObj ? (p.minutes ?? p.min) : p);
      if (!Number.isFinite(min) || min <= 0) return null;
      return { min, label: isObj && p.label ? String(p.label) : null };
    }).filter(Boolean);
  }

  _presetsHtml(ec, style) {
    const list = this._presetList(ec);
    if (!list.length) return '';
    const entityId = ec.entity;
    const btn = (p, cls, inner) =>
      `<button class="${cls}" type="button" data-preset="${p.min * 60}"
               data-target="${esc(entityId)}"
               aria-label="${esc(p.label || `${p.min} min`)}">${inner}</button>`;

    if (style === 'chips') {
      return list.map((p) =>
        btn(p, 'chip preset-chip', esc(p.label || formatPresetChip(p.min)))).join('');
    }
    const unit = ec.preset_unit ?? 'min';
    const cells = list.map((p) => btn(p, 'preset-btn',
      `<span class="preset-num">${esc(p.label || p.min)}</span>` +
      (p.label || !unit ? '' : `<span class="preset-unit">${esc(unit)}</span>`))).join('');
    const pos = ec.preset_position === 'bottom' ? 'bottom' : 'top';
    return `<div class="preset-grid ${pos}"
                 style="grid-template-columns:repeat(${list.length},1fr);">${cells}</div>`;
  }

  /** Start (or restart) a timer with a preset duration. */
  _startPreset(entityId, seconds) {
    if (!this._hass || !entityId || !Number.isFinite(seconds) || seconds <= 0) return;
    if (entityDomain(entityId) !== 'timer') return;
    this._hass.callService('timer', 'start', { entity_id: entityId, duration: seconds });
    this._haptic();
  }

  _haptic() {
    this.dispatchEvent(new CustomEvent('haptic', {
      bubbles: true, composed: true, detail: 'light',
    }));
  }

  // ── Interval ───────────────────────────────────────────────

  _syncInterval() {
    const anyActive = this._entities.some((ec) => this._getTimerData(ec).isActive);
    const anyFinished = Object.keys(this._finished).length > 0;
    if (anyActive || anyFinished) this._startInterval();
    else this._stopInterval();
  }

  _startInterval() {
    if (this._interval) return;
    // 250 ms keeps the ceil()-based countdown flip accurate; DOM is only
    // touched when a rendered value actually changes.
    this._interval = setInterval(() => this._tick(), 250);
  }

  _stopInterval() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  // ── Localization ───────────────────────────────────────────

  _t(key) {
    const lang = (this._hass?.locale?.language || this._hass?.language || 'en')
      .split('-')[0].toLowerCase();
    return (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
  }

  _formatClock(ms) {
    const lang = this._hass?.locale?.language || this._hass?.language || undefined;
    if (!this._timeFmt || this._timeFmtLang !== lang) {
      try {
        this._timeFmt = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        this._timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
      }
      this._timeFmtLang = lang;
    }
    return this._timeFmt.format(new Date(ms));
  }

  // ── Actions ────────────────────────────────────────────────

  /** Effective tap action for one row; non-timer entities fall back to more_info. */
  _effectiveTap(ec) {
    let a = ec.tap || 'cancel';
    if (entityDomain(ec.entity) !== 'timer' && (a === 'cancel' || a === 'toggle_pause')) {
      a = 'more_info';
    }
    return a;
  }

  _effectiveHold(ec) {
    let a = ec.hold || 'none';
    if (entityDomain(ec.entity) !== 'timer' && (a === 'cancel' || a === 'toggle_pause')) {
      a = 'none';
    }
    return a;
  }

  _executeTimerAction(action, entityId) {
    if (!this._hass || !entityId || action === 'none') return;
    if (action === 'more_info') {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles: true, composed: true, detail: { entityId },
      }));
      return;
    }
    const stateObj = this._hass.states[entityId];
    if (!stateObj || entityDomain(entityId) !== 'timer') return;

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
    }
  }

  _handleTap(index) {
    const ref = this._rowRefs[index];
    if (!ref || !this._hass) return;
    const entityId = ref.cfg.entity;

    // Per-entity tap_action wins; _normalizeEntities inherits the card-level one.
    if (ref.cfg.tap_action) {
      const action = ref.cfg.tap_action;
      if (action.action === 'call-service' || action.action === 'perform-action') {
        const [domain, service] = (action.service || action.perform_action || '').split('.');
        if (domain && service) {
          this._hass.callService(domain, service, action.service_data || action.data || {});
        }
      } else if (action.action === 'navigate') {
        history.pushState(null, '', action.navigation_path);
        window.dispatchEvent(new Event('location-changed'));
      } else if (action.action === 'more-info') {
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true, composed: true, detail: { entityId },
        }));
      }
      return;
    }
    this._executeTimerAction(this._effectiveTap(ref.cfg), entityId);
  }

  _handleHold(index) {
    const ref = this._rowRefs[index];
    if (!ref) return;
    this._executeTimerAction(this._effectiveHold(ref.cfg), ref.cfg.entity);
  }

  _extendTimer(entityId, seconds) {
    if (!this._hass || !entityId || !Number.isFinite(seconds) || seconds === 0) return;
    const stateObj = this._hass.states[entityId];
    // timer.change accepts paused timers too, and negative values shorten them.
    if (!stateObj || (stateObj.state !== 'active' && stateObj.state !== 'paused')) return;
    this._hass.callService('timer', 'change', { entity_id: entityId, duration: seconds });
    this._haptic();
  }

  // ── Entity normalization ────────────────────────────────────

  _normalizeEntities() {
    const globals = {};
    [
      'icon', 'color',
      'warning_color', 'warning_threshold', 'warning_threshold_sec',
      'critical_color', 'critical_threshold', 'critical_threshold_sec',
      'cancel_label', 'pause_label', 'resume_label', 'paused_label', 'finished_label',
      'show_duration', 'show_when_idle', 'show_ends_at', 'show_finished',
      'gradient_bar', 'pulse_icon', 'pulse_bar',
      'bar_height', 'bar_direction', 'bar_position',
      'tap', 'hold', 'tap_action', 'extend_buttons', 'duration',
      'presets', 'preset_style', 'preset_position', 'preset_unit',
    ].forEach((k) => {
      if (this._config[k] !== undefined) globals[k] = this._config[k];
    });

    if (Array.isArray(this._config.entities) && this._config.entities.length > 0) {
      return this._config.entities.map((e) =>
        typeof e === 'string' ? { ...globals, entity: e } : { ...globals, ...e });
    }
    return [{ ...globals, entity: this._config.entity, name: this._config.name }];
  }

  // ── Timer data ─────────────────────────────────────────────

  _serverNow() {
    return Date.now() + this._skew;
  }

  _getTimerData(ec) {
    const entityId = ec.entity;
    const empty = {
      state: 'loading', remainingSec: 0, pct: 0, timeStr: '–', totalSec: 0,
      finishesAtMs: null, isActive: false, isPaused: false, isIdle: true, isError: false,
    };
    if (!this._hass || !entityId) return empty;

    const stateObj = this._hass.states[entityId];
    if (!stateObj) {
      return { ...empty, state: 'missing', isIdle: false, isError: true };
    }
    const state = stateObj.state;
    if (state === 'unknown' || state === 'unavailable') {
      return { ...empty, state, isIdle: false, isError: true };
    }

    const attrs = stateObj.attributes;

    // Non-timer entities: countdown to a timestamp (device_class: timestamp sensors etc.)
    if (entityDomain(entityId) !== 'timer') {
      const ts = Date.parse(state);
      if (!Number.isFinite(ts)) {
        return { ...empty, state: 'invalid', isIdle: false, isError: true };
      }
      const remainingSec = (ts - this._serverNow()) / 1000;
      const totalSec = parseTimeSec(ec.duration);
      if (remainingSec > 0) {
        this._lastRemaining[entityId] = remainingSec;
        const pct = totalSec > 0
          ? Math.min(100, Math.max(0, ((totalSec - remainingSec) / totalSec) * 100)) : 0;
        return {
          state: 'active', remainingSec, pct,
          timeStr: formatTime(Math.ceil(remainingSec)), totalSec, finishesAtMs: ts,
          isActive: true, isPaused: false, isIdle: false, isError: false,
        };
      }
      return {
        state: 'idle', remainingSec: 0, pct: 0,
        timeStr: totalSec > 0 ? formatTime(totalSec) : '0:00', totalSec, finishesAtMs: null,
        isActive: false, isPaused: false, isIdle: true, isError: false,
      };
    }

    const durationSec = parseTimeSec(attrs.duration || '0:00:00');

    if (state === 'active') {
      let remainingSec = 0;
      let finishesAtMs = null;
      if (attrs.finishes_at) {
        finishesAtMs = Date.parse(attrs.finishes_at);
        remainingSec = Math.max(0, (finishesAtMs - this._serverNow()) / 1000);
      }
      this._lastRemaining[entityId] = remainingSec;
      const pct = durationSec > 0
        ? Math.min(100, Math.max(0, ((durationSec - remainingSec) / durationSec) * 100)) : 0;
      return {
        state, remainingSec, pct,
        timeStr: formatTime(Math.ceil(remainingSec)), totalSec: durationSec, finishesAtMs,
        isActive: true, isPaused: false, isIdle: false, isError: false,
      };
    }

    if (state === 'paused') {
      const remainingSec = parseTimeSec(attrs.remaining || '0:00:00');
      const pct = durationSec > 0
        ? Math.min(100, Math.max(0, ((durationSec - remainingSec) / durationSec) * 100)) : 0;
      return {
        state, remainingSec, pct,
        timeStr: formatTime(Math.ceil(remainingSec)), totalSec: durationSec, finishesAtMs: null,
        isActive: false, isPaused: true, isIdle: false, isError: false,
      };
    }

    return {
      state, remainingSec: 0, pct: 0,
      timeStr: durationSec > 0 ? formatTime(durationSec) : '0:00',
      totalSec: durationSec, finishesAtMs: null,
      isActive: false, isPaused: false, isIdle: true, isError: false,
    };
  }

  // ── Threshold zones ────────────────────────────────────────

  /** Zone applies to active AND paused timers (paused keeps its zone color, dimmed). */
  _getThresholdZone(data, ec) {
    if (!data || (!data.isActive && !data.isPaused)) return 'normal';
    const rem = data.remainingSec;
    const pctRem = data.totalSec > 0 ? (rem / data.totalSec) * 100 : null;

    // Thresholds are OR-combined, so whichever fires first wins. That makes the
    // percentage default actively harmful once an absolute threshold is set:
    // "5 %" of a 4 h timer is 12 minutes and would always beat "60 s". An
    // explicit *_threshold_sec therefore suppresses the implicit percentage —
    // set the percentage explicitly to get both.
    const pctThreshold = (explicit, secT, fallback) =>
      explicit != null ? explicit : (secT != null ? null : fallback);

    const hit = (color, pctT, secT) => !!color && (
      (pctRem != null && pctT != null && pctRem <= pctT) ||
      (secT != null && rem <= secT));

    if (hit(ec.critical_color,
            pctThreshold(ec.critical_threshold, ec.critical_threshold_sec, 5),
            ec.critical_threshold_sec)) return 'critical';
    if (hit(ec.warning_color,
            pctThreshold(ec.warning_threshold, ec.warning_threshold_sec, 20),
            ec.warning_threshold_sec)) return 'warning';
    return 'normal';
  }

  _zoneColor(zone, ec) {
    const base = safeColor(ec.color);
    if (zone === 'critical') return safeColor(ec.critical_color, base);
    if (zone === 'warning') return safeColor(ec.warning_color, base);
    return base;
  }

  // ── Finished flash ─────────────────────────────────────────

  _markFinished(entityId) {
    if (this._finished[entityId]) return;
    this._finished[entityId] = Date.now() + FINISHED_MS;
  }

  _isFinished(entityId) {
    const exp = this._finished[entityId];
    if (!exp) return false;
    if (Date.now() >= exp) { delete this._finished[entityId]; return false; }
    return true;
  }

  // ── Build ──────────────────────────────────────────────────

  _rowName(ec) {
    const stateObj = this._hass && this._hass.states[ec.entity];
    return ec.name || stateObj?.attributes.friendly_name || ec.entity;
  }

  /** Accessible label — includes the countdown so a screen reader announces it. */
  _rowAria(ec, data) {
    const name = this._rowName(ec);
    return (data.isActive || data.isPaused) ? `${name}, ${data.timeStr}` : name;
  }

  _rowHtml(ec, data, index) {
    const entityId  = ec.entity;
    const name      = this._rowName(ec);
    const isTimer   = entityDomain(entityId) === 'timer';
    const finished  = this._isFinished(entityId) && !data.isActive && ec.show_finished !== false;

    const zone  = finished ? 'normal' : this._getThresholdZone(data, ec);
    const color = this._zoneColor(zone, ec);
    const base  = safeColor(ec.color);

    const isActive  = data.isActive;
    const isPaused  = data.isPaused;
    const isError   = data.isError;
    const tapAction = this._effectiveTap(ec);
    const doPulse   = ec.pulse_icon !== false && isActive;
    const doPulseBar = ec.pulse_bar === true && isActive && !isPaused
      && (zone === 'warning' || zone === 'critical');
    const isRTL     = ec.bar_direction === 'rtl';
    const isBarTop  = ec.bar_position === 'top';
    const barHeight = Math.min(40, Math.max(1, parseInt(ec.bar_height, 10) || 3));

    const showDuration = !!ec.show_duration && data.totalSec > 0 && (isActive || isPaused);
    const totalStr     = showDuration ? formatTime(data.totalSec) : null;
    const endsStr      = ec.show_ends_at && isActive && data.finishesAtMs
      ? `→ ${this._formatClock(data.finishesAtMs)}` : null;

    const pct       = finished ? 100 : data.pct;
    const barWidth  = (isRTL ? 100 - pct : pct).toFixed(1);
    const timeStr   = finished ? '0:00' : data.timeStr;
    const lit       = isActive || finished;
    const barOpacity = isPaused ? '0.45' : '1';
    const barBg = ec.gradient_bar !== false
      ? (isRTL
        ? `linear-gradient(90deg, var(--ctc) 0%, color-mix(in srgb, var(--ctc) 55%, transparent) 100%)`
        : `linear-gradient(90deg, color-mix(in srgb, var(--ctc) 55%, transparent) 0%, var(--ctc) 100%)`)
      : 'var(--ctc)';

    const cancelLabel   = ec.cancel_label   || this._t('cancel');
    const pauseLabel    = ec.pause_label    || this._t('pause');
    const resumeLabel   = ec.resume_label   || this._t('resume');
    const pausedLabel   = ec.paused_label   || this._t('paused');
    const finishedLabel = ec.finished_label || this._t('done');

    let statusBadge = '';
    if (isError) {
      statusBadge = `<span class="s-badge s-error" title="${esc(data.state)}">!</span>`;
    } else if (finished) {
      statusBadge = `<span class="s-badge s-done">&#x2713; ${esc(finishedLabel)}</span>`;
    } else if (isPaused) {
      if (tapAction === 'toggle_pause') {
        statusBadge = `<span class="s-cancel">&#x25B6; ${esc(resumeLabel)}</span>`;
      } else {
        statusBadge = `<span class="s-badge s-paused">&#x23F8; ${esc(pausedLabel)}</span>`;
      }
    } else if (isActive && isTimer) {
      if (tapAction === 'toggle_pause') {
        statusBadge = `<span class="s-cancel">&#x23F8; ${esc(pauseLabel)}</span>`;
      } else if (tapAction === 'cancel' && !ec.tap_action) {
        statusBadge = `<span class="s-cancel">${esc(cancelLabel)}</span>`;
      }
    }

    let chipsHtml = '';
    if ((isActive || isPaused) && isTimer
        && Array.isArray(ec.extend_buttons) && ec.extend_buttons.length > 0) {
      chipsHtml = ec.extend_buttons
        .map((m) => Number(m))
        .filter((m) => Number.isFinite(m) && m !== 0)
        .map((m) => {
          const label = `${m > 0 ? '+' : '−'}${Math.abs(m)}m`;
          return `<button class="chip" type="button" data-extend="${m * 60}"
                          data-target="${esc(entityId)}"
                          aria-label="${m > 0 ? 'plus' : 'minus'} ${Math.abs(m)} min">${label}</button>`;
        }).join('');
    }

    const presetStyle  = ec.preset_style === 'chips' ? 'chips' : 'buttons';
    const presetChips  = presetStyle === 'chips'   ? this._presetsHtml(ec, 'chips')   : '';
    const presetBlock  = presetStyle === 'buttons' ? this._presetsHtml(ec, 'buttons') : '';

    const totalHtml = totalStr ? `<span class="time-total" data-role="total">/ ${totalStr}</span>` : '';
    const endsHtml  = endsStr ? `<span class="time-total" data-role="ends">${esc(endsStr)}</span>` : '';
    const barMargin = isBarTop ? 'margin:0 0 6px 0' : 'margin:6px 0 0 0';

    const barHtml = `
      <div class="bar-wrap${isRTL ? ' bar-rtl' : ''}"
           style="${barMargin};height:${barHeight}px;border-radius:${barHeight}px;
                  background:color-mix(in srgb, var(--ctc-base) 12%, transparent);">
        <div class="bar-fill${doPulseBar ? ' pulsing' : ''}" data-role="bar"
             style="width:${barWidth}%;background:${barBg};border-radius:${barHeight}px;
                    box-shadow:0 0 ${barHeight * 2}px color-mix(in srgb, var(--ctc) 55%, transparent);
                    opacity:${barOpacity};"></div>
      </div>`;

    const rowHtml = `
      <div class="info-row">
        <div class="left">
          <ha-icon icon="${esc(ec.icon || 'mdi:timer-outline')}"
            style="color:color-mix(in srgb, var(--ctc) ${lit ? 80 : 45}%, transparent);
                   ${doPulse ? 'animation:pulse-icon 2s ease-in-out infinite;' : ''}"></ha-icon>
          <span class="label">${esc(name)}</span>
        </div>
        <div class="right">
          <span class="time" data-role="time"
                style="color:${lit ? 'var(--ctc)' : 'color-mix(in srgb, var(--ctc) 45%, transparent)'};">${esc(timeStr)}</span>
          ${totalHtml}
          ${endsHtml}
          ${presetChips}
          ${chipsHtml}
          ${statusBadge}
        </div>
      </div>`;

    // What actually happens on press decides what the row is allowed to look
    // like. A row with tap: none must not advertise itself as a button.
    const hasTap  = !!ec.tap_action || tapAction !== 'none';
    const hasHold = this._effectiveHold(ec) !== 'none';
    const rowCls  = `timer-row${hasTap || hasHold ? ' pressable' : ''}${hasTap ? ' focusable' : ''}`;
    const a11y    = hasTap
      ? ` role="button" tabindex="0" aria-label="${esc(this._rowAria(ec, data))}"`
      : '';

    const content = isBarTop ? `${barHtml}${rowHtml}` : `${rowHtml}${barHtml}`;
    const row = `<div class="${rowCls}" data-entity="${esc(entityId)}" data-i="${index}"${a11y}>${content}</div>`;

    // Presets live outside [data-i] on purpose: that keeps them out of the row's
    // tap/hold/keyboard target instead of relying on event-handler guards.
    const top    = presetBlock && ec.preset_position !== 'bottom' ? presetBlock : '';
    const bottom = presetBlock && ec.preset_position === 'bottom' ? presetBlock : '';
    return `<div class="row-group" style="--ctc:${color};--ctc-base:${base};">${top}${row}${bottom}</div>`;
  }

  _build() {
    clearTimeout(this._holdTimer);
    this._holdTimer = null;

    const entityData = this._entities.map((ec) => {
      const data = this._getTimerData(ec);
      if (data.isActive) delete this._finished[ec.entity];
      return { cfg: ec, data };
    });
    const visible = entityData.filter(({ cfg, data }) => this._isVisible(cfg, data));

    this._structKey = this._computeStructKey();

    if (visible.length === 0) {
      this.shadowRoot.innerHTML = '<style>:host { display: none !important; }</style>';
      this._rowRefs = [];
      this._initialized = true;
      return;
    }

    const accent = this._cardAccent(visible);
    const useHaCard = !!this._config.use_ha_card;
    const tag = useHaCard ? 'ha-card' : 'div';

    let rowsHtml = '';
    visible.forEach(({ cfg, data }, i) => {
      rowsHtml += this._rowHtml(cfg, data, i);
      if (i < visible.length - 1) rowsHtml += '<div class="row-sep"></div>';
    });

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; -webkit-tap-highlight-color: transparent; user-select: none; }
        .card {
          padding: 10px 14px;
          transition: background 0.12s ease;
        }
        div.card {
          background: color-mix(in srgb, var(--ctc-card) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--ctc-card) 18%, transparent);
          border-radius: 14px;
        }
        .timer-row {
          pointer-events: auto; border-radius: 6px; outline: none;
          transition: opacity 0.1s ease, transform 0.1s ease;
        }
        .timer-row.pressable { cursor: pointer; }
        .timer-row.pressable:active { opacity: 0.75; transform: scale(0.99); }
        .timer-row.focusable:focus-visible {
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctc) 60%, transparent);
        }
        .info-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; pointer-events: none;
        }
        .left {
          display: flex; align-items: center; gap: 8px;
          flex: 1; min-width: 0; pointer-events: none;
        }
        ha-icon { --mdc-icon-size: 15px; flex-shrink: 0; pointer-events: none; }
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.85); }
        }
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
        @media (prefers-reduced-motion: reduce) {
          ha-icon, .bar-fill { animation: none !important; }
        }
        .label {
          font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.8px;
          color: var(--secondary-text-color, rgba(127,127,127,0.7));
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; pointer-events: none;
        }
        .right {
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0; pointer-events: none;
        }
        .time {
          font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          line-height: 1; pointer-events: none;
        }
        .time-total {
          font-size: 11px; font-weight: 500;
          color: var(--secondary-text-color, rgba(127,127,127,0.7));
          font-variant-numeric: tabular-nums;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          line-height: 1; pointer-events: none;
        }
        .s-cancel {
          font-size: 10px; color: var(--secondary-text-color, rgba(127,127,127,0.7));
          border: 1px solid var(--divider-color, rgba(127,127,127,0.3));
          border-radius: 6px; padding: 2px 7px;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          line-height: 1.6; white-space: nowrap; pointer-events: none;
        }
        .s-badge {
          font-size: 10px; border: 1px solid; border-radius: 6px; padding: 2px 7px;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          line-height: 1.6; white-space: nowrap; pointer-events: none;
        }
        .s-paused {
          color: color-mix(in srgb, var(--ctc) 70%, transparent);
          border-color: color-mix(in srgb, var(--ctc) 30%, transparent);
        }
        .s-done {
          color: var(--ctc); border-color: color-mix(in srgb, var(--ctc) 40%, transparent);
          font-weight: 700; animation: pulse-bar 1.2s ease-in-out infinite;
        }
        .s-error {
          color: var(--error-color, #f87171) !important;
          border-color: var(--error-color, #f87171) !important; font-weight: 700;
        }
        .chip {
          pointer-events: auto; cursor: pointer;
          font-size: 10px; font-weight: 700;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
          color: var(--ctc); background: color-mix(in srgb, var(--ctc) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--ctc) 35%, transparent);
          border-radius: 6px; padding: 2px 7px; line-height: 1.6; white-space: nowrap;
        }
        .chip:active { opacity: 0.6; }
        .chip:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctc) 60%, transparent);
        }
        .preset-grid {
          display: grid; gap: 8px; pointer-events: auto;
        }
        .preset-grid.top    { margin: 0 0 10px 0; }
        .preset-grid.bottom { margin: 10px 0 0 0; }
        .preset-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px; padding: 12px 4px; cursor: pointer; font: inherit; outline: none;
          background: color-mix(in srgb, var(--ctc-base) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--ctc-base) 20%, transparent);
          border-radius: 14px;
          transition: background 0.12s ease, transform 0.1s ease, opacity 0.1s ease;
        }
        .preset-btn:hover { background: color-mix(in srgb, var(--ctc-base) 12%, transparent); }
        .preset-btn:active { transform: scale(0.97); opacity: 0.7; }
        .preset-btn:focus-visible {
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctc-base) 60%, transparent);
        }
        .preset-num {
          font-size: 16px; font-weight: 800; line-height: 1; color: var(--ctc-base);
          font-variant-numeric: tabular-nums;
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
        }
        .preset-unit {
          font-size: 9px; font-weight: 600; line-height: 1;
          text-transform: uppercase; letter-spacing: 1.5px;
          color: var(--secondary-text-color, rgba(127,127,127,0.6));
          font-family: var(--ha-font-family-body, var(--primary-font-family, sans-serif));
        }
        .preset-chip { color: var(--ctc-base); }
        .bar-wrap { width: 100%; overflow: hidden; pointer-events: none; }
        .bar-wrap.bar-rtl { display: flex; flex-direction: row-reverse; }
        .bar-fill { height: 100%; width: 0%; transition: width 0.4s linear; pointer-events: none; }
        .bar-fill.pulsing { animation: pulse-bar 1s ease-in-out infinite; }
        .row-sep {
          height: 1px; background: var(--divider-color, rgba(127,127,127,0.2));
          margin: 8px 0; pointer-events: none;
        }
      </style>
      <${tag} class="card" style="--ctc-card:${accent};">${rowsHtml}</${tag}>
    `;

    // Cache element references per row — no per-tick querySelector calls.
    this._rowRefs = [];
    this.shadowRoot.querySelectorAll('.row-group').forEach((group, i) => {
      const { cfg, data } = visible[i];
      const row = group.querySelector('.timer-row');
      this._rowRefs.push({
        cfg,
        group,
        row,
        hasAria: row.hasAttribute('aria-label'),
        lastAria: row.getAttribute('aria-label'),
        els: {
          time:  row.querySelector('[data-role="time"]'),
          bar:   row.querySelector('[data-role="bar"]'),
          total: row.querySelector('[data-role="total"]'),
          ends:  row.querySelector('[data-role="ends"]'),
        },
        lastZone: this._isFinished(cfg.entity) && !data.isActive
          ? 'normal' : this._getThresholdZone(data, cfg),
        lastTime: null,
        lastWidth: null,
        builtActive: data.isActive,
        prevRemaining: data.isActive ? data.remainingSec : null,
      });
    });

    this._attachListeners();
    this._initialized = true;
  }

  _cardAccent(visible) {
    let accent = null;
    let severity = 0; // 0 normal, 1 warning, 2 critical
    for (const { cfg, data } of visible) {
      const finished = this._isFinished(cfg.entity) && !data.isActive;
      const zone = finished ? 'normal' : this._getThresholdZone(data, cfg);
      const s = zone === 'critical' ? 2 : zone === 'warning' ? 1 : 0;
      if (accent === null || s > severity) {
        accent = this._zoneColor(zone, cfg);
        severity = s;
      }
    }
    return accent || DEFAULT_COLOR;
  }

  _attachListeners() {
    const cardEl = this.shadowRoot.querySelector('.card');
    if (!cardEl) return;

    const startHold = (target) => {
      if (target.closest('[data-extend], [data-preset]')) return;
      const row = target.closest('[data-i]');
      if (!row) return;
      const index = Number(row.dataset.i);
      this._holdFired = false;
      clearTimeout(this._holdTimer);
      this._holdTimer = setTimeout(() => {
        this._holdFired = true;
        this._handleHold(index);
        navigator.vibrate?.(40);
        // Some mobile browsers suppress the click after a long press —
        // make sure a stale flag can never swallow the next tap.
        clearTimeout(this._holdReset);
        this._holdReset = setTimeout(() => { this._holdFired = false; }, 800);
      }, HOLD_MS);
    };
    const cancelHold = () => {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    };

    cardEl.addEventListener('mousedown',  (e) => startHold(e.target));
    cardEl.addEventListener('mouseup',    cancelHold);
    cardEl.addEventListener('mouseleave', cancelHold);
    cardEl.addEventListener('touchstart', (e) => startHold(e.target), { passive: true });
    cardEl.addEventListener('touchend',   cancelHold);
    cardEl.addEventListener('touchmove',  cancelHold, { passive: true });
    cardEl.addEventListener('touchcancel', cancelHold);

    cardEl.addEventListener('click', (e) => {
      const preset = e.target.closest('[data-preset]');
      if (preset) {
        this._startPreset(preset.dataset.target, Number(preset.dataset.preset));
        return;
      }
      const chip = e.target.closest('[data-extend]');
      if (chip) {
        this._extendTimer(chip.dataset.target, Number(chip.dataset.extend));
        return;
      }
      if (this._holdFired) { this._holdFired = false; return; }
      const row = e.target.closest('[data-i]');
      if (row) this._handleTap(Number(row.dataset.i));
    });

    cardEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest) return;
      // Chips and presets are real <button>s — let the browser activate them
      // natively instead of hijacking the key for the row's tap action.
      if (e.target.closest('[data-extend], [data-preset]')) return;
      const row = e.target.closest('[data-i]');
      if (!row) return;
      e.preventDefault();
      this._handleTap(Number(row.dataset.i));
    });
  }

  // ── Zone color patching (no DOM rebuild) ───────────────────

  _applyZones() {
    if (!this._rowRefs.length) return;
    const cardEl = this.shadowRoot.querySelector('.card');
    let accent = null;
    let severity = -1;

    for (const ref of this._rowRefs) {
      const data = this._getTimerData(ref.cfg);
      const finished = this._isFinished(ref.cfg.entity) && !data.isActive;
      const zone = finished ? 'normal' : this._getThresholdZone(data, ref.cfg);
      if (zone !== ref.lastZone) {
        ref.lastZone = zone;
        ref.group.style.setProperty('--ctc', this._zoneColor(zone, ref.cfg));
        if (ref.els.bar) {
          const pulse = ref.cfg.pulse_bar === true && data.isActive && !data.isPaused
            && (zone === 'warning' || zone === 'critical');
          ref.els.bar.classList.toggle('pulsing', pulse);
        }
      }
      const s = zone === 'critical' ? 2 : zone === 'warning' ? 1 : 0;
      if (s > severity) {
        severity = s;
        accent = this._zoneColor(zone, ref.cfg);
      }
    }
    if (cardEl && accent) cardEl.style.setProperty('--ctc-card', accent);
  }

  // ── Tick ───────────────────────────────────────────────────

  _tick() {
    if (!this._initialized) return;
    let needRefresh = false;
    const nowMs = Date.now();

    for (const [eid, exp] of Object.entries(this._finished)) {
      if (nowMs >= exp) { delete this._finished[eid]; needRefresh = true; }
    }

    let zonesDirty = false;
    for (const ref of this._rowRefs) {
      const ec = ref.cfg;
      const data = this._getTimerData(ec);

      // Local natural-finish detection (also covers timestamp sensors,
      // which never emit a state change when they cross "now").
      if (ref.prevRemaining != null && ref.prevRemaining > 0 && data.remainingSec <= 0) {
        if (ec.show_finished !== false) this._markFinished(ec.entity);
        needRefresh = true;
      }
      ref.prevRemaining = data.isActive ? data.remainingSec : null;

      // Row built as active but no longer is (sensor crossed zero, timer
      // display caught up before the HA state event) → structure changed.
      if (ref.builtActive && !data.isActive) needRefresh = true;

      if (!data.isActive) continue;

      if (ref.els.time && data.timeStr !== ref.lastTime) {
        ref.els.time.textContent = data.timeStr;
        ref.lastTime = data.timeStr;
        if (ref.hasAria) {
          const aria = this._rowAria(ec, data);
          if (aria !== ref.lastAria) {
            ref.row.setAttribute('aria-label', aria);
            ref.lastAria = aria;
          }
        }
      }
      const isRTL = ec.bar_direction === 'rtl';
      const width = (isRTL ? 100 - data.pct : data.pct).toFixed(1) + '%';
      if (ref.els.bar && width !== ref.lastWidth) {
        ref.els.bar.style.width = width;
        ref.lastWidth = width;
      }
      if (ref.els.total && data.totalSec > 0) {
        const t = `/ ${formatTime(data.totalSec)}`;
        if (ref.els.total.textContent !== t) ref.els.total.textContent = t;
      }
      if (ref.els.ends && data.finishesAtMs) {
        const e = `→ ${this._formatClock(data.finishesAtMs)}`;
        if (ref.els.ends.textContent !== e) ref.els.ends.textContent = e;
      }
      if (this._getThresholdZone(data, ec) !== ref.lastZone) zonesDirty = true;
    }

    if (zonesDirty) this._applyZones();
    if (needRefresh) this._refresh();
  }

  // ── Sizing ─────────────────────────────────────────────────

  getCardSize() {
    return Math.max(1, this._rowRefs.length || this._entities.length);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4, rows: 'auto' };
  }
}

if (!customElements.get('compact-timer-card')) {
  customElements.define('compact-timer-card', CompactTimerCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'compact-timer-card',
  name: 'Compact Timer Card',
  description: 'Sleek timer card with live countdown, gradient bar, warning/critical color zones, extend buttons, timestamp-sensor support, and multi-timer stacked mode.',
  preview: true,
  documentationURL: 'https://github.com/Michailjovic/compact-timer-card',
});

console.info(
  `%c COMPACT-TIMER-CARD %c v${CARD_VERSION} `,
  'color: #fff; background: #3b82f6; font-weight: 700;',
  'color: #3b82f6; background: transparent; font-weight: 700;'
);
