#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const GITHUB_REPO = 'rvizcaino80/vmusic'

const REQUIRED_ASSETS = [
  { name: 'salsamania-{version}.dmg', type: 'DMG' },
  { name: 'Salsamania-{version}-arm64-mac.zip', type: 'ZIP' },
  { name: 'latest-mac.yml', type: 'YML' }
]

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

function capture(cmd) {
  return execSync(cmd).toString().trim()
}

function verifyAssets(version) {
  console.log('\n🔍 Verificando assets del release...')
  const result = capture(`gh release view v${version} --repo ${GITHUB_REPO} --json assets`)
  const uploaded = JSON.parse(result).assets.map(a => a.name)

  const missing = REQUIRED_ASSETS
    .map(a => ({ ...a, name: a.name.replace('{version}', version) }))
    .filter(a => !uploaded.includes(a.name))

  if (missing.length > 0) {
    console.error(`❌ Assets faltantes: ${missing.map(a => a.name).join(', ')}`)
    return false
  }

  console.log('✅ Todos los assets están completos')
  return true
}

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
  lastTag = capture(`git describe --tags --abbrev=0`)
} catch {
  console.log('📌 No previous tags found, using initial commit')
  lastTag = capture(`git rev-list --max-parents=0 HEAD`)
}

console.log(`\n📝 Commits desde ${lastTag}:`)
const commitLog = capture(`git log ${lastTag}..HEAD --pretty=format:"%s"`)
const commits = commitLog.split('\n').filter(Boolean)

if (commits.length === 0) {
  console.log('  Ningún commit nuevo')
} else {
  commits.forEach((c) => console.log(`  - ${c}`))
}

const extractDescription = (commit) => {
  let text = commit.replace(/^[^:]+:\s*/, '').trim()
  text = text.replace(/\[user-facing\]\s*/, '').trim()
  text = text.charAt(0).toUpperCase() + text.slice(1)
  return text
}

const changes = { new: [], fix: [], perf: [], refactor: [], other: [] }

commits.forEach((commit) => {
  if (!commit.includes('[user-facing]')) return
  const text = extractDescription(commit)
  if (!text) return
  if (commit.startsWith('feat')) changes.new.push(text)
  else if (commit.startsWith('fix')) changes.fix.push(text)
  else if (commit.startsWith('perf')) changes.perf.push(text)
  else if (commit.startsWith('refactor')) changes.refactor.push(text)
  else changes.other.push(text)
})

const date = new Date().toISOString().split('T')[0]

const changelogPath = 'src/renderer/src/assets/changelog.json'
let changelog = { versions: [] }
if (fs.existsSync(changelogPath)) {
  changelog = JSON.parse(fs.readFileSync(changelogPath))
}

changelog.versions.unshift({
  version: newVersion,
  date,
  changes: Object.fromEntries(Object.entries(changes).filter(([, v]) => v.length > 0))
})

fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n')
console.log('✅ Changelog actualizado automáticamente')

console.log('\n📋 Cambios generados:')
Object.entries(changes).forEach(([type, items]) => {
  if (items.length > 0) {
    console.log(`  ${type}: ${items.join(', ')}`)
  }
})

pkg.version = newVersion
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('✅ package.json actualizado')

console.log('\n📝 Committing version bump...')
run('git add package.json src/renderer/src/assets/changelog.json')
run(`git commit -m "v${newVersion}"`)

console.log('🏷️  Creating tag...')
run(`git tag v${newVersion}`)

console.log('\n🔨 Building...')
run('npm run build')

console.log('\n🚀 Publishing release...')
run('npx electron-builder --mac --arm64 --publish always')

let attempts = 0
const MAX_RETRIES = 2
while (attempts <= MAX_RETRIES) {
  if (verifyAssets(newVersion)) break
  attempts++
  if (attempts > MAX_RETRIES) {
    console.error(`\n❌ El release v${newVersion} quedó incompleto después de ${MAX_RETRIES + 1} intentos`)
    console.error('   Ejecuta manualmente: npm run build && npx electron-builder --mac --arm64 --publish always')
    process.exit(1)
  }
  console.log(`\n🔄 Reintentando publicación (intento ${attempts}/${MAX_RETRIES})...`)
  run('npx electron-builder --mac --arm64 --publish always')
}

console.log(`\n✅ Released v${newVersion}!`)
