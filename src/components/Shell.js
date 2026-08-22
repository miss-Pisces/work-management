// Shell.js — 应用外壳组件（侧边栏 + 内容区）
// 负责导航、移动端侧边栏开关

import { icons } from '../utils/icons.js';
import { getRoutes, navigate, getCurrent, subscribe } from '../router.js';
import { formatLongDate, toISODate } from '../utils/date.js';

export function createShell(onNavigate) {
  const routes = getRoutes();
  const state = { current: getCurrent(), sidebarOpen: false };

  const el = document.createElement('div');
  el.className = 'wf-shell';
  el.innerHTML = `
    <aside class="wf-sidebar" id="wf-sidebar">
      <div class="wf-sidebar__logo">
        <div class="wf-sidebar__logo-top">
          <div class="wf-sidebar__logo-icon">
            <svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
              <rect width="52" height="52" rx="14" fill="#4b3fe3"/>
              <rect x="13" y="14" width="7" height="7" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/>
              <path d="M15 17.5 L16.5 19 L19 16" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="25" y1="17.5" x2="39" y2="17.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              <line x1="25" y1="26.5" x2="39" y2="26.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              <line x1="25" y1="35.5" x2="39" y2="35.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              <rect x="13" y="23" width="7" height="7" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/>
              <rect x="13" y="32" width="7" height="7" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/>
            </svg>
          </div>
          <div class="wf-sidebar__logo-text-group">
            <div class="wf-sidebar__logo-text">工作管理</div>
            <div class="wf-sidebar__logo-sub">提升效率，管理日常</div>
          </div>
        </div>
        <div class="wf-sidebar__logo-date-divider"></div>
        <div class="wf-sidebar__logo-date" id="wf-sidebar-date"></div>
      </div>
      <div class="wf-sidebar__divider"></div>
      <nav class="wf-sidebar__nav" id="wf-nav"></nav>
    </aside>
    <div class="wf-sidebar-backdrop" id="wf-backdrop"></div>
    <div class="wf-main">
      <main class="wf-content" id="wf-content"></main>
    </div>
  `;

  // 渲染侧栏导航（button 保证键盘可达）
  const navEl = el.querySelector('#wf-nav');
  const routeIcons = { '/tasks': 'tasks', '/log': 'log', '/stats': 'stats' };
  routes.forEach((r) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'wf-sidebar__nav-item' + (state.current === r.path ? ' is-active' : '');
    item.dataset.path = r.path;
    item.innerHTML = `
      <span class="wf-sidebar__nav-icon">${icons[routeIcons[r.path]] || ''}</span>
      <span class="wf-sidebar__nav-label">${r.label}</span>
    `;
    item.addEventListener('click', () => {
      navigate(r.path);
      closeSidebar();
    });
    navEl.appendChild(item);
  });

  // 日期（跨零点自动更新：常驻托盘应用不重开页面也要显示正确日期）
  const updateDate = () => {
    el.querySelector('#wf-sidebar-date').textContent = formatLongDate(new Date());
  };
  updateDate();
  let lastDateKey = toISODate(new Date());
  const dateTimer = setInterval(() => {
    const key = toISODate(new Date());
    if (key !== lastDateKey) {
      lastDateKey = key;
      updateDate();
    }
  }, 30000);

  // 高亮当前导航
  const updateNav = () => {
    navEl.querySelectorAll('.wf-sidebar__nav-item').forEach((n) => {
      const active = n.dataset.path === state.current;
      n.classList.toggle('is-active', active);
      if (active) {
        n.setAttribute('aria-current', 'page');
      } else {
        n.removeAttribute('aria-current');
      }
    });
  };

  // 移动端侧边栏开关
  const backdrop = el.querySelector('#wf-backdrop');
  const sidebar = el.querySelector('#wf-sidebar');
  function openSidebar() {
    state.sidebarOpen = true;
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-visible');
  }
  function closeSidebar() {
    state.sidebarOpen = false;
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
  }
  
  backdrop.addEventListener('click', closeSidebar);

  // 移动端开侧栏自定义事件
  const handleOpenSidebar = () => openSidebar();
  window.addEventListener('wf-open-sidebar', handleOpenSidebar);

  // 订阅路由变化
  const unsub = subscribe((path) => {
    state.current = path;
    updateNav();
    closeSidebar();
    if (onNavigate) onNavigate(path);
  });

  // 内容区引用
  el._content = el.querySelector('#wf-content');

  el._destroy = () => {
    window.removeEventListener('wf-open-sidebar', handleOpenSidebar);
    clearInterval(dateTimer);
    unsub();
  };

  return el;
}

