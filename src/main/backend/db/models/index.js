'use strict'

const path = require('path')
const process = require('process')
const dayjs = require('dayjs')
const Sequelize = require('sequelize')
const { Model } = Sequelize

const db = {}
const projectRoot = process.cwd()
const sqliteStoragePath = path.resolve(projectRoot, 'src/main/backend/db/vmusic.sqlite')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqliteStoragePath,
  logging: false
})

class Artist extends Model {}
Artist.init({
  name: Sequelize.DataTypes.STRING
}, {
  sequelize,
  modelName: 'Artist'
})

class ArtistSong extends Model {}
ArtistSong.init({
  artistId: Sequelize.DataTypes.INTEGER,
  songId: Sequelize.DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'ArtistSong',
  tableName: 'ArtistSong'
})

class Composer extends Model {}
Composer.init({
  name: Sequelize.DataTypes.STRING
}, {
  sequelize,
  modelName: 'Composer',
  tableName: 'Artists'
})

class ComposerSong extends Model {}
ComposerSong.init({
  composerId: Sequelize.DataTypes.INTEGER,
  songId: Sequelize.DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'ComposerSong',
  tableName: 'ComposerSong'
})

class Song extends Model {}
Song.init({
  folder: Sequelize.DataTypes.STRING,
  ytid: Sequelize.DataTypes.STRING,
  name: Sequelize.DataTypes.STRING,
  speed: Sequelize.DataTypes.INTEGER,
  duration: Sequelize.DataTypes.INTEGER,
  start: Sequelize.DataTypes.INTEGER,
  end: Sequelize.DataTypes.INTEGER,
  duration_original: Sequelize.DataTypes.STRING,
  timestamp: {
    type: Sequelize.DataTypes.VIRTUAL,
    get() {
      return dayjs(this.createdAt).valueOf()
    },
    set() {
      throw new Error('Do not try to set the `timestamp` value!')
    }
  },
  isAppleMusic: {
    type: Sequelize.DataTypes.VIRTUAL,
    get() {
      return !isNaN(parseFloat(this.ytid)) && isFinite(this.ytid)
    },
    set() {
      throw new Error('Do not try to set the `isAppleMusic` value!')
    }
  }
}, {
  sequelize,
  modelName: 'Song'
})

class SongTag extends Model {}
SongTag.init({
  songId: Sequelize.DataTypes.INTEGER,
  tagId: Sequelize.DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'SongTag'
})

class Tag extends Model {}
Tag.init({
  name: Sequelize.DataTypes.STRING
}, {
  sequelize,
  modelName: 'Tag'
})

db.Artist = Artist
db.ArtistSong = ArtistSong
db.Composer = Composer
db.ComposerSong = ComposerSong
db.Song = Song
db.SongTag = SongTag
db.Tag = Tag

db.Song.belongsToMany(db.Tag, { through: db.SongTag })
db.Tag.belongsToMany(db.Song, { through: db.SongTag })
db.Artist.belongsToMany(db.Song, { through: db.ArtistSong })
db.Song.belongsToMany(db.Artist, { through: db.ArtistSong })
db.Composer.belongsToMany(db.Song, { through: db.ComposerSong })
db.Song.belongsToMany(db.Composer, { through: db.ComposerSong })

db.sequelize = sequelize
db.Sequelize = Sequelize

exports.Artist = Artist
exports.ArtistSong = ArtistSong
exports.Composer = Composer
exports.ComposerSong = ComposerSong
exports.Song = Song
exports.SongTag = SongTag
exports.Tag = Tag
exports.sequelize = sequelize
exports.Sequelize = Sequelize
exports.default = db
module.exports = db
