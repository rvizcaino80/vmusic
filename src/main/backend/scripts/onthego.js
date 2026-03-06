#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const db = require('../db/models')

const PROJECT_ROOT = path.join(__dirname, '..')
const ONTHEGO_DIR = path.join(PROJECT_ROOT, 'onthego')
const IGNORED_TAG = 'agregado-reciente'

function parseArgs(argv) {
  const genreIndex = argv.indexOf('--genre')
  const genre = genreIndex >= 0 ? argv[genreIndex + 1] : null

  return {
    genre: genre ? String(genre).trim() : ''
  }
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ')
    .trim()
}

function songHasTag(song, targetTag) {
  const normalizedTarget = normalize(targetTag).toLowerCase()
  if (!normalizedTarget) return false
  const tags = Array.isArray(song.Tags) ? song.Tags : []

  return tags.some((tag) => {
    const name = normalize(tag.name).toLowerCase()
    if (!name) return false
    if (name === IGNORED_TAG) return false

    return name === normalizedTarget
  })
}

function getSongMp3Path(song) {
  return path.join(PROJECT_ROOT, '_music', normalize(song.folder), `${normalize(song.ytid)}.mp3`)
}

async function main() {
  const { genre } = parseArgs(process.argv.slice(2))
  if (!genre) {
    throw new Error('Debes pasar --genre "<etiqueta>"')
  }

  if (!fs.existsSync(ONTHEGO_DIR)) {
    fs.mkdirSync(ONTHEGO_DIR, { recursive: true })
  }

  const songs = await db.Song.findAll({
    include: [
      {
        model: db.Tag,
        as: 'Tags'
      }
    ],
    order: [['id', 'ASC']]
  })

  const filtered = songs.filter((song) => songHasTag(song, genre))
  if (!filtered.length) {
    console.log(`No hay canciones con la etiqueta "${genre}"`)

    return
  }

  let copied = 0
  let skipped = 0
  let missing = 0
  for (const song of filtered) {
    const source = getSongMp3Path(song)
    const fileName = path.basename(source)
    const target = path.join(ONTHEGO_DIR, fileName)

    if (!fs.existsSync(source)) {
      missing += 1
      console.log(`[missing] songId=${song.id} ${source}`)
      continue
    }

    if (fs.existsSync(target)) {
      skipped += 1
      console.log(`[skip] songId=${song.id} ya existe ${target}`)
      continue
    }

    fs.copyFileSync(source, target)
    copied += 1
    console.log(`[ok] songId=${song.id} -> ${target}`)
  }

  console.log(`Resumen -> copied=${copied}, skipped=${skipped}, missing=${missing}, total=${filtered.length}`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async() => {
    await db.sequelize.close()
  })
