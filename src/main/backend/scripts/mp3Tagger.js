const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const { spawn } = require('child_process')

function sanitizeMetadataValue(value) {
  if (value === null || value === undefined) return ''

  return String(value).replace(/\s+/g, ' ')
    .trim()
}

function buildSongMetadata(song) {
  const artists = Array.isArray(song.Artists) ? song.Artists.map((item) => sanitizeMetadataValue(item.name)).filter(Boolean) : []
  const composers = Array.isArray(song.Composers) ? song.Composers.map((item) => sanitizeMetadataValue(item.name)).filter(Boolean) : []
  const rawTags = Array.isArray(song.Tags) ? song.Tags : []
  const sortedTags = rawTags
    .slice()
    .sort((a, b) => {
      const aTime = a?.SongTag?.createdAt ? new Date(a.SongTag.createdAt).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b?.SongTag?.createdAt ? new Date(b.SongTag.createdAt).getTime() : Number.MAX_SAFE_INTEGER

      return aTime - bTime
    })
  const tags = sortedTags
    .map((item) => sanitizeMetadataValue(item.name))
    .filter(Boolean)
    .filter((tagName) => tagName.toLowerCase() !== 'agregado-reciente')
  const title = sanitizeMetadataValue(song.name)
  const createdAtYear = song.createdAt ? new Date(song.createdAt).getUTCFullYear() : ''
  const genre = tags[0] || ''

  const metadata = {
    title,
    artist: artists.join(', '),
    album_artist: artists.join(', '),
    composer: composers.join(', '),
    genre,
    track: sanitizeMetadataValue(song.id),
    date: Number.isFinite(createdAtYear) ? String(createdAtYear) : '',
    comment: [
      `vmusic_song_id=${sanitizeMetadataValue(song.id)}`,
      `ytid=${sanitizeMetadataValue(song.ytid)}`,
      `folder=${sanitizeMetadataValue(song.folder)}`,
      tags.length ? `tags=${tags.join('|')}` : ''
    ].filter(Boolean).join('; ')
  }

  return Object.entries(metadata)
    .filter(([, value]) => sanitizeMetadataValue(value))
    .flatMap(([key, value]) => ['-metadata', `${key}=${sanitizeMetadataValue(value)}`])
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} failed (${code}): ${stderr}`))

        return
      }
      resolve()
    })
  })
}

function getSongFilePath(baseDir, song) {
  const musicDir = process.env.VMUSIC_MUSIC_DIR ? path.resolve(process.env.VMUSIC_MUSIC_DIR) : path.join(baseDir, '_music')

  return path.join(musicDir, String(song.folder).trim(), `${String(song.ytid).trim()}.mp3`)
}

async function tagSongFile({ song, baseDir, filePath }) {
  const targetPath = filePath || getSongFilePath(baseDir, song)
  const tempPath = `${targetPath}.tmp-tag-${Date.now()}.mp3`
  const metadataArgs = buildSongMetadata(song)

  const ffmpegArgs = [
    '-y',
    '-i',
    targetPath,
    '-map',
    '0:a:0',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-c',
    'copy',
    '-id3v2_version',
    '3',
    '-write_id3v1',
    '1',
    ...metadataArgs,
    tempPath
  ]

  await runCommand('ffmpeg', ffmpegArgs)
  await fsp.rename(tempPath, targetPath)
}

async function loadSongWithRelations(db, songId) {
  return db.Song.findByPk(songId, {
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
    ]
  })
}

async function tagSongFileById({ db, baseDir, songId, filePath }) {
  const song = await loadSongWithRelations(db, songId)
  if (!song) {
    throw new Error(`No existe la canción con id ${songId}`)
  }

  await tagSongFile({ song, baseDir, filePath })

  return song
}

module.exports = {
  buildSongMetadata,
  getSongFilePath,
  loadSongWithRelations,
  tagSongFile,
  tagSongFileById
}
