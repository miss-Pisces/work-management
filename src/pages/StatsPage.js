// StatsPage.js — 工作统计页面
// 包含：时间范围切换、KPI 卡片、周一到周日任务完成趋势柱状图

import { store } from '../store.js';
import { icons } from '../utils/icons.js';

const RANGES = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季度' },
  { key: 'year', label: '本年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
];

// 趋势图 SVG 内边距（渲染与 tooltip 定位共用）
const CHART_PAD_LEFT = 40;
const CHART_PAD_RIGHT = 12;

export function createStatsPage() {
  const state = {
    range: 'today',
    customStart: '',
    customEnd: '',
    appliedCustom: null, // 已应用的自定义范围 { start, end }；null 表示尚未应用
    hiddenSeries: {},
  };

  // 自定义草稿是否有效：起止齐全且起始 ≤ 结束（ISO 字符串可直接比较）
  function isDraftValid() {
    return !!(state.customStart && state.customEnd && state.customStart <= state.customEnd);
  }

  // 趋势图参考宽度：与卡片内容区实际宽度一致，由 ResizeObserver 校正
  let chartW = 1140;

  const el = document.createElement('div');
  el.className = 'stats-page-container';

  function getWeeklyData() {
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDay + 1);
    monday.setHours(0, 0, 0, 0);

    const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const data = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      data.push({
        date: dStr,
        day: i,
        label: weekdayLabels[i],
        dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        newTask: 0,
        newSubtask: 0,
        doneTask: 0,
        doneSubtask: 0,
      });
    }

    const tasks = store.getTasks();
    const dateIdxMap = {};
    data.forEach((d, i) => { dateIdxMap[d.date] = i; });

    tasks.forEach((t) => {
      t.logs.forEach((l) => {
        if (!l.date || dateIdxMap[l.date] == null) return;
        const idx = dateIdxMap[l.date];
        if (l.text === '创建任务') {
          data[idx].newTask++;
        } else if (l.text.startsWith('添加子任务')) {
          data[idx].newSubtask++;
        } else if (l.text === '完成任务') {
          data[idx].doneTask++;
        } else if (l.text.startsWith('完成子任务')) {
          data[idx].doneSubtask++;
        }
      });
    });

    return data;
  }

  const SERIES_CONFIG = [
    { key: 'newTask', label: '新建主任务', color: 'var(--viz-series-brand)', type: 'bar' },
    { key: 'newSubtask', label: '新建子任务', color: 'var(--viz-series-sky)', type: 'bar' },
    { key: 'doneTask', label: '完成主任务', color: 'var(--viz-series-mint)', type: 'bar' },
    { key: 'doneSubtask', label: '完成子任务', color: 'var(--viz-series-amber)', type: 'bar' },
  ];

  function renderComboChart(weeklyData) {
    const visibleSeries = SERIES_CONFIG.filter((s) => !state.hiddenSeries[s.key]);
    const chartH = 240;
    const padLeft = CHART_PAD_LEFT;
    const padRight = CHART_PAD_RIGHT;
    const padTop = 20;
    const padBottom = 44;
    const plotW = chartW - padLeft - padRight;
    const plotH = chartH - padTop - padBottom;
    const numDays = 7;
    const groupW = plotW / numDays;
    const barGap = 3;
    // 宽卡片下限制柱宽，避免柱子过粗
    const barW = Math.min((groupW - barGap * (visibleSeries.length - 1)) / Math.max(visibleSeries.length, 1), 26);

    let maxVal = 0;
    weeklyData.forEach((d) => {
      visibleSeries.forEach((s) => {
        if (d[s.key] > maxVal) maxVal = d[s.key];
      });
    });
    maxVal = Math.max(6, maxVal);
    const yTicks = 6;
    const yStep = Math.ceil(maxVal / yTicks);
    const yMax = yStep * yTicks;
    const yScale = plotH / yMax;

    const yLines = [];
    const yLabels = [];
    for (let i = 0; i <= yTicks; i++) {
      const val = yMax - yStep * i;
      const y = padTop + i * (plotH / yTicks);
      yLines.push(`<line x1="${padLeft}" y1="${y}" x2="${chartW - padRight}" y2="${y}" stroke="#f2f4f7" stroke-width="1" />`);
      yLabels.push(`<text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" font-size="13" fill="#667085">${val}</text>`);
    }

    const xLabels = [];
    const futureMasks = [];
    // 今天在本周的位置（0=周一…6=周日），其后的列为"尚未发生"
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayIdx = weeklyData.findIndex((d) => d.date === todayStr);
    weeklyData.forEach((d, i) => {
      const x = padLeft + i * groupW + groupW / 2;
      const isFuture = todayIdx >= 0 && i > todayIdx;
      if (isFuture) {
        futureMasks.push(
          `<rect class="cmb-future-mask" x="${(padLeft + i * groupW).toFixed(1)}" y="${padTop}" width="${groupW.toFixed(1)}" height="${plotH}" fill="#98a2b3" fill-opacity="0.08" pointer-events="none" />`
        );
      }
      const weekFill = isFuture ? '#98a2b3' : '#475467';
      const weekWeight = isFuture ? '400' : '500';
      const dateFill = isFuture ? '#98a2b3' : '#667085';
      xLabels.push(`
        <text x="${x}" y="${chartH - padBottom + 15}" text-anchor="middle" font-size="14" font-weight="${weekWeight}" fill="${weekFill}">${d.label}</text>
        <text x="${x}" y="${chartH - padBottom + 32}" text-anchor="middle" font-size="13" fill="${dateFill}">${d.dateLabel}</text>
      `);
    });

    const bars = [];

    visibleSeries.forEach((s, sIdx) => {
      weeklyData.forEach((d, i) => {
        const groupX = padLeft + i * groupW;
        const barX = groupX + sIdx * (barW + barGap) + (groupW - visibleSeries.length * barW - (visibleSeries.length - 1) * barGap) / 2;
        const val = d[s.key];
        const barH = val * yScale;
        const barY = padTop + plotH - barH;

        if (barH > 0) {
          // 主任务系列可点击下钻；子任务系列纯展示
          const linkCls = (s.key === 'newTask' || s.key === 'doneTask') ? ' cmb-bar--link' : '';
          bars.push(
            `<rect class="cmb-bar cmb-bar--${s.key}${linkCls}" data-day="${i}" data-series="${s.key}" data-value="${val}" ` +
            `x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" ` +
            `fill="${s.color}" rx="3" ry="3" />`
          );
        }
      });
    });

    const hoverTargets = [];
    for (let i = 0; i < numDays; i++) {
      const x = padLeft + i * groupW;
      hoverTargets.push(
        `<rect class="cmb-hover-target" data-day="${i}" ` +
        `x="${x}" y="${padTop}" width="${groupW}" height="${plotH}" fill="transparent" />`
      );
    }

    const legendItems = SERIES_CONFIG.map((s) => {
      const hidden = state.hiddenSeries[s.key];
      const total = weeklyData.reduce((sum, d) => sum + (d[s.key] || 0), 0);
      return (
        `<button type="button" class="cmb-legend-item ${hidden ? 'is-hidden' : ''}" data-series="${s.key}" aria-pressed="${!hidden}" title="点击切换显示">
          <span class="cmb-legend-icon" style="background:${s.color};"></span>
          <span class="cmb-legend-label">${s.label}</span>
          <span class="cmb-legend-value">${total}</span>
        </button>`
      );
    }).join('');

    return `
      <div class="combo-chart">
        <svg class="combo-chart__svg" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="xMidYMid meet">
          ${yLines.join('')}
          ${yLabels.join('')}
          <line x1="${padLeft}" y1="${padTop + plotH}" x2="${chartW - padRight}" y2="${padTop + plotH}" stroke="#d0d5dd" stroke-width="1" />
          ${futureMasks.join('')}
          ${xLabels.join('')}
          ${hoverTargets.join('')}
          ${bars.join('')}
        </svg>
        <div class="cmb-tooltip" id="cmb-tooltip"></div>
        <div class="cmb-legend">${legendItems}</div>
      </div>
    `;
  }

  function renderDonutSegments(stats) {
    // 环形图展示「全部主任务」的状态构成，完成率为全局口径：已完成 /（全部 − 已终止）
    const activeTotal = stats.overallTotal - stats.overallTerminated;
    const strokeRadius = 32;
    const circumference = 2 * Math.PI * strokeRadius;

    // 空状态：灰色底环
    if (activeTotal <= 0) {
      return `<circle cx="50" cy="50" r="${strokeRadius}" fill="none" stroke="#e5e7eb" stroke-width="15" />`;
    }

    const data = [
      { value: stats.overallDone, color: 'var(--viz-series-sky)' },
      { value: stats.overallProgress, color: 'var(--viz-series-sky-light)' },
    ].filter((item) => item.value > 0);

    // 只有一种状态：画完整圆环，中心显示完成率（done / activeTotal）
    if (data.length === 1) {
      const rateText = stats.completionRate != null ? stats.completionRate + '%' : '';
      return `<circle cx="50" cy="50" r="${strokeRadius}" fill="none" stroke="${data[0].color}" stroke-width="15" />
              <text x="50" y="46" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="700" fill="#1d2939">${rateText}</text>
              <text x="50" y="59" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#667085">完成率</text>`;
    }

    // 多种状态：用 stroke-dasharray 分段
    let offset = 0;
    let result = '';
    data.forEach((item) => {
      const pct = item.value / activeTotal;
      const dashLen = pct * circumference;
      const gapLen = circumference - dashLen;
      result += `<circle cx="50" cy="50" r="${strokeRadius}" fill="none" stroke="${item.color}" stroke-width="15" stroke-dasharray="${dashLen.toFixed(3)} ${gapLen.toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 50 50)" />`;
      offset += dashLen;
    });

    // 中心显示完成率（done / activeTotal，与分段占比一致）
    const rateText = stats.completionRate != null ? stats.completionRate + '%' : '';
    if (rateText) {
      result += `<text x="50" y="46" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="700" fill="#1d2939">${rateText}</text>
                 <text x="50" y="59" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#667085">完成率</text>`;
    }
    return result;
  }

  function render() {
    // 自定义范围：仅使用「已应用」的起止日期；未应用时不给 KPI 提供范围（显示占位）
    const customActive = state.range === 'custom';
    const rangeParam = customActive
      ? (state.appliedCustom ? { start: state.appliedCustom.start, end: state.appliedCustom.end } : null)
      : state.range;
    // hero 卡与完成率为全局口径，不依赖 range；range 为 null 时 KPI 区显示占位
    const stats = store.getStats(rangeParam || 'all');
    const weeklyData = getWeeklyData();
    const monthlyAction = store.getMonthlyActionStats();
    const weekTotal = weeklyData.reduce((s, d) => s + d.newTask + d.newSubtask + d.doneTask + d.doneSubtask, 0);

    // KPI aria-label 用的范围描述
    const rangeText = customActive ? '所选范围' : (RANGES.find((r) => r.key === state.range) || {}).label || '';

    // 自定义草稿提示：无效时说明原因；有效但未应用时提示生效方式
    let customHint = '';
    if (customActive) {
      if (!state.customStart || !state.customEnd) {
        customHint = '<span class="stats-custom-date__hint">请选择开始与结束日期</span>';
      } else if (state.customStart > state.customEnd) {
        customHint = '<span class="stats-custom-date__hint">结束日期不能早于开始日期</span>';
      } else if (!state.appliedCustom || state.appliedCustom.start !== state.customStart || state.appliedCustom.end !== state.customEnd) {
        customHint = '<span class="stats-custom-date__hint stats-custom-date__hint--muted">点击「应用」查看该范围统计</span>';
      }
    }

    el.innerHTML = `
      <div class="stats-header">
        <button class="wf-menu-toggle-btn" id="stats-menu-toggle">${icons.menu}</button>
      </div>

      <div class="stats-hero-row">
        ${stats.overdue > 0 ? `
          <button type="button" class="stats-overdue-card is-danger" data-kpi-click="overdue" title="查看逾期主任务" aria-label="查看逾期主任务，${stats.overdue} 项">
            <span class="stats-overdue-card__header">
              <span class="stats-overdue-card__icon">${icons.warning}</span>
              <span class="stats-overdue-card__label">逾期主任务数</span>
            </span>
            <span class="stats-overdue-card__num">${stats.overdue}</span>
            <span class="stats-overdue-card__hint">
              ${stats.overdueMaxDays > 0 ? `最久已逾期 ${stats.overdueMaxDays} 天，建议优先处理` : '建议优先处理'}
            </span>
          </button>
        ` : `
          <div class="stats-overdue-card is-success">
            <span class="stats-overdue-card__header">
              <span class="stats-overdue-card__icon">${icons.checkCircle}</span>
              <span class="stats-overdue-card__label">逾期主任务数</span>
            </span>
            <span class="stats-overdue-card__num">${stats.overdue}</span>
            <span class="stats-overdue-card__hint">当前无逾期任务，一切按时推进</span>
          </div>
        `}
        <div class="stats-chart-card stats-hero-card">
          <div class="stats-chart-card__title stats-chart-card__title--rate">
            <span class="stats-chart-card__title-icon">${icons.target}</span>
            <span>主任务完成率</span>
          </div>
          <div class="stats-chart-card__body">
            <div class="donut-chart donut-chart--compact">
              <svg viewBox="0 0 100 100" class="donut-chart__svg donut-chart__svg--compact" role="img"
                aria-label="${stats.overallTotal - stats.overallTerminated > 0
                  ? `全部主任务完成率 ${stats.completionRate}%，已完成 ${stats.overallDone}，进行中 ${stats.overallProgress}`
                  : '暂无任务'}">
                ${renderDonutSegments(stats)}
              </svg>
              <div class="donut-chart__legend donut-chart__legend--rows">
                <div class="donut-chart__legend-item">
                  <span class="donut-chart__legend-dot donut-chart__legend-dot--sky"></span>
                  <span class="donut-chart__legend-label">已完成</span>
                  <span class="donut-chart__legend-value">${stats.overallDone}</span>
                </div>
                <div class="donut-chart__legend-item">
                  <span class="donut-chart__legend-dot donut-chart__legend-dot--sky-light"></span>
                  <span class="donut-chart__legend-label">进行中</span>
                  <span class="donut-chart__legend-value">${stats.overallProgress}</span>
                </div>
                <div class="donut-chart__legend-item">
                  <span class="donut-chart__legend-dot donut-chart__legend-dot--coral"></span>
                  <span class="donut-chart__legend-label">已终止</span>
                  <span class="donut-chart__legend-value">${stats.overallTerminated}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="stats-overdue-card is-action" title="工作 = 当月有产出（完成任务/子任务或手动记录）的天数（含今天）；躺平 = 当月截至昨日无任何记录的天数；不随时间范围变化">
          <span class="stats-overdue-card__header">
            <span class="stats-overdue-card__icon">${icons.checkCircle}</span>
            <span class="stats-overdue-card__label">本月工作状态</span>
          </span>
          <div class="stats-monthly-rows">
            <div class="stats-monthly-row">
              <span class="stats-monthly-row__label">工作</span>
              <span class="stats-monthly-row__num stats-monthly-row__num--work">${String(monthlyAction.actionCount).padStart(2, '0')}</span>
              <span class="stats-monthly-row__label">天</span>
            </div>
            <div class="stats-monthly-row">
              <span class="stats-monthly-row__label stats-monthly-row__label--idle">躺平</span>
              <span class="stats-monthly-row__num stats-monthly-row__num--idle">${monthlyAction.idleCount}</span>
              <span class="stats-monthly-row__label stats-monthly-row__label--idle">天</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-section-divider"></div>

      <div class="stats-range-section">
        <div class="stats-range-bar">
          ${RANGES.map((r) => `
            <button class="stats-range-pill ${state.range === r.key ? 'stats-range-pill--active' : ''}" data-range="${r.key}" aria-pressed="${state.range === r.key}">${r.label}</button>
          `).join('')}
        </div>
        ${state.range === 'custom' ? `
          <div class="stats-custom-date">
            <input type="date" id="stats-custom-start" value="${state.customStart}" class="stats-custom-date__input" aria-label="统计开始日期" />
            <span class="stats-custom-date__separator">至</span>
            <input type="date" id="stats-custom-end" value="${state.customEnd}" class="stats-custom-date__input" aria-label="统计结束日期" />
            <button class="wf-btn wf-btn--secondary" id="stats-custom-apply" ${isDraftValid() ? '' : 'disabled'}>应用</button>
            ${customHint}
          </div>
        ` : ''}
        ${rangeParam ? `
        <div class="stats-kpi-row">
          ${stats.total > 0 ? `
            <button type="button" class="stats-kpi-card stats-kpi-card--clickable" data-kpi-click="all" title="查看主任务列表" aria-label="查看${rangeText}主任务列表，共 ${stats.total} 项">
              <span class="stats-kpi__label">主任务总数</span>
              <span class="stats-kpi__metric metric">${stats.total}</span>
            </button>
          ` : `
            <div class="stats-kpi-card">
              <span class="stats-kpi__label">主任务总数</span>
              <span class="stats-kpi__metric metric">${stats.total}</span>
            </div>
          `}
          ${stats.done > 0 ? `
            <button type="button" class="stats-kpi-card stats-kpi-card--clickable" data-kpi-click="done" title="查看已完成主任务" aria-label="查看${rangeText}已完成主任务，${stats.done} 项">
              <span class="stats-kpi__label">主任务完成数</span>
              <span class="stats-kpi__metric metric stats-kpi__metric--brand">${stats.done}</span>
            </button>
          ` : `
            <div class="stats-kpi-card">
              <span class="stats-kpi__label">主任务完成数</span>
              <span class="stats-kpi__metric metric stats-kpi__metric--brand">${stats.done}</span>
            </div>
          `}
          ${stats.terminated > 0 ? `
            <button type="button" class="stats-kpi-card stats-kpi-card--clickable" data-kpi-click="terminated" title="查看已终止主任务" aria-label="查看${rangeText}已终止主任务，${stats.terminated} 项">
              <span class="stats-kpi__label">终止主任务数</span>
              <span class="stats-kpi__metric metric stats-kpi__metric--warning">${stats.terminated}</span>
            </button>
          ` : `
            <div class="stats-kpi-card">
              <span class="stats-kpi__label">终止主任务数</span>
              <span class="stats-kpi__metric metric stats-kpi__metric--warning">${stats.terminated}</span>
            </div>
          `}
          <div class="stats-kpi-card" title="统计范围内新建主任务所含子任务的完成情况（已完成/总数），不随子任务创建时间区分">
            <span class="stats-kpi__label">子任务完成数/子任务总数</span>
            <span class="stats-kpi__metric metric stats-kpi__metric--subtask">
              <span class="stats-kpi__frac-num">${stats.subtaskDone}</span><span class="stats-kpi__frac-den">/${stats.subtaskTotal}</span>
            </span>
          </div>
        </div>
        ` : `
        <div class="stats-kpi-empty">请选择日期范围并点击「应用」后查看统计</div>
        `}
      </div>

      <div class="stats-section-divider"></div>

      <div class="stats-trend-section">
        <div class="stats-chart-card">
          <div class="stats-chart-card__title">本周任务趋势</div>
          <div class="stats-chart-card__body">
            ${weekTotal > 0 ? renderComboChart(weeklyData) : '<div class="stats-chart-empty">本周暂无任务动态</div>'}
          </div>
        </div>
      </div>
    `;

    // 范围切换
    el.querySelectorAll('[data-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.range = btn.dataset.range;
        if (state.range !== 'custom') {
          state.customStart = '';
          state.customEnd = '';
          state.appliedCustom = null;
        }
        render();
      });
    });

    // 自定义日期输入（变更即时刷新校验提示与应用按钮状态，统计仍需点击「应用」）
    const startInput = el.querySelector('#stats-custom-start');
    const endInput = el.querySelector('#stats-custom-end');
    const applyBtn = el.querySelector('#stats-custom-apply');
    if (startInput) {
      startInput.addEventListener('change', (e) => {
        state.customStart = e.target.value;
        render();
      });
    }
    if (endInput) {
      endInput.addEventListener('change', (e) => {
        state.customEnd = e.target.value;
        render();
      });
    }
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (isDraftValid()) {
          state.appliedCustom = { start: state.customStart, end: state.customEnd };
          render();
        }
      });
    }

    // KPI卡片点击跳转（数值为0时不响应）
    el.querySelectorAll('[data-kpi-click]').forEach((card) => {
      card.addEventListener('click', () => {
        const filterType = card.dataset.kpiClick;
        // 逾期为全局口径，下钻不携带范围参数；自定义范围传递已应用的起止日期段
        let rangeVal = state.range;
        if (filterType !== 'overdue' && state.range === 'custom' && state.appliedCustom) {
          rangeVal = `${state.appliedCustom.start}:${state.appliedCustom.end}`;
        }
        const rangeSuffix = filterType === 'overdue' ? '' : `&range=${rangeVal}`;
        window.location.hash = `#/tasks?filter=${filterType}${rangeSuffix}`;
      });
    });

    // 移动端开侧栏
    el.querySelector('#stats-menu-toggle').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wf-open-sidebar'));
    });

    // 图例点击切换显示
    el.querySelectorAll('.cmb-legend-item').forEach((item) => {
      item.addEventListener('click', () => {
        const key = item.dataset.series;
        if (state.hiddenSeries[key]) {
          delete state.hiddenSeries[key];
        } else {
          // 至少保留一个可见
          const visibleCount = SERIES_CONFIG.filter((s) => !state.hiddenSeries[s.key]).length;
          if (visibleCount <= 1) return;
          state.hiddenSeries[key] = true;
        }
        render();
      });
    });

    // 悬停显示 tooltip + 整列高亮；主任务柱子点击下钻
    const tooltip = el.querySelector('#cmb-tooltip');
    const svgEl = el.querySelector('.combo-chart__svg');
    if (tooltip && svgEl) {
      const showTooltip = (dayIdx) => {
        const d = weeklyData[dayIdx];
        if (!d) return;
        const visibleSeries = SERIES_CONFIG.filter((s) => !state.hiddenSeries[s.key]);
        let html = `<div class="cmb-tooltip__title">${d.label}（${d.dateLabel}）</div>`;
        visibleSeries.forEach((s) => {
          html += `
            <div class="cmb-tooltip__row">
              <span class="cmb-tooltip__dot" style="background:${s.color};"></span>
              <span class="cmb-tooltip__label">${s.label}</span>
              <span class="cmb-tooltip__value">${d[s.key]}</span>
            </div>
          `;
        });
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        const svgRect = svgEl.getBoundingClientRect();
        const groupW = (svgRect.width - CHART_PAD_LEFT - CHART_PAD_RIGHT) / 7;
        const left = CHART_PAD_LEFT + dayIdx * groupW + groupW / 2;
        const tooltipRect = tooltip.getBoundingClientRect();
        let tooltipLeft = left - tooltipRect.width / 2;
        if (tooltipLeft < 4) tooltipLeft = 4;
        if (tooltipLeft + tooltipRect.width > svgRect.width - 4) {
          tooltipLeft = svgRect.width - tooltipRect.width - 4;
        }
        tooltip.style.left = tooltipLeft + 'px';
        tooltip.style.top = '8px';
      };
      const hideTooltip = () => {
        tooltip.style.display = 'none';
      };
      // 整列高亮：悬停列满亮，其余列淡化
      const highlightColumn = (dayIdx) => {
        svgEl.querySelectorAll('.cmb-bar').forEach((b) => {
          b.classList.toggle('is-col-dim', b.dataset.day !== String(dayIdx));
        });
      };
      const clearHighlight = () => {
        svgEl.querySelectorAll('.cmb-bar.is-col-dim').forEach((b) => b.classList.remove('is-col-dim'));
      };

      // 悬停热区（整列）与柱子（置于热区上层）都触发 tooltip 与高亮
      el.querySelectorAll('.cmb-hover-target, .cmb-bar').forEach((zone) => {
        zone.addEventListener('mouseenter', () => {
          const dayIdx = parseInt(zone.dataset.day, 10);
          showTooltip(dayIdx);
          highlightColumn(dayIdx);
        });
        zone.addEventListener('mouseleave', () => {
          hideTooltip();
          clearHighlight();
        });
      });

      // 主任务柱子点击下钻：新建 → 任务列表（按创建日）；完成 → 已完成任务（按完成日）
      el.querySelectorAll('.cmb-bar--link').forEach((bar) => {
        bar.addEventListener('click', () => {
          const d = weeklyData[parseInt(bar.dataset.day, 10)];
          if (!d) return;
          const filter = bar.dataset.series === 'doneTask' ? 'done' : 'all';
          window.location.hash = `#/tasks?filter=${filter}&range=${d.date}`;
        });
      });
    }
  }

  // 订阅 store 变化
  const unsub = store.subscribe(() => {
    if (el.parentNode) {
      render();
    }
  });

  // 容器尺寸变化时同步趋势图参考宽度（viewBox 随内容区宽度伸缩）
  const resizeObserver = new ResizeObserver(() => {
    if (!el.isConnected) return;
    // 页面左右 padding 24×2 + 卡片左右 padding 16×2
    const w = Math.max(320, el.clientWidth - 80);
    if (Math.abs(w - chartW) > 32) {
      chartW = w;
      render();
    }
  });
  resizeObserver.observe(el);

  el._destroy = () => {
    unsub();
    resizeObserver.disconnect();
  };

  render();
  return el;
}
