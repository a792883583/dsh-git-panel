import { spawn } from 'node:child_process'
import { GitService, type GitRunner } from '../src/host/git-service.ts'

const runner: GitRunner = {
  run(argv, cwd) {
    return new Promise((resolve) => {
      const child = spawn('git', [...argv], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''; let stderr = ''
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('close', (code) => resolve({ exitCode: code, stdout, stderr }))
    })
  },
}
const service = new GitService(runner, async (p) => ({ ok: true, canonical: p }))
const REPO = '/tmp/gitpanel-test/work'
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  await service.switchBranch(REPO, 'main')

  // 1) 重命名 feature/alpha -> feature/alpha2
  const rn = await service.renameBranch(REPO, 'feature/alpha', 'feature/alpha2')
  check('重命名分支', rn.ok, rn.error?.message)
  const b1 = await service.branches(REPO)
  check('新名字存在', b1.local.some((b) => b.name === 'feature/alpha2'))
  check('旧名字消失', !b1.local.some((b) => b.name === 'feature/alpha'))

  // 2) 推送 feature/alpha2 到远程
  const push = await runner.run(['push', '-u', 'origin', 'feature/alpha2'], REPO)
  check('推送 feature/alpha2', push.exitCode === 0, push.stderr.slice(0, 40))

  // 3) 删除远程分支
  const delRemote = await service.deleteRemoteBranch(REPO, 'origin/feature/alpha2')
  check('删除远程分支', delRemote.ok, delRemote.error?.message)
  const b2 = await service.branches(REPO)
  check('远程分支已删', !b2.remote.some((b) => b.name === 'origin/feature/alpha2'))

  // 4) 合并 feature/alpha2 到 main
  const mg = await service.mergeBranch(REPO, 'feature/alpha2')
  check('合并分支到当前', mg.ok, mg.error?.message ?? mg.output.slice(0, 40))

  // 5) 删除本地 feature/alpha2
  const del = await service.deleteBranch(REPO, 'feature/alpha2')
  check('删除本地分支', del.ok, del.error?.message)
  const b3 = await service.branches(REPO)
  check('删除后不存在', !b3.local.some((b) => b.name === 'feature/alpha2'))

  // 6) 边界：删除当前分支应失败
  const delCur = await service.deleteBranch(REPO, 'main')
  check('删除当前分支被 git 拒绝', !delCur.ok, delCur.error?.message.slice(0, 40))

  // 7) 非法新名
  const bad = await service.renameBranch(REPO, 'main', 'bad name')
  check('非法名由 git 拒绝', !bad.ok, bad.error?.message.slice(0, 30))
}
main().catch((e) => { console.error('测试失败:', e); process.exit(1) })
