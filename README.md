# dsh-git-panel

[English](README.en.md) · [Español](README.es.md)

DSH Web GUI 的 Git 面板插件：分支管理（切换 / 拉取 / 抓取 / 重命名 / 删除 / 合并）+ GitLens 风格的提交图谱。

## 功能

- **分支面板**（聊天区右侧）：
  - 本地分支：当前分支高亮，显示相对上游的 `↑ahead / ↓behind`，**双击切换分支**（当前分支双击为拉取）
  - 远程分支：**双击检出**（自动创建本地跟踪分支）
  - 右键菜单：**重命名 / 删除 / 合并至当前分支**（远程分支为删除远程分支）
  - 一键**拉取**当前分支、**全部抓取**（`git fetch --all --prune`）
- **分支胶囊**（输入框上方）：显示当前分支，点击展开本地分支列表快速切换
- **Git 图谱**：提交 DAG 泳道图（lane 算法），三栏标题（线图 / 提交 / 分支），提交列左右两侧可拖拽调宽（宽度持久化），点击节点查看提交详情；虚拟化渲染——只绘制可视区域，大仓库滚动流畅
- **多语言**：自动跟随 DSH Web 界面语言（中文 / 英文），西班牙语浏览器自动切换西班牙语，默认简体中文
- 跟随当前会话工作目录：切换项目会话自动重新绑定
- 明暗主题跟随 DSH Web GUI

## 安装

```sh
# 本地开发 / 未发布 npm 时
dsh plugin --profile web add link:/path/to/dsh-git-panel

# 发布到 npm 后
dsh plugin --profile web add dsh-git-panel
```

重启 `dsh web`，打开绑定 git 仓库的项目会话，聊天区右侧出现「Git 面板」。

## 开发

```sh
npm install
npm run typecheck     # tsc --noEmit
npm run build         # esbuild → lib/index.js (host) + lib/client.js (browser)
npm test              # scripts/test-e2e.sh：scratch 仓库端到端测试
```

### 架构

- **host 半区**（`src/index.ts` / `src/host/`）：workspace 门卫 + `ctx.subprocess` 运行真实 git 命令，经 `ctx.webServer.register` 暴露 `/git-panel/*` JSON 路由。安全边界：只允许在已注册 workspace 根目录执行 git。
- **browser 半区**（`src/client/`）：通过 `[class*="sidebarCol"]` 父元素（或 `[data-dsh-frame]`）定位壳的 frame 网格，追加右侧列并同步 grid tracks；React 渲染分支列表与图谱；`i18n.ts` 维护中 / 英 / 西三语文案，跟随平台语言与浏览器语言自动切换。
- 构建产物遵循 `window.__ModuleLoader__.load({ id, factory })` 闭包工厂约定；外部模块（react / @deepseek-ai 平台模块）走加载器模块表。

### 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/git-panel/branches` | POST | 分支视图（current / local / remote + ahead / behind） |
| `/git-panel/graph` | POST | 提交 DAG + 分支 tip 映射 |
| `/git-panel/switch` | POST | 切换分支（远程分支自动建本地跟踪分支） |
| `/git-panel/pull` | POST | 拉取当前分支 |
| `/git-panel/fetch` | POST | 抓取全部远程（prune） |
| `/git-panel/rename` | POST | 重命名分支 |
| `/git-panel/delete` | POST | 删除本地分支 |
| `/git-panel/delete-remote` | POST | 删除远程分支 |
| `/git-panel/merge` | POST | 合并分支至当前分支 |

## License

MIT
