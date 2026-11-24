const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const control = require('../handlers/control');

module.exports = {
  data: new SlashCommandBuilder().setName('central').setDescription('🎛️ Central de Controle — configure tudo por botões'),
  async execute(i) {
    if (!(await perms.check(i, 'admin'))) return;
    await i.reply({ ...control.home(i.guild), flags: MessageFlags.Ephemeral });
  }
};
