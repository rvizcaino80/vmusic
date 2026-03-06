#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const db = require('../db/models')
const { loadSongWithRelations, tagSongFile, getSongFilePath } = require('./mp3Tagger')

const PROJECT_ROOT = path.join(__dirname, '..')

function printUsage() {
  console.log('Uso:')
  console.log('  node scripts/tag-mp3.js --all')
  console.log('  node scripts/tag-mp3.js --song-id <id>')
}

function parseArgs(argv) {
  const hasAll = argv.includes('--all')
  const songIdIndex = argv.indexOf('--song-id')
  const songIdValue = songIdIndex >= 0 ? argv[songIdIndex + 1] : null

  return {
    all: hasAll,
    songId: songIdValue ? Number(songIdValue) : null
  }
}

async function tagSingleSong(songId) {
  const song = await loadSongWithRelations(db, songId)
  if (!song) {
    throw new Error(`No existe una canción con id ${songId}`)
  }

  const filePath = getSongFilePath(PROJECT_ROOT, song)
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo mp3 para la canción ${song.id}: ${filePath}`)
  }

  await tagSongFile({ song, baseDir: PROJECT_ROOT, filePath })
  console.log(`[ok] Etiquetado songId=${song.id} archivo=${filePath}`)
}

async function tagAllSongs() {
  const songs = await db.Song.findAll({
    include: [
      {
        model: db.Artist,
        as: 'Artists'
      },
      {
        model: db.Composer,
        as: 'Composers'
      },
      {
        model: db.Tag,
        as: 'Tags'
      }
    ],
    order: [['id', 'ASC']]
  })

  let ok = 0
  let missingFile = 0
  let failed = 0

  for (const song of songs) {
    const filePath = getSongFilePath(PROJECT_ROOT, song)
    if (!fs.existsSync(filePath)) {
      missingFile += 1
      console.log(`[skip] songId=${song.id} sin mp3 en ${filePath}`)
      continue
    }

    try {
      await tagSongFile({ song, baseDir: PROJECT_ROOT, filePath })
      ok += 1
      console.log(`[ok] songId=${song.id}`)
    } catch (error) {
      failed += 1
      console.error(`[error] songId=${song.id}: ${error.message}`)
    }
  }

  console.log(`Resumen -> ok=${ok}, skip=${missingFile}, failed=${failed}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

async function main() {
  const { all, songId } = parseArgs(process.argv.slice(2))

  if (!all && !songId) {
    printUsage()
    process.exitCode = 1

    return
  }

  if (all) {
    await tagAllSongs()

    return
  }

  await tagSingleSong(songId)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async() => {
    await db.sequelize.close()
  })
