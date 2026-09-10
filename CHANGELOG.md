# Changelog

`dsh-git-panel` 的版本变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.12] - 2026-09-10

### Changed（重大变更 · 需 DSH 0.1.5-alpha.1+）

- **Git 面板融合为官方右侧栏的原生 Tab**：
  - 面板不再外挂独立的右侧列，改为通过官方 `sidebarRightTabs` 注册为右侧栏的一等公民标签页（`kind: "git"`，标签标题 `🌿 Git`），与官方「文件」标签并列
  - 注册契约：类型进 `ctx.sidebarRightTabs`，内容体进 `sidebar.right.pane.tab`，标签标题进 `sidebar.right.pane.tab.title`，全部以本插件的 `id` 作为 key
  - 展开、收起、宽度拖拽、多标签切换现在完全由官方右侧栏接管

### Fixed

- **修复收起官方侧边栏后 Git 面板被挤成空白窄条的问题**：
  - 根因：旧实现直接改写页面根容器的 `gridTemplateColumns`，并硬编码假设布局「恒为 3 列」。DSH 引入官方右侧栏后列数会在展开/收起时动态增减，该假设失效，导致面板所在列被压缩到接近 0px，必须手动折叠再展开 Git 面板才能恢复
  - 现已彻底删除该布局改写逻辑（移除 `src/client/frame.ts` 整个模块），打包产物中不再包含任何 `gridTemplateColumns` 写入、列宽手柄或折叠箭头

- **修复切换会话后 Git 面板路径不跟随的问题**：
  - 新增 `GitTab.tsx`，订阅 sessions 列表把「当前活动会话 → 工作区 cwd」映射为 React 状态，切换会话时面板自动重指向新仓库

### Removed

- 移除右侧悬浮的折叠箭头与外挂面板列（已被官方右侧栏 Tab 完全取代）
- 移除 `src/client/frame.ts`（页面网格布局改写模块）

### Requirements

- 需要 DSH `>=0.1.5-alpha.1`（该版本起提供 `@deepseek-ai/dsh-client-ui-sidebar-right` 右侧栏多标签框架）

## [0.1.11] - 2026-09-08

- 文件级复制路径、向 Agent 提问按钮、丢弃改动二次确认
