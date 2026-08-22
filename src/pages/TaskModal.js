// TaskModal.js — 创建任务 & 编辑任务弹窗
// 包含：创建弹窗 (Screenshot 4)、编辑弹窗 (Screenshot 3)、自定义截止日期开关、子任务与时间线

import { store } from '../store.js';
import { icons } from '../utils/icons.js';
import { confirmDialog } from '../utils/dialog.js';
import {
  formatShortDate, daysBetween, toISODate, fromISODate, formatRelativeTime,
} from '../utils/date.js';

// 是否存在叠加的上层弹窗（终止确认/确认对话框等），Esc 时交由上层处理
function hasUpperModal() {
  return document.querySelectorAll('.modal-backdrop, .dlg-backdrop').length > 1;
}

// ─── 创建任务弹窗 ─────────────────────────────────────────
export function openCreateModal(onClose) {
  document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'ct-modal';
  modal.innerHTML = `
    <div class="ct-modal__header">
      <div class="ct-modal__title">创建任务</div>
      <button class="ct-modal__close" id="ct-close" title="关闭" aria-label="关闭">${icons.close}</button>
    </div>
    <div class="ct-modal__body">
      <form class="ct-form" id="ct-form">
        <div class="ct-field">
          <label class="ct-label" for="ct-name">任务名称 <span class="ct-required">*</span></label>
          <div class="ct-input">
            <input type="text" id="ct-name" placeholder="输入任务名称..." maxlength="80" />
          </div>
          <div class="ct-field-error" id="ct-name-error"></div>
        </div>
        <div class="ct-field">
          <label class="ct-label" for="ct-desc">任务描述</label>
          <textarea class="ct-textarea" id="ct-desc" placeholder="添加任务描述（可选）..." maxlength="200"></textarea>
        </div>
        <div class="ct-field">
          <label class="ct-label" for="ct-priority">优先级</label>
          <div class="ct-select-wrap">
            <select class="ct-select" id="ct-priority">
              <option value="high">高</option>
              <option value="mid" selected>中</option>
              <option value="low">低</option>
            </select>
            <span class="ct-select-arrow">${icons.chevronDown}</span>
          </div>
        </div>
        <div class="ct-field">
          <label class="ct-checkbox-label">
            <input type="checkbox" class="ct-checkbox" id="ct-has-deadline" />
            <span class="ct-checkbox-custom"></span>
            <span>设置截止日期</span>
          </label>
        </div>
        <div class="ct-field ct-field--deadline" id="ct-deadline-field">
          <label class="ct-label" for="ct-deadline">截止日期</label>
          <div class="ct-date-wrap">
            <input type="date" class="ct-input" id="ct-deadline" />
          </div>
        </div>
      </form>
    </div>
    <div class="ct-modal__footer">
      <button class="ct-btn ct-btn--cancel" id="ct-cancel">取消</button>
      <button class="ct-btn ct-btn--primary" id="ct-submit">创建</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // 默认截止日期：3 天后
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 3);
  modal.querySelector('#ct-deadline').value = toISODate(defaultDeadline);

  const deadlineField = modal.querySelector('#ct-deadline-field');
  modal.querySelector('#ct-has-deadline').addEventListener('change', (e) => {
    deadlineField.classList.toggle('ct-field--deadline', !e.target.checked);
  });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
    if (typeof onClose === 'function') {
      try { onClose(); } catch { /* ignore */ }
    }
  };

  // 直接绑定关闭按钮（更可靠，避免事件委托被其他 handler 拦截）
  const ctClose = modal.querySelector('#ct-close');
  const ctCancel = modal.querySelector('#ct-cancel');
  if (ctClose) ctClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  if (ctCancel) ctCancel.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  // 阻止表单默认提交（Enter 键），改由下方按钮点击处理
  modal.querySelector('#ct-form').addEventListener('submit', (e) => e.preventDefault());

  const $name = modal.querySelector('#ct-name');
  const $nameError = modal.querySelector('#ct-name-error');
  $name.addEventListener('input', () => { $nameError.textContent = ''; });

  modal.querySelector('#ct-submit').addEventListener('click', () => {
    const name = $name.value.trim();
    if (!name) {
      // 行内错误提示，替代静默 focus
      $nameError.textContent = '请输入任务名称';
      $name.focus();
      return;
    }
    const hasDeadline = modal.querySelector('#ct-has-deadline').checked;
    const deadlineVal = hasDeadline ? modal.querySelector('#ct-deadline').value : '';

    store.addTask({
      name,
      description: modal.querySelector('#ct-desc').value.trim(),
      priority: modal.querySelector('#ct-priority').value,
      deadline: deadlineVal,
      status: 'progress', // 默认进行中
    });
    close();
  });

  setTimeout(() => modal.querySelector('#ct-name').focus(), 100);
}

// ─── 编辑任务弹窗 ─────────────────────────────────────────
export function openEditModal(taskId, onClose) {
  const task = store.getTask(taskId);
  if (!task) return;

  const isReadOnly = task.status === 'done' || task.status === 'terminated';
  const isDone = task.status === 'done';
  const isTerminated = task.status === 'terminated';

  // 避免叠加多重弹窗，清理已有 backdrop
  document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'et-modal';

  const createdDate = fromISODate(task.createdAt);
  const today = new Date();
  const progressDays = Math.max(1, daysBetween(createdDate, today));

  modal.innerHTML = `
    <div class="et-modal__header">
      <div class="et-modal__breadcrumb">
        <span class="crumb-muted">我的任务</span>
        <span class="crumb-muted">/</span>
        <span class="crumb-current">${isReadOnly ? '查看任务' : '编辑任务'}${isDone ? ' <span class="et-crumb-badge et-crumb-badge--done">（已完成）</span>' : ''}${isTerminated ? ' <span class="et-crumb-badge et-crumb-badge--terminated">（已终止）</span>' : ''}</span>
      </div>
      <button class="ct-modal__close" id="et-close" title="关闭" aria-label="关闭">${icons.close}</button>
    </div>
    <div class="et-modal__body">
      <input type="text" class="et-task-name-input ${isDone ? 'is-done' : ''} ${isTerminated ? 'is-terminated' : ''}" id="et-name" value="${escapeAttr(task.name)}" placeholder="任务名称" aria-label="任务名称" ${isReadOnly ? 'disabled' : ''} />
      <div class="ct-field-error" id="et-name-error"></div>
      <div class="et-columns">
        <div class="et-col-left">
          <div class="et-section">
            <div class="et-section__title">任务描述</div>
            <textarea class="et-textarea-desc" id="et-desc" placeholder="补充任务描述..." ${isReadOnly ? 'disabled' : ''}>${escapeHtml(task.description || '')}</textarea>
          </div>
          <div class="et-section">
            <div class="et-section__title">子任务 <span class="et-section__count" id="et-subtask-count"></span></div>
            <div class="et-subtask-list" id="et-subtask-list"></div>
            ${isReadOnly ? '' : '<button class="et-add-subtask" id="et-add-subtask">+ 添加子任务</button>'}
          </div>
        </div>
        <div class="et-col-right">
          <div class="et-info-card">
            <div class="et-info-card__title">任务信息</div>
            <div class="et-info-rows">
              <div class="et-info-row">
                <span class="et-info-label">创建时间</span>
                <span class="et-info-value">${formatShortDate(task.createdAt)}</span>
              </div>
              <div class="et-info-row">
                <span class="et-info-label">已进行时间</span>
                <span class="et-info-value">${progressDays}天</span>
              </div>
              <div class="et-info-row">
                <span class="et-info-label">优先级</span>
                <div class="et-info-select-wrap">
                  <select class="et-info-select" id="et-priority" ${isReadOnly ? 'disabled' : ''}>
                    <option value="high">高</option>
                    <option value="mid">中</option>
                    <option value="low">低</option>
                  </select>
                  <span class="et-info-select-arrow">${icons.chevronDown}</span>
                </div>
              </div>
              <div class="et-info-row">
                <span class="et-info-label">截止日期</span>
                <div class="et-deadline-display" id="et-deadline-display">
                  <span class="et-deadline-display__icon">${icons.calendar}</span>
                  <input type="date" id="et-deadline-input" value="${task.deadline}" class="et-deadline-input-inline" aria-label="截止日期" ${isReadOnly ? 'disabled' : ''} />
                </div>
              </div>
            </div>
          </div>
          <div class="et-info-card">
            <div class="et-info-card__title">操作记录</div>
            <div class="et-timeline" id="et-timeline"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="et-action-bar">
      <button class="et-btn et-btn--cancel" id="et-cancel">${isReadOnly ? '关闭' : '取消'}</button>
      ${isReadOnly ? '' : `
        <button class="et-btn et-btn--save" id="et-save">保存</button>
        <button class="et-btn et-btn--danger" id="et-delete" title="终止此任务">终止任务</button>
      `}
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // 设置初始值
  modal.querySelector('#et-priority').value = task.priority;

  // ─── 子任务渲染 ──────────────────────────────────────
  const subtaskListEl = modal.querySelector('#et-subtask-list');
  const subtaskCountEl = modal.querySelector('#et-subtask-count');

  function renderSubtasks() {
    const fresh = store.getTask(taskId);
    if (!fresh) { close(); return; }
    const done = fresh.subtasks.filter((s) => s.done).length;
    subtaskCountEl.textContent = `(${done}/${fresh.subtasks.length})`;
    subtaskListEl.innerHTML = fresh.subtasks.map((s) => {
      const isSubDone = s.done;
      const isSubTerminated = s.status === 'terminated' || s.terminated || isTerminated;
      return `
        <div class="et-subtask-row ${isSubDone ? 'et-subtask-row--checked' : ''} ${isSubTerminated ? 'et-subtask-row--terminated' : ''}" data-subtask-id="${s.id}">
          <label class="et-subtask-check">
            <input type="checkbox" ${s.done ? 'checked' : ''} ${(isReadOnly || s.done || isSubTerminated) ? 'disabled' : ''} data-st-toggle="${s.id}" />
            <span class="et-subtask-check__box">${icons.check}</span>
          </label>
          <input type="text" class="et-subtask-input" value="${escapeAttr(s.name)}" ${isReadOnly ? 'disabled' : ''} data-st-edit="${s.id}" />
        </div>
      `;
    }).join('');

    if (!isReadOnly) {
      subtaskListEl.querySelectorAll('[data-st-toggle]').forEach((cb) => {
        cb.addEventListener('change', async () => {
          if (cb.checked) {
            // 自定义确认弹窗替代原生 confirm
            const ok = await confirmDialog({
              title: '完成子任务',
              message: '确认将此子任务标记为已完成？',
              confirmText: '确认完成',
            });
            if (!ok) {
              cb.checked = false;
              return;
            }
          }
          commitSubtaskNames();
          store.updateSubtask(taskId, cb.dataset.stToggle, { done: cb.checked });
        });
      });
    }
  }

  // 提交子任务输入框中未保存的名称编辑，避免重渲染丢失输入
  function commitSubtaskNames() {
    const fresh = store.getTask(taskId);
    if (!fresh) return;
    subtaskListEl.querySelectorAll('[data-st-edit]').forEach((input) => {
      const id = input.dataset.stEdit;
      const value = input.value.trim();
      // 空名称不落库（避免产生空名子任务）
      if (!value) return;
      const st = fresh.subtasks.find((s) => s.id === id);
      if (st && st.name !== value) {
        store.updateSubtask(taskId, id, { name: value });
      }
    });
  }

  if (!isReadOnly) {
    modal.querySelector('#et-add-subtask').addEventListener('click', () => {
      commitSubtaskNames();
      store.addSubtask(taskId, '新子任务');
      setTimeout(() => {
        renderSubtasks();
        const inputs = subtaskListEl.querySelectorAll('.et-subtask-input');
        if (inputs.length > 0) {
          const last = inputs[inputs.length - 1];
          last.focus();
          last.select();
        }
      }, 0);
    });
  }

  // ─── 时间线渲染 ──────────────────────────────────────
  const timelineEl = modal.querySelector('#et-timeline');
  function renderTimeline() {
    const fresh = store.getTask(taskId);
    if (!fresh) return;
    const logs = fresh.logs.slice().reverse(); // 最新在上
    timelineEl.innerHTML = logs.map((log, i) => {
      const isLatest = i === 0;
      const logDate = new Date(`${log.date}T${log.time}`);
      const relativeTime = formatRelativeTime(logDate);
      return `
        <div class="et-timeline-item">
          <div class="et-timeline-track">
            <div class="et-timeline-dot ${isLatest ? 'et-timeline-dot--brand' : ''}"></div>
            ${i < logs.length - 1 ? '<div class="et-timeline-line"></div>' : ''}
          </div>
          <div class="et-timeline-content">
            <div class="et-timeline-text">${escapeHtml(log.text)}</div>
            <div class="et-timeline-time">${relativeTime}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─── 关闭逻辑 ────────────────────────────────────────
  let unsub = null;
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    // 存在叠加的上层弹窗（终止确认/完成子任务确认）时，Esc 只关上层
    if (hasUpperModal()) return;
    close();
  };
  document.addEventListener('keydown', onKey);

  function close() {
    if (unsub) {
      try { unsub(); } catch { /* ignore */ }
    }
    document.removeEventListener('keydown', onKey);
    document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
    if (typeof onClose === 'function') {
      try { onClose(); } catch { /* ignore */ }
    }
  }

  // 直接绑定关闭按钮（更可靠，避免事件委托被其他 handler 拦截）
  const etClose = modal.querySelector('#et-close');
  const etCancel = modal.querySelector('#et-cancel');
  if (etClose) etClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  if (etCancel) etCancel.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  if (!isReadOnly) {
    modal.querySelector('#et-delete').addEventListener('click', () => {
      openTerminateModal(task, taskId, close);
    });

    const $etName = modal.querySelector('#et-name');
    const $etNameError = modal.querySelector('#et-name-error');
    $etName.addEventListener('input', () => { $etNameError.textContent = ''; });

    modal.querySelector('#et-save').addEventListener('click', () => {
      const name = $etName.value.trim();
      if (!name) {
        // 行内错误提示，替代静默 focus
        $etNameError.textContent = '请输入任务名称';
        $etName.focus();
        return;
      }
      commitSubtaskNames();
      store.updateTask(taskId, {
        name,
        description: modal.querySelector('#et-desc').value.trim(),
        priority: modal.querySelector('#et-priority').value,
        deadline: modal.querySelector('#et-deadline-input').value,
      });
      close();
    });
  }

  // 订阅 store 变化（子任务增删改时实时刷新）
  unsub = store.subscribe(() => {
    renderSubtasks();
    renderTimeline();
  });

  renderSubtasks();
  renderTimeline();
  setTimeout(() => modal.querySelector('#et-name').focus(), 100);
}

// ─── 终止任务弹窗 ──────────────────────────────────────
function openTerminateModal(task, taskId, parentClose) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'ct-modal ct-modal--terminate';

  modal.innerHTML = `
    <div class="ct-modal__header">
      <div class="ct-modal__title">终止任务</div>
      <button class="ct-modal__close" id="tm-close" title="关闭" aria-label="关闭">${icons.close}</button>
    </div>
    <div class="ct-modal__body">
      <div class="ct-field">
        <label class="ct-label">任务名称</label>
        <div class="tm-task-name">${escapeHtml(task.name)}</div>
      </div>
      <div class="ct-field">
        <label class="ct-label" for="tm-reason">终止原因 <span class="ct-required">*</span></label>
        <textarea id="tm-reason" class="ct-textarea" placeholder="请输入终止原因（必填，200字以内）..." maxlength="200"></textarea>
        <div class="ct-field-error" id="tm-reason-error"></div>
      </div>
    </div>
    <div class="ct-modal__footer">
      <button class="et-btn et-btn--cancel" id="tm-cancel">取消</button>
      <button class="et-btn et-btn--danger" id="tm-confirm">确认终止</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  // Escape 关闭（与其他弹窗行为一致）
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  modal.querySelector('#tm-close').addEventListener('click', close);
  modal.querySelector('#tm-cancel').addEventListener('click', close);

  const $reason = modal.querySelector('#tm-reason');
  const $reasonError = modal.querySelector('#tm-reason-error');
  $reason.addEventListener('input', () => { $reasonError.textContent = ''; });

  modal.querySelector('#tm-confirm').addEventListener('click', () => {
    const reason = $reason.value.trim();
    if (!reason) {
      // 行内错误提示，替代静默 focus
      $reasonError.textContent = '请输入终止原因';
      $reason.focus();
      return;
    }
    store.terminateTask(taskId, reason);
    close();
    parentClose();
  });

  setTimeout(() => $reason.focus(), 100);
}

// ─── HTML 转义 ────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
