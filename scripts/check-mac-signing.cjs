#!/usr/bin/env node

const { spawnSync } = require('child_process')

const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
  encoding: 'utf8'
})

const output = `${result.stdout || ''}\n${result.stderr || ''}`
const validDeveloperIdMatches = output.match(/Developer ID Application:/g) || []

if (result.status !== 0) {
  console.error('[release][mac] Failed to inspect code-signing identities.')
  process.stderr.write(output)
  process.exit(result.status || 1)
}

if (validDeveloperIdMatches.length <= 0) {
  console.error('[release][mac] No valid "Developer ID Application" identities found.')
  console.error('[release][mac] macOS auto-update requires signed releases. Install/import your Developer ID certificate before publishing.')
  process.stderr.write(output)
  process.exit(1)
}

console.log(`[release][mac] Found ${validDeveloperIdMatches.length} Developer ID Application identity(s).`)
