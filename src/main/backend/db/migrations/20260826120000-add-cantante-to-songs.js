'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Songs', 'cantante', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    })
    await queryInterface.sequelize.query('UPDATE Songs SET cantante = NULL WHERE cantante IS NOT NULL')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Songs', 'cantante')
  }
}
