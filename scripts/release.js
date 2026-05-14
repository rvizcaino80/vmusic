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

console.log(`\n📝 Commits desde ${lastTag}:`)
const commitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`).toString()
const commits = commitLog.split('\n').filter(Boolean)

if (commits.length === 0) {
  console.log('  Ningún commit nuevo')
} else {
  commits.forEach((c) => console.log(`  - ${c}`))
}

// Función para extraer la descripción del commit (después de tipo: y [user-facing])
const extractDescription = (commit) => {
  // Remover el prefijo del tipo (feat:, fix:, etc.)
  let text = commit.replace(/^[^:]+:\s*/, '').trim()
  // Remover la etiqueta [user-facing]
  text = text.replace(/\[user-facing\]\s*/, '').trim()
  // Capitalizar primera letra
  text = text.charAt(0).toUpperCase() + text.slice(1)
  return text
}

const changes = { new: [], fix: [], perf: [], refactor: [], other: [] }

commits.forEach((commit) => {
  // Solo procesar commits marcados como [user-facing]
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

// Agregar nueva versión
changelog.versions.unshift({
  version: newVersion,
  date,
  changes: Object.fromEntries(Object.entries(changes).filter(([, v]) => v.length > 0))
})

fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n')
console.log('✅ Changelog actualizado automáticamente')

// Mostrar cambios generados
console.log('\n📋 Cambios generados:')
Object.entries(changes).forEach(([type, items]) => {
  if (items.length > 0) {
    console.log(`  ${type}: ${items.join(', ')}`)
  }
})

// Actualizar versión
pkg.version = newVersion
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('✅ package.json actualizado')

// Commit y tag
console.log('\n📝 Committing version bump...')
execSync(`git add package.json src/renderer/src/assets/changelog.json`)
execSync(`git commit -m "v${newVersion}"`)

console.log('🏷️  Creating tag...')
execSync(`git tag v${newVersion}`)

// Build y publish
console.log('\n🔨 Building...')
execSync('npm run build', { stdio: 'inherit' })

console.log('\n🚀 Publishing release...')
execSync('electron-builder --mac --arm64 --publish always', { stdio: 'inherit' })

console.log(`\n✅ Released v${newVersion}!`)
