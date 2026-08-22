// store.js — 数据存储层
// 基于 localStorage 持久化，内置种子数据（与设计稿一致）
// 采用发布订阅模式，组件可监听变化自动重渲染

const STORAGE_KEY = 'wf-work-management-v1';
const SCHEMA_VERSION = 1;

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };

// ─── 工具函数 ──────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysAgoISO = (n) => daysFromNow(-n);

// 任务状态归因日期：任务「进入当前状态」的日期，作为时间范围统计的统一口径
// 已完成 → 最后一条「完成任务」日志的日期；已终止 → 最后一条「终止任务」日志的日期；进行中 → 创建日期
const statusDateOf = (t) => {
  const logs = t.logs || [];
  if (t.status === 'done') {
    const doneLog = [...logs].reverse().find((l) => l.text === '完成任务');
    return (doneLog && doneLog.date) || t.createdAt;
  }
  if (t.status === 'terminated') {
    const termLog = [...logs].reverse().find((l) => l.text && l.text.startsWith('终止任务'));
    return (termLog && termLog.date) || t.createdAt;
  }
  return t.createdAt;
};

// ─── 种子数据 ──────────────────────────────────────────────
// 与设计稿《我的任务》表格中显示的任务保持一致
function buildSeedData() {
  const tasksList = [
    {
      id: uid(),
      name: '完成季度报告初稿',
      description: '汇总 Q2 各项目进展，整理成季度总结报告初稿，提交给团队评审。',
      priority: 'high',
      status: 'progress',
      category: '报告',
      createdAt: daysAgoISO(6),
      deadline: daysAgoISO(1),
      subtasks: [
        { id: uid(), name: '收集各项目数据', done: true },
        { id: uid(), name: '撰写执行摘要', done: true },
        { id: uid(), name: '整理图表与附录', done: false },
        { id: uid(), name: '内部评审与修订', done: false },
      ],
      logs: [
        { id: uid(), time: '09:00', text: '创建任务', type: 'auto', date: daysAgoISO(6) },
        { id: uid(), time: '14:30', text: '添加子任务「完成内部评审」', type: 'auto', date: daysAgoISO(1) },
        { id: uid(), time: '16:00', text: '修改优先级为「高」', type: 'auto', date: daysAgoISO(0) },
      ],
    },
    {
      id: uid(),
      name: '代码评审 #142',
      description: '评审同事提交的 PR #142，关注性能与边界情况处理。',
      priority: 'mid',
      status: 'progress',
      category: '开发',
      createdAt: daysAgoISO(4),
      deadline: daysAgoISO(2),
      subtasks: [
        { id: uid(), name: '阅读改动说明', done: false },
        { id: uid(), name: '本地拉取分支运行测试', done: false },
        { id: uid(), name: '提交评审意见', done: false },
        { id: uid(), name: '评审安全与漏洞', done: false },
      ],
      logs: [
        { id: uid(), time: '10:00', text: '创建任务', type: 'auto', date: daysAgoISO(4) },
        { id: uid(), time: '16:00', text: '完成任务', type: 'auto', date: daysAgoISO(3) },
        { id: uid(), time: '18:00', text: '重置为进行中', type: 'auto', date: daysAgoISO(3) },
      ],
    },
    {
      id: uid(),
      name: '学习 TypeScript 泛型',
      description: '深入学习 TypeScript 泛型的使用场景与最佳实践，完成相关练习。',
      priority: 'low',
      status: 'progress',
      category: '学习',
      createdAt: daysAgoISO(3),
      deadline: daysFromNow(1),
      subtasks: [
        { id: uid(), name: '阅读官方文档泛型章节', done: true },
        { id: uid(), name: '完成 TS 练习题 5 道', done: false },
        { id: uid(), name: '在项目中实践泛型工具', done: false },
        { id: uid(), name: '整理泛型学习笔记', done: false },
      ],
      logs: [
        { id: uid(), time: '09:30', text: '创建任务', type: 'auto', date: daysAgoISO(3) },
      ],
    },
    {
      id: uid(),
      name: '更新个人博客',
      description: '写一篇新文章，升级静态博客的主题模板并更新关于我页面。',
      priority: 'low',
      status: 'progress',
      category: '其他',
      createdAt: daysAgoISO(1),
      deadline: daysFromNow(6),
      subtasks: [
        { id: uid(), name: '撰写新文章', done: false },
        { id: uid(), name: '优化页面加载速度', done: false },
        { id: uid(), name: '更新关于我页面', done: false },
        { id: uid(), name: '部署上线', done: false },
      ],
      logs: [
        { id: uid(), time: '11:00', text: '创建任务', type: 'auto', date: daysAgoISO(1) },
      ],
    },
    {
      id: uid(),
      name: '准备技术分享 PPT',
      description: '准备下周的技术分享，主题为「TypeScript 类型体操实践与进阶」。',
      priority: 'mid',
      status: 'progress',
      category: '分享',
      createdAt: daysAgoISO(2),
      deadline: daysFromNow(0),
      subtasks: [
        { id: uid(), name: '确定分享大纲', done: true },
        { id: uid(), name: '收集技术素材', done: true },
        { id: uid(), name: '制作 PPT 幻灯片', done: false },
        { id: uid(), name: '进行演练与优化', done: false },
      ],
      logs: [
        { id: uid(), time: '15:00', text: '创建任务', type: 'auto', date: daysAgoISO(2) },
      ],
    },
    {
      id: uid(),
      name: '健身计划 - 跑步',
      description: '每周三次户外跑步，保持身体活力，单次目标 5 公里。',
      priority: 'low',
      status: 'progress',
      category: '其他',
      createdAt: daysAgoISO(0),
      deadline: daysFromNow(3),
      subtasks: [
        { id: uid(), name: '制定跑步计划', done: false },
        { id: uid(), name: '准备跑步装备', done: false },
        { id: uid(), name: '进行 5 公里跑步', done: false },
        { id: uid(), name: '跑后拉伸与总结', done: false },
      ],
      logs: [
        { id: uid(), time: '18:30', text: '创建任务', type: 'auto', date: daysAgoISO(0) },
      ],
    },
    {
      id: uid(),
      name: '梳理项目遗留问题',
      description: '排查历史代码库中的待办注释及低优缺陷，统一整理至任务看板。',
      priority: 'mid',
      status: 'progress',
      category: '其他',
      createdAt: daysAgoISO(5),
      deadline: daysFromNow(4),
      subtasks: [],
      logs: [
        { id: uid(), time: '10:00', text: '创建任务', type: 'auto', date: daysAgoISO(5) },
      ],
    }
  ];

  // 生成 23 个已完成的任务，使其总数达到 30
  for (let i = 1; i <= 23; i++) {
    let name = `已完成历史任务 #${i}`;
    let dateStr = daysAgoISO(4 + (i % 5));
    let doneDateStr = daysAgoISO(1 + (i % 3));

    if (i === 1) {
      name = '整理客户需求文档';
      dateStr = daysAgoISO(5);
      doneDateStr = daysAgoISO(3); // 3 days ago = July 6, 2026 (if today is July 9)
    } else if (i === 2) {
      name = '每周团队会议';
      dateStr = daysAgoISO(5);
      doneDateStr = daysAgoISO(3);
    }

    tasksList.push({
      id: uid(),
      name: name,
      description: `关于 ${name} 的描述内容。`,
      priority: i % 3 === 0 ? 'high' : (i % 2 === 0 ? 'mid' : 'low'),
      status: 'done',
      category: '其他',
      createdAt: dateStr,
      deadline: doneDateStr,
      subtasks: [
        { id: uid(), name: '子任务 A', done: true },
        { id: uid(), name: '子任务 B', done: true }
      ],
      logs: [
        { id: uid(), time: '09:00', text: '创建任务', type: 'auto', date: dateStr },
        { id: uid(), time: '17:00', text: '完成任务', type: 'auto', date: doneDateStr }
      ]
    });
  }

  return {
    tasks: tasksList,
    workLogs: {
      [daysAgoISO(3)]: {
        date: daysAgoISO(3),
        manualEntries: [
          { id: uid(), time: '14:00', text: '参加部门周会，讨论Q3计划' },
          { id: uid(), time: '16:30', text: '与客户电话沟通需求变更，确认3个功能点的优先级' }
        ],
        summary: '今日聚焦于周会讨论与客户需求梳理，工作效率极高。'
      },
      [todayISO()]: {
        date: todayISO(),
        manualEntries: [
          { id: uid(), time: '10:15', text: '撰写季度报告执行摘要' },
          { id: uid(), time: '14:30', text: '与设计师沟通登录页交互细节' },
        ],
        summary: '今日聚焦于季度报告撰写与跨部门沟通，进展顺利。',
      },
    },
    meta: {
      currentUserName: '张明',
      currentUserRole: '产品设计师',
    },
  };
}

// ─── 存储核心 ──────────────────────────────────────────────
class Store {
  constructor() {
    this._state = this._load();
    this._listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks)) {
          return this._migrate(parsed);
        }
        console.warn('[store] 本地数据格式异常，已忽略并使用默认空数据');
      }
    } catch (e) {
      console.warn('[store] 读取本地数据失败', e);
    }
    // 仅开发环境注入种子数据，生产环境返回空数据，避免发布即事故
    if (import.meta.env.DEV) {
      const seed = buildSeedData();
      this._save(seed);
      return seed;
    }
    return {
      tasks: [],
      workLogs: {},
      meta: {
        schemaVersion: SCHEMA_VERSION,
        currentUserName: '',
        currentUserRole: '',
      },
    };
  }

  // 数据迁移：保证 meta.schemaVersion 存在，便于后续版本升级
  _migrate(data) {
    if (!data.meta || typeof data.meta !== 'object') data.meta = {};
    if (data.meta.schemaVersion === undefined) data.meta.schemaVersion = SCHEMA_VERSION;
    return data;
  }

  // 多窗口同步入口：从 storage 事件 raw 字符串加载并广播订阅者
  // 注意：仅广播订阅者，不调用 _emit/_save，避免回写 localStorage 形成多窗口写入循环
  loadFromStorage(raw) {
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tasks)) return false;
      this._state = this._migrate(parsed);
      this._listeners.forEach((fn) => fn(this._state));
      return true;
    } catch (e) {
      console.warn('[store] loadFromStorage 解析失败', e);
      return false;
    }
  }

  // 收集所有有日志的日期：workLogs 键 + 任务 logs 中的日期
  getAllLogDates() {
    const dates = new Set();
    Object.keys(this._state.workLogs || {}).forEach((d) => dates.add(d));
    this._state.tasks.forEach((t) => {
      (t.logs || []).forEach((l) => { if (l.date) dates.add(l.date); });
    });
    return [...dates].sort();
  }

  _save(state = this._state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[store] 保存数据失败', e);
    }
  }

  _emit() {
    this._save();
    this._listeners.forEach((fn) => fn(this._state));
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getState() {
    return this._state;
  }

  // ─── 任务操作 ──────────────────────────────────────────
  getTasks() {
    return this._state.tasks;
  }

  getTask(id) {
    return this._state.tasks.find((t) => t.id === id) || null;
  }

  // 按时间范围筛选任务（basis 与 getStats 各指标口径一致）：
  // 'created'（默认）按创建日期；'done' 按完成日期（仅已完成任务）；'terminated' 按终止日期（仅已终止任务）
  getTasksByRange(range, basis = 'created') {
    const tasks = this._state.tasks;
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'week') {
      const day = now.getDay() || 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day + 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1);
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (typeof range === 'string') {
      // 精确日期范围："YYYY-MM-DD"（单日）或 "YYYY-MM-DD:YYYY-MM-DD"（起止段）
      const m = range.match(/^(\d{4}-\d{2}-\d{2})(?::(\d{4}-\d{2}-\d{2}))?$/);
      if (m) {
        const [sy, sm, sd] = m[1].split('-').map(Number);
        startDate = new Date(sy, sm - 1, sd);
        const endIso = m[2] || m[1];
        const [ey, em, ed] = endIso.split('-').map(Number);
        endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      }
    }

    if (!startDate) return tasks.slice();

    const inRange = (isoDate) => {
      const [y, m, d] = isoDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt >= startDate && (!endDate || dt <= endDate);
    };
    if (basis === 'done') {
      return tasks.filter((t) => t.status === 'done' && inRange(statusDateOf(t)));
    }
    if (basis === 'terminated') {
      return tasks.filter((t) => t.status === 'terminated' && inRange(statusDateOf(t)));
    }
    return tasks.filter((t) => inRange(t.createdAt));
  }

  // 按 KPI 类型进一步筛选（与 getStats 计数逻辑一致）
  filterByKpiType(tasks, filterType) {
    const todayStr = todayISO();
    switch (filterType) {
      case 'all':
        return tasks.slice();
      case 'done':
        return tasks.filter((t) => t.status === 'done');
      case 'overdue':
        return tasks.filter((t) => t.status !== 'done' && t.status !== 'terminated' && t.deadline && t.deadline < todayStr);
      case 'terminated':
        return tasks.filter((t) => t.status === 'terminated');
      default:
        return tasks.slice();
    }
  }

  addTask(data) {
    const now = new Date();
    const task = {
      id: uid(),
      name: data.name || '未命名任务',
      description: data.description || '',
      priority: data.priority || 'mid',
      status: data.status || 'progress',
      category: data.category || '其他',
      createdAt: todayISO(),
      deadline: data.deadline || '',
      subtasks: (data.subtasks || []).filter((s) => s.name.trim()).map((s) => ({
        id: uid(),
        name: s.name,
        done: !!s.done,
      })),
      logs: [
        {
          id: uid(),
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          text: '创建任务',
          type: 'auto',
          date: todayISO(),
        },
      ],
    };
    this._state.tasks.unshift(task);
    this._emit();
    return task;
  }

  _nowLog() {
    const now = new Date();
    return {
      id: uid(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      type: 'auto',
      date: todayISO(),
    };
  }

  updateTask(id, patch) {
    const idx = this._state.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const prev = this._state.tasks[idx];

    if (patch.status === 'done') {
      const hasUnfinishedSubtasks = prev.subtasks && prev.subtasks.some((s) => !s.done);
      if (hasUnfinishedSubtasks) {
        // 存在未完成子任务：拒绝标记完成，由调用方决定 UI 反馈
        return null;
      }
    }

    const next = { ...prev, ...patch };
    const newLogs = [...prev.logs];
    if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== prev.name) {
      newLogs.push({ ...this._nowLog(), text: `修改任务标题为「${patch.name.trim()}」` });
    }
    if (patch.description !== undefined && patch.description.trim() !== (prev.description || '').trim()) {
      newLogs.push({ ...this._nowLog(), text: '修改任务描述' });
    }
    if (patch.status && patch.status !== prev.status) {
      const statusText = {
        progress: '开始进行',
        done: '完成任务',
      }[patch.status] || '更新状态';
      newLogs.push({ ...this._nowLog(), text: statusText });
    }
    if (patch.priority !== undefined && patch.priority !== prev.priority) {
      newLogs.push({ ...this._nowLog(), text: `修改优先级为「${PRIORITY_LABEL[patch.priority] || patch.priority}」` });
    }
    if (patch.deadline !== undefined && patch.deadline !== prev.deadline) {
      if (patch.deadline) {
        newLogs.push({ ...this._nowLog(), text: `设置截止日期为 ${patch.deadline}` });
      } else {
        newLogs.push({ ...this._nowLog(), text: '清除截止日期' });
      }
    }
    next.logs = newLogs;
    this._state.tasks[idx] = next;
    this._emit();
    return next;
  }

  terminateTask(id, reason) {
    const task = this.getTask(id);
    if (!task) return;
    const now = new Date();
    task.logs.push({
      id: uid(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      text: `终止任务 — 原因：${reason}`,
      type: 'auto',
      date: todayISO(),
    });
    task.status = 'terminated';
    this._emit();
  }

  // ─── 子任务操作 ────────────────────────────────────────
  addSubtask(taskId, name) {
    const task = this.getTask(taskId);
    if (!task || !name.trim()) return;
    task.subtasks.push({ id: uid(), name: name.trim(), done: false });
    const now = new Date();
    task.logs.push({
      id: uid(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      text: `添加子任务「${name.trim()}」`,
      type: 'auto',
      date: todayISO(),
    });
    this._emit();
  }

  updateSubtask(taskId, subtaskId, patch) {
    const task = this.getTask(taskId);
    if (!task) return;
    // 已完成/已终止的任务（含其子任务）不可再修改
    if (task.status === 'done' || task.status === 'terminated') return;
    const st = task.subtasks.find((s) => s.id === subtaskId);
    if (!st) return;
    // 已终止的子任务不可修改
    if (st.status === 'terminated' || st.terminated) return;
    const wasDone = st.done;
    const oldName = st.name;
    Object.assign(st, patch);

    if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== oldName) {
      task.logs.push({
        ...this._nowLog(),
        text: `修改子任务「${oldName}」名称为「${patch.name.trim()}」`,
      });
    }

    // 子任务从未完成变为完成时，记录日志
    if (!wasDone && patch.done === true) {
      task.logs.push({
        ...this._nowLog(),
        text: `完成子任务「${st.name}」`,
      });
    }
    this._emit();
  }

  // ─── 工作日志操作 ──────────────────────────────────────
  // 月度行动统计：actionDates = 有完成任务/子任务日志的日期集合；
  // contentDates = 有任何记录（任务日志或手动日志）的日期集合
  getMonthlyAction(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const actionDates = new Set();
    const contentDates = new Set();
    this._state.tasks.forEach((t) => {
      (t.logs || []).forEach((l) => {
        if (!l.date || !l.date.startsWith(prefix)) return;
        contentDates.add(l.date);
        if (l.text === '完成任务' || l.text.startsWith('完成子任务')) {
          actionDates.add(l.date);
        }
      });
    });
    Object.keys(this._state.workLogs || {}).forEach((date) => {
      if (!date.startsWith(prefix)) return;
      const log = this._state.workLogs[date];
      if (log && log.manualEntries && log.manualEntries.length > 0) {
        contentDates.add(date);
      }
    });
    return { actionDates, contentDates };
  }

  // 本月工作状态统计（工作统计页用）：
  // 行动天数 = 当月有完成任务日志的天数（含今天，今天完成即计入）
  // 躺平天数 = 当月截至昨天，既无完成记录也无任何日志内容的天数（今天不定局）
  getMonthlyActionStats() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { actionDates, contentDates } = this.getMonthlyAction(year, month);

    let actionCount = actionDates.size;

    // 躺平：1 号到昨天中，没有任何内容的日子
    let idleCount = 0;
    const today = now.getDate();
    const yesterdayMs = now.getTime() - 24 * 60 * 60 * 1000;
    const yesterday = new Date(yesterdayMs);
    const isSameMonth = yesterday.getFullYear() === year && yesterday.getMonth() + 1 === month;
    const lastDay = isSameMonth ? yesterday.getDate() : 0;
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!contentDates.has(dateStr)) idleCount++;
    }

    return { year, month, actionCount, idleCount, daysElapsed: today };
  }

  getWorkLog(dateISO) {
    return this._state.workLogs[dateISO] || {
      date: dateISO,
      manualEntries: [],
      summary: '',
    };
  }

  _ensureWorkLog(dateISO) {
    if (!this._state.workLogs[dateISO]) {
      this._state.workLogs[dateISO] = {
        date: dateISO,
        manualEntries: [],
        summary: '',
      };
    }
    return this._state.workLogs[dateISO];
  }

  addManualEntry(dateISO, time, text) {
    if (!text.trim()) return;
    const log = this._ensureWorkLog(dateISO);
    log.manualEntries.push({
      id: uid(),
      time: time || (() => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })(),
      text: text.trim(),
    });
    this._emit();
  }

  updateSummary(dateISO, text) {
    const log = this._ensureWorkLog(dateISO);
    log.summary = text;
    this._emit();
  }

  // ─── 统计计算 ──────────────────────────────────────────
  // range: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  getStats(range) {
    const tasks = this._state.tasks;
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (typeof range === 'object' && range.start && range.end) {
      const [sy, sm, sd] = range.start.split('-').map(Number);
      const [ey, em, ed] = range.end.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd);
      endDate = new Date(ey, em - 1, ed);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      // 本周（周一起算）
      const day = now.getDay() || 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day + 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    const inRange = (isoDate) => {
      if (!startDate) return true;
      const [y, m, d] = isoDate.split('-').map(Number);
      const taskDate = new Date(y, m - 1, d);
      if (endDate) {
        return taskDate >= startDate && taskDate <= endDate;
      }
      return taskDate >= startDate;
    };

    // 按指标性质拆分口径：
    // 任务总数/进行中 → 范围内新建（createdAt，稳定且与趋势柱状图「新建主任务」一致）
    const createdSet = tasks.filter((t) => inRange(t.createdAt));
    // 任务完成数 → 范围内完成（完成日志日期，含之前创建的任务）
    const doneSet = tasks.filter((t) => t.status === 'done' && inRange(statusDateOf(t)));
    // 终止任务数 → 范围内终止（终止日志日期）
    const terminatedSet = tasks.filter((t) => t.status === 'terminated' && inRange(statusDateOf(t)));

    const total = createdSet.length;
    const done = doneSet.length;
    const progress = createdSet.filter((t) => t.status === 'progress' || t.status === 'todo').length;
    const terminated = terminatedSet.length;
    const todo = 0; // 已合并到进行中，不再单独统计

    // 子任务：范围内新建主任务所含子任务的完成情况（与主任务总数同一队列，显示为 12/24）
    let subtaskTotal = 0;
    let subtaskDone = 0;
    createdSet.forEach((t) => {
      (t.subtasks || []).forEach((s) => {
        subtaskTotal++;
        if (s.done) subtaskDone++;
      });
    });

    // 完成率：全局口径，不随时间范围变化——所有已完成主任务 /（所有主任务 − 已终止）
    // 只统计主任务状态（子任务完成不等于主任务完成），用于呈现整体任务急切度
    const overallTotal = tasks.length;
    const overallDone = tasks.filter((t) => t.status === 'done').length;
    const overallTerminated = tasks.filter((t) => t.status === 'terminated').length;
    const overallProgress = overallTotal - overallDone - overallTerminated;
    const completionRate = (overallTotal - overallTerminated) > 0
      ? Math.round((overallDone / (overallTotal - overallTerminated)) * 100)
      : 0;

    // 逾期：当前全部逾期任务（当前状态，不随时间范围过滤）
    const todayStr = todayISO();
    const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'terminated' && t.deadline && t.deadline < todayStr);
    const overdue = overdueTasks.length;
    // 最久逾期天数：逾期任务中截止日距今最久的天数（统计页警示卡展示急迫程度）
    let overdueMaxDays = 0;
    if (overdue > 0) {
      const [ty, tm, td] = todayStr.split('-').map(Number);
      const today = new Date(ty, tm - 1, td);
      overdueTasks.forEach((t) => {
        const [y, m, d] = t.deadline.split('-').map(Number);
        const days = Math.floor((today - new Date(y, m - 1, d)) / 86400000);
        if (days > overdueMaxDays) overdueMaxDays = days;
      });
    }

    // 优先级分布：基于范围内新建任务
    const priorityCount = { high: 0, mid: 0, low: 0 };
    createdSet.forEach((t) => { priorityCount[t.priority] = (priorityCount[t.priority] || 0) + 1; });

    // 近 7 天每日完成任务数（柱状图）
    const dailyDone = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const count = tasks.filter((t) => {
        if (t.status !== 'done') return false;
        const doneLog = [...t.logs].reverse().find((l) => l.text === '完成任务');
        return doneLog && doneLog.date === dStr;
      }).length;
      dailyDone.push({
        date: dStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count,
      });
    }
    const maxDaily = Math.max(1, ...dailyDone.map((d) => d.count));

    return {
      total, done, progress, terminated, todo, completionRate, overdue, overdueMaxDays,
      subtaskTotal, subtaskDone,
      priorityCount,
      dailyDone,
      maxDaily,
      // 全部主任务的状态构成（环形图与全局完成率使用，保证中心百分比与分段占比一致）
      overallTotal, overallDone, overallProgress, overallTerminated,
    };
  }
}

// 单例导出
export const store = new Store();
