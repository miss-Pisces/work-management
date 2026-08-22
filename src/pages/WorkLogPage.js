// WorkLogPage.js — 工作日志页面
// 包含：单栏卡片布局、自动记录与手动记录展示、手动日志添加弹窗、搜索与导出功能

import { store } from '../store.js';
import { icons } from '../utils/icons.js';
import {
  formatLongDate, toISODate, fromISODate,
} from '../utils/date.js';
import { getMonthCalendar, getMonthLabel, getLunarYearLabel } from '../utils/lunar.js';

export function createWorkLogPage() {
  const today = new Date();
  const state = {
    currentDate: toISODate(today),
    search: '',
    calYear: today.getFullYear(),
    calMonth: today.getMonth() + 1,
  };

  const el = document.createElement('div');
  el.className = 'wl-page-container';

  function getAllDates() {
    // 收集所有有日志的日期：直接复用 store 的统一聚合方法
    const dates = new Set(store.getAllLogDates());
    dates.add(state.currentDate);
    return [...dates].sort();
  }

  function getAutoRecords(date) {
    const autoRecords = [];
    store.getTasks().forEach((t) => {
      t.logs.forEach((l) => {
        if (l.date !== date) return;
        if (l.text === '完成任务') {
          autoRecords.push({ ...l, taskName: t.name, taskStatus: t.status, type: 'task' });
        } else if (l.text.startsWith('完成子任务')) {
          // 解析子任务名称
          const match = l.text.match(/^完成子任务「(.+)」$/);
          const subtaskName = match ? match[1] : l.text;
          autoRecords.push({ ...l, taskName: t.name, taskStatus: t.status, subtaskName, type: 'subtask' });
        }
      });
    });
    autoRecords.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return autoRecords;
  }

  // ─── 共用：搜索过滤（render 与 renderContentOnly 唯一数据源）───
  function getFilteredRecords() {
    const log = store.getWorkLog(state.currentDate);
    let autoRecords = getAutoRecords(state.currentDate);
    let manualEntries = log.manualEntries.slice();

    // 搜索过滤：搜索所有日期的日志
    if (state.search) {
      const q = state.search.toLowerCase();
      const allDates = getAllDates();
      autoRecords = [];
      manualEntries = [];
      allDates.forEach((date) => {
        getAutoRecords(date).forEach((r) => {
          if (r.text.toLowerCase().includes(q) || (r.taskName && r.taskName.toLowerCase().includes(q))) {
            autoRecords.push({ ...r, _date: date });
          }
        });
        store.getWorkLog(date).manualEntries.forEach((e) => {
          if (e.text.toLowerCase().includes(q)) {
            manualEntries.push({ ...e, _date: date });
          }
        });
      });
    }
    return { autoRecords, manualEntries };
  }

  // ─── 共用：记录卡片 HTML ───
  function buildRecordsHtml() {
    const { autoRecords, manualEntries } = getFilteredRecords();

    const autoList = autoRecords.length === 0
      ? `<div class="wl-auto-empty">${state.search ? '未找到匹配的日志' : '今日暂无自动记录，任务完成后将自动呈现在这里'}</div>`
      : autoRecords.map((r) => `
          <div class="wl-auto-item">
            <div class="wl-auto-item__check">${icons.check}</div>
            <div class="wl-auto-item__body">
              <div class="wl-auto-item__text wl-auto-item__text--done">${r.type === 'subtask' ? escapeHtml(r.subtaskName) : escapeHtml(r.taskName)}</div>
              ${r.type === 'subtask' ? `<span class="wl-auto-item__sub">子任务 · 所属：${escapeHtml(r.taskName)}</span>` : ''}
              ${r._date ? `<span class="wl-record-date">${r._date}</span>` : ''}
            </div>
            <div class="wl-auto-item__indicator"></div>
          </div>
        `).join('');

    const manualList = manualEntries.length === 0
      ? `<div class="wl-auto-empty">${state.search ? '未找到匹配的日志' : '今日暂无手动记录，点击左上方「添加日志」开始记录'}</div>`
      : manualEntries.map((e) => `
          <div class="wl-manual-entry">
            <span class="wl-manual-entry__time">${e.time}</span>
            <span class="wl-manual-entry__text">${escapeHtml(e.text)}</span>
            ${e._date ? `<span class="wl-record-date">${e._date}</span>` : ''}
          </div>
        `).join('');

    return `
      <!-- 自动记录 -->
      <div class="wl-section">
        <div class="wl-section-header">
          <span class="wl-section-title"><span class="wl-section-title__icon">${icons.clock}</span> 自动记录 (已完成任务/子任务)</span>
          <span class="wl-section-count">${autoRecords.length} 项</span>
        </div>
        <div class="wl-list">
          ${autoList}
        </div>
      </div>

      <div class="wl-divider"></div>

      <!-- 手动记录 -->
      <div class="wl-section">
        <div class="wl-section-header">
          <span class="wl-section-title"><span class="wl-section-title__icon">${icons.tasks}</span> 手动记录</span>
          <span class="wl-section-count">${manualEntries.length} 项</span>
        </div>
        <div class="wl-list wl-list--manual">
          <div class="wl-manual-entries">
            ${manualList}
          </div>
        </div>
      </div>
    `;
  }

  // ─── 共用：月历 HTML（render 与 store 刷新的唯一数据源）───
  function buildCalendarHtml() {
    const todayObj = new Date();
    const todayStr = toISODate(todayObj);
    const todayYear = todayObj.getFullYear();
    const todayMonth = todayObj.getMonth() + 1;
    const isMaxMonth = state.calYear > todayYear || (state.calYear === todayYear && state.calMonth >= todayMonth);
    // 当月行动日集合（有完成任务/子任务的日期），用于月历标记
    const { actionDates } = store.getMonthlyAction(state.calYear, state.calMonth);

    return `
      <div class="wl-calendar__header">
        <button class="wl-calendar__nav-btn" id="wl-cal-prev" title="上个月" aria-label="上个月">${icons.chevronLeft || '<'}</button>
        <div class="wl-calendar__title">
          <span class="wl-calendar__month-label">${getMonthLabel(state.calYear, state.calMonth)}</span>
          <span class="wl-calendar__lunar-label">${getLunarYearLabel(state.calYear, state.calMonth, 1)}</span>
        </div>
        <button class="wl-calendar__nav-btn" id="wl-cal-next" title="下个月" aria-label="下个月" ${isMaxMonth ? 'disabled' : ''}>${icons.chevronRight || '>'}</button>
      </div>
      <div class="wl-calendar__weekdays">
        <span class="wl-calendar__weekday">一</span>
        <span class="wl-calendar__weekday">二</span>
        <span class="wl-calendar__weekday">三</span>
        <span class="wl-calendar__weekday">四</span>
        <span class="wl-calendar__weekday">五</span>
        <span class="wl-calendar__weekday wl-calendar__weekday--weekend">六</span>
        <span class="wl-calendar__weekday wl-calendar__weekday--weekend">日</span>
      </div>
      <div class="wl-calendar__grid" id="wl-cal-grid">
        ${getMonthCalendar(state.calYear, state.calMonth).map((cell) => {
          const isFuture = cell.date > todayStr;
          // 行动日：当天有完成任务/子任务日志；今天不标记（还没过完，次日结算）
          const isAction = !cell.isToday && !isFuture && actionDates.has(cell.date);
          return `
            <div class="wl-calendar__cell ${cell.isToday ? 'is-today' : ''} ${cell.date === state.currentDate ? 'is-selected' : ''} ${cell.isCurrentMonth ? '' : 'is-out'} ${cell.festival ? 'is-festival' : ''} ${isFuture ? 'is-future' : ''} ${isAction ? 'is-action' : ''}" data-date="${cell.date}" role="button" tabindex="-1" aria-label="${cell.date}${cell.isToday ? '，今天' : ''}${isAction ? '，行动日' : ''}" ${isAction ? 'title="行动日：当天有完成任务"' : ''}>
              <span class="wl-calendar__day">${cell.day}</span>
              <span class="wl-calendar__lunar">${cell.lunarShort}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="wl-calendar__legend">
        <span class="wl-calendar__legend-item"><span class="wl-calendar__legend-dot wl-calendar__legend-dot--today"></span>今天</span>
        <span class="wl-calendar__legend-item"><span class="wl-calendar__legend-dot wl-calendar__legend-dot--festival"></span>节日</span>
        <span class="wl-calendar__legend-item"><span class="wl-calendar__legend-dot wl-calendar__legend-dot--action"></span>行动日</span>
        <span class="wl-calendar__legend-item"><span class="wl-calendar__legend-dot wl-calendar__legend-dot--idle"></span>空闲日</span>
      </div>
    `;
  }

  // 月历事件绑定（buildCalendarHtml 重画后调用）
  function bindCalendarEvents() {
    const todayStr = toISODate(new Date());

    el.querySelector('#wl-cal-prev').addEventListener('click', () => {
      state.calMonth--;
      if (state.calMonth < 1) {
        state.calMonth = 12;
        state.calYear--;
      }
      renderCalendar();
    });
    el.querySelector('#wl-cal-next').addEventListener('click', () => {
      const t = new Date();
      if (state.calYear > t.getFullYear() || (state.calYear === t.getFullYear() && state.calMonth >= t.getMonth() + 1)) return;
      state.calMonth++;
      if (state.calMonth > 12) {
        state.calMonth = 1;
        state.calYear++;
      }
      renderCalendar();
    });

    // 月历日期点击：切换查看该日期的日志（未来日期禁止点击）
    el.querySelectorAll('.wl-calendar__cell[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => {
        if (cell.dataset.date > todayStr) return;
        state.currentDate = cell.dataset.date;
        render();
      });
    });
  }

  // 局部重画月历（store 数据变化、翻月时使用，不触碰搜索框焦点）
  function renderCalendar() {
    const cal = el.querySelector('.wl-calendar');
    cal.innerHTML = buildCalendarHtml();
    bindCalendarEvents();
  }

  // 局部重画记录卡片（搜索输入、store 数据变化时使用）
  function renderContentOnly() {
    el.querySelector('.wl-card').innerHTML = buildRecordsHtml();
  }

  function render() {
    const dateObj = fromISODate(state.currentDate);

    const todayObj = new Date();
    const todayStr = toISODate(todayObj);
    const isCurrentDay = state.currentDate === todayStr;
    const isMaxDay = state.currentDate >= todayStr;

    el.innerHTML = `
      <div class="wl-page-header">
        <button class="wf-menu-toggle-btn" id="wl-menu-toggle" aria-label="打开菜单">${icons.menu}</button>
        <button class="wl-btn wl-btn--primary" id="wl-add-log-btn">
          <span class="wf-btn__lead-icon">${icons.plus}</span> 添加日志
        </button>
        <div class="wl-search-wrapper">
          <span class="wl-search-icon">${icons.search}</span>
          <input type="text" class="wl-search-input" id="wl-log-search" placeholder="搜索日志..." aria-label="搜索日志" />
        </div>
      </div>

      <div class="wl-date-nav">
        <div class="wl-date-nav__center">
          <button class="wl-day-nav-btn" id="wl-day-prev" title="前一天" aria-label="查看前一天">${icons.chevronLeft}</button>
          <span class="wl-date-nav__date">${formatLongDate(dateObj)}</span>
          ${isCurrentDay ? `
            <span class="wl-date-nav__badge">今天</span>
          ` : `
            <button class="wl-date-nav__badge wl-date-nav__badge--back" id="wl-back-today" title="点击一键返回今天">← 返回今天</button>
          `}
          <button class="wl-day-nav-btn" id="wl-day-next" title="后一天" aria-label="查看后一天" ${isMaxDay ? 'disabled' : ''}>${icons.chevronRight}</button>
        </div>
        <button class="wl-export-btn" id="wl-export-btn">
          <span class="wl-export-btn__icon">${icons.download}</span> 导出日志
        </button>
      </div>

      <div class="wl-main-layout">
        <div class="wl-calendar-sidebar">
          <div class="wl-calendar">
            ${buildCalendarHtml()}
          </div>
        </div>

        <div class="wl-card">
          ${buildRecordsHtml()}
        </div>
      </div>
    `;

    // 绑定值
    el.querySelector('#wl-log-search').value = state.search;

    // 返回今天
    const backTodayBtn = el.querySelector('#wl-back-today');
    if (backTodayBtn) {
      backTodayBtn.addEventListener('click', () => {
        const t = new Date();
        state.currentDate = toISODate(t);
        state.calYear = t.getFullYear();
        state.calMonth = t.getMonth() + 1;
        render();
      });
    }

    // 逐日前后导航（后一天不可越过今天）
    const shiftDay = (dateISO, delta) => {
      const d = fromISODate(dateISO);
      d.setDate(d.getDate() + delta);
      return toISODate(d);
    };
    el.querySelector('#wl-day-prev').addEventListener('click', () => {
      state.currentDate = shiftDay(state.currentDate, -1);
      syncCalendarMonth();
      render();
    });
    el.querySelector('#wl-day-next').addEventListener('click', () => {
      if (state.currentDate >= todayStr) return;
      state.currentDate = shiftDay(state.currentDate, 1);
      syncCalendarMonth();
      render();
    });

    // 导出日志
    el.querySelector('#wl-export-btn').addEventListener('click', () => {
      openExportModal();
    });

    // 月历事件
    bindCalendarEvents();

    // 添加日志弹窗
    el.querySelector('#wl-add-log-btn').addEventListener('click', () => {
      openAddLogModal();
    });

    // 搜索
    el.querySelector('#wl-log-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      renderContentOnly();
    });

    // 移动端开菜单
    el.querySelector('#wl-menu-toggle').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wf-open-sidebar'));
    });
  }

  // 逐日导航后若跨月，月历视图跟随当前日期所在月
  function syncCalendarMonth() {
    const d = fromISODate(state.currentDate);
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth() + 1;
  }

  function openAddLogModal() {
    const todayObj = new Date();
    const todayStr = toISODate(todayObj);
    const todayYear = todayObj.getFullYear();
    const todayMonth = todayObj.getMonth() + 1;
    const todayDay = todayObj.getDate();
    const isRetro = state.currentDate < todayStr;
    const retroTagText = `${todayYear}年${todayMonth}月${todayDay}日补录`;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ct-modal ct-modal--log';

    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    modal.innerHTML = `
      <div class="ct-modal__header">
        <div class="ct-modal__title">添加工作日志</div>
        <button class="ct-modal__close" id="wl-close-modal" title="关闭" aria-label="关闭">${icons.close}</button>
      </div>
      <div class="ct-modal__body">
        ${isRetro ? `
          <div class="wl-retro-hint">
            💡 当前正在为历史日期（${state.currentDate}）补录日志，提交后将自动加注“${retroTagText}”。
          </div>
        ` : ''}
        <div class="ct-field">
          <label class="ct-label">记录时间 <span class="ct-required">*</span></label>
          <div class="ct-input">
            <input type="time" id="wl-log-time" value="${defaultTime}" />
          </div>
        </div>
        <div class="ct-field">
          <label class="ct-label" for="wl-log-content">工作内容 <span class="ct-required">*</span></label>
          <div class="ct-input">
            <input type="text" id="wl-log-content" placeholder="记录你完成的工作..." maxlength="100" />
          </div>
          <div class="ct-field-error" id="wl-content-error"></div>
        </div>
      </div>
      <div class="ct-modal__footer">
        <button class="ct-btn ct-btn--cancel" id="wl-cancel-modal">取消</button>
        <button class="ct-btn ct-btn--primary" id="wl-submit-modal">添加</button>
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

    modal.querySelector('#wl-close-modal').addEventListener('click', close);
    modal.querySelector('#wl-cancel-modal').addEventListener('click', close);

    const $content = modal.querySelector('#wl-log-content');
    const $error = modal.querySelector('#wl-content-error');
    $content.addEventListener('input', () => { $error.textContent = ''; });

    modal.querySelector('#wl-submit-modal').addEventListener('click', () => {
      const time = modal.querySelector('#wl-log-time').value;
      let text = $content.value.trim();
      if (!text) {
        // 行内错误提示，替代静默 focus
        $error.textContent = '请输入工作内容';
        $content.focus();
        return;
      }
      if (isRetro && !/（\d{4}年\d{1,2}月\d{1,2}日补录）$/.test(text)) {
        text += ` （${retroTagText}）`;
      }
      store.addManualEntry(state.currentDate, time, text);
      close();
    });

    setTimeout(() => $content.focus(), 100);
  }

  function openExportModal() {
    const todayISO = toISODate(new Date());
    // 默认导出范围：最近 7 天
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ct-modal ct-modal--export';

    modal.innerHTML = `
      <div class="ct-modal__header">
        <div class="ct-modal__title">导出工作日志</div>
        <button class="ct-modal__close" id="wl-export-close" title="关闭" aria-label="关闭">${icons.close}</button>
      </div>
      <div class="ct-modal__body">
        <div class="wl-export-hint">选择要导出的时间范围，支持跨多天导出。</div>
        <div class="wl-export-range">
          <div class="ct-field">
            <label class="ct-label" for="wl-export-start">开始日期 <span class="ct-required">*</span></label>
            <div class="ct-input">
              <input type="date" id="wl-export-start" value="${toISODate(sevenDaysAgo)}" max="${todayISO}" />
            </div>
          </div>
          <div class="ct-export-arrow">→</div>
          <div class="ct-field">
            <label class="ct-label" for="wl-export-end">结束日期 <span class="ct-required">*</span></label>
            <div class="ct-input">
              <input type="date" id="wl-export-end" value="${todayISO}" max="${todayISO}" />
            </div>
          </div>
        </div>
        <div class="wl-export-presets">
          <button type="button" class="wl-export-preset" data-preset="today">今天</button>
          <button type="button" class="wl-export-preset" data-preset="week">最近7天</button>
          <button type="button" class="wl-export-preset" data-preset="month">最近30天</button>
          <button type="button" class="wl-export-preset" data-preset="all">全部</button>
        </div>
        <div class="wl-export-error" id="wl-export-error"></div>
        <div class="wl-export-status" id="wl-export-status"></div>
      </div>
      <div class="ct-modal__footer">
        <button class="ct-btn ct-btn--cancel" id="wl-export-cancel">取消</button>
        <button class="ct-btn ct-btn--primary" id="wl-export-confirm">
          <span id="wl-export-confirm-text">确认导出</span>
        </button>
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

    const $start = modal.querySelector('#wl-export-start');
    const $end = modal.querySelector('#wl-export-end');
    const $err = modal.querySelector('#wl-export-error');
    const $status = modal.querySelector('#wl-export-status');
    const $confirm = modal.querySelector('#wl-export-confirm');
    const $confirmText = modal.querySelector('#wl-export-confirm-text');

    modal.querySelector('#wl-export-close').addEventListener('click', close);
    modal.querySelector('#wl-export-cancel').addEventListener('click', close);

    // 预设按钮
    modal.querySelectorAll('.wl-export-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const end = new Date();
        let start = new Date();
        if (preset === 'today') {
          // start = end
        } else if (preset === 'week') {
          start.setDate(end.getDate() - 6);
        } else if (preset === 'month') {
          start.setDate(end.getDate() - 29);
        } else if (preset === 'all') {
          // 全部：从最早有日志的日期开始
          const allDates = getAllDates();
          if (allDates.length > 0) {
            start = fromISODate(allDates[0]);
          }
        }
        $start.value = toISODate(start);
        $end.value = toISODate(end);
        $err.textContent = '';
      });
    });

    // 输入变化时清除错误
    [$start, $end].forEach(($i) => {
      $i.addEventListener('change', () => { $err.textContent = ''; });
    });

    modal.querySelector('#wl-export-confirm').addEventListener('click', () => {
      const startVal = $start.value;
      const endVal = $end.value;

      // 校验
      if (!startVal || !endVal) {
        $err.textContent = '请选择开始日期和结束日期';
        return;
      }
      if (startVal > endVal) {
        $err.textContent = '开始日期不能晚于结束日期';
        return;
      }

      // 禁用按钮，显示导出中
      $confirm.disabled = true;
      $confirmText.textContent = '导出中...';
      $err.textContent = '';
      $status.textContent = '正在生成日志文件...';

      // 用 setTimeout 让 UI 有机会刷新
      setTimeout(() => {
        try {
          const result = doExport(startVal, endVal);
          $status.textContent = `导出成功：共 ${result.days} 天，${result.count} 条记录`;
          setTimeout(() => {
            close();
          }, 800);
        } catch (e) {
          $status.textContent = '';
          $err.textContent = '导出失败：' + (e.message || '未知错误');
          $confirm.disabled = false;
          $confirmText.textContent = '确认导出';
        }
      }, 50);
    });

    function doExport(startISO, endISO) {
      // 收集范围内的所有日期（降序：最近的天在前）
      const allDates = getAllDates().filter((d) => d >= startISO && d <= endISO);
      // 降序排列：最近的日期在前
      allDates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

      let text = `工作日志导出\n`;
      text += `时间范围：${startISO} 至 ${endISO}\n`;
      text += `${'='.repeat(50)}\n\n`;

      let totalEntries = 0;
      let daysWithLogs = 0;

      if (allDates.length === 0) {
        text += '（所选范围内无日志记录）\n';
      } else {
        allDates.forEach((date) => {
          const dateObj = fromISODate(date);
          const log = store.getWorkLog(date);
          const autoRecords = getAutoRecords(date);
          // 天内按时间正序排（getAutoRecords 已排，manualEntries 在此排序）
          const manual = log.manualEntries.slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          const hasContent = autoRecords.length > 0 || manual.length > 0;

          text += `【${formatLongDate(dateObj)}】\n`;
          text += `-`.repeat(40) + '\n';

          if (!hasContent) {
            text += '（无记录）\n\n';
            return;
          }

          daysWithLogs++;
          if (autoRecords.length > 0) {
            text += `自动记录：\n`;
            autoRecords.forEach((r) => {
              const label = r.type === 'subtask' ? `${r.taskName} / ${r.subtaskName}` : r.taskName;
              text += `  ${r.time}  ${label}\n`;
              totalEntries++;
            });
          }
          if (manual.length > 0) {
            if (autoRecords.length > 0) text += '\n';
            text += `手动记录：\n`;
            manual.forEach((e) => {
              text += `  ${e.time}  ${e.text}\n`;
              totalEntries++;
            });
          }
          text += '\n';
        });
      }

      text += `${'='.repeat(50)}\n`;
      text += `共 ${daysWithLogs} 天有记录，合计 ${totalEntries} 条\n`;

      // 生成文件名：范围_开始_结束.txt
      const filename = `工作日志_${startISO}_至_${endISO}.txt`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      return { days: daysWithLogs, count: totalEntries };
    }
  }

  // 订阅 store 变化：右侧卡片与月历同步刷新
  // （月历的行动日标记依赖任务日志，悬浮窗完成任务后主窗口需即时呈现）
  const unsub = store.subscribe(() => {
    if (el.parentNode) {
      renderContentOnly();
      renderCalendar();
    }
  });

  // 跨零点自动更新：常驻托盘应用跨天后，「今天」高亮与行动日结算需自动刷新
  let lastTodayKey = toISODate(new Date());
  const midnightTimer = setInterval(() => {
    const key = toISODate(new Date());
    if (key !== lastTodayKey && el.parentNode) {
      lastTodayKey = key;
      const t = new Date();
      state.currentDate = key;
      state.calYear = t.getFullYear();
      state.calMonth = t.getMonth() + 1;
      render();
    }
  }, 30000);

  // 监听其他窗口的 localStorage 变化（悬浮窗勾选子任务等）
  // loadFromStorage 会自动触发订阅者刷新 renderContentOnly + renderCalendar，无需在此手动调用
  const onStorage = (e) => {
    if (e.key === 'wf-work-management-v1' && e.newValue) {
      store.loadFromStorage(e.newValue);
    }
  };
  window.addEventListener('storage', onStorage);

  el._destroy = () => {
    unsub();
    clearInterval(midnightTimer);
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
