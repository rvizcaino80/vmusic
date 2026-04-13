#!/usr/bin/env node
// Git commit-msg hook para validar formato de commits
// Uso: node scripts/verify-commit-msg.js .git/COMMIT_EDITMSG

const fs = require('fs')

const validTypes = ['feat', 'fix', 'perf', 'refactor', 'docs', 'chore', 'test', 'style', 'build']
const commitMsgFile = process.argv[2]

if (!commitMsgFile) {
  console.error('Usage: node verify-commit-msg.js <commit-msg-file>')
  process.exit(1)
}

const commitMsg = fs.readFileSync(commitMsgFile, 'utf8').trim()

// Ignorar merge commits y líneas vacías
if (commitMsg.startsWith('Merge ') || commitMsg === '') {
  process.exit(0)
}

// Extraer primera línea (ignorar comentarios)
const firstLine = commitMsg.split('\n')[0]

// Validar formato
const match = firstLine.match(/^([a-z]+):\s*(.+)$/)

if (!match) {
  console.error('\n❌ Error: El mensaje de commit no tiene el formato correcto.\n')
  console.error('Formato esperado: tipo: descripcion\n')
  console.error('Tipos validos:', validTypes.join(', '))
  console.error('\nEjemplos:')
  console.error('  feat: agregar filtro por artista')
  console.error('  fix: corregir error al cargar archivos MP3')
  console.error('  perf: optimizar carga de la biblioteca\n')
  process.exit(1)
}

const [, type, description] = match

if (!validTypes.includes(type)) {
  console.error(`\n❌ Error: Tipo de commit invalido "${type}".\n`)
  console.error('Tipos validos:', validTypes.join(', '))
  process.exit(1)
}

if (description.length > 70) {
  console.error('\n⚠️  Advertencia: La descripcion es muy larga (>70 caracteres).')
  console.error('Considera usar un mensaje mas breve.\n')
}

// Verificar que sea español (contiene caracteres comunes en español)
const hasSpanishChars =
  /[áéíóúñ]/i.test(description) ||
  /\b(el|la|los|las|un|una|del|al|con|por|para|desde|hasta|entre|sin|sobre|tras)\b/i.test(
    description
  )

if (!hasSpanishChars) {
  console.error('\n⚠️  Advertencia: El mensaje no parece estar en español.')
  console.error('Por favor escribe los commits en español.\n')
  process.exit(1)
}

console.log(`✅ Commit valido: ${type}: ${description}`)
process.exit(0)
