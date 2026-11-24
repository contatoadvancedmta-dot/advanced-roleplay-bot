const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const { success, base, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder().setName('limpar').setDescription('🗑️ Apaga mensagens do canal')
    .addIntegerOption((o) => o.setName('quantidade').setDescription('1 a 100').setMinValue(1).setMaxValue(100).setRequired(true)),
  async execute(interaction) {
    if (!(await perms.check(interaction, 'moderador'))) return;
    const n = interaction.options.getInteger('quantidade');
    const deleted = await interaction.channel.bulkDelete(n, true);
    await interaction.reply({ embeds: [success(`${e.trash} **${deleted.size}** mensagens apagadas.`)], flags: MessageFlags.Ephemeral });
    sendLog(interaction.guild, base().setTitle(`${e.trash} Limpeza de chat`)
      .setDescription(`${interaction.user} apagou **${deleted.size}** mensagens em ${interaction.channel}`));
  }
};
