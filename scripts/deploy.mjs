// One-command redeploy to GitHub Pages (gh-pages branch).
// Usage: npm run deploy
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const REMOTE = 'https://github.com/asandes88/confer.git'
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })

console.log('› Building…')
run('npm run build')

// Keep Pages from running Jekyll over the Vite output.
writeFileSync('dist/.nojekyll', '')

console.log('› Publishing dist/ to gh-pages…')
const git = (cmd) => run(`git ${cmd}`, { cwd: 'dist' })
// dist/.git may already exist from a prior deploy; (re)initialise idempotently.
try {
  git('rev-parse --is-inside-work-tree')
} catch {
  git('init -q')
}
git('checkout -q -B gh-pages')
git('add -A')
git('-c user.email=poc@confer.local -c user.name=Confer commit -q -m "Deploy" --allow-empty')
git(`push -q -f ${REMOTE} gh-pages`)

console.log('\n✓ Deployed → https://asandes88.github.io/confer/')
