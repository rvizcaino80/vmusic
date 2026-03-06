'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Songs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ytid: {
        type: Sequelize.STRING
      },
      folder: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      duration: {
        type: Sequelize.INTEGER
      },
      start: {
        type: Sequelize.INTEGER
      },
      end: {
        type: Sequelize.INTEGER
      },
      speed: {
        type: Sequelize.INTEGER,
        unsigned: true,
        defaultValue: 0
      },
      duration_original: {
        type: Sequelize.STRING
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Songs')
  }
}
