(() => {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const rootUrl = new URL('../', script.src);
  const role = script.dataset.maestraRole || 'module';
  const CONTEXT_KEY = 'maestra_launch_context_v1';
  const TOOL_PATHS = {
    canvas: 'maestra/ee_canvas.html',
    student: 'maestra/ee_problem_solving_workspace_student.html',
    builder: 'maestra/ee_problem_set_builder.html',
    instructor: 'maestra/ee_problem_solving_workspace_instructor.html',
    grader: 'maestra/assessment_grader.html',
    tools: 'maestra/index.html',
    hub: 'index.html'
  };

  function cleanText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function slug(value) {
    return cleanText(value, 'topic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'topic';
  }

  function dynamicPageTitle() {
    return cleanText(
      document.querySelector('#pageTitle')?.textContent ||
      document.querySelector('main h1')?.textContent ||
      document.querySelector('h1')?.textContent ||
      document.title,
      'Learning page'
    );
  }

  function dynamicTopic() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, '')).replace(/[-_]+/g, ' ');
    const page = dynamicPageTitle();
    if (hash) return hash.replace(/\b\w/g, c => c.toUpperCase());
    return cleanText(script.dataset.maestraTopicTitle, page);
  }

  function currentContext(overrides = {}) {
    const moduleTitle = cleanText(script.dataset.maestraModuleTitle, dynamicPageTitle());
    const topicTitle = cleanText(overrides.topicTitle, dynamicTopic());
    return {
      version: 1,
      course: 'Solid-State Electronics',
      moduleId: cleanText(overrides.moduleId, cleanText(script.dataset.maestraModuleId, slug(moduleTitle))),
      moduleTitle: cleanText(overrides.moduleTitle, moduleTitle),
      topicId: cleanText(overrides.topicId, cleanText(script.dataset.maestraTopicId, slug(topicTitle))),
      topicTitle,
      sourceRole: role,
      returnUrl: location.href,
      canvasTemplate: cleanText(overrides.canvasTemplate, cleanText(script.dataset.maestraCanvasTemplate, '')),
      tags: cleanText(script.dataset.maestraTags, '').split(',').map(x => x.trim()).filter(Boolean),
      launchedAt: Date.now()
    };
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url;
    } catch (_) {
      return null;
    }
  }

  function readStoredContext() {
    try {
      const value = JSON.parse(localStorage.getItem(CONTEXT_KEY) || 'null');
      if (!value || typeof value !== 'object') return null;
      if (value.returnUrl && !safeHttpUrl(value.returnUrl)) value.returnUrl = '';
      return value;
    } catch (_) {
      return null;
    }
  }

  function storeContext(context) {
    try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(context)); } catch (_) {}
  }

  function toolUrl(tool, context) {
    const path = TOOL_PATHS[tool] || TOOL_PATHS.tools;
    const url = new URL(path, rootUrl);
    if (context) {
      url.searchParams.set('course', 'solid-state-electronics');
      if (context.moduleId) url.searchParams.set('module', context.moduleId);
      if (context.topicId) url.searchParams.set('topic', context.topicId);
      url.searchParams.set('from', 'learning-hub');
    }
    return url;
  }

  function launch(tool, overrides = {}, target = '_blank') {
    if (tool === 'hub') {
      location.href = new URL(TOOL_PATHS.hub, rootUrl).href;
      return;
    }
    const context = currentContext(overrides);
    storeContext(context);
    const url = toolUrl(tool, context).href;
    if (target === '_self') location.href = url;
    else window.open(url, target, 'noopener');
  }

  function wireLaunchLinks() {
    document.querySelectorAll('[data-maestra-launch]').forEach(el => {
      if (el.dataset.maestraWired === '1') return;
      el.dataset.maestraWired = '1';
      el.addEventListener('click', event => {
        const tool = el.dataset.maestraLaunch;
        if (!tool) return;
        event.preventDefault();
        launch(tool, {
          moduleId: el.dataset.moduleId,
          moduleTitle: el.dataset.moduleTitle,
          topicId: el.dataset.topicId,
          topicTitle: el.dataset.topicTitle,
          canvasTemplate: el.dataset.canvasTemplate
        }, el.dataset.target === 'self' ? '_self' : '_blank');
      });
    });
  }

  function createModuleLauncher() {
    const wrap = document.createElement('div');
    wrap.className = 'maestra-shell-launcher';
    wrap.innerHTML = `
      <div class="maestra-shell-panel" hidden>
        <div class="maestra-shell-head">
          <div class="maestra-shell-brand">MAESTRA Tools<small class="maestra-shell-topic"></small></div>
          <button class="maestra-shell-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="maestra-shell-grid">
          <button class="maestra-shell-action primary" type="button" data-tool="canvas">Draw in EE Canvas</button>
          <button class="maestra-shell-action" type="button" data-tool="student">Open Workspace</button>
          <button class="maestra-shell-action" type="button" data-tool="builder">Build Activity</button>
          <button class="maestra-shell-action" type="button" data-tool="instructor">Instructor Workspace</button>
          <a class="maestra-shell-action wide" href="${new URL('index.html', rootUrl).href}">Semiconductor Learning Hub</a>
        </div>
      </div>
      <button class="maestra-shell-toggle" type="button" aria-expanded="false">MAESTRA Tools</button>`;
    document.body.appendChild(wrap);
    const panel = wrap.querySelector('.maestra-shell-panel');
    const toggle = wrap.querySelector('.maestra-shell-toggle');
    const topic = wrap.querySelector('.maestra-shell-topic');
    function refreshTopic() {
      const c = currentContext();
      topic.textContent = `${c.moduleTitle} · ${c.topicTitle}`;
    }
    refreshTopic();
    window.addEventListener('hashchange', refreshTopic);
    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      refreshTopic();
    });
    wrap.querySelector('.maestra-shell-close').addEventListener('click', () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });
    wrap.querySelectorAll('[data-tool]').forEach(button => {
      button.addEventListener('click', () => launch(button.dataset.tool));
    });
  }

  function createToolToolbar() {
    const context = readStoredContext();
    const wrap = document.createElement('div');
    wrap.className = 'maestra-shell-toolbar';
    const returnUrl = context?.returnUrl ? safeHttpUrl(context.returnUrl)?.href : '';
    const contextHtml = context ? `
      <div class="maestra-shell-context"><b>${escapeHtml(context.moduleTitle || 'Solid-State Electronics')}</b>${escapeHtml(context.topicTitle || 'Learning activity')}</div>` :
      '<div class="maestra-shell-context"><b>MAESTRA</b>Engineering learning tools</div>';
    wrap.innerHTML = `${contextHtml}
      <a class="maestra-shell-toolbtn primary" href="${new URL('index.html', rootUrl).href}">Learning Hub</a>
      ${returnUrl ? `<a class="maestra-shell-toolbtn" href="${escapeAttr(returnUrl)}">Return to lesson</a>` : ''}
      <a class="maestra-shell-toolbtn" href="${new URL('maestra/index.html', rootUrl).href}">All tools</a>`;
    document.body.appendChild(wrap);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  wireLaunchLinks();
  if (role === 'module') createModuleLauncher();
  else if (role === 'tool' || role === 'tool-index') createToolToolbar();

  window.MAESTRAHub = { rootUrl: rootUrl.href, currentContext, readStoredContext, launch, wireLaunchLinks };
})();
