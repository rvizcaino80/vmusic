'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface
      .createTable('PlaylistSongs', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        playlistId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Playlists',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
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
        order: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      })
      .then(() => {
        return queryInterface.sequelize.query(
          `CREATE INDEX playlist_song_order_index ON PlaylistSongs (playlistId, order)`
        )
      })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PlaylistSongs')
  }
}
