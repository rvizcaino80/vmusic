const { execFileSync } = require('node:child_process')
const { utimesSync } = require('node:fs')
const { join } = require('node:path')

module.exports = async function clearMacBundleIconFlags(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  try {
    // Lowercase "c" clears Finder's custom icon flag; uppercase "C" sets it.
    execFileSync('SetFile', ['-a', 'c', appPath])
  } catch (error) {
    console.warn('[afterPack] failed to clear custom icon flag', error?.message || error)
  }

  try {
    execFileSync('xattr', ['-d', 'com.apple.FinderInfo', appPath])
  } catch {}

  try {
    execFileSync('xattr', ['-d', 'com.apple.ResourceFork', appPath])
  } catch {}

  try {
    const now = new Date()
    utimesSync(appPath, now, now)
  } catch {}
}
