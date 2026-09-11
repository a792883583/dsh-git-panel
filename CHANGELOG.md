# Changelog

`dsh-git-panel` 的版本变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.13] - 2026-09-11

### Added（VS Code 式改动感知）

- **工作区文件树改动标记**：右侧栏「文件」树里，有 git 改动的文件在文件名后显示状态字母并给名字上色（`M` 修改 / `A` 新增 / `U` 未跟踪 / `D` 删除 / `R` 重命名 / `C` 冲突），包含改动的目录显示一个圆点——与 VS Code 资源管理器同一观感
  - 装饰层只读取官方文件树已经给出的稳定 DOM 契约（`[data-files-state="tree"][data-files-root]` 与 `li[data-files-entry][data-files-path]`），不改动官方渲染逻辑
  - 清单来自宿主新增的 `/git-panel/file-status` 路由（以仓库根为 cwd 运行 `git status --porcelain -z`，再解析回工作区相对路径），客户端按 TTL 缓存，页面不可见时不轮询
- **Git 变更对比标签（`kind: 'git-diff'`）**：VS Code 风格的双栏 Diff
  - 只有「此刻确有 git 改动」的文件才由本类型接手（同步的 `canOpen` 门禁），未改动文件仍然走官方预览；视图右上角的「源码」按钮用显式 kind 回到官方文本预览，两条路互不干扰
  - 行级 LCS 差异算法（公共前后缀裁剪 + 动态规划，超大文件退化为顺序配对），左右行号严格对齐；新增 / 删除 / 修改行分别着色
  - 支持**单栏**与**双栏**两种布局、**折叠未改动区域**（默认保留 3 行上下文，点击展开）、**自动换行**开关、**字号缩放**
  - **手动编辑**模式：直接修改工作区内容
  - 头部显示文件状态字母与 `+新增 / −删除` 统计；「暂存」按钮一键 `git add`
- **合并冲突一键解决**：
  - 自动识别 `<<<<<<<` / `=======` / `>>>>>>>` 冲突块（可同时处理多块）
  - 每块提供「保留当前更改」「保留传入更改（分支名）」「两者都保留」三个动作，并排展示两侧内容
  - 处理完点「保存」写回工作区文件；检测到冲突时自动切到冲突面板
- 宿主新增路由：`/git-panel/show-head`（`git show HEAD:<仓库相对路径>`，以仓库根解析，工作区为子目录时同样正确）、`/git-panel/read-file`（工作区文件内容，含二进制与超限判定）、`/git-panel/save-file`（冲突解决 / 编辑回写，含工作区边界校验）、`/git-panel/file-status`（变更清单）
- Git 面板与对比标签联动：在变更文件列表里点击任意文件，直接在右侧栏以完整对比视图打开；写操作（暂存 / 取消暂存 / 放弃）后立即刷新文件树标记

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
