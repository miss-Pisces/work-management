# 工作管理

一个轻量的桌面工作管理应用，帮助你在繁杂的日常任务中保持节奏。基于 Electron + 原生 JS + Vite 构建，主窗口负责完整管理，悬浮窗提供轻量速览。

## 功能特性

- **任务管理**：创建、编辑、终止任务；支持优先级、截止日期、子任务与多层级日志
- **悬浮窗**：常驻桌面顶层，单击任务即可恢复主窗口并打开编辑弹窗
- **工作日志**：自动记录任务状态变更，支持手动补录与按时间范围导出
- **统计看板**：按今日 / 本周 / 本月 / 本季度 / 本年多维度查看完成率、逾期与每日趋势
- **农历日历**：内置农历与节日标注，方便按日查阅日志
- **多窗口同步**：主窗口与悬浮窗通过 `storage` 事件实时同步数据
- **本地优先**：所有数据存储在浏览器 `localStorage`，不依赖任何后端服务

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Electron 33 |
| 构建工具 | Vite 5 |
| 渲染层 | 原生 JavaScript (ES Modules)，无前端框架 |
| 状态层 | 自实现发布订阅 + `localStorage` 持久化 |
| 打包 | electron-builder (NSIS) |
| 农历计算 | lunar-javascript |

## 项目结构

```
.
├── electron/         # Electron 主进程 / preload
│   ├── main.cjs
│   └── preload.cjs
├── src/               # 渲染层源码
│   ├── main.js        # 主窗口入口
│   ├── float.js       # 悬浮窗入口
│   ├── store.js       # 数据层（单例 store）
│   ├── pages/         # 各页面组件
│   └── utils/         # 通用工具（日期、农历、图标）
├── index.html         # 主窗口 HTML
├── float.html         # 悬浮窗 HTML
└── package.json
```

## 开发

环境要求：Node.js ≥ 18

```bash
# 安装依赖
npm install

# 启动 Vite 开发服务器（仅渲染层）
npm run dev

# 启动 Electron 开发模式（先构建再启动 Electron）
npm run electron:dev

# 同时运行 Vite 与 Electron（热重载）
npm run electron:serve
```

## 构建

```bash
# 仅构建渲染层产物到 dist/
npm run build

# 打包桌面安装包到 release/（Windows NSIS）
npm run electron:build
```

> 打包前请在 `electron/` 目录放置 `icon.png`（建议 512×512 透明背景），否则 `electron:build` 会因图标缺失而失败。

## Windows 7 支持

Electron 23+ 已不再支持 Windows 7。如需构建 Win7 兼容安装包，请按以下步骤操作：

1. 将 `package.json` 中 Electron 版本降级到 `22.x`（最后一个支持 Win7 的大版本）：
   ```json
   "electron": "^22.0.0"
   ```
2. 修改 `version` 字段以避免与主分支安装包重名：
   ```json
   "version": "1.0.2-win7"
   ```
3. 重新安装依赖并打包：
   ```bash
   npm install
   npm run electron:build
   ```

打包产物 `WorkManagement-Setup-1.0.2-win7.exe` 将生成在 `release/` 目录下。已构建的 Win7 安装包可在 [Releases](https://github.com/MissPisces/work-management/releases/tag/v1.0.2) 页面直接下载，无需自行编译。

## 协议

本项目基于 [MIT License](./LICENSE) 开源。

Copyright (c) 2026 work-management contributors

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| [v1.0.2](https://github.com/MissPisces/work-management/releases/tag/v1.0.2) | 2026-08-22 | UI 无障碍与交互整改；统计页主任务口径明确并新增子任务统计卡 |
| [v1.0.1](https://github.com/MissPisces/work-management/releases/tag/v1.0.1) | 2026-08-11 | Bug 修复版本：完成率显示、操作记录溢出、悬浮窗置顶与渲染等 7 项修复 |
| [v1.0.0](https://github.com/MissPisces/work-management/releases/tag/v1.0.0) | 2026-08-09 | 首个正式版本 |

## 截图

> 应用截图待补充。可在 PR 中提交以下位置的截图：
> - 主窗口 - 我的任务页
> - 主窗口 - 工作日志页
> - 主窗口 - 统计看板页
> - 悬浮窗
