#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const [type] = args

if (!type) {
  console.error('Usage: npm run release [major|minor|patch]')
  process.exit(1)
}

if (!['major', 'minor', 'patch'].includes(type)) {
  console.error('Invalid type. Use: major, minor, or patch')
  process.exit(1)
}

console.log(`🚀 Starting release process (${type})...\n`)

const pkg = JSON.parse(fs.readFileSync('package.json'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

let newVersion
if (type === 'major') {
  newVersion = `${major + 1}.0.0`
} else if (type === 'minor') {
  newVersion = `${major}.${minor + 1}.0`
} else {
  newVersion = `${major}.${minor}.${patch + 1}`
}

console.log(`📦 Version: ${pkg.version} → ${newVersion}`)

let lastTag
try {
  lastTag = execSync(`git describe --tags --abbrev=0`).toString().trim()
} catch {
  console.log('📌 No previous tags found, using initial commit')
  lastTag = execSync(`git rev-list --max-parents=0 HEAD`).toString().trim()
}

console.log(`📝 Commits since ${lastTag}:`)

const commitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`).toString()
const commits = commitLog.split('\n').filter(Boolean)

if (commits.length === 0) {
  console.log('  No commits since last tag')
} else {
  commits.forEach((c) => console.log(`  - ${c}`))
}

const changes = { new: [], fix: [], perf: [], refactor: [], other: [] }

commits.forEach((commit) => {
  const text = commit.replace(/^[^:]+:\s*/, '').trim()
  if (commit.startsWith('feat')) changes.new.push(text)
  else if (commit.startsWith('fix')) changes.fix.push(text)
  else if (commit.startsWith('perf')) changes.perf.push(text)
  else if (commit.startsWith('refactor')) changes.refactor.push(text)
  else if (!commit.startsWith('docs') && !commit.startsWith('chore')) changes.other.push(text)
})

const date = new Date().toISOString().split('T')[0]

const changelogPath = 'src/renderer/public/changelog.json'
let changelog = { versions: [] }
if (fs.existsSync(changelogPath)) {
  changelog = JSON.parse(fs.readFileSync(changelogPath))
}

changelog.versions.unshift({
  version: newVersion,
  date,
  changes
})

fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n')
console.log('✅ Changelog updated')

pkg.version = newVersion
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('✅ package.json updated')

console.log('\n📝 Committing version bump...')
execSync(`git add package.json resources/changelog.json`)
execSync(`git commit -m "v${newVersion}"`)

console.log('🏷️  Creating tag...')
execSync(`git tag v${newVersion}`)

console.log('\n🔨 Building...')
execSync('npm run build', { stdio: 'inherit' })

console.log('\n🚀 Publishing release...')
execSync('electron-builder --mac --arm64 --publish always', { stdio: 'inherit' })

console.log(`\n✅ Released v${newVersion}!`)
