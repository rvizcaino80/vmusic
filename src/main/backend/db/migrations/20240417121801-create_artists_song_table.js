'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.createTable('ArtistSong', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      songId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Songs',
          key: 'id'
        },
        onUpdate: 'cascade',
        onDelete: 'cascade'
      },
      artistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Artists',
          key: 'id'
        },
        onUpdate: 'cascade',
        onDelete: 'cascade'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(() => {
      // Create Unique CompoundIndex
      let sql = `CREATE UNIQUE INDEX artist_song_index ON ArtistSong (artistId, songId)`

      return queryInterface.sequelize.query(sql, { raw: true })
    })
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.dropTable('ArtistSong')
  }
}
