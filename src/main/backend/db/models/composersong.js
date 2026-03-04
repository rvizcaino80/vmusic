'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ComposerSong extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }
    ComposerSong.init({
        composerId: DataTypes.INTEGER,
        songId: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'ComposerSong',
        tableName: 'ComposerSong'
    });
    return ComposerSong;
};