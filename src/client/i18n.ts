/**
 * 三种语言的插件文案。活动语言会自动检测：DSH 平台语言优先（zh → 简体中文），
 * 然后是浏览器语言（es → 西班牙语），其余情况一律默认为简体中文。文案放在
 * 这里而不放在平台的语言命名空间中，是因为插件需要提供平台并不包含的西班牙语。
 * @module dsh-git-panel/client/i18n
 */

import { useSyncExternalStore } from 'react'

export type Lang = 'zh' | 'en' | 'es'

type Dict = Record<string, string>

const DICTS: Record<Lang, Dict> = {
  zh: {
    'panel.title': 'Git 面板',
    'panel.empty': '打开项目会话后显示 Git 面板',
    'tab.branches': '分支',
    'tab.graph': '图谱',
    'loading': '加载中…',
    'section.local': '本地分支',
    'section.remote': '远程分支',
    'empty.local': '无本地分支',
    'empty.remote': '无远程分支',
    'badge.current': '当前',
    'fetch.all': '全部抓取',
    'op.pull': '拉取',
    'op.switch': '切换',
    'op.checkout': '检出',
    'op.rename': '重命名',
    'op.delete': '删除',
    'op.deleteRemote': '删除远程分支',
    'op.merge': '合并 {branch}',
    'op.done': '{label}完成',
    'write.commit': '提交',
    'write.commit.placeholder': '提交信息…',
    'write.push': '推送',
    'write.stash': '暂存',
    'write.stashPop': '恢复暂存',
    'write.status': '状态',
    'op.ok': '操作成功',
    'op.refresh': '刷新',
    'op.failed': '操作失败',
    'menu.rename': '重命名…',
    'menu.delete': '删除',
    'menu.deleteRemote': '删除远程分支',
    'menu.merge': '合并至当前分支',
    'menu.confirm': '确认',
    'menu.cancel': '取消',
    'menu.title.rename': '重命名分支 {name}',
    'menu.title.delete': '确认删除分支 {name}？',
    'menu.title.deleteRemote': '确认删除远程分支 {name}？',
    'error.invalidName': '非法分支名：{name}',
    'row.title.switch': '双击切换到此分支',
    'row.title.pull': '双击拉取当前分支',
    'row.title.checkout': '双击检出此远程分支',
    'graph.col.lanes': '线图',
    'graph.col.commit': '提交',
    'graph.col.branch': '分支',
    'graph.col.resize': '调整提交列宽 · 双击还原',
    'chip.title': '切换分支',
    'chip.head': '本地分支',
    'aria.loading': '加载中',
  },
  en: {
    'panel.title': 'Git Panel',
    'panel.empty': 'Open a project session to see the Git panel',
    'tab.branches': 'Branches',
    'tab.graph': 'Graph',
    'loading': 'Loading…',
    'section.local': 'Local branches',
    'section.remote': 'Remote branches',
    'empty.local': 'No local branches',
    'empty.remote': 'No remote branches',
    'badge.current': 'current',
    'fetch.all': 'Fetch all',
    'op.pull': 'Pull',
    'op.switch': 'Switch',
    'op.checkout': 'Checkout',
    'op.rename': 'Rename',
    'op.delete': 'Delete',
    'op.deleteRemote': 'Delete remote branch',
    'op.merge': 'Merge {branch}',
    'op.done': '{label} done',
    'write.commit': 'Commit',
    'write.commit.placeholder': 'Commit message…',
    'write.push': 'Push',
    'write.stash': 'Stash',
    'write.stashPop': 'Pop stash',
    'write.status': 'Status',
    'op.ok': 'Done',
    'op.refresh': 'Refresh',
    'op.failed': 'Failed',
    'menu.rename': 'Rename…',
    'menu.delete': 'Delete',
    'menu.deleteRemote': 'Delete remote branch',
    'menu.merge': 'Merge into current branch',
    'menu.confirm': 'Confirm',
    'menu.cancel': 'Cancel',
    'menu.title.rename': 'Rename branch {name}',
    'menu.title.delete': 'Delete branch {name}?',
    'menu.title.deleteRemote': 'Delete remote branch {name}?',
    'error.invalidName': 'Invalid branch name: {name}',
    'row.title.switch': 'Double-click to switch',
    'row.title.pull': 'Double-click to pull',
    'row.title.checkout': 'Double-click to check out',
    'graph.col.lanes': 'Lanes',
    'graph.col.commit': 'Commit',
    'graph.col.branch': 'Branch',
    'graph.col.resize': 'Drag to resize · double-click to reset',
    'chip.title': 'Switch branch',
    'chip.head': 'Local branches',
    'aria.loading': 'Loading',
  },
  es: {
    'panel.title': 'Panel de Git',
    'panel.empty': 'Abre una sesión de proyecto para ver el panel de Git',
    'tab.branches': 'Ramas',
    'tab.graph': 'Gráfico',
    'loading': 'Cargando…',
    'section.local': 'Ramas locales',
    'section.remote': 'Ramas remotas',
    'empty.local': 'No hay ramas locales',
    'empty.remote': 'No hay ramas remotas',
    'badge.current': 'actual',
    'fetch.all': 'Obtener todo',
    'op.pull': 'Traer cambios',
    'op.switch': 'Cambiar',
    'op.checkout': 'Cambiar a',
    'op.rename': 'Renombrar',
    'op.delete': 'Eliminar',
    'op.deleteRemote': 'Eliminar rama remota',
    'op.merge': 'Fusionar {branch}',
    'op.done': '{label} completado',
    'write.commit': 'Confirmar',
    'write.commit.placeholder': 'Mensaje de commit…',
    'write.push': 'Empujar',
    'write.stash': 'Guardar',
    'write.stashPop': 'Recuperar',
    'write.status': 'Estado',
    'op.ok': 'Hecho',
    'op.refresh': 'Actualizar',
    'op.failed': 'Falló',
    'menu.rename': 'Renombrar…',
    'menu.delete': 'Eliminar',
    'menu.deleteRemote': 'Eliminar rama remota',
    'menu.merge': 'Fusionar en la rama actual',
    'menu.confirm': 'Confirmar',
    'menu.cancel': 'Cancelar',
    'menu.title.rename': 'Renombrar rama {name}',
    'menu.title.delete': '¿Eliminar la rama {name}?',
    'menu.title.deleteRemote': '¿Eliminar la rama remota {name}?',
    'error.invalidName': 'Nombre de rama no válido: {name}',
    'row.title.switch': 'Doble clic para cambiar',
    'row.title.pull': 'Doble clic para traer cambios',
    'row.title.checkout': 'Doble clic para cambiar a esta rama',
    'graph.col.lanes': 'Carriles',
    'graph.col.commit': 'Commit',
    'graph.col.branch': 'Rama',
    'graph.col.resize': 'Arrastrar para ajustar · doble clic para restablecer',
    'chip.title': 'Cambiar rama',
    'chip.head': 'Ramas locales',
    'aria.loading': 'Cargando',
  },
}

/** 平台 locale 服务的结构（参见 client/index.ts）。 */
interface LocaleService {
  getLocale(): { active: string }
  subscribe(fn: () => void): () => void
}

let locale: LocaleService | null = null
let lang: Lang = 'zh'
let revision = 0
const listeners = new Set<() => void>()

function notify(): void {
  revision += 1
  for (const fn of listeners) fn()
}

function detectLang(): Lang {
  // 1. 当平台语言明确为中文时，平台语言优先。
  const active = locale?.getLocale().active
  if (active === 'zh') return 'zh'
  // 2. 平台只提供 zh/en，因此西班牙语浏览器会落到 en —— 嗅探浏览器语言，
  //   以便给西语用户提供西语文案。
  const nav = (navigator.language || '').toLowerCase()
  if (nav.startsWith('es')) return 'es'
  // 3. 其余情况一律默认为简体中文。
  if (active === 'en') return 'en'
  if (nav.startsWith('zh')) return 'zh'
  return 'zh'
}

/** 接入平台 locale 服务；由客户端入口调用一次。 */
export function initI18n(service: LocaleService): void {
  if (locale === service) return
  locale = service
  lang = detectLang()
  service.subscribe(() => {
    const next = detectLang()
    if (next !== lang) {
      lang = next
      notify()
    }
  })
}

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const getSnapshot = (): number => revision

/** 按活动语言翻译一个键。缺失的键回退到 zh。 */
export function t(key: string, params?: Record<string, string>): string {
  const text = DICTS[lang][key] ?? DICTS.zh[key] ?? key
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}

/**
 * React hook：当活动语言变化时重新渲染组件。返回的 t() 是模块级稳定引用，
 * 因此被 memo 化的回调可以安全地依赖它。
 */
export function useT(): (key: string, params?: Record<string, string>) => string {
  useSyncExternalStore(subscribe, getSnapshot)
  return t
}
