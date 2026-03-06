'use strict'
const {
  Model
} = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Composer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
    }
  }
  Composer.init({
    name: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Composer',
    tableName: 'Artists'
  })

  return Composer
}
