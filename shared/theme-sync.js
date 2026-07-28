(() => {
  'use strict';

  /*
   * MAESTRA unified appearance runtime v2.1
   *
   * The previous synchronizer reacted to every legacy storage key and then
   * wrote all of those keys again. With two tabs or an embedded same-origin
   * tool, that could create a dark/light race and visible blinking.
   *
   * This runtime uses one canonical storage event, never echoes an external
   * event back to storage, and suppresses the MutationObserver callback that
   * results from an externally applied theme.
   */

  const KEY = 'maestra_hub_settings_v1';
  const VERSION = '2.1.0';
  const LEGACY_STRING_KEYS = [
    'semiHubTheme',
    'basicSemiTheme',
    'pnDiodeTheme',
    'bjtTheme',
    'mosfetChapterTheme',
    'mesfetPnTheme',
    'solarCellTheme',
    'maestra_index_theme',
    'ee_suite_theme_v1',
    'minicanvas_ui_theme'
  ];

  let suppressObservedTheme = null;
  let lastAppliedTheme = null;

  function normalize(value) {
    return value === 'light' || value === 'dark' ? value : null;
  }

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function readCanonicalRecord() {
    try {
      const record = safeParse(localStorage.getItem(KEY), null);
      const theme = normalize(record?.appearance?.theme);
      return theme ? { record, theme } : null;
    } catch (_) {
      return null;
    }
  }

  function readLegacyTheme() {
    try {
      const cfg = safeParse(localStorage.getItem('ee_suite_configuration_v1'), null);
      const configured = normalize(cfg?.appearance?.theme);
      if (configured) return configured;
    } catch (_) {}

    for (const key of LEGACY_STRING_KEYS) {
      try {
        const value = normalize(localStorage.getItem(key));
        if (value) return value;
      } catch (_) {}
    }
    return null;
  }

  function preferredTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateThemeControls(theme) {
    const nextLabel = theme === 'dark' ? 'Bright' : 'Dark';
    const selectors = [
      '#themeBtn',
      '#themeToggleBtn',
      '[data-theme-toggle]',
      '.themeBtn'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(control => {
      if (control.tagName === 'SELECT') {
        if ([...control.options].some(option => option.value === theme)) control.value = theme;
        return;
      }
      if (control.tagName === 'INPUT' && control.type === 'checkbox') {
        control.checked = theme === 'dark';
        return;
      }
      const current = String(control.textContent || '').trim().toLowerCase();
      if (!current || current === 'dark' || current === 'bright' || current === 'light') {
        control.textContent = nextLabel;
      }
      control.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      control.setAttribute('title', theme === 'dark' ? 'Switch to bright mode' : 'Switch to dark mode');
    });

    const suiteSelect = document.getElementById('suiteThemeToggle');
    if (suiteSelect && suiteSelect.value !== theme) suiteSelect.value = theme;
  }

  function syncBodyClasses(theme) {
    if (!document.body) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
  }

  function applyToDocument(theme, { external = false, announce = true } = {}) {
    theme = normalize(theme);
    if (!theme) return null;

    const current = normalize(document.documentElement.getAttribute('data-theme'));
    if (external && current !== theme) suppressObservedTheme = theme;

    if (current !== theme) document.documentElement.setAttribute('data-theme', theme);
    syncBodyClasses(theme);
    updateThemeControls(theme);
    lastAppliedTheme = theme;

    if (announce) {
      window.dispatchEvent(new CustomEvent('maestra-theme-applied', {
        detail: { theme, external, version: VERSION }
      }));
    }
    return theme;
  }

  function writeIfChanged(key, value) {
    try {
      if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
    } catch (_) {}
  }

  function mirrorLegacy(theme) {
    for (const key of LEGACY_STRING_KEYS) writeIfChanged(key, theme);

    try {
      const suite = safeParse(localStorage.getItem('ee_suite_configuration_v1'), {}) || {};
      const next = {
        ...suite,
        appearance: { ...(suite.appearance || {}), theme }
      };
      const serialized = JSON.stringify(next);
      writeIfChanged('ee_suite_configuration_v1', serialized);
    } catch (_) {}
  }

  function publish(theme) {
    theme = normalize(theme);
    if (!theme) return;

    try {
      const existing = readCanonicalRecord();
      if (existing?.theme !== theme) {
        const base = existing?.record && typeof existing.record === 'object' ? existing.record : {};
        const record = {
          ...base,
          appearance: { ...(base.appearance || {}), theme },
          themeSync: {
            version: VERSION,
            updatedAt: Date.now(),
            source: location.pathname || 'document'
          }
        };
        localStorage.setItem(KEY, JSON.stringify(record));
      }
    } catch (_) {}

    // Mirror only for old pages that still read their historical key on startup.
    // The synchronizer intentionally ignores storage events from these keys.
    mirrorLegacy(theme);
  }

  const initial = readCanonicalRecord()?.theme ||
    readLegacyTheme() ||
    normalize(document.documentElement.getAttribute('data-theme')) ||
    preferredTheme();

  applyToDocument(initial, { external: true, announce: false });
  publish(initial);

  const observer = new MutationObserver(() => {
    const theme = normalize(document.documentElement.getAttribute('data-theme'));
    if (!theme) return;

    if (suppressObservedTheme === theme) {
      suppressObservedTheme = null;
      lastAppliedTheme = theme;
      syncBodyClasses(theme);
      updateThemeControls(theme);
      return;
    }

    if (theme !== lastAppliedTheme) {
      lastAppliedTheme = theme;
      syncBodyClasses(theme);
      updateThemeControls(theme);
      publish(theme);
      window.dispatchEvent(new CustomEvent('maestra-theme-applied', {
        detail: { theme, external: false, version: VERSION }
      }));
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Only the canonical key drives cross-document synchronization. Applying an
  // external value never writes it back, so tabs and iframes cannot ping-pong.
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    const record = safeParse(event.newValue, null);
    const theme = normalize(record?.appearance?.theme);
    if (!theme || theme === lastAppliedTheme) return;
    applyToDocument(theme, { external: true, announce: true });
  });

  window.MAESTRATheme = {
    version: VERSION,
    get() {
      return readCanonicalRecord()?.theme ||
        normalize(document.documentElement.getAttribute('data-theme')) ||
        readLegacyTheme() ||
        preferredTheme();
    },
    set(theme) {
      theme = normalize(theme);
      if (!theme) return null;
      applyToDocument(theme, { external: false, announce: true });
      publish(theme);
      return theme;
    },
    toggle() {
      return this.set(this.get() === 'dark' ? 'light' : 'dark');
    }
  };
})();
