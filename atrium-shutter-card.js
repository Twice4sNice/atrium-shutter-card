/*
 * Atrium Rollladen (atrium-shutter) v0.3.1
 * Teil der Atrium-Kartenfamilie: https://github.com/Twice4sNice/Atrium
 * MIT License
 */

const ATRIUM_CARDS_VERSION = "0.3.1";

const aEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Only accept simple CSS colours from configs (they end up inside style attributes). */
const safeColor = (v, fallback) =>
  typeof v === "string" && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v.trim()) ? v.trim() : fallback;

const OFFLINE = new Set(["unavailable", "unknown"]);
const TOGGLE_DOMAINS = new Set(["switch", "light", "fan", "input_boolean", "automation", "siren", "humidifier"]);
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const DOMAIN_ICONS = {
  switch: "mdi:power-socket-eu",
  light: "mdi:lightbulb-outline",
  fan: "mdi:fan",
  input_boolean: "mdi:toggle-switch-outline",
  automation: "mdi:robot-outline",
  script: "mdi:script-text-outline",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  cover: "mdi:window-shutter",
  lock: "mdi:lock",
  sensor: "mdi:eye-outline",
  climate: "mdi:thermostat",
};

const isTemplate = (v) => typeof v === "string" && /\[\[\[|\{\{|\{%/.test(v);
const plain = (v) => (typeof v === "string" && v.trim() && !isTemplate(v) ? v : undefined);

/* "RolladenSchlafzimmerLinks" / "Tasmota_Deko_Haustür" -> readable words. */
const pretty = (v) =>
  String(v || "")
    .replace(/_/g, " ")
    .replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

const lang = (hass) => hass?.locale?.language || hass?.language || "de";
const fmtNum = (hass, v, digits) =>
  Number(v).toLocaleString(lang(hass), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const autoDigits = (v) => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

const fire = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

const firstEntity = (hass, domains, test = () => true) =>
  Object.keys(hass?.states || {}).find((id) => domains.includes(id.split(".")[0]) && test(hass.states[id]));

function runAction(el, hass, action, entityId) {
  const a = action || {};
  const kind = a.action || "more-info";
  if (kind === "none") return undefined;
  if (kind === "toggle") return hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
  if (kind === "more-info") return fire(el, "hass-more-info", { entityId: a.entity || entityId });
  if (kind === "navigate") {
    if (a.navigation_path) {
      history.pushState(null, "", a.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
    return undefined;
  }
  if (kind === "url") {
    if (a.url_path) window.open(a.url_path, "_blank", "noopener");
    return undefined;
  }
  if (kind === "call-service" || kind === "perform-action") {
    const svc = a.perform_action || a.service;
    if (!svc || !svc.includes(".")) return undefined;
    const [domain, service] = svc.split(".");
    return hass.callService(domain, service, a.data || a.service_data || {}, a.target);
  }
  return undefined;
}

const BASE_CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
button{font:inherit;color:inherit}
.c{background:var(--ha-card-background,var(--card-background-color,#1c1c1f));border:1px solid var(--ha-card-border-color,rgba(127,127,127,0.2));border-radius:var(--ha-card-border-radius,24px);box-shadow:var(--ha-card-box-shadow,none);padding:16px;color:var(--primary-text-color,#F5F5F7);height:100%;width:100%;display:flex;flex-direction:column;gap:12px;min-width:0}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.hd{display:flex;align-items:center;gap:12px;min-width:0}
.t{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{margin:2px 0 0;font-size:12.5px;color:var(--secondary-text-color,#9A9AA3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ib{width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex:none;background:rgba(127,127,127,0.16);border:1px solid rgba(127,127,127,0.18);--mdc-icon-size:20px}
.off{color:#F5A623}
@container (max-width:200px){.c{padding:12px;gap:10px;border-radius:20px}.ib{width:34px;height:34px;--mdc-icon-size:18px}.t{font-size:14px}}
`;

class AtriumBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) throw new Error("Konfiguration fehlt");
    this._config = this._normalize(config);
    if (this._hass) this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config || this._busy) return;
    if (!old || this._watch().some((id) => old.states[id] !== hass.states[id])) this._render();
  }

  get hass() {
    return this._hass;
  }

  _normalize(config) {
    return config;
  }

  _watch() {
    return [];
  }

  _st(id) {
    return id ? this._hass?.states[id] : undefined;
  }

  _name(id, override) {
    return override || pretty(this._st(id)?.attributes?.friendly_name) || id || "";
  }

  getCardSize() {
    return 3;
  }
}

/* ---------- atrium-shutter: replaces shutter-card ---------- */

class AtriumShutter extends AtriumBase {
  static getStubConfig(hass) {
    return { entities: [firstEntity(hass, ["cover"]) || ""] };
  }

  _normalize(config) {
    const list = (Array.isArray(config.entities) ? config.entities : [config.entity])
      .map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((e) => e && e.entity);
    if (!list.length) throw new Error("atrium-shutter braucht mindestens eine Entität");
    return { ...config, entities: list };
  }

  _watch() {
    return this._config.entities.map((e) => e.entity);
  }

  getCardSize() {
    return 5 * this._config.entities.length;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  _pos(s) {
    const p = Number(s?.attributes?.current_position);
    if (Number.isFinite(p)) return Math.max(0, Math.min(100, p));
    return s?.state === "open" ? 100 : 0;
  }

  _render() {
    const multi = this._config.entities.length > 1;
    const items = this._config.entities
      .map((e, i) => {
        const s = this._st(e.entity);
        const offline = !s || OFFLINE.has(s.state);
        const pos = this._pos(s);
        const single = plain(this._config.name) && !multi ? this._config.name : undefined;
        const title = single || this._name(e.entity);
        const moving = s?.state === "opening" || s?.state === "closing";
        const sub = offline
          ? "Nicht erreichbar"
          : s.state === "opening"
            ? "Öffnet …"
            : s.state === "closing"
              ? "Schließt …"
              : pos === 0
                ? "Geschlossen"
                : pos === 100
                  ? "Offen"
                  : `${pos} % offen`;
        const feats = Number(s?.attributes?.supported_features || 0);
        const canSet = Boolean(feats & 4);
        const canStop = !s || feats === 0 || Boolean(feats & 8);
        const dis = offline ? "disabled" : "";
        return `<div class="it" data-i="${i}">
          <div class="row"><div style="min-width:0"><p class="t">${aEsc(title)}</p><p class="s ${offline ? "off" : ""}">${aEsc(sub)}</p></div>
          <button class="ib mi" data-act="more" aria-label="Details ${aEsc(title)}"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>
          <div class="win ${moving ? "mv" : ""}" aria-hidden="true"><div class="sl" style="height:${100 - pos}%"></div><div class="mid"></div><span class="pc">${offline ? "–" : `${pos} %`}</span></div>
          <div class="ctl">
            <button class="b" data-act="open" aria-label="${aEsc(title)} hochfahren" ${dis}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
            ${canStop ? `<button class="b" data-act="stop" aria-label="${aEsc(title)} stoppen" ${dis}><ha-icon icon="mdi:stop"></ha-icon></button>` : ""}
            <button class="b" data-act="close" aria-label="${aEsc(title)} runterfahren" ${dis}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          </div>
          ${canSet && !offline ? `<input class="rg" type="range" min="0" max="100" step="5" value="${pos}" aria-label="Position ${aEsc(title)}">` : ""}
        </div>`;
      })
      .join("");
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}
      .it{display:flex;flex-direction:column;gap:12px;min-width:0}
      .it + .it{padding-top:14px;border-top:1px solid rgba(127,127,127,0.18)}
      .mi{cursor:pointer;width:36px;height:36px}
      .win{position:relative;width:100%;height:140px;border-radius:16px;border:2px solid rgba(127,127,127,0.3);background:linear-gradient(180deg,#1C2A44,#0E1626);overflow:hidden}
      .sl{position:absolute;left:0;right:0;top:0;background:repeating-linear-gradient(180deg,#3A3A42 0 9px,#2C2C33 9px 11px);transition:height .4s ease}
      .mv .sl{opacity:.85}
      .mid{position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.12)}
      .pc{position:absolute;left:8px;bottom:8px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,0.55);color:#F5F5F7;font-size:11.5px;font-weight:600}
      .ctl{display:flex;gap:8px}
      .b{flex:1;min-width:0;height:44px;border-radius:14px;border:1px solid rgba(127,127,127,0.25);background:rgba(127,127,127,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;--mdc-icon-size:20px}
      .b:hover:not(:disabled){background:rgba(127,127,127,0.2)}
      .b:focus-visible,.mi:focus-visible{outline:2px solid #5B8CFF;outline-offset:2px}
      .b:disabled{opacity:.4;cursor:default}
      .rg{width:100%;accent-color:#2F6BFF;min-height:28px;margin:0}
      @container (max-width:200px){.win{height:110px}.mi{display:none}.ctl{gap:6px}.b{height:40px;border-radius:12px}.it .t{white-space:normal;overflow-wrap:anywhere;font-size:13.5px;line-height:1.25}}
      @container (min-width:420px){.win{height:170px}}
    </style><div class="c">${items}</div>`;
    this.shadowRoot.querySelectorAll(".it").forEach((node) => {
      const e = this._config.entities[Number(node.dataset.i)];
      const target = { entity_id: e.entity };
      node.addEventListener("click", (ev) => {
        const act = ev.target.closest("[data-act]")?.dataset.act;
        if (act === "open") this._hass.callService("cover", "open_cover", {}, target);
        else if (act === "stop") this._hass.callService("cover", "stop_cover", {}, target);
        else if (act === "close") this._hass.callService("cover", "close_cover", {}, target);
        else if (act === "more") fire(this, "hass-more-info", { entityId: e.entity });
      });
      const range = node.querySelector(".rg");
      if (!range) return;
      // Keep the slider where the finger is while dragging; state updates would reset it.
      const hold = () => {
        this._busy = true;
      };
      const release = () => {
        this._busy = false;
      };
      range.addEventListener("pointerdown", hold);
      range.addEventListener("pointerup", release);
      range.addEventListener("pointercancel", release);
      range.addEventListener("input", () => {
        const sl = node.querySelector(".sl");
        const pc = node.querySelector(".pc");
        if (sl) sl.style.height = `${100 - Number(range.value)}%`;
        if (pc) pc.textContent = `${range.value} %`;
      });
      range.addEventListener("change", () => {
        this._busy = false;
        this._hass.callService("cover", "set_cover_position", { position: Number(range.value) }, target);
      });
    });
  }
}


if (!customElements.get("atrium-shutter")) customElements.define("atrium-shutter", AtriumShutter);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "atrium-shutter")) window.customCards.push({ type: "atrium-shutter", name: "Atrium Rollladen", description: "Rollläden mit Position und Steuerung", preview: true });
console.info("%c ATRIUM-SHUTTER %c v0.3.1 ", "color:#fff;background:#2F6BFF;border-radius:4px 0 0 4px;padding:2px 4px", "color:#2F6BFF;background:#1c1c1f;border-radius:0 4px 4px 0;padding:2px 4px");
