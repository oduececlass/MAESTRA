/*
 * MAESTRA AI Tutor v1.0 — one chapter tutor, powered by Google AI Studio (Gemini API).
 *
 * Include on a chapter page:
 *   <link rel="stylesheet" href="../../shared/maestra-ai.css">
 *   <script defer src="../../shared/maestra-ai.js" data-chapter="t2" data-chapter-title="2. PN Diode"></script>
 *
 * - Students use their own API key. It is stored only in this browser and sent only to Google.
 * - Setup is shared by every chapter (and copied into the older simulator AI panels), so it is asked once.
 * - The tutor knows the section on screen and any visible virtual-lab readings.
 * - Chats are saved automatically; they can be renamed, reopened, deleted, exported and imported.
 */
(() => {
  'use strict';
  if (window.MaestraAI) return;

  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const S_KEY = 'maestra_ai_settings_v1';
  const C_KEY = 'maestra_ai_chats_v1';
  const LEGACY = ['pnDiodeTutorConfig', 'rubberSheetChatConfig', 'rubberSheetLabChatConfig', 'bjtMetaphorChatConfig',
    'mosMetaphorAiTutorConfig', 'mosSurfacePotentialAiTutorConfig', 'mosCvAiTutorConfig', 'nmosDeviceAiTutorConfig'];
  const script = document.currentScript || {};
  const ds = script.dataset || {};
  const CH = { id: ds.chapter || location.pathname.split('/').pop() || 'general', title: ds.chapterTitle || document.title };
  const DEFAULTS = { apiKey: '', model: '', temperature: 0.5, maxTokens: 2048, mode: 'socratic', remember: false };

  /* ───────────────────────── storage ───────────────────────── */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  };
  function loadSettings() {
    let s = ls.get(S_KEY, null);
    if (!s) { try { const t = sessionStorage.getItem(S_KEY); if (t) s = JSON.parse(t); } catch (_) {} }
    if (!s || !s.apiKey) {                                   // reuse a key already entered in an older panel
      for (const k of LEGACY) { const c = ls.get(k, null); if (c && c.apiKey && (!c.provider || c.provider === 'google')) { s = { ...(s || {}), apiKey: c.apiKey, model: (s && s.model) || '' }; break; } }
    }
    return { ...DEFAULTS, ...(s || {}) };
  }
  function saveSettings(s) {
    if (s.remember) { ls.set(S_KEY, s); try { sessionStorage.removeItem(S_KEY); } catch (_) {} syncLegacy(s); }
    else { forgetKey(); try { sessionStorage.setItem(S_KEY, JSON.stringify(s)); } catch (_) {} }
  }
  function syncLegacy(s) {                                   // older simulator panels read these keys on load
    for (const k of LEGACY) { const c = ls.get(k, {}) || {}; ls.set(k, { ...c, provider: 'google', apiKey: s.apiKey, ...(s.model ? { model: s.model } : {}) }); }
  }
  function forgetKey() {
    ls.del(S_KEY); try { sessionStorage.removeItem(S_KEY); } catch (_) {}
    for (const k of LEGACY) { const c = ls.get(k, null); if (c && c.apiKey) { c.apiKey = ''; ls.set(k, c); } }
  }
  let chatMemory = null;
  let temporaryChats = false;
  const store = {
    all() {
      if (temporaryChats && chatMemory) return chatMemory;
      const d = ls.get(C_KEY, null);
      chatMemory = d && d.chats && d.current ? d : (chatMemory || { v: 1, chats: {}, current: {} });
      return chatMemory;
    },
    save(d) {
      chatMemory = d;
      temporaryChats = !ls.set(C_KEY, d);
      return !temporaryChats;
    }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ───────────────────────── page context ───────────────────────── */
  const isVisible = el => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const clean = s => (s || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  function currentSection() {
    const sel = 'section[data-title], section.section, section.topic, .view-block, #pageBody';
    const cands = [...document.querySelectorAll(sel)].filter(el => isVisible(el) && !el.closest('.mai-root'));
    const mid = Math.min(innerHeight * 0.4, 360);
    const holding = cands.filter(el => { const r = el.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
    let el = holding.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
    if (!el) el = cands.sort((a, b) => { const ov = x => { const r = x.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); }; return ov(b) - ov(a); })[0];
    const pageTitle = document.getElementById('pageTitle');
    let title = '';
    if (el) title = el.dataset.title || (el.querySelector('h1,h2') || {}).textContent || '';
    if ((!title || el?.id === 'pageBody') && pageTitle) title = pageTitle.textContent;
    title = clean(title) || CH.title;
    let sub = '';
    if (el) {
      const hs = [...el.querySelectorAll('h3,h4')].filter(h => isVisible(h) && !h.closest('.mai-root'));
      const above = hs.filter(h => h.getBoundingClientRect().top < mid).pop();
      if (above) sub = clean(above.textContent).slice(0, 90);
    }
    let text = '';
    if (el) {
      /* keep equations as their TeX source (MathJax remembers it for every typeset item) */
      const texOf = new Map();
      try { (window.MathJax && MathJax.startup && MathJax.startup.document ? MathJax.startup.document.getMathItemsWithin(el) : []).forEach(it => { if (it.typesetRoot) texOf.set(it.typesetRoot, it.display ? `\\[${it.math}\\]` : `\\(${it.math}\\)`); }); } catch (_) {}
      const origMath = [...el.querySelectorAll('mjx-container')];
      const c = el.cloneNode(true);
      [...c.querySelectorAll('mjx-container')].forEach((m, i) => { const tex = texOf.get(origMath[i]); m.replaceWith(document.createTextNode(tex ? ` ${tex} ` : ' [equation] ')); });
      c.querySelectorAll('script,style,svg,canvas,iframe,button,select,input,.mai-root,.vl-notebook').forEach(n => n.remove());
      text = clean(c.textContent).slice(0, 7000);
    }
    return { title, sub, text, lab: currentLab() };
  }
  function currentLab() {
    const p = [...document.querySelectorAll('.vl-inst')].find(x => { if (!isVisible(x)) return false; const r = x.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    if (!p) return null;
    const name = clean((p.closest('.vl-page') && (p.closest('.vl-page').querySelector('h4') || {}).textContent) || (p.querySelector('.vl-inst-title') || {}).textContent || 'Virtual lab');
    const metrics = [...p.querySelectorAll('.vl-stat')].map(s => `${clean(s.querySelector('.k')?.textContent)}: ${clean(s.querySelector('.v')?.textContent)}`).join('; ');
    const controls = [...p.querySelectorAll('.vl-ctrl')].map(c => `${clean(c.querySelector('.name')?.textContent)} = ${clean(c.querySelector('.val')?.textContent)}`).join('; ');
    const rows = (p._rows || []).slice(-12);
    const table = rows.length ? [Object.keys(rows[0]).join(' | '), ...rows.map(r => Object.values(r).join(' | '))].join('\n') : '';
    return { name, metrics, controls, table, count: (p._rows || []).length };
  }

  /* ───────────────────────── Gemini API ───────────────────────── */
  function sysPrompt(ctx, mode) {
    const style = mode === 'explain'
      ? 'Explain directly and clearly. Use the key equations, and add a short worked example when it helps. End by suggesting one follow-up question the student could explore.'
      : 'Teach Socratically. Guide with hints and one or two focused questions instead of giving final numerical answers or full derivations, unless the student explicitly asks for the full solution. Check understanding at the end with one short question.';
    let s = `You are the MAESTRA AI Tutor for the chapter "${CH.title}" of an undergraduate solid-state electronics course (semiconductor devices, Neamen/Pierret level). MAESTRA is an NSF-funded learning platform that combines physical metaphors, Socratic questioning and interactive simulation.
The student is currently reading the section "${ctx.title}"${ctx.sub ? ` (subsection "${ctx.sub}")` : ''}.
Teaching style: ${style}
Rules:
- Ground your answers in the section text below and in standard device physics. Use the chapter's notation and symbols.
- Write all mathematics in LaTeX using \\( ... \\) for inline and \\[ ... \\] for display equations. Never use $ delimiters.
- Be concise: usually under 200 words, with short paragraphs or bullet points. Use **bold** for key terms.
- When lab readings are provided, interpret the student's own numbers. Never invent measurement data.
- If a question is unrelated to the course, answer briefly and steer back to the topic. If you are not sure, say so.`;
    if (ctx.text) s += `\n\nSection text (excerpt from the page the student sees):\n"""\n${ctx.text}\n"""`;
    if (ctx.lab) s += `\n\nVirtual lab on screen: ${ctx.lab.name}\nControls: ${ctx.lab.controls}\nReadouts: ${ctx.lab.metrics}` + (ctx.lab.table ? `\nLab notebook (last ${Math.min(12, ctx.lab.count)} of ${ctx.lab.count} readings):\n${ctx.lab.table}` : '\nLab notebook: empty');
    return s;
  }
  function apiError(status, body) {
    let msg = ''; try { msg = JSON.parse(body).error.message; } catch (_) { msg = body.slice(0, 200); }
    if (status === 400 && /API key/i.test(msg)) return 'The API key was rejected. Check it in Settings.';
    if (status === 403) return 'Access denied (403). The key may be restricted or the Gemini API is not enabled for it.';
    if (status === 404) return 'Model not found (404). Pick another model in Settings.';
    if (status === 429) return 'Rate limit reached (429). Wait a minute and try again; the free tier allows a limited number of requests per minute.';
    if (status >= 500) return `Google's service had a problem (${status}). Try again shortly.`;
    return `Request failed (${status}): ${msg}`;
  }
  async function listModels(key) {
    const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000) });
    const body = await res.text(); if (!res.ok) throw new Error(apiError(res.status, body));
    const ms = (JSON.parse(body).models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name) && !/embed|image|tts|audio|live|vision|aqa|robotics|computer/i.test(m.name));
    const ver = n => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    const rank = n => (/pro/.test(n) ? 1 : 0) + (/lite/.test(n) ? 2 : 0) + (/preview|exp/.test(n) ? 3 : 0);
    return ms.map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
      .sort((a, b) => rank(a.id) - rank(b.id) || ver(b.id) - ver(a.id) || a.id.localeCompare(b.id));
  }
  async function* streamChat(settings, history, ctx, signal) {
    const url = `${API}/models/${encodeURIComponent(settings.model || 'gemini-2.5-flash')}:streamGenerateContent?alt=sse`;
    const body = {
      systemInstruction: { parts: [{ text: sysPrompt(ctx, settings.mode) }] },
      contents: history.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })),
      generationConfig: { temperature: +settings.temperature, maxOutputTokens: +settings.maxTokens }
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey }, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(apiError(res.status, await res.text()));
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      buf += done ? dec.decode() + '\n' : dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        let j; try { j = JSON.parse(line.slice(5)); } catch (_) { continue; }
        if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error(`The request was blocked (${j.promptFeedback.blockReason}). Rephrase the question.`);
        const c = (j.candidates || [])[0]; if (!c) continue;
        const t = ((c.content || {}).parts || []).map(p => p.text || '').join('');
        if (t) yield { text: t };
        if (c.finishReason && c.finishReason !== 'STOP') yield { finish: c.finishReason };
      }
      if (done) break;
    }
  }

  /* ───────────────────────── markdown + math rendering ───────────────────────── */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function inline(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }
  function md(src) {
    const keep = [];
    const hold = h => { keep.push(h); return `\u0000${keep.length - 1}\u0000`; };
    src = String(src).replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (m, l, c) => hold(`<pre><code>${esc(c.replace(/\n$/, ''))}</code></pre>`));
    src = src.replace(/\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$/g, m => hold(esc(m)));
    const lines = esc(src).split('\n'); const out = []; let list = null, para = [], table = [];
    const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join('<br>'))}</p>`); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map(x => `<li>${inline(x)}</li>`).join('')}</${list.t}>`); list = null; } };
    const flushT = () => { if (table.length) { const rows = table.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
        out.push(`<div class="mai-tablewrap"><table><thead><tr>${rows[0].map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); table = []; } };
    for (const raw of lines) {
      const ln = raw.replace(/\s+$/, '');
      let m;
      if (/^\s*\|.*\|\s*$/.test(ln)) { flushP(); flushL(); table.push(ln.trim()); continue; } else flushT();
      if (!ln.trim()) { flushP(); flushL(); continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { flushP(); flushL(); out.push('<hr>'); continue; }
      if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); out.push(`<h4>${inline(m[2])}</h4>`); continue; }
      if ((m = ln.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = ln.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
      if (list && /^\s{2,}\S/.test(ln)) { list.items[list.items.length - 1] += ' ' + ln.trim(); continue; }
      flushL(); para.push(ln);
    }
    flushP(); flushL(); flushT();
    return out.join('').replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
  }
  function typeset(el) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {}); }

  /* ───────────────────────── UI ───────────────────────── */
  const I = {
    spark: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    redo: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>', trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', key: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zM15.5 7.5l3 3L22 7l-3-3"/>'
  };
  const svg = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
  const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } if (html) e.innerHTML = html; return e; };

  let settings = loadSettings(), chat = null, busy = null, view = 'chat', root, ui = {};

  function build() {
    root = h('div', { class: 'mai-root' });
    root.innerHTML = `
<button type="button" class="mai-launch" aria-label="Open AI tutor" title="AI Tutor">${svg('spark', 22)}<span>AI Tutor</span></button>
<section class="mai-panel" role="dialog" aria-label="MAESTRA AI Tutor" hidden>
  <header class="mai-head">
    <div class="mai-brand"><span class="mai-logo">${svg('spark', 18)}</span><div><b>AI Tutor</b><small>${esc(CH.title)}</small></div></div>
    <div class="mai-tools">
      <button type="button" data-a="new" title="New chat">${svg('plus')}</button>
      <button type="button" data-a="history" title="Chat history">${svg('hist')}</button>
      <button type="button" data-a="settings" title="AI setup">${svg('gear')}</button>
      <button type="button" data-a="expand" class="mai-only-wide" title="Expand">${svg('expand')}</button>
      <button type="button" data-a="close" title="Close">${svg('x')}</button>
    </div>
  </header>
  <div class="mai-context"><span class="mai-dot"></span><span class="mai-ctx-text">Reading: …</span><span class="mai-lab-chip" hidden></span></div>
  <div class="mai-views">
    <div class="mai-view mai-chatview">
      <div class="mai-msgs" aria-live="polite"></div>
      <div class="mai-composer">
        <div class="mai-chips"></div>
        <div class="mai-inputrow">
          <textarea rows="1" placeholder="Ask about this section…" aria-label="Message"></textarea>
          <button type="button" class="mai-send" data-a="send" title="Send (Enter)">${svg('send')}</button>
        </div>
        <div class="mai-foot">
          <div class="mai-mode" role="group" aria-label="Tutor style"><button type="button" data-mode="socratic">Socratic hints</button><button type="button" data-mode="explain">Explain</button></div>
          <span class="mai-note">AI can make mistakes. Check important results with the chapter.</span>
        </div>
      </div>
    </div>
    <div class="mai-view mai-histview" hidden></div>
    <div class="mai-view mai-setview" hidden></div>
  </div>
  <div class="mai-toast" hidden></div>
</section>
<input type="file" accept="application/json,.json" hidden class="mai-file">`;
    document.body.appendChild(root);
    ui = {
      launch: root.querySelector('.mai-launch'), panel: root.querySelector('.mai-panel'), msgs: root.querySelector('.mai-msgs'),
      ta: root.querySelector('textarea'), send: root.querySelector('.mai-send'), chips: root.querySelector('.mai-chips'),
      ctx: root.querySelector('.mai-ctx-text'), lab: root.querySelector('.mai-lab-chip'), hist: root.querySelector('.mai-histview'),
      set: root.querySelector('.mai-setview'), chatv: root.querySelector('.mai-chatview'), toast: root.querySelector('.mai-toast'), file: root.querySelector('.mai-file')
    };
    ui.launch.addEventListener('click', () => open());
    root.querySelector('.mai-head').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
    ui.send.addEventListener('click', () => busy ? stop() : send());
    ui.ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) send(); } });
    ui.ta.addEventListener('input', autosize);
    root.querySelector('.mai-mode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; settings.mode = b.dataset.mode; saveSettings(settings); paintMode(); });
    ui.panel.addEventListener('keydown', e => { if (e.key === 'Escape') { if (view !== 'chat') show('chat'); else close(); } });
    ui.file.addEventListener('change', importFile);
    paintMode();
    draggable(ui.panel, root.querySelector('.mai-head'), 'maestra_ai_panel_pos_v1', { ignore: 'button' });
    draggable(ui.launch, ui.launch, 'maestra_ai_launch_pos_v1', { clickGuard: true });
    addEventListener('resize', () => { clampEl(ui.panel); clampEl(ui.launch); });
  }

  /* ───── drag to move (window by its header, launcher anywhere); positions remembered across pages ───── */
  const phone = () => matchMedia('(max-width: 640px)').matches;
  function clampEl(el) {
    if (!el || !el.classList.contains('mai-moved') || phone() || !el.offsetWidth) return; // hidden: clamp when shown
    // offset* ignore the open animation's transform, so a restored position is not nudged
    const m = 8, w = el.offsetWidth, h = el.offsetHeight;
    const x = Math.min(Math.max(el.offsetLeft, m), Math.max(m, innerWidth - w - m));
    const y = Math.min(Math.max(el.offsetTop, m), Math.max(m, innerHeight - Math.min(h, innerHeight - 2 * m) - m));
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function placeSaved(el, key) {
    const p = ls.get(key, null);
    if (!p || phone()) { el.classList.remove('mai-moved'); el.style.left = el.style.top = ''; return; }
    el.classList.add('mai-moved'); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; requestAnimationFrame(() => clampEl(el));
  }
  function draggable(el, handle, key, opt = {}) {
    placeSaved(el, key);
    let start = null, moved = false;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || phone() || (opt.ignore && e.target.closest(opt.ignore))) return;
      start = { px: e.clientX, py: e.clientY, x: el.offsetLeft, y: el.offsetTop }; moved = false;
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    });
    handle.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; el.classList.add('mai-moved', 'mai-dragging'); }
      el.style.left = start.x + dx + 'px'; el.style.top = start.y + dy + 'px'; clampEl(el);
    });
    const end = e => {
      if (!start) return;
      if (moved) { ls.set(key, { x: el.offsetLeft, y: el.offsetTop }); el.classList.remove('mai-dragging'); }
      start = null;
      if (moved && opt.clickGuard) { const stop = ev => { ev.stopImmediatePropagation(); ev.preventDefault(); }; el.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener('click', stop, true), 50); }
    };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    handle.addEventListener('dblclick', e => { if (opt.ignore && e.target.closest(opt.ignore)) return; ls.del(key); placeSaved(el, key); });
  }
  const autosize = () => { ui.ta.style.height = 'auto'; ui.ta.style.height = Math.min(ui.ta.scrollHeight, 160) + 'px'; };
  function paintMode() { root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === settings.mode)); }
  function toast(msg, kind = 'ok') { if (!ui.toast) return; ui.toast.textContent = msg; ui.toast.className = 'mai-toast ' + kind; ui.toast.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast.hidden = true; }, 3200); }
  function show(v) { view = v; ui.chatv.hidden = v !== 'chat'; ui.hist.hidden = v !== 'history'; ui.set.hidden = v !== 'settings'; if (v === 'history') renderHistory(); if (v === 'settings') renderSettings(); if (v === 'chat') { renderChat(); setTimeout(() => ui.ta.focus(), 30); } }

  let ctxTimer = null;
  function refreshContext() {
    const c = currentSection();
    ui.ctx.textContent = 'Reading: ' + (c.sub ? `${c.title} › ${c.sub}` : c.title);
    if (c.lab) { ui.lab.hidden = false; ui.lab.textContent = `Lab: ${c.lab.name.replace(/^Lab \d+\s*[—-]\s*/, '')}${c.lab.count ? ` · ${c.lab.count} readings` : ''}`; } else ui.lab.hidden = true;
    renderChips(c);
    return c;
  }
  function renderChips(c) {
    const chips = [['Explain this section simply', 'Explain the key idea of this section simply, in plain language first and then with the main equation.'],
      ['Give me a hint', 'I am stuck on this section. Give me a hint, not the answer.'],
      ['Quiz me', 'Ask me one conceptual question about this section, wait for my answer, then give feedback.'],
      ['Connect to the metaphor', 'How does the physical metaphor used in this chapter map onto the physics of this section?']];
    if (c.lab) chips.splice(2, 0, ['Check my lab data', 'Look at my lab readings and readouts. Are they consistent with the theory? What should I look at next?']);
    ui.chips.innerHTML = chips.map(([l, p]) => `<button type="button" data-p="${esc(p)}">${esc(l)}</button>`).join('');
    ui.chips.onclick = e => { const b = e.target.closest('[data-p]'); if (b && !busy) { ui.ta.value = b.dataset.p; send(); } };
  }

  function open() {
    ui.panel.hidden = false; ui.launch.classList.add('hide'); document.documentElement.classList.add('mai-open');
    requestAnimationFrame(() => clampEl(ui.panel));
    if (!settings.apiKey) { show('settings'); } else { ensureChat(); show('chat'); }
    if (view === 'chat') typeset(ui.msgs);
    refreshContext(); clearInterval(ctxTimer); ctxTimer = setInterval(() => { if (!ui.panel.hidden && !busy) refreshContext(); }, 2500);
  }
  function close() { stop(); ui.panel.hidden = true; ui.launch.classList.remove('hide'); document.documentElement.classList.remove('mai-open'); clearInterval(ctxTimer); ui.launch.focus(); }
  function act(a) {
    if (busy && ['new', 'history', 'settings'].includes(a)) return toast('Stop the current answer before switching chats or setup.', 'warn');
    if (a === 'close') close();
    else if (a === 'new') { if (!settings.apiKey) return show('settings'); newChat(); show('chat'); toast('New chat started'); }
    else if (a === 'history') show(view === 'history' ? 'chat' : 'history');
    else if (a === 'settings') show(view === 'settings' && settings.apiKey ? 'chat' : 'settings');
    else if (a === 'expand') { ui.panel.classList.toggle('wide'); root.querySelector('[data-a="expand"]').innerHTML = svg(ui.panel.classList.contains('wide') ? 'shrink' : 'expand'); requestAnimationFrame(() => clampEl(ui.panel)); }
  }

  /* chats */
  function ensureChat() {
    const d = store.all(); const id = d.current[CH.id];
    chat = (id && d.chats[id]) || null;
    if (!chat) newChat();
  }
  function newChat() {
    const d = store.all();
    chat = { id: uid(), title: 'New chat', chapter: CH.id, chapterTitle: CH.title, created: Date.now(), updated: Date.now(), messages: [] };
    d.chats[chat.id] = chat; d.current[CH.id] = chat.id; store.save(d);
  }
  function persist() {
    const d = store.all(); chat.updated = Date.now();
    if (chat.title === 'New chat') { const f = chat.messages.find(m => m.role === 'user'); if (f) chat.title = f.text.replace(/\s+/g, ' ').slice(0, 60); }
    d.chats[chat.id] = { ...chat, messages: chat.messages.filter(m => !m.error) };   // errors are shown, never stored
    d.current[CH.id] = chat.id; store.save(d);
  }
  function renderChat() {
    if (!chat) ensureChat();
    ui.msgs.innerHTML = '';
    if (!chat.messages.length) {
      ui.msgs.innerHTML = `<div class="mai-empty"><div class="mai-empty-logo">${svg('spark', 30)}</div><h3>Hi! I'm your tutor for ${esc(CH.title)}.</h3>
        <p>I can see which section you're reading${document.querySelector('.vl-inst') ? ' and any virtual-lab data on screen' : ''}. Ask a question, or try one of the suggestions below.</p>
        <p class="mai-sub">Socratic mode gives hints and questions; Explain mode gives full explanations.</p></div>`;
    }
    chat.messages.forEach((m, i) => ui.msgs.appendChild(msgEl(m, i)));
    /* typeset only once the messages are in the page: MathJax measures the surrounding font */
    if (!ui.panel.hidden && chat.messages.length) typeset(ui.msgs);
    scrollEnd(true);
  }
  function msgEl(m, i) {
    const el = h('div', { class: `mai-msg ${m.role === 'user' ? 'user' : 'bot'}${m.error ? ' err' : ''}` });
    const time = new Date(m.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `<div class="mai-avatar">${m.role === 'user' ? 'You' : svg('spark', 15)}</div>
      <div class="mai-bubble"><div class="mai-meta">${m.role === 'user' ? 'You' : 'AI Tutor'} · ${time}${m.section ? ` · <span title="Section">${esc(m.section)}</span>` : ''}</div>
      <div class="mai-body">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : md(m.text)}</div>
      ${m.role === 'model' && !m.error ? `<div class="mai-actions"><button type="button" data-c="copy" title="Copy">${svg('copy', 14)} Copy</button>${i === chat.messages.length - 1 ? `<button type="button" data-c="retry" title="Regenerate">${svg('redo', 14)} Regenerate</button>` : ''}</div>` : ''}
      ${m.error ? `<div class="mai-actions"><button type="button" data-c="retry">${svg('redo', 14)} Try again</button><button type="button" data-c="settings">${svg('gear', 14)} Setup</button></div>` : ''}</div>`;
    el.querySelector('.mai-actions')?.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'copy') { navigator.clipboard?.writeText(m.text).then(() => toast('Copied')); }
      if (b.dataset.c === 'retry') regenerate();
      if (b.dataset.c === 'settings') show('settings');
    });
    return el;
  }
  const scrollEnd = force => { const s = ui.msgs; if (force || s.scrollHeight - s.scrollTop - s.clientHeight < 140) s.scrollTop = s.scrollHeight; };

  async function send(text) {
    if (busy) return;
    text = (text ?? ui.ta.value).trim(); if (!text) return;
    if (!settings.apiKey) return show('settings');
    const ctx = refreshContext();
    ui.ta.value = ''; autosize();
    chat.messages = chat.messages.filter(m => !m.error);
    chat.messages.push({ role: 'user', text, ts: Date.now(), section: ctx.title });
    persist(); renderChat();
    await answer(ctx);
  }
  async function regenerate() {
    if (busy) return;
    while (chat.messages.length && chat.messages[chat.messages.length - 1].role !== 'user') chat.messages.pop();
    if (!chat.messages.length) return;
    persist(); renderChat(); await answer(refreshContext());
  }
  async function answer(ctx) {
    const reply = { role: 'model', text: '', ts: Date.now() };
    const el = h('div', { class: 'mai-msg bot typing' });
    el.innerHTML = `<div class="mai-avatar">${svg('spark', 15)}</div><div class="mai-bubble"><div class="mai-meta">AI Tutor · thinking…</div><div class="mai-body"><span class="mai-dots"><i></i><i></i><i></i></span></div></div>`;
    ui.msgs.querySelector('.mai-empty')?.remove(); ui.msgs.appendChild(el); scrollEnd(true);
    const body = el.querySelector('.mai-body');
    busy = new AbortController(); ui.send.innerHTML = svg('stop'); ui.send.title = 'Stop'; ui.send.classList.add('stop');
    let note = '';
    let timedOut = false;
    const requestTimer = setTimeout(() => { timedOut = true; busy?.abort(); }, 60000);
    try {
      const hist = chat.messages.filter(m => !m.error).slice(-24);
      let last = 0;
      for await (const part of streamChat(settings, hist, ctx, busy.signal)) {
        if (part.text) { reply.text += part.text; if (Date.now() - last > 60) { body.innerHTML = md(reply.text); scrollEnd(); last = Date.now(); } }
        if (part.finish === 'MAX_TOKENS') note = '\n\n*(Answer cut off at the length limit. Ask "continue" or raise the limit in Setup.)*';
        else if (part.finish === 'SAFETY') note = '\n\n*(Stopped by the safety filter.)*';
      }
      reply.text = (reply.text || '_(No answer was returned. Try rephrasing.)_') + note;
    } catch (err) {
      if (err.name === 'AbortError') { reply.text = (reply.text || '') + (timedOut ? '\n\n*(Request timed out. Try again.)*' : '\n\n*(Stopped.)*'); }
      else { reply.text = (err && err.message) || 'Network error. Check your internet connection.'; reply.error = true; }
    } finally {
      clearTimeout(requestTimer);
      busy = null; ui.send.innerHTML = svg('send'); ui.send.title = 'Send (Enter)'; ui.send.classList.remove('stop');
    }
    chat.messages.push(reply); persist(); renderChat();
  }
  function stop() { if (busy) busy.abort(); }

  /* history view */
  function renderHistory() {
    const d = store.all(); const list = Object.values(d.chats).sort((a, b) => b.updated - a.updated);
    const fmt = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    ui.hist.innerHTML = `<div class="mai-subhead"><button type="button" data-h="back">${svg('back', 16)}</button><b>Chat history</b><span class="mai-spacer"></span>
      <button type="button" class="mai-btn" data-h="savecur">${svg('save', 15)} Save current…</button></div>
      ${temporaryChats ? '<p class="mai-muted" role="status">Chats are available in this tab only. Export them before closing this tab; browser saving is unavailable.</p>' : ''}<div class="mai-hist-actions"><button type="button" class="mai-btn" data-h="exportmd">${svg('down', 15)} Export current (.md)</button><button type="button" class="mai-btn" data-h="exportjson">${svg('down', 15)} Export all (.json)</button><button type="button" class="mai-btn" data-h="import">${svg('up', 15)} Import…</button></div>
      <div class="mai-hist-list">${list.length ? list.map(c => `<div class="mai-hist-item${chat && c.id === chat.id ? ' cur' : ''}" data-id="${c.id}">
        <button type="button" class="mai-hist-open" data-h="open"><b>${esc(c.title)}</b><small>${esc(c.chapterTitle || c.chapter)} · ${c.messages.length} messages · ${fmt(c.updated)}</small></button>
        <button type="button" data-h="rename" title="Rename">${svg('edit', 15)}</button><button type="button" data-h="del" title="Delete">${svg('trash', 15)}</button></div>`).join('') : '<p class="mai-muted">No saved chats yet.</p>'}</div>`;
    ui.hist.onclick = e => {
      const b = e.target.closest('[data-h]'); if (!b) return;
      const item = b.closest('.mai-hist-item'), id = item && item.dataset.id, d2 = store.all();
      switch (b.dataset.h) {
        case 'back': show('chat'); break;
        case 'open': chat = d2.chats[id]; d2.current[CH.id] = id; store.save(d2); show('chat'); toast('Chat loaded'); break;
        case 'rename': { const t = prompt('Chat name', d2.chats[id].title); if (t && t.trim()) { d2.chats[id].title = t.trim().slice(0, 80); store.save(d2); if (chat && chat.id === id) chat.title = d2.chats[id].title; renderHistory(); } break; }
        case 'del': if (confirm(`Delete "${d2.chats[id].title}"? This cannot be undone.`)) { delete d2.chats[id]; for (const k in d2.current) if (d2.current[k] === id) delete d2.current[k]; store.save(d2); if (chat && chat.id === id) chat = null; renderHistory(); } break;
        case 'savecur': { if (!chat) ensureChat(); const t = prompt('Save this chat as', chat.title); if (t && t.trim()) { chat.title = t.trim().slice(0, 80); chat.saved = true; persist(); renderHistory(); toast(temporaryChats ? 'Chat kept in this tab' : 'Chat saved'); } break; }
        case 'exportmd': exportMd(); break;
        case 'exportjson': download(`maestra-ai-chats-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ type: 'maestra-ai-chats', v: 1, exported: new Date().toISOString(), chats: Object.values(d2.chats) }, null, 2), 'application/json'); break;
        case 'import': ui.file.value = ''; ui.file.click(); break;
      }
    };
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function exportMd() {
    if (!chat || !chat.messages.length) return toast('This chat is empty', 'warn');
    const lines = [`# ${chat.title}`, '', `MAESTRA AI Tutor · ${chat.chapterTitle || CH.title} · exported ${new Date().toLocaleString()}`, ''];
    chat.messages.forEach(m => { lines.push(`## ${m.role === 'user' ? 'You' : 'AI Tutor'}${m.section ? ` — ${m.section}` : ''}`, '', m.text, ''); });
    download(`${chat.title.replace(/[^\w\- ]+/g, '').slice(0, 40).trim() || 'chat'}.md`, lines.join('\n'), 'text/markdown');
  }
  async function importFile() {
    const f = ui.file.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const arr = Array.isArray(j) ? j : (Array.isArray(j.chats) ? j.chats : j.chats ? Object.values(j.chats) : (j.messages ? [j] : []));
      const d = store.all(); let n = 0;
      for (const c of arr) { if (!c || !Array.isArray(c.messages)) continue; const id = uid(); d.chats[id] = { id, chapter: String(c.chapter || CH.id), chapterTitle: String(c.chapterTitle || CH.title), title: String(c.title || 'Imported chat').slice(0, 80), messages: c.messages.filter(m => m && ['user', 'model'].includes(m.role) && typeof m.text === 'string').map(m => ({role:m.role,text:m.text,section: typeof m.section === 'string' ? m.section : ''})), updated: Number.isFinite(c.updated) ? c.updated : Date.now(), created: Number.isFinite(c.created) ? c.created : Date.now() }; n++; }
      store.save(d); renderHistory(); toast(n ? `Imported ${n} chat${n > 1 ? 's' : ''}` : 'No chats found in that file', n ? 'ok' : 'warn');
    } catch (_) { toast('That file is not a MAESTRA chat export', 'warn'); }
  }

  /* settings view */
  function renderSettings() {
    const s = settings;
    ui.set.innerHTML = `<div class="mai-subhead">${s.apiKey ? `<button type="button" data-s="back">${svg('back', 16)}</button>` : ''}<b>AI setup</b></div>
      <div class="mai-form">
        <p class="mai-intro">The tutor uses <b>Google AI Studio</b> (Gemini). Use your own API key. By default it stays in this tab for the session. Remembering it also configures the supported older simulator panels; the solar-waterworks tutor and MAESTRA tools have separate settings.</p>
        <ol class="mai-steps"><li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with a Google account.</li><li>Click <b>Create API key</b> and copy it.</li><li>Paste it below, choose a model and press <b>Save</b>.</li></ol>
        <label class="mai-field"><span>${svg('key', 15)} Google AI Studio API key</span>
          <div class="mai-keyrow"><input type="password" class="mai-key" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(s.apiKey)}"><button type="button" class="mai-icon" data-s="reveal" title="Show or hide">${svg('eye', 16)}</button></div></label>
        <label class="mai-field"><span>Model</span>
          <div class="mai-keyrow"><select class="mai-model">${s.model ? `<option value="${esc(s.model)}">${esc(s.model)}</option>` : '<option value="">Press "Load models" after entering the key</option>'}</select><button type="button" class="mai-btn" data-s="models">Load models</button></div>
          <small>A <i>Flash</i> model is fast and works well for tutoring.</small></label>
        <div class="mai-two">
          <label class="mai-field"><span>Creativity <output class="mai-tval">${(+s.temperature).toFixed(1)}</output></span><input type="range" class="mai-temp" min="0" max="1" step="0.1" value="${s.temperature}"></label>
          <label class="mai-field"><span>Answer length</span><select class="mai-len"><option value="1024"${s.maxTokens == 1024 ? ' selected' : ''}>Short</option><option value="2048"${s.maxTokens == 2048 ? ' selected' : ''}>Medium</option><option value="4096"${s.maxTokens == 4096 ? ' selected' : ''}>Long</option><option value="8192"${s.maxTokens == 8192 ? ' selected' : ''}>Very long</option></select></label>
        </div>
        <label class="mai-check"><input type="checkbox" class="mai-remember"${s.remember ? ' checked' : ''}> Remember the key on this computer (all chapters will use it)</label>
        <div class="mai-status" role="status"></div>
        <div class="mai-row"><button type="button" class="mai-btn" data-s="test">Test connection</button><span class="mai-spacer"></span><button type="button" class="mai-btn primary" data-s="save">Save</button></div>
        <p class="mai-privacy">Your key is kept in this tab for the session unless you choose to remember it. Tutor requests send your question, recent chat history, section excerpt and visible lab readings to Google's Gemini API. Anyone who uses this browser profile can read it, so do not save it on a shared computer. Under Google's free tier, prompts may be used to improve Google's products.</p>
        ${s.apiKey ? `<button type="button" class="mai-link" data-s="forget">Remove the saved key from this computer</button>` : ''}
      </div>`;
    const $ = sel => ui.set.querySelector(sel), status = (t, k = '') => { const e = $('.mai-status'); e.textContent = t; e.className = 'mai-status ' + k; };
    $('.mai-temp').addEventListener('input', e => { $('.mai-tval').textContent = (+e.target.value).toFixed(1); });
    const read = () => ({ ...settings, apiKey: $('.mai-key').value.trim(), model: $('.mai-model').value, temperature: +$('.mai-temp').value, maxTokens: +$('.mai-len').value, remember: $('.mai-remember').checked });
    ui.set.onclick = async e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'back') show('chat');
      if (b.dataset.s === 'reveal') { const k = $('.mai-key'); k.type = k.type === 'password' ? 'text' : 'password'; }
      if (b.dataset.s === 'models' || b.dataset.s === 'test') {
        const key = $('.mai-key').value.trim(); if (!key) return status('Enter your API key first.', 'warn');
        status('Contacting Google…');
        try {
          const ms = await listModels(key); if (!ms.length) return status('Connected, but no Gemini chat models are available for this key.', 'warn');
          const cur = $('.mai-model').value; const sel = $('.mai-model');
          sel.innerHTML = ms.map(m => `<option value="${esc(m.id)}">${esc(m.label)} (${esc(m.id)})</option>`).join('');
          sel.value = ms.some(m => m.id === cur) ? cur : (ms.find(m => /flash/.test(m.id) && !/lite/.test(m.id)) || ms[0]).id;
          status(`Connected. ${ms.length} models available.${b.dataset.s === 'test' ? ' Press Save to finish.' : ''}`, 'ok');
        } catch (err) { status(err.message, 'warn'); }
      }
      if (b.dataset.s === 'save') {
        const s2 = read(); if (!s2.apiKey) return status('Enter your API key first.', 'warn');
        if (!s2.model) { try { const ms = await listModels(s2.apiKey); s2.model = (ms.find(m => /flash/.test(m.id) && !/lite/.test(m.id)) || ms[0] || {}).id || ''; } catch (err) { return status(err.message, 'warn'); } }
        settings = s2; saveSettings(settings); paintMode(); toast('AI setup saved. Session-only keys stay in this tab; remembered keys also serve older simulator panels.');
        ensureChat(); show('chat');
      }
      if (b.dataset.s === 'forget') { if (confirm('Remove the saved API key from this browser? Your chats are kept.')) { forgetKey(); settings = { ...DEFAULTS }; renderSettings(); toast('Key removed'); } }
    };
  }

  /* keep tabs in sync: setup saved in one chapter applies to the others */
  window.addEventListener('storage', e => { if (e.key === S_KEY) { settings = loadSettings(); paintMode(); } });

  /* let a page's own controls hand a question to the tutor (opens setup first if no key is saved) */
  function ask(text) { open(); if (settings.apiKey && text && !busy) { show('chat'); send(String(text)); } }
  const boot = () => { build(); window.MaestraAI = { open, close, ask, context: currentSection, version: '1.0.0' }; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
