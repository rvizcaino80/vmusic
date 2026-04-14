'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Songs', 'playCount', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    })

    // Inicializar playCount en 0 para todas las canciones existentes
    await queryInterface.sequelize.query('UPDATE Songs SET playCount = 0 WHERE playCount IS NULL')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Songs', 'playCount')
  }
}
