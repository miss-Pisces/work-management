// TasksPage.js — 我的任务页面
// 包含：顶部操作区（新建任务、搜索）、排序选择器、任务表格（只保留编辑操作，去除拖拽与多余按钮）

import { store } from '../store.js';
import { icons } from '../utils/icons.js';
import { formatShortDate, daysBetween, fromISODate, getTaskDurationInfo } from '../utils/date.js';
import { openCreateModal, openEditModal } from './TaskModal.js';

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };
const PRIORITY_ORDER = { high: 0, mid: 1, low: 2 };

export function createTasksPage() {
  const state = {
    search: '',
    sortKey: 'createdAt', // createdAt | deadline | priority | progressDays
    sortDir: 'desc',      // asc | desc
    collapsed: {},        // { [taskId]: true } 单击任务名后隐藏子任务
  };

  const el = document.createElement('div');
  el.className = 'wf-tasks-container';

  function getProgressDays(t) {
    const created = fromISODate(t.createdAt);
    const today = new Date();
    if (t.status === 'done') {
      const doneLog = [...t.logs].reverse().find((l) => l.text === '完成任务');
      const end = doneLog ? fromISODate(doneLog.date) : today;
      return Math.max(1, daysBetween(created, end));
    } else {
      return Math.max(1, daysBetween(created, today));
    }
  }

  function getFiltered() {
    let list = store.getTasks().slice();

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const urlFilter = urlParams.get('filter');
    const urlRange = urlParams.get('range');

    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.subtasks && t.subtasks.some((s) => (s.name || '').toLowerCase().includes(q)))
      );
    } else if (urlFilter) {
      // 与 getStats 各指标口径一致：总数按新建、完成按完成日期、终止按终止日期；
      // 逾期是当前状态，不随时间范围过滤
      if (urlFilter === 'overdue') {
        list = store.filterByKpiType(store.getTasks().slice(), 'overdue');
      } else {
        const basis = { all: 'created', done: 'done', terminated: 'terminated' }[urlFilter] || 'created';
        const rangeTasks = urlRange ? store.getTasksByRange(urlRange, basis) : store.getTasks().slice();
        list = store.filterByKpiType(rangeTasks, urlFilter);
      }
    } else {
      list = list.filter((t) => t.status !== 'done' && t.status !== 'terminated');
    }

    list.sort((a, b) => {
      let av, bv;
      switch (state.sortKey) {
        case 'progressDays': av = getProgressDays(a); bv = getProgressDays(b); break;
        case 'priority': av = PRIORITY_ORDER[a.priority]; bv = PRIORITY_ORDER[b.priority]; break;
        case 'createdAt': av = a.createdAt; bv = b.createdAt; break;
        case 'deadline': av = a.deadline; bv = b.deadline; break;
        default: av = a.createdAt; bv = b.createdAt;
      }
      if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }

  function render() {
    const list = getFiltered();

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const urlFilter = urlParams.get('filter');
    const urlRange = urlParams.get('range');

    const FILTER_LABELS = { all: '全部任务', done: '已完成任务', overdue: '逾期任务', terminated: '已终止任务' };
    const RANGE_LABELS = { today: '今日', week: '本周', month: '本月', quarter: '本季度', year: '本年', all: '全部时间' };

    // 日期串范围（"YYYY-MM-DD" 单日 / "YYYY-MM-DD:YYYY-MM-DD" 起止段）转为中文标签
    const dateRangeLabel = (r) => {
      const m = r && r.match(/^(\d{4}-\d{2}-\d{2})(?::(\d{4}-\d{2}-\d{2}))?$/);
      if (!m) return '';
      return m[2] ? `${formatShortDate(m[1])}–${formatShortDate(m[2])}` : formatShortDate(m[1]);
    };

    const showFilterBanner = urlFilter && !state.search;
    const filterLabel = FILTER_LABELS[urlFilter] || '任务';
    const rangeText = RANGE_LABELS[urlRange] || dateRangeLabel(urlRange);
    const rangeLabel = urlRange && urlFilter !== 'overdue' ? rangeText + ' · ' : '';

    el.innerHTML = `
      <div class="wf-page-header">
        <button class="wf-menu-toggle-btn" id="wf-menu-toggle" aria-label="打开菜单">${icons.menu}</button>
        <button class="wf-btn wf-btn--primary" id="wf-create-task-btn">
          <span class="wf-btn__lead-icon">${icons.plus}</span> 新建任务
        </button>
        <div class="wf-search-wrapper">
          <span class="wf-search-icon">${icons.search}</span>
          <input type="text" class="wf-search-input" id="wf-task-search" placeholder="搜索任务..." aria-label="搜索任务" />
        </div>
      </div>
      ${showFilterBanner ? `
        <div class="wf-filter-banner">
          <span class="wf-filter-banner__text">${rangeLabel}${filterLabel}（${list.length} 条）</span>
          <button class="wf-filter-banner__clear" id="wf-clear-filter">清除筛选 ×</button>
        </div>
      ` : ''}
      <div class="wf-filter-bar">
        <div class="wf-filter-select">
          <select id="wf-sort-select" aria-label="排序方式">
            <option value="createdAt">按创建时间</option>
            <option value="deadline">按截止时间</option>
            <option value="priority">按优先级</option>
            <option value="progressDays">按已进行时间</option>
          </select>
          <span class="wf-filter-select__arrow">${icons.chevronDown}</span>
        </div>
      </div>
      <div class="wf-table-card">
        <div class="wf-table-wrap" id="wf-table-wrap"></div>
      </div>
    `;

    // 清除筛选
    const clearBtn = el.querySelector('#wf-clear-filter');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        window.location.hash = '#/tasks';
      });
    }

    // 绑定事件和值
    el.querySelector('#wf-task-search').value = state.search;
    el.querySelector('#wf-sort-select').value = state.sortKey;

    // 新建任务
    el.querySelector('#wf-create-task-btn').addEventListener('click', () => {
      openCreateModal(() => render());
    });

    // 侧边栏开关（移动端）
    el.querySelector('#wf-menu-toggle').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wf-open-sidebar'));
    });

    // 搜索
    el.querySelector('#wf-task-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      renderTableOnly();
    });

    // 排序
    el.querySelector('#wf-sort-select').addEventListener('change', (e) => {
      state.sortKey = e.target.value;
      // 按已进行时间、创建时间、截止时间默认降序；按优先级数值升序（高在前）
      state.sortDir = (state.sortKey === 'priority') ? 'asc' : 'desc';
      renderTableOnly();
    });

    renderTableOnly();
  }

  function renderTableOnly() {
    const list = getFiltered();
    const wrap = el.querySelector('#wf-table-wrap');
    if (list.length === 0) {
      // 区分两种空态：搜索/筛选无匹配 vs 尚未创建任何任务
      const urlFilter = new URLSearchParams(window.location.hash.split('?')[1]).get('filter');
      const hasQuery = !!(state.search || urlFilter);
      wrap.innerHTML = hasQuery ? `
        <div class="wf-empty">
          <div class="wf-empty__icon">${icons.search}</div>
          <div class="wf-empty__title">未找到匹配的任务</div>
          <div class="wf-empty__desc">试试更换关键词${urlFilter ? '或清除筛选条件' : ''}</div>
        </div>
      ` : `
        <div class="wf-empty">
          <div class="wf-empty__icon">${icons.tasks}</div>
          <div class="wf-empty__title">暂无任务</div>
          <div class="wf-empty__desc">点击左上角「新建任务」开始记录你的工作</div>
        </div>
      `;
      return;
    }
    wrap.innerHTML = buildTable(list);
    bindTableEvents(wrap, list);
  }

  function buildTable(list) {
    const rows = list.map((t, i) => {
      const subtaskDone = t.subtasks.filter((s) => s.done).length;
      const subtaskTotal = t.subtasks.length;
      const progressDays = getProgressDays(t);
      const q = state.search ? state.search.toLowerCase() : '';
      const subtaskMatched = !!(q && t.subtasks && t.subtasks.some((s) => (s.name || '').toLowerCase().includes(q)));
      const isCollapsed = subtaskMatched ? false : (state.collapsed[t.id] !== false);
      // 子任务列表始终渲染（如果有子任务），用 CSS 类控制显示/隐藏，避免单击重渲染
      const subtaskListHtml = subtaskTotal > 0 ? `
        <div class="wf-subtask-list ${isCollapsed ? 'is-hidden' : ''}">
          ${t.subtasks.map((s) => {
            const isSubDone = s.done;
            const isSubTerminated = s.status === 'terminated' || s.terminated || t.status === 'terminated';
            return `
              <div class="wf-subtask-item">
                <span class="wf-subtask-dot ${isSubDone ? 'is-done' : ''} ${isSubTerminated ? 'is-terminated' : ''}"></span>
                <span class="wf-subtask-item__text ${isSubDone ? 'is-done' : ''} ${isSubTerminated ? 'is-terminated' : ''}">${escapeHtml(s.name)}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : '';

      return `
        <tr data-task-id="${t.id}" class="${t.status === 'done' ? 'is-done' : ''} ${t.status === 'terminated' ? 'is-terminated' : ''}">
          <td class="col-row"><span class="wf-row-num">${i + 1}</span></td>
          <td class="col-name">
            <div class="wf-task-name-row">
              ${subtaskTotal > 0 ? `
                <span class="wf-subtask-toggle ${isCollapsed ? 'is-collapsed' : ''}" data-action="toggle-subtask" title="${isCollapsed ? '展开子任务' : '折叠子任务'}">
                  ${icons.chevronDown}
                </span>
              ` : ''}
              <span class="wf-task-name__text wf-task-name--priority-${t.priority}" data-task-name="${t.id}" ${t.status === 'done' ? 'data-done="true"' : ''} ${t.status === 'terminated' ? 'data-terminated="true"' : ''}>${escapeHtml(t.name)}</span>
              ${t.status === 'progress' ? (() => {
                const d = getTaskDurationInfo(t);
                if (d.hasDeadline) {
                  // 有截止日期：不显示时钟，用文字提示剩余/超期天数
                  if (d.isOverdue) {
                    return `<span class="wf-task-deadline-text wf-task-deadline-text--overdue" title="截止 ${t.deadline}">超期${d.overdueDays}天</span>`;
                  }
                  return `<span class="wf-task-deadline-text wf-task-deadline-text--remaining" title="截止 ${t.deadline}">剩余${d.remainingDays}天</span>`;
                }
                // 无截止日期：保留时钟图标按时长等级变色
                return `<span class="wf-task-clock wf-task-clock--${d.level}" title="进行 ${d.days} 天">${icons.clock}</span>`;
              })() : ''}
            </div>
            ${subtaskListHtml}
          </td>
          <td class="col-priority">
            <span class="wf-tag wf-tag--priority-${t.priority}">${PRIORITY_LABEL[t.priority]}</span>
          </td>
          <td class="col-created">
            <span class="wf-date">${formatShortDate(t.createdAt)}</span>
          </td>
          <td class="col-date">
            ${t.deadline ? `<span class="wf-date">${formatShortDate(t.deadline)}</span>` : `<span class="wf-date wf-date--empty" title="未设置截止日期">—</span>`}
          </td>
          <td class="col-duration">
            <span class="wf-duration">${progressDays}天</span>
          </td>
          <td class="col-subtask">
            <span class="wf-subtask-count" data-action="edit">${subtaskDone}/${subtaskTotal}</span>
          </td>
          <td class="col-actions">
            <button class="wf-action-btn" data-action="edit" title="编辑" aria-label="编辑任务">
              ${icons.edit}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="wf-table">
        <thead>
          <tr>
            <th class="col-row">序号</th>
            <th class="col-name">任务名称</th>
            <th class="col-priority">优先级</th>
            <th class="col-created">创建时间</th>
            <th class="col-date">截止日期</th>
            <th class="col-duration">已进行时间</th>
            <th class="col-subtask">子任务数</th>
            <th class="col-actions">编辑</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function bindTableEvents(wrap, _list) {
    wrap.querySelectorAll('tbody tr').forEach((tr) => {
      const taskId = tr.dataset.taskId;
      tr.querySelectorAll('[data-action]').forEach((node) => {
        if (node.dataset.action === 'toggle-subtask') return;
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = node.dataset.action;
          if (action === 'edit') {
            openEditModal(taskId, () => render());
          }
        });
      });
    });
  }

  // ─── 事件委托：折叠箭头与任务名称单击 ──────────────────────────
  // 绑定在 el（页面容器）上，不受表格 innerHTML 重渲染影响
  el.addEventListener('click', (e) => {
    // 点击子任务展开/折叠箭头
    const toggleBtn = e.target.closest('[data-action="toggle-subtask"]');
    if (toggleBtn) {
      e.stopPropagation();
      const tr = toggleBtn.closest('tr');
      if (!tr) return;
      const taskId = tr.dataset.taskId;
      const subtaskList = tr.querySelector('.wf-subtask-list');
      const isCollapsed = state.collapsed[taskId] !== false;
      state.collapsed[taskId] = !isCollapsed;
      toggleBtn.classList.toggle('is-collapsed', state.collapsed[taskId]);
      if (subtaskList) {
        subtaskList.classList.toggle('is-hidden', state.collapsed[taskId]);
      }
      return;
    }

    // 单击任务名称：0ms 延迟直接打开编辑/详情模态框
    const nameEl = e.target.closest('[data-task-name]');
    if (nameEl) {
      e.stopPropagation();
      const tr = nameEl.closest('tr');
      if (!tr) return;
      openEditModal(tr.dataset.taskId, () => render());
    }
  });

  const unsub = store.subscribe(() => {
    if (el.parentNode) {
      renderTableOnly();
    }
  });

  // 监听悬浮窗的 localStorage 变化（悬浮窗勾选任务时触发）
  // loadFromStorage 会自动触发订阅者刷新 renderTableOnly，无需在此手动调用
  const onStorage = (e) => {
    if (e.key === 'wf-work-management-v1' && e.newValue) {
      store.loadFromStorage(e.newValue);
    }
  };
  window.addEventListener('storage', onStorage);

  el._destroy = () => {
    unsub();
    window.removeEventListener('storage', onStorage);
  };

  render();
  return el;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
