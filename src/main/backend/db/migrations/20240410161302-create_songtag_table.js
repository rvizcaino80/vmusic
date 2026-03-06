'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.createTable('SongTags', {
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
      tagId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Tags',
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
      let sql = `CREATE UNIQUE INDEX song_tag_index ON SongTags (songId, tagId)`

      return queryInterface.sequelize.query(sql, { raw: true })
    })
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.dropTable('SongTags')
  }
}
