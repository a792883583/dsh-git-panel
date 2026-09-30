/**
 * 当前活动会话身份的共享暂存。
 *
 * 为什么需要它：官方会话列表快照（`sessions.list.getSnapshot()`）返回的
 * `SessionListState` **只有 `ids` 与 `byId`，没有 `current`** —— 官方该服务的注释
 * 写明 "view selection remains outside the Controller"。当前会话身份只由
 * **会话作用域插槽的标准 props** 下发（`SessionStandardProps.sessionId`）。
 *
 * 而后台的变更清单轮询（见 `client/index.ts` 第 0 段）不在任何插槽内，拿不到标准
 * props，因此需要一个由插槽组件写入、轮询读取的共享位置。
 *
 * 写入方：`BranchChip`（会话内常驻）与 `GitTabBody`（Git 面板）。
 *
 * @module dsh-git-panel/client/active-session
 */

let activeSessionId: string | undefined

/** 记录当前活动会话（由会话作用域的插槽组件调用）。 */
export function setActiveSessionId(sessionId: string | undefined): void {
  activeSessionId = sessionId === '' ? undefined : sessionId
}

/** 读取当前活动会话身份；尚未有插槽组件挂载时返回 undefined。 */
export function getActiveSessionId(): string | undefined {
  return activeSessionId
}
