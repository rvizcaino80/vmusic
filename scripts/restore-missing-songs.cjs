const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { Sequelize, DataTypes } = require('sequelize')
const { Op } = Sequelize

const MUSIC_DIR = process.env.VMUSIC_MUSIC_DIR || path.join(require('os').homedir(), 'Music', 'SalsamaniaLibrary')
const DB_PATH = process.argv[2] || path.join(__dirname, '..', 'src/main/backend/db/vmusic.sqlite')
const YT_DLP_BIN = process.env.VMUSIC_YT_DLP_BIN || path.join(__dirname, '..', 'build/bin/yt-dlp')

const REVISAR_ARTIST = 'revisar'
const REVISAR_TAG = 'revisar'

function runYtDlp(ytid) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${ytid}`
    const args = ['--skip-download', '--print', '%(title)s', '--print', '%(duration)s', url]
    const child = spawn(YT_DLP_BIN, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp falló (${code}): ${stderr.slice(0, 300)}`))
        return
      }
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean)
      resolve({ title: lines[0] || '', duration: parseInt(lines[1], 10) || 0 })
    })
  })
}

function cleanTitle(rawTitle) {
  let title = String(rawTitle || '').trim()
  const patterns = [
    /\s*\(Official\s+(Lyric\s+)?Video\)\s*/gi,
    /\s*\(Lyric\s+Video\)\s*/gi,
    /\s*\(Official\s+Audio\)\s*/gi,
    /\s*\(Video\s+Oficial\)\s*/gi,
    /\s*\(Audio\s+Oficial\)\s*/gi,
    /\s*\(Letra\)\s*/gi,
    /\s*\(Lyrics?\)\s*/gi,
    /\s*\(Vídeo\s+Oficial\)\s*/gi,
    /\s*\(En\s+Vivo\)\s*/gi,
    /\s*\(Live\)\s*/gi,
    /\s*\(HD\)\s*/gi,
    /\s*\(4K\)\s*/gi,
    /\s*\|.*$/gi,
    /^VIDEO\s+/i,
    /^Video\s+/i,
  ]
  for (const p of patterns) {
    title = title.replace(p, '')
  }
  return title.trim()
}

function findSongFile(ytid) {
  const folders = fs.readdirSync(MUSIC_DIR, { withFileTypes: true })
  for (const folder of folders) {
    if (!folder.isDirectory()) continue
    const filePath = path.join(MUSIC_DIR, folder.name, `${ytid}.mp3`)
    if (fs.existsSync(filePath)) {
      return { folder: folder.name, filePath }
    }
  }
  return null
}

async function main() {
  console.log(`[restore] DB: ${DB_PATH}`)
  console.log(`[restore] Música: ${MUSIC_DIR}`)
  console.log(`[restore] yt-dlp: ${YT_DLP_BIN}`)

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[restore] ERROR: No existe DB en ${DB_PATH}`)
    process.exit(1)
  }

  const sequelize = new Sequelize({ dialect: 'sqlite', storage: DB_PATH, logging: false })

  const Artist = sequelize.define('Artist', { name: DataTypes.STRING }, { tableName: 'Artists', timestamps: true })
  const Tag = sequelize.define('Tag', { name: DataTypes.STRING }, { timestamps: true })
  const Song = sequelize.define('Song', {
    folder: DataTypes.STRING,
    ytid: DataTypes.STRING,
    name: DataTypes.STRING,
    duration: DataTypes.INTEGER,
    duration_original: DataTypes.STRING,
    speed: DataTypes.INTEGER,
    start: DataTypes.INTEGER,
    end: DataTypes.INTEGER,
  }, { timestamps: true })
  const ArtistSong = sequelize.define('ArtistSong', {
    artistId: DataTypes.INTEGER,
    songId: DataTypes.INTEGER,
  }, { tableName: 'ArtistSong', timestamps: true })
  const SongTag = sequelize.define('SongTag', {
    songId: DataTypes.INTEGER,
    tagId: DataTypes.INTEGER,
  }, { timestamps: true })

  Artist.belongsToMany(Song, { through: ArtistSong, foreignKey: 'artistId', otherKey: 'songId' })
  Song.belongsToMany(Artist, { through: ArtistSong, foreignKey: 'songId', otherKey: 'artistId' })
  Song.belongsToMany(Tag, { through: SongTag, foreignKey: 'songId', otherKey: 'tagId' })
  Tag.belongsToMany(Song, { through: SongTag, foreignKey: 'tagId', otherKey: 'songId' })

  await sequelize.authenticate()

  const [revisarArtist] = await Artist.findOrCreate({ where: { name: REVISAR_ARTIST } })
  const [revisarTag] = await Tag.findOrCreate({ where: { name: REVISAR_TAG } })
  console.log(`[restore] Artista "${REVISAR_ARTIST}" → id ${revisarArtist.id}`)
  console.log(`[restore] Tag "${REVISAR_TAG}" → id ${revisarTag.id}`)

  const existingSongs = await Song.findAll({ attributes: ['ytid'] })
  const existingYtids = new Set(existingSongs.map(s => s.ytid))
  console.log(`[restore] Canciones existentes en DB: ${existingYtids.size}`)

  const missingRaw = fs.readFileSync('/tmp/missing_ytids.txt', 'utf-8').trim().split('\n').filter(Boolean)
  const missingYtids = [...new Set(missingRaw.map(y => y.trim()).filter(y => y && !existingYtids.has(y)))]
  console.log(`[restore] Canciones huérfanas a procesar: ${missingYtids.length}`)

  let imported = 0
  let errors = 0
  let skipped = 0

  for (const ytid of missingYtids) {
    console.log(`\n[restore] ▶ ${ytid}`)

    const fileInfo = findSongFile(ytid)
    if (!fileInfo) {
      console.log(`[restore]   ⚠ Archivo no encontrado en disco, se salta`)
      skipped++
      continue
    }

    let meta
    try {
      meta = await runYtDlp(ytid)
    } catch (err) {
      console.log(`[restore]   ⚠ yt-dlp falló: ${err.message.slice(0, 100)}`)
      errors++
      continue
    }

    if (!meta.title) {
      console.log(`[restore]   ⚠ Título vacío, se salta`)
      skipped++
      continue
    }

    const songName = cleanTitle(meta.title)
    if (!songName) {
      console.log(`[restore]   ⚠ Título inválido después de limpiar: "${meta.title}"`)
      skipped++
      continue
    }

    const duration = meta.duration || 0
    const durationOriginal = duration
      ? `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`
      : ''

    try {
      const song = await Song.create({
        folder: fileInfo.folder,
        ytid,
        name: songName,
        duration,
        duration_original: durationOriginal,
        speed: 0,
        start: 0,
        end: 0,
        playCount: 0,
      })

      await song.addArtist(revisarArtist)
      await song.addTag(revisarTag)

      console.log(`[restore]   ✓ "${songName}" (${durationOriginal}) → id ${song.id}, folder ${fileInfo.folder}`)
      imported++
    } catch (err) {
      console.log(`[restore]   ✗ Error al crear: ${err.message}`)
      errors++
    }
  }

  console.log(`\n═══════════════════════════════════`)
  console.log(`[restore] COMPLETADO`)
  console.log(`[restore]   Importadas: ${imported}`)
  console.log(`[restore]   Errores:    ${errors}`)
  console.log(`[restore]   Omitidas:   ${skipped}`)
  console.log(`═══════════════════════════════════`)

  await sequelize.close()
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[restore] Error fatal:', err)
  process.exit(1)
})
