const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { helpMessage } = require('../handlers/panels');

module.exports = {
  data: new SlashCommandBuilder().setName('ajuda').setDescription('📖 Lista de comandos do bot'),
  execute: (interaction) => interaction.reply({ ...helpMessage('geral'), flags: MessageFlags.Ephemeral })
};
