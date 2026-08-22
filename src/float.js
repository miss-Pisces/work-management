// float.js — 悬浮窗入口
// 复用主应用的 store，显示未完成任务的精简列表
// 单击任务名：恢复主窗口并打开编辑弹窗
// 单击勾选框：切换完成状态；双击标题栏：仅恢复主窗口（不指定任务）

import { store } from './store.js';
import { icons } from './utils/icons.js';
import { confirmDialog, alertDialog } from './utils/dialog.js';
import { formatShortDate, getTaskDurationInfo } from './utils/date.js';

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };
const collapsed = {};

const app = document.getElementById('float-app');

function render() {
  // 保存当前滚动位置，防止重新渲染后跳回顶部
  const listEl = document.getElementById('float-list');
  const savedScroll = listEl ? listEl.scrollTop : 0;

  const tasks = store.getTasks()
    .filter((t) => t.status !== 'done' && t.status !== 'terminated')
    .sort((a, b) => {
      // 与"我的任务"页面默认排序一致：按创建时间降序
      if (a.createdAt < b.createdAt) return 1;
      if (a.createdAt > b.createdAt) return -1;
      return 0;
    });
  const total = tasks.length;

  app.innerHTML = `
    <div class="float-container">
      <div class="float-header" id="float-header">
        <div class="float-header__title">
          <span>我的任务</span>
          <span class="float-header__count">${total}</span>
        </div>
        <div class="float-header__actions">
          <button class="float-header__btn" id="float-close" title="隐藏" aria-label="隐藏">${icons.close}</button>
        </div>
      </div>
      <div class="float-list" id="float-list">
        ${tasks.length === 0 ? `
          <div class="float-empty">
            <svg class="float-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <path d="M7 8h10M7 12h10M7 16h6"/>
            </svg>
            <div class="float-empty__text">暂无进行中任务</div>
          </div>
        ` : tasks.map((t) => {
          const d = getTaskDurationInfo(t);
          const hasSubtasks = t.subtasks && t.subtasks.length > 0;
          const isCollapsed = collapsed[t.id] !== false;
          // 任务名后展示：有截止日期用剩余/超期天数文字，无截止日期保留时钟图标
          const trailingHtml = d.hasDeadline
            ? (d.isOverdue
                ? `<span class="float-task-deadline-text float-task-deadline-text--overdue" title="截止 ${t.deadline}">超期${d.overdueDays}天</span>`
                : `<span class="float-task-deadline-text float-task-deadline-text--remaining" title="截止 ${t.deadline}">剩余${d.remainingDays}天</span>`)
            : `<span class="float-task-clock float-task-clock--${d.level}" title="进行 ${d.days} 天">${icons.clock}</span>`;
          return `
            <div class="float-task" data-task-id="${t.id}">
              <span class="float-task__check ${t.status === 'done' ? 'is-done' : ''}" data-check="${t.id}">
                ${t.status === 'done' ? icons.check : ''}
              </span>
              <div class="float-task__body">
                <div class="float-task__name-row">
                  ${hasSubtasks ? `
                    <span class="float-task__toggle ${isCollapsed ? 'is-collapsed' : ''}" data-toggle-subtask="${t.id}" title="${isCollapsed ? '展开子任务' : '折叠子任务'}">
                      ${icons.chevronDown}
                    </span>
                  ` : ''}
                  <div class="float-task__name float-task__name--priority-${t.priority} ${t.status === 'done' ? 'is-done' : ''} ${t.status === 'terminated' ? 'is-terminated' : ''}" data-name="${t.id}">${escapeHtml(t.name)}${trailingHtml}</div>
                </div>
                <div class="float-task__meta">
                  <span class="float-task__tag float-task__tag--${t.priority}">${PRIORITY_LABEL[t.priority]}</span>
                  <span class="float-task__deadline ${d.isOverdue ? 'is-overdue' : ''}">${formatShortDate(t.deadline)}</span>
                </div>
                ${hasSubtasks && !isCollapsed ? `
                  <div class="float-subtasks">
                    ${t.subtasks.map((s) => {
                      const isSubDone = s.done;
                      const isSubTerminated = s.status === 'terminated' || s.terminated || t.status === 'terminated';
                      return `
                        <div class="float-subtask ${isSubDone ? 'is-done' : ''} ${isSubTerminated ? 'is-terminated' : ''}" data-subtask="${t.id}:${s.id}">
                          <span class="float-subtask__check ${isSubDone ? 'is-done' : ''} ${isSubTerminated ? 'is-terminated' : ''}" data-subcheck="${t.id}:${s.id}">
                            ${s.done ? icons.check : ''}
                          </span>
                          <span class="float-subtask__name">${escapeHtml(s.name)}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  bindEvents();

  // 恢复滚动位置
  const newList = document.getElementById('float-list');
  if (newList) newList.scrollTop = savedScroll;
}

function bindEvents() {
  // 关闭按钮
  document.getElementById('float-close').addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.floatClose();
  });

  // 标题栏双击恢复主窗口
  document.getElementById('float-header').addEventListener('dblclick', () => {
    if (window.electronAPI) window.electronAPI.floatRestore();
  });

  // 任务勾选框点击：标记完成（已完成/已终止任务不可操作）
  document.querySelectorAll('[data-check]').forEach((check) => {
    check.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = check.dataset.check;
      const task = store.getTask(taskId);
      if (!task || task.status === 'terminated' || task.status === 'done') return;
      const hasUnfinishedSubtasks = task.subtasks && task.subtasks.some((s) => !s.done);
      if (hasUnfinishedSubtasks) {
        // 自定义提示弹窗替代原生 alert
        await alertDialog({
          title: '无法标记完成',
          message: '还有子任务未完成，无法标记完成',
          confirmText: '知道了',
        });
        return;
      }
      // 自定义确认弹窗替代原生 confirm
      const ok = await confirmDialog({
        title: '完成任务',
        message: '确认将此任务标记为已完成？完成后将不可编辑。',
        confirmText: '确认完成',
      });
      if (!ok) return;
      store.updateTask(taskId, { status: 'done' });
    });
  });

  // 子任务勾选框点击：切换子任务完成状态
  document.querySelectorAll('[data-subcheck]').forEach((check) => {
    check.addEventListener('click', async (e) => {
      e.stopPropagation();
      const [taskId, subtaskId] = check.dataset.subcheck.split(':');
      const task = store.getTask(taskId);
      if (!task) return;
      const st = task.subtasks.find((s) => s.id === subtaskId);
      if (!st) return;
      if (st.done) return;
      // 自定义确认弹窗替代原生 confirm
      const ok = await confirmDialog({
        title: '完成子任务',
        message: '确认将此子任务标记为已完成？',
        confirmText: '确认完成',
      });
      if (!ok) return;
      store.updateSubtask(taskId, subtaskId, { done: true });
    });
  });

  // 子任务折叠箭头点击：0ms 延迟切换显隐
  document.querySelectorAll('[data-toggle-subtask]').forEach((toggleBtn) => {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = toggleBtn.dataset.toggleSubtask;
      collapsed[taskId] = collapsed[taskId] === false ? true : false;
      render();
    });
  });

  // 任务名单击：0ms 延迟直接恢复主窗口并打开编辑弹窗
  document.querySelectorAll('[data-name]').forEach((nameEl) => {
    nameEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = nameEl.dataset.name;
      if (window.electronAPI) window.electronAPI.floatEditTask(taskId);
    });
  });

  // 鼠标滚轮控制上下滚动（自动处理像素与行滚动）
  const listEl = document.getElementById('float-list');
  if (listEl) {
    listEl.addEventListener('wheel', (e) => {
      e.stopPropagation();
      const scrollAmount = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      listEl.scrollTop += scrollAmount;
    }, { passive: true });
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 订阅数据变化自动刷新
store.subscribe(() => render());

// 监听其他窗口的 localStorage 变化（主窗口创建/编辑任务时触发）
// loadFromStorage 会自动触发订阅者刷新 render，无需在此手动调用
window.addEventListener('storage', (e) => {
  if (e.key === 'wf-work-management-v1' && e.newValue) {
    store.loadFromStorage(e.newValue);
  }
});

// 首次渲染
render();
