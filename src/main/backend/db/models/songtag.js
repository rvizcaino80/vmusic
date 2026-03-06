'use strict'
const {
  Model
} = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class SongTag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SongTag.init({
    songId: DataTypes.INTEGER,
    tagId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'SongTag'
  })

  return SongTag
}
