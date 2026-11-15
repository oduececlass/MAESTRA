/* Shared progressive enhancement; native controls and page handlers remain intact. */
(() => {
  'use strict';
  let sequence = 0, queued = false;
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  function enhance() {
    queued = false;
    document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(control => {
      if (control.labels?.length || control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) return;
      let box = control.parentElement, label;
      for (let depth = 0; box && depth < 3; depth++, box = box.parentElement) {
        const labels = box.querySelectorAll('label,.ctl-name,.slider-label,.control-label,.control-name,.vl-ctrl .name,.ctrl .name,.lab-ctrl .row>span:first-child');
        if (labels.length === 1) { label = labels[0]; break; }
        if (labels.length > 1) break;
      }
      if (label && text(label)) {
        if (!label.id) label.id = 'maestra-control-label-' + (++sequence);
        control.setAttribute('aria-labelledby', label.id);
      } else if (control.title) control.setAttribute('aria-label', control.title);
    });
    document.querySelectorAll('.vl-ctrl input[type=range],.ctrl input[type=range],.lab-ctrl input[type=range],.control-group input[type=range]').forEach(control => {
      const value = text(control.closest('.vl-ctrl,.ctrl,.lab-ctrl,.control-group').querySelector('.val,.control-value'));
      if (value && control.getAttribute('aria-valuetext') !== value) control.setAttribute('aria-valuetext',value);
    });
    document.querySelectorAll('canvas:not([aria-label]):not([aria-labelledby])').forEach(canvas => {
      const section = canvas.closest('section,.card,.panel,.stage');
      const heading = text(section?.querySelector('h2,h3,.panel-title')) || document.title;
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label', heading + ' — interactive visualization; use the adjacent controls, readouts, and explanation.');
    });
    document.querySelectorAll('[role=tablist]').forEach(list => {
      const tabs = [...list.querySelectorAll('[role=tab]')];
      if (!tabs.length) return;
      tabs.forEach(tab => tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1);
      if (list.dataset.maestraKeys) return;
      list.dataset.maestraKeys = 'true';
      list.addEventListener('keydown', event => {
        const tabs = [...list.querySelectorAll('[role=tab]:not([disabled])')], i = tabs.indexOf(event.target);
        if (i < 0) return;
        let next;
        if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault(); tabs[next].click(); tabs[next].focus();
        tabs.forEach((tab,j) => tab.tabIndex = j === next ? 0 : -1);
      });
    });
  }
  function start() {
    enhance();
    new MutationObserver(() => {
      if (!queued) { queued = true; requestAnimationFrame(enhance); }
    }).observe(document.body, {childList:true,subtree:true});
    // Give standalone tools a theme control when they do not already have one.
    if (window.MAESTRATheme && !document.querySelector('#themeBtn,#themeToggle,#themeToggleBtn,#topThemeBtnPN,#modeBtn,[data-theme-toggle],.themeBtn')) {
      const host = document.querySelector('header,.app-header,.headerLinks');
      if (host) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'maestra-theme-control';
        button.setAttribute('data-theme-toggle','');
        const refresh = () => { button.textContent = window.MAESTRATheme.get() === 'dark' ? 'Light theme' : 'Dark theme'; };
        button.addEventListener('click', () => { window.MAESTRATheme.toggle(); refresh(); });
        window.addEventListener('maestra-theme-applied',refresh); refresh(); host.append(button);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
