const { SlashCommandBuilder } = require('discord.js');
const perms = require('../utils/permissions');
const { modal } = require('../handlers/suggestions');

module.exports = {
  data: new SlashCommandBuilder().setName('sugestao-staff').setDescription('🛠️ Sugestão interna da equipe (só a staff vê)'),
  async execute(interaction) {
    if (!(await perms.check(interaction, 'suporte'))) return;
    await interaction.showModal(modal('ssug'));
  }
};
