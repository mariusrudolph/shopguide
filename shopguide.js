/**
 * ShopGuide.js v1.1
 * Lightweight feature onboarding — Vanilla JS, GTM-ready.
 * New in v1.1: Pulse Beacon, i18n, GTM Analytics Events
 */

(function (global) {
  "use strict";

  const LS_PREFIX   = "shopguide_";
  const OVERLAY_ID  = "sg-overlay";
  const TOOLTIP_ID  = "sg-tooltip";
  const BEACON_CLS  = "sg-beacon";
  const Z_BASE      = 99999;

  // ─────────────────────────────────────────────
  // DEFAULT THEME
  // ─────────────────────────────────────────────
  const DEFAULT_THEME = {
    primary:          "#2563EB",
    primaryText:      "#ffffff",
    background:       "#ffffff",
    text:             "#111827",
    textMuted:        "#6B7280",
    border:           "#E5E7EB",
    borderRadius:     "12px",
    fontFamily:       "-apple-system, 'Inter', BlinkMacSystemFont, sans-serif",
    fontSize:         "14px",
    shadow:           "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
    backdropColor:    "rgba(0,0,0,0.45)",
    highlightRing:    "0 0 0 4px rgba(37,99,235,0.25)",
    spotlightPadding: 8,
    // Beacon options
    beaconColor:      null,   // defaults to primary
    beaconSize:       12,     // px – the solid dot
    beaconPosition:   "top-right", // top-right | top-left | bottom-right | bottom-left
  };

  // ─────────────────────────────────────────────
  // BUILT-IN TRANSLATIONS
  // ─────────────────────────────────────────────
  const BUILT_IN_STRINGS = {
    de: { next: "Weiter →",    prev: "← Zurück",   done: "Fertig ✓",    close: "Schließen", step: "{current} / {total}" },
    en: { next: "Next →",      prev: "← Back",     done: "Done ✓",      close: "Close",     step: "{current} / {total}" },
    fr: { next: "Suivant →",   prev: "← Retour",   done: "Terminer ✓",  close: "Fermer",    step: "{current} / {total}" },
    it: { next: "Avanti →",    prev: "← Indietro", done: "Fine ✓",      close: "Chiudi",    step: "{current} / {total}" },
    sr: { next: "Даље →",      prev: "← Назад",    done: "Готово ✓",    close: "Затвори",   step: "{current} / {total}" },
    hu: { next: "Tovább →",    prev: "← Vissza",   done: "Kész ✓",      close: "Bezárás",   step: "{current} / {total}" },
    ro: { next: "Înainte →",   prev: "← Înapoi",   done: "Finalizat ✓", close: "Închide",   step: "{current} / {total}" },
    cs: { next: "Dále →",      prev: "← Zpět",     done: "Hotovo ✓",    close: "Zavřít",    step: "{current} / {total}" },
  };

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────
  let _config      = {};
  let _theme       = {};
  let _strings     = {};        // resolved strings for current language
  let _activeFlow  = null;
  let _activeStep  = 0;
  let _resizeTimer = null;
  let _beacons     = [];        // [{el, targetEl}] – active standalone beacons

  // ─────────────────────────────────────────────
  // LANGUAGE RESOLUTION
  // ─────────────────────────────────────────────
  /**
   * Resolve the language to use:
   * Priority: config.locale → navigator.language → 'en'
   * Supports region codes like 'de-CH' → falls back to 'de'
   */
  function resolveLocale(config) {
    const raw = config.locale || navigator.language || "en";
    const lang = raw.split("-")[0].toLowerCase();
    return lang;
  }

  /**
   * Merge strings: built-in → config.strings (global) → step-level i18n
   */
  function buildStrings(lang, customStrings) {
    const base = BUILT_IN_STRINGS[lang] || BUILT_IN_STRINGS["en"];
    return Object.assign({}, base, customStrings || {});
  }

  function t(key, vars) {
    let str = _strings[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace("{" + k + "}", vars[k]);
      });
    }
    return str;
  }

  /**
   * Get translated value from a step field.
   * A field can be a plain string or an i18n object: { de: "...", en: "...", fr: "..." }
   * Falls back to first available value if current lang not found.
   */
  function localise(field) {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      const lang = resolveLocale(_config);
      return field[lang] || field[lang.split("-")[0]] || Object.values(field)[0] || "";
    }
    return String(field);
  }

  // ─────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────
  function merge(base, override) { return Object.assign({}, base, override || {}); }
  function $(sel) { return document.querySelector(sel); }
  function lsKey(id) { return LS_PREFIX + id; }
  function hasCompleted(id) { return localStorage.getItem(lsKey(id)) === "done"; }
  function markCompleted(id) { localStorage.setItem(lsKey(id), "done"); }
  function currentUrl() { return window.location.pathname + window.location.search; }
  function urlMatches(pattern) {
    if (!pattern) return true;
    if (pattern instanceof RegExp) return pattern.test(currentUrl());
    if (pattern.includes("*")) return new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(currentUrl());
    return currentUrl().startsWith(pattern);
  }

  // ─────────────────────────────────────────────
  // ANALYTICS — GTM dataLayer push
  // ─────────────────────────────────────────────
  /**
   * Pushes a ShopGuide event to window.dataLayer (GTM).
   * Events: sg_flow_started, sg_step_viewed, sg_flow_completed,
   *         sg_flow_dismissed, sg_tooltip_shown, sg_tooltip_clicked
   */
  function track(event, payload) {
    if (_config.analytics === false) return;
    const dl = (global.dataLayer = global.dataLayer || []);
    dl.push(Object.assign({ event }, payload || {}));
  }

  // ─────────────────────────────────────────────
  // CSS INJECTION
  // ─────────────────────────────────────────────
  function injectStyles(theme) {
    const existing = document.getElementById("sg-styles");
    if (existing) existing.remove();

    const bc = theme.beaconColor || theme.primary;
    const bs = theme.beaconSize;

    const css = `
      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: ${Z_BASE};
        pointer-events: none;
      }
      #${OVERLAY_ID}.sg-active { pointer-events: all; }
      #${OVERLAY_ID} svg { width:100%; height:100%; position:absolute; inset:0; }

      #${TOOLTIP_ID} {
        position: fixed; z-index: ${Z_BASE + 2};
        max-width: 320px; min-width: 240px;
        background: ${theme.background};
        border: 1px solid ${theme.border};
        border-radius: ${theme.borderRadius};
        box-shadow: ${theme.shadow};
        font-family: ${theme.fontFamily};
        font-size: ${theme.fontSize};
        color: ${theme.text};
        padding: 20px;
        box-sizing: border-box;
        animation: sg-fadeIn 0.2s ease;
      }
      @keyframes sg-fadeIn {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }

      /* ── Pulse Beacon ── */
      .${BEACON_CLS} {
        position: fixed;
        z-index: ${Z_BASE + 3};
        width: ${bs}px; height: ${bs}px;
        pointer-events: none;
      }
      .${BEACON_CLS}__dot {
        width: 100%; height: 100%;
        border-radius: 50%;
        background: ${bc};
        position: relative;
        z-index: 1;
      }
      .${BEACON_CLS}__ring {
        position: absolute;
        top: 50%; left: 50%;
        width: ${bs}px; height: ${bs}px;
        margin: -${bs/2}px 0 0 -${bs/2}px;
        border-radius: 50%;
        background: ${bc};
        opacity: 0;
        animation: sg-beacon-pulse 1.8s ease-out infinite;
      }
      .${BEACON_CLS}__ring:nth-child(2) { animation-delay: 0.6s; }
      .${BEACON_CLS}__ring:nth-child(3) { animation-delay: 1.2s; }
      @keyframes sg-beacon-pulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        100% { transform: scale(3.2); opacity: 0;   }
      }

      .sg-tooltip-header {
        display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px;
      }
      .sg-tooltip-title { font-size:15px; font-weight:600; color:${theme.text}; line-height:1.3; margin:0; }
      .sg-tooltip-close {
        background:none; border:none; cursor:pointer; color:${theme.textMuted};
        padding:0; line-height:1; font-size:18px; flex-shrink:0; margin-top:-1px; transition:color .15s;
      }
      .sg-tooltip-close:hover { color:${theme.text}; }
      .sg-tooltip-body { color:${theme.textMuted}; line-height:1.55; margin:0 0 16px; }
      .sg-tooltip-footer {
        display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
      }
      .sg-progress { font-size:12px; color:${theme.textMuted}; font-variant-numeric:tabular-nums; }
      .sg-progress-dots { display:flex; gap:5px; align-items:center; }
      .sg-progress-dot {
        width:6px; height:6px; border-radius:50%; background:${theme.border};
        transition: background .2s, transform .2s;
      }
      .sg-progress-dot.active  { background:${theme.primary}; transform:scale(1.3); }
      .sg-progress-dot.done    { background:${theme.primary}; opacity:0.4; }
      .sg-btn-group { display:flex; gap:6px; align-items:center; margin-left:auto; }
      .sg-btn {
        display:inline-flex; align-items:center; gap:5px;
        padding:7px 14px; border-radius:8px;
        font-family:${theme.fontFamily}; font-size:13px; font-weight:500;
        cursor:pointer; border:none; text-decoration:none;
        transition:opacity .15s, transform .1s; white-space:nowrap;
      }
      .sg-btn:active { transform:scale(0.97); }
      .sg-btn-primary { background:${theme.primary}; color:${theme.primaryText}; }
      .sg-btn-primary:hover { opacity:.88; }
      .sg-btn-ghost {
        background:transparent; color:${theme.textMuted};
        border:1px solid ${theme.border};
      }
      .sg-btn-ghost:hover { background:${theme.border}; color:${theme.text}; }
      .sg-btn-link { background:transparent; color:${theme.primary}; padding:7px 4px; border:none; }
      .sg-btn-link:hover { opacity:.75; }
      @media (max-width:600px) {
        #${TOOLTIP_ID} { max-width:calc(100vw - 32px); min-width:0; }
      }
    `;
    const style = document.createElement("style");
    style.id = "sg-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────
  // BEACON
  // ─────────────────────────────────────────────
  function placeBeacon(targetEl) {
    removeBeacons();
    if (!targetEl) return;

    const r   = targetEl.getBoundingClientRect();
    const bs  = _theme.beaconSize;
    const pos = _theme.beaconPosition || "top-right";
    const pad = -4; // slight overlap with target edge

    const coords = {
      "top-right":    { top: r.top    + pad - bs/2, left: r.right  - bs/2 - pad },
      "top-left":     { top: r.top    + pad - bs/2, left: r.left   - bs/2 + pad },
      "bottom-right": { top: r.bottom - pad - bs/2, left: r.right  - bs/2 - pad },
      "bottom-left":  { top: r.bottom - pad - bs/2, left: r.left   - bs/2 + pad },
    }[pos] || { top: r.top - bs/2, left: r.right - bs/2 };

    const beacon = document.createElement("div");
    beacon.className = BEACON_CLS;
    beacon.style.top  = Math.round(coords.top)  + "px";
    beacon.style.left = Math.round(coords.left) + "px";
    beacon.innerHTML  = `
      <div class="${BEACON_CLS}__ring"></div>
      <div class="${BEACON_CLS}__ring"></div>
      <div class="${BEACON_CLS}__ring"></div>
      <div class="${BEACON_CLS}__dot"></div>`;
    document.body.appendChild(beacon);
    _beacons.push(beacon);
  }

  function removeBeacons() {
    _beacons.forEach((b) => b.remove());
    _beacons = [];
  }

  // ─────────────────────────────────────────────
  // OVERLAY / SPOTLIGHT
  // ─────────────────────────────────────────────
  function getOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) { el = document.createElement("div"); el.id = OVERLAY_ID; document.body.appendChild(el); }
    return el;
  }

  function showOverlay(targetEl) {
    const overlay = getOverlay();
    overlay.classList.add("sg-active");
    if (!targetEl) {
      overlay.innerHTML = `<svg><rect width="100%" height="100%" fill="${_theme.backdropColor}"/></svg>`;
      return;
    }
    updateSpotlight(overlay, targetEl);
  }

  function updateSpotlight(overlay, targetEl) {
    const pad = _theme.spotlightPadding;
    const r   = targetEl.getBoundingClientRect();
    const vw  = window.innerWidth, vh = window.innerHeight;
    const rx  = Math.max(0, r.left   - pad);
    const ry  = Math.max(0, r.top    - pad);
    const rw  = r.width  + pad * 2;
    const rh  = r.height + pad * 2;
    const br  = 8;
    const path = `M0,0 H${vw} V${vh} H0 Z
      M${rx+br},${ry} H${rx+rw-br} Q${rx+rw},${ry} ${rx+rw},${ry+br}
      V${ry+rh-br} Q${rx+rw},${ry+rh} ${rx+rw-br},${ry+rh}
      H${rx+br} Q${rx},${ry+rh} ${rx},${ry+rh-br}
      V${ry+br} Q${rx},${ry} ${rx+br},${ry} Z`;
    overlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" d="${path}" fill="${_theme.backdropColor}"/></svg>`;
  }

  function hideOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) { el.classList.remove("sg-active"); el.innerHTML = ""; }
  }

  // ─────────────────────────────────────────────
  // TOOLTIP POSITIONING
  // ─────────────────────────────────────────────
  function positionTooltip(tip, targetEl, preferredPos) {
    const pad = 16, sp = _theme.spotlightPadding;
    const tr  = targetEl ? targetEl.getBoundingClientRect() : null;
    const tw  = tip.offsetWidth, th = tip.offsetHeight;
    const vw  = window.innerWidth, vh = window.innerHeight;

    if (!tr) {
      tip.style.left = Math.round((vw - tw) / 2) + "px";
      tip.style.top  = Math.round((vh - th) / 2) + "px";
      return;
    }
    const order = preferredPos
      ? [preferredPos, ...["bottom","top","right","left"].filter(p => p !== preferredPos)]
      : ["bottom","top","right","left"];

    for (const pos of order) {
      const gap = sp + 12;
      let left, top;
      if (pos === "bottom") { left = tr.left + tr.width/2 - tw/2; top = tr.bottom + gap; }
      else if (pos === "top") { left = tr.left + tr.width/2 - tw/2; top = tr.top - th - gap; }
      else if (pos === "right") { left = tr.right + gap; top = tr.top + tr.height/2 - th/2; }
      else { left = tr.left - tw - gap; top = tr.top + tr.height/2 - th/2; }
      left = Math.max(pad, Math.min(left, vw - tw - pad));
      top  = Math.max(pad, Math.min(top,  vh - th - pad));
      if (top >= pad && top+th <= vh-pad && left >= pad && left+tw <= vw-pad) {
        tip.style.left = Math.round(left) + "px";
        tip.style.top  = Math.round(top)  + "px";
        return;
      }
    }
    tip.style.left = Math.round((vw - tw) / 2) + "px";
    tip.style.top  = Math.round((vh - th) / 2) + "px";
  }

  // ─────────────────────────────────────────────
  // RENDER TOOLTIP
  // ─────────────────────────────────────────────
  function renderTooltip(opts, flowMeta) {
    removeTooltip();
    const targetEl = opts.target ? $(opts.target) : null;
    const tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-modal", "true");

    // Localise fields
    const title = localise(opts.title);
    const body  = localise(opts.body);
    const btnLabel = opts.button ? localise(opts.button.label) : null;

    // Progress
    let progressHtml = "";
    if (flowMeta && flowMeta.total > 1) {
      const dots = Array.from({ length: flowMeta.total }, (_, i) => {
        const cls = i < flowMeta.current ? "done" : i === flowMeta.current ? "active" : "";
        return `<span class="sg-progress-dot ${cls}"></span>`;
      }).join("");
      progressHtml = `
        <div class="sg-progress-dots">${dots}</div>
        <span class="sg-progress">${t("step", { current: flowMeta.current + 1, total: flowMeta.total })}</span>`;
    }

    // Optional link button
    const actionBtn = btnLabel
      ? `<a href="${opts.button.url || "#"}" class="sg-btn sg-btn-link"
           ${opts.button.newTab ? 'target="_blank" rel="noopener"' : ""}>${btnLabel} →</a>`
      : "";

    // Navigation
    let navHtml = "";
    if (flowMeta) {
      const isFirst = flowMeta.current === 0;
      const isLast  = flowMeta.current === flowMeta.total - 1;
      navHtml = `<div class="sg-btn-group">
        ${!isFirst ? `<button class="sg-btn sg-btn-ghost" data-sg="prev">${t("prev")}</button>` : ""}
        <button class="sg-btn sg-btn-primary" data-sg="${isLast ? "done" : "next"}">
          ${isLast ? t("done") : t("next")}</button>
      </div>`;
    }

    tip.innerHTML = `
      <div class="sg-tooltip-header">
        <p class="sg-tooltip-title">${title}</p>
        <button class="sg-tooltip-close" data-sg="close" aria-label="${t("close")}">×</button>
      </div>
      ${body ? `<p class="sg-tooltip-body">${body}</p>` : ""}
      <div class="sg-tooltip-footer">
        <div style="display:flex;gap:8px;align-items:center">${progressHtml}</div>
        ${actionBtn}
        ${navHtml}
      </div>`;
    document.body.appendChild(tip);

    if (targetEl) {
      placeBeacon(targetEl);
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        positionTooltip(tip, targetEl, opts.position);
        showOverlay(targetEl);
      }));
    } else {
      positionTooltip(tip, null, null);
      showOverlay(null);
    }

    tip.addEventListener("click", function (e) {
      const action = e.target.closest("[data-sg]")?.dataset.sg;
      if (!action) return;
      if (action === "close") ShopGuide.close();
      else if (action === "next") _nextStep();
      else if (action === "prev") _prevStep();
      else if (action === "done") _finishFlow();
    });
    getOverlay().addEventListener("click", ShopGuide.close, { once: true });
    window.addEventListener("resize", _onResize);
  }

  function removeTooltip() {
    const tip = document.getElementById(TOOLTIP_ID);
    if (tip) tip.remove();
    removeBeacons();
    window.removeEventListener("resize", _onResize);
  }

  function _onResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (!_activeFlow) return;
      const step     = _activeFlow.steps[_activeStep];
      const tip      = document.getElementById(TOOLTIP_ID);
      const targetEl = step.target ? $(step.target) : null;
      if (tip && targetEl) {
        positionTooltip(tip, targetEl, step.position);
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) updateSpotlight(overlay, targetEl);
        placeBeacon(targetEl);
      }
    }, 100);
  }

  // ─────────────────────────────────────────────
  // FLOW LOGIC
  // ─────────────────────────────────────────────
  function _showStep(index) {
    if (!_activeFlow) return;
    const step = _activeFlow.steps[index];
    if (!step) return;
    _activeStep = index;
    renderTooltip(step, { current: index, total: _activeFlow.steps.length });
    track("sg_step_viewed", {
      sg_flow_id:   _activeFlow.id,
      sg_step:      index,
      sg_step_name: typeof step.title === "string" ? step.title : "",
    });
  }

  function _nextStep() {
    if (_activeStep < _activeFlow.steps.length - 1) _showStep(_activeStep + 1);
    else _finishFlow();
  }

  function _prevStep() {
    if (_activeStep > 0) _showStep(_activeStep - 1);
  }

  function _finishFlow() {
    if (!_activeFlow) return;
    markCompleted(_activeFlow.id);
    track("sg_flow_completed", { sg_flow_id: _activeFlow.id });
    const cb = _activeFlow.onComplete;
    const id = _activeFlow.id;
    _activeFlow = null;
    _activeStep = 0;
    removeTooltip();
    hideOverlay();
    if (typeof cb === "function") cb(id);
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────
  const ShopGuide = {
    init(config) {
      _config  = config || {};
      _theme   = merge(DEFAULT_THEME, _config.theme || {});
      const lang = resolveLocale(_config);
      _strings = buildStrings(lang, _config.strings);
      injectStyles(_theme);

      (_config.flows || []).forEach((flow) => {
        if (flow.autoStart && urlMatches(flow.urlPattern)) {
          if (!flow.once || !hasCompleted(flow.id)) {
            const start = () => this.startFlow(flow.id);
            document.readyState === "loading"
              ? document.addEventListener("DOMContentLoaded", start)
              : setTimeout(start, flow.delay || 0);
          }
        }
      });

      (_config.tooltips || []).forEach((tooltip) => {
        if (tooltip.autoShow && urlMatches(tooltip.urlPattern)) {
          if (!tooltip.once || !hasCompleted(tooltip.id)) {
            setTimeout(() => this.showTooltip(tooltip), tooltip.delay || 0);
          }
        }
      });
    },

    startFlow(flowId) {
      const flow = (_config.flows || []).find((f) => f.id === flowId);
      if (!flow) { console.warn("[ShopGuide] Flow not found:", flowId); return; }
      if (flow.once && hasCompleted(flow.id)) return;
      _activeFlow = flow;
      _activeStep = 0;
      track("sg_flow_started", { sg_flow_id: flow.id });
      _showStep(0);
    },

    showTooltip(tooltipConfig) {
      _activeFlow = null;
      track("sg_tooltip_shown", { sg_tooltip_id: tooltipConfig.id });
      renderTooltip(tooltipConfig, null);
    },

    close() {
      if (_activeFlow) {
        track("sg_flow_dismissed", { sg_flow_id: _activeFlow.id, sg_step: _activeStep });
        _activeFlow = null;
        _activeStep = 0;
      }
      removeTooltip();
      hideOverlay();
    },

    reset(id) {
      if (id) localStorage.removeItem(lsKey(id));
      else Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
    },

    hasCompleted,

    /** Returns current language code resolved by the framework */
    getLocale() { return resolveLocale(_config); },
  };

  global.ShopGuide = ShopGuide;
})(window);


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE — Schweiz: Flows mit deutschen + französischen + italienischen Texten
// ─────────────────────────────────────────────────────────────────────────────
/*
ShopGuide.init({

  // Sprache: auto via navigator.language ODER manuell gesetzt (z. B. aus Shopvariable)
  // locale: "fr",  ← falls ihr die Sprache vom Shop-Backend kennt

  theme: {
    primary:         "#1A56DB",
    borderRadius:    "10px",
    beaconColor:     "#1A56DB",
    beaconPosition:  "top-right",
  },

  // Globale String-Überschreibungen (optional, überschreiben Built-ins)
  strings: {
    // z. B. eigene Button-Labels
    // next: "Los →",
  },

  flows: [
    {
      id: "schnellbestellung-tour",
      autoStart: true,
      once: true,
      urlPattern: "/shop*",
      delay: 800,
      steps: [
        {
          target: "#quick-order-input",
          position: "bottom",
          title: {
            de: "Schnellbestellung",
            fr: "Commande rapide",
            it: "Ordine rapido",
            en: "Quick order",
          },
          body: {
            de: "Gib einfach die Artikelnummer ein und bestelle in Sekunden.",
            fr: "Saisissez simplement le numéro d'article et commandez en quelques secondes.",
            it: "Inserisci semplicemente il numero articolo e ordina in pochi secondi.",
            en: "Enter the part number and order in seconds.",
          },
        },
        {
          target: "#bulk-discount-badge",
          position: "left",
          title: {
            de: "Mengenrabatt",
            fr: "Remise sur quantité",
            it: "Sconto quantità",
            en: "Volume discount",
          },
          body: {
            de: "Ab 10 Stück erhaltet ihr automatisch 8% Rabatt.",
            fr: "À partir de 10 pièces, vous bénéficiez automatiquement de 8% de remise.",
            it: "Da 10 pezzi ricevete automaticamente l'8% di sconto.",
            en: "From 10 units you automatically get 8% off.",
          },
          button: {
            label: { de: "Preisübersicht", fr: "Voir les prix", it: "Prezzi", en: "Price list" },
            url: "/pricing",
          },
        },
      ],
    },
  ],

});
*/
