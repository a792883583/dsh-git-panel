/**
 * Host git-service end-to-end test against a scratch repo.
 * Bundled with esbuild and run with node — no DSH runtime required.
 */
import { spawn } from 'node:child_process'
import { GitService, type GitRunner } from '../src/host/git-service.ts'

const runner: GitRunner = {
  run(argv, cwd) {
    return new Promise((resolve) => {
      const child = spawn('git', [...argv], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('close', (code) => resolve({ exitCode: code, stdout, stderr }))
    })
  },
}

const service = new GitService(runner, async (path) => ({ ok: true, canonical: path }))

const REPO = '/tmp/gitpanel-test/work'
const NON_REPO = '/tmp/gitpanel-test'

function check(name: string, ok: boolean, extra = ''): void {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main(): Promise<void> {
  // Ahead/behind is computed against the local remote-tracking refs (same
  // semantics as git status / GitLens): refresh them first so the scenario
  // (main ahead 1 / behind 1) is visible from the start.
  const initFetch = await service.fetchAll(REPO)
  check('初始 fetch 成功', initFetch.ok, initFetch.error?.message)

  // 1) branches
  const branches = await service.branches(REPO)
  console.log('\n== branches ==')
  console.log(`current=${branches.current} repo=${branches.repo}`)
  console.log('local:', branches.local.map((b) => `${b.name}@${b.sha} ahead=${b.ahead} behind=${b.behind} cur=${b.current ?? false}`))
  console.log('remote:', branches.remote.map((b) => b.name))
  check('当前分支 main', branches.current === 'main')
  const main = branches.local.find((b) => b.name === 'main')
  check('本地分支含 main/feature/alpha', branches.local.some((b) => b.name === 'feature/alpha') && !!main)
  check('main 领先上游 1', main?.ahead === 1, `ahead=${main?.ahead}`)
  check('main 落后上游 1', main?.behind === 1, `behind=${main?.behind}`)
  check('远程分支含 origin/main', branches.remote.some((b) => b.name === 'origin/main'))
  check('当前标记正确', branches.local.find((b) => b.name === 'main')?.current === true)

  // 2) graph
  const graph = await service.graph(REPO)
  console.log('\n== graph ==')
  console.log(`commits=${graph.commits.length} tips=${Object.keys(graph.tips).length}`)
  console.log('tips:', graph.tips)
  check('图谱有提交', graph.commits.length >= 4)
  check('tips 含本地+远程分支', !!graph.tips['main'] && !!graph.tips['origin/main'] && !!graph.tips['feature/alpha'])
  check('提交带 parent 关系', graph.commits.some((c) => c.parents.length > 0))
  console.log('首条:', graph.commits[0]?.subject, '| parents:', graph.commits[0]?.parents)

  // 3) switch 到另一分支再切回
  const sw1 = await service.switchBranch(REPO, 'feature/alpha')
  check('切换到 feature/alpha', sw1.ok, sw1.error?.message ?? sw1.output)
  const cur1 = await service.currentBranch(REPO)
  check('当前分支已变', cur1 === 'feature/alpha', `cur=${cur1}`)
  const sw2 = await service.switchBranch(REPO, 'main')
  check('切回 main', sw2.ok, sw2.error?.message)
  const cur2 = await service.currentBranch(REPO)
  check('当前分支已恢复', cur2 === 'main', `cur=${cur2}`)

  // 4) fetch（应把远端 main 的领先提交拉下来）
  const fetchRes = await service.fetchAll(REPO)
  check('fetch --all --prune', fetchRes.ok, fetchRes.error?.message ?? fetchRes.output.slice(0, 80))
  const branches2 = await service.branches(REPO)
  const main2 = branches2.local.find((b) => b.name === 'main')
  check('fetch 后 behind 更新', main2?.behind === 1, `behind=${main2?.behind}`)

  // 5) pull（快进合并）
  const pullRes = await service.pull(REPO)
  check('git pull 成功', pullRes.ok, pullRes.error?.message ?? pullRes.output.slice(0, 80))
  const branches3 = await service.branches(REPO)
  const main3 = branches3.local.find((b) => b.name === 'main')
  check('pull 后 ahead=1 behind=0', main3?.ahead === 1 && main3?.behind === 0, `ahead=${main3?.ahead} behind=${main3?.behind}`)

  // 6) 非 git 目录的错误处理
  let threw = false
  try {
    await service.branches(NON_REPO)
  } catch (e) {
    threw = true
    check('非仓库目录抛错', true, String((e as Error).message).slice(0, 60))
  }
  if (!threw) check('非仓库目录抛错', false, '未抛错')
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
