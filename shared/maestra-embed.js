/*
 * MAESTRA embed sizing v1.0
 * Shows embedded simulators (iframes) at their full content height, so the page scrolls as one
 * and the simulator has no scrollbar of its own.
 *
 * Parent pages: include this script. It sizes every iframe it can read (srcdoc, blob, same origin).
 * Simulator pages: include it too. When the page is embedded somewhere it cannot be read from
 * (e.g. pages opened from file://), it reports its own height to the parent instead.
 *
 * Opt out per frame with data-maestra-embed="off". Frames that a page already sizes itself
 * (MESFET tutor, MOS AI simulators, nMOS lab, thyristor labs) are left alone.
 */
(() => {
  'use strict';
  const MSG = 'maestra-embed-height';
  const SKIP = 'iframe[data-maestra-embed="off"], iframe.embed-frame, iframe[data-ai-simulator], iframe[data-nmos-device-lab], .thySection iframe';
  const FIX_CSS = 'html,body{height:auto!important;min-height:0!important;overflow:hidden!important}';

  function contentHeight(doc) {
    const b = doc.body; if (!b) return 0;
    const win = doc.defaultView, cs = win.getComputedStyle(b), r = b.getBoundingClientRect();
    return Math.ceil(r.bottom + win.scrollY + (parseFloat(cs.marginBottom) || 0) + 4);
  }

  /* ───── child side: report own height when embedded ───── */
  if (window.parent !== window) {
    let last = 0, queued = false;
    const style = document.createElement('style'); style.textContent = FIX_CSS; style.dataset.maestraEmbed = '1';
    window.addEventListener('message', e => { if (e.source === window.parent && e.data?.type === 'maestra-embed-scroll') style.remove(); });
    const send = () => {
      queued = false;
      const h = contentHeight(document);
      if (!h || Math.abs(h - last) < 2) return;
      last = h;
      try { window.parent.postMessage({ type: MSG, h }, '*'); } catch (_) {}
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(send); } };
    const start = () => {
      (document.head || document.documentElement).appendChild(style);
      if (window.ResizeObserver && document.body) new ResizeObserver(queue).observe(document.body);
      queue(); setInterval(queue, 1500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.addEventListener('load', queue);
  }

  /* ───── parent side: size readable frames, accept reports from the rest ───── */
  const managed = new WeakMap();

  function setHeight(frame, h) {
    if (!Number.isFinite(h) || h <= 80 || h > 50000) return;
    frame.style.setProperty('height', Math.ceil(h) + 'px', 'important');
    frame.style.setProperty('min-height', '0', 'important');
    frame.style.setProperty('max-height', 'none', 'important');
    frame.style.setProperty('overflow', 'hidden', 'important');
    frame.setAttribute('scrolling', 'no');
  }

  function manage(frame) {
    if (managed.has(frame) || frame.matches(SKIP)) return;
    const originalStyle = frame.getAttribute('style'), originalScrolling = frame.getAttribute('scrolling');
    const state = { fixed: false, last: 0, ro: null, viewportBound: false };
    managed.set(frame, state);

    const measure = () => {
      if (state.viewportBound) return;
      let doc;
      try { doc = frame.contentDocument; } catch (_) { return; }
      if (!doc || !doc.body || frame.offsetParent === null) return;
      if (!state.fixed) {
        const st = doc.createElement('style'); st.textContent = FIX_CSS; st.dataset.maestraEmbed = '1';
        (doc.head || doc.documentElement).appendChild(st); state.fixed = true;
      }
      const h = contentHeight(doc);
      if (!h || Math.abs(h - state.last) < 2) return;
      /* guard: if the content grows whenever the frame grows (layout tied to 100vh), stop
         and keep the page's own height and scrollbar rather than growing forever */
      const before = frame.clientHeight;
      if (state.last && h > state.last && h >= before - 2 && h - before < 8) {
        if (++state.grow > 3) { state.viewportBound = true;
          if (originalStyle === null) frame.removeAttribute('style'); else frame.setAttribute('style',originalStyle);
          if (originalScrolling === null) frame.removeAttribute('scrolling'); else frame.setAttribute('scrolling',originalScrolling);
          doc.querySelectorAll('style[data-maestra-embed]').forEach(s => s.remove());
          try { frame.contentWindow.postMessage({type:'maestra-embed-scroll'},'*'); } catch (_) {}
          return; }
      } else state.grow = 0;
      state.last = h;
      setHeight(frame, h);
    };
    state.grow = 0;
    const schedule = () => requestAnimationFrame(() => requestAnimationFrame(measure));

    const attach = () => {
      state.fixed = false; state.last = 0; state.viewportBound = false; state.grow = 0;
      let doc; try { doc = frame.contentDocument; } catch (_) { doc = null; }
      if (doc && doc.body && window.ResizeObserver) {
        try { state.ro && state.ro.disconnect(); state.ro = new ResizeObserver(schedule); state.ro.observe(doc.body); } catch (_) {}
      }
      schedule(); setTimeout(schedule, 300); setTimeout(schedule, 1200);
    };
    frame.addEventListener('load', attach);
    if (frame.loading === 'lazy') frame.loading = 'eager';
    attach();
    frame._maestraMeasure = schedule;
  }

  /* ───── shared design for embedded copies (srcdoc/blob simulators) ───── */
  const DESIGN_URL = (() => { try { return new URL('maestra-design.css?v=20261115f', document.currentScript.src).href; } catch (_) { return ''; } })();
  const PAGE_BY_TITLE = [
    [/Fermi-Dirac/i, 'fermi'], [/Water Table|MOS Metaphor/i, 'mos-water'], [/Surface-Potential/i, 'mos-surface'],
    [/C.V Frequency/i, 'mos-cv'], [/nMOS Device Lab/i, 'nmos'], [/Rubber-Sheet Poisson/i, 'poisson'],
    [/Photovoltaic Waterworks/i, 'solar-loop'], [/Drift-Diffusion/i, 'drift']
  ];
  const parentTheme = () => document.documentElement.getAttribute('data-theme');
  function styleChild(frame) {
    let doc; try { doc = frame.contentDocument; } catch (_) { return; }
    if (!doc || !doc.documentElement || !DESIGN_URL) return;
    const html = doc.documentElement;
    if (!html.hasAttribute('data-maestra-page')) {
      const t = doc.title || frame.title || '';
      const hit = PAGE_BY_TITLE.find(([re]) => re.test(t));
      if (!hit) return;
      html.setAttribute('data-maestra-page', hit[1]);
    }
    if (!doc.getElementById('maestra-design')) {
      const link = doc.createElement('link'); link.id = 'maestra-design'; link.rel = 'stylesheet'; link.href = DESIGN_URL;
      (doc.body || html).appendChild(link);
    }
    const t = parentTheme(); if (t && html.getAttribute('data-theme') !== t) html.setAttribute('data-theme', t);
  }
  function wireDesign(frame) {
    if (frame._maestraDesign) return; frame._maestraDesign = true;
    frame.addEventListener('load', () => styleChild(frame)); styleChild(frame);
  }
  new MutationObserver(() => document.querySelectorAll('iframe').forEach(styleChild))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function scan(root) { (root || document).querySelectorAll('iframe').forEach(f => { manage(f); wireDesign(f); }); }

  window.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== MSG) return;
    document.querySelectorAll('iframe').forEach(f => {
      if (f.contentWindow === e.source && !f.matches(SKIP)) {
        const st = managed.get(f); if (st && st.viewportBound) return;
        setHeight(f, d.h);
      }
    });
  });

  const boot = () => {
    scan();
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IFRAME') { manage(n); wireDesign(n); } else if (n.querySelectorAll) scan(n);
    }))).observe(document.body, { childList: true, subtree: true });
    /* frames inside hidden pages/tabs measure once they become visible */
    const remeasure = () => document.querySelectorAll('iframe').forEach(f => f._maestraMeasure && f._maestraMeasure());
    window.addEventListener('resize', remeasure);
    document.addEventListener('click', () => setTimeout(remeasure, 120), true);
    window.addEventListener('hashchange', () => setTimeout(remeasure, 120));
    setInterval(remeasure, 2000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
