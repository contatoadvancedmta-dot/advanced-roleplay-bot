const { SlashCommandBuilder } = require('discord.js');
const { modal } = require('../handlers/suggestions');

module.exports = {
  data: new SlashCommandBuilder().setName('sugestao').setDescription('💡 Envie uma sugestão para o Advanced'),
  execute: (interaction) => interaction.showModal(modal())
};
