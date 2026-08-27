'use strict'
const dayjs = require('dayjs')
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Song extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {}
  }
  Song.init({
    cantante: DataTypes.STRING,
    folder: DataTypes.STRING,
    ytid: DataTypes.STRING,
    name: DataTypes.STRING,
    speed: DataTypes.INTEGER,
    duration: DataTypes.INTEGER,
    start: DataTypes.INTEGER,
    end: DataTypes.INTEGER,
    duration_original: DataTypes.STRING,
    playCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    timestamp: {
      type: DataTypes.VIRTUAL,
      get() {
        return dayjs(this.createdAt).valueOf()
      },
      set(value) {
        throw new Error('Do not try to set the `fullName` value!')
      }
    },
    isAppleMusic: {
      type: DataTypes.VIRTUAL,
      get() {
        return !isNaN(parseFloat(this.ytid)) && isFinite(this.ytid)
      },
      set(value) {
        throw new Error('Do not try to set the `fullName` value!')
      }
    }
  },
  {
    sequelize,
    modelName: 'Song'
  })

  return Song
}
