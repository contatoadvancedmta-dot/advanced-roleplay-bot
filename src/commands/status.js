const { SlashCommandBuilder } = require('discord.js');
const fivem = require('../handlers/fivem');

module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('🖥️ Status da cidade e jogadores online'),
  async execute(i) {
    await i.deferReply();
    await i.editReply(fivem.statusMessage(await fivem.fetchStatus()));
  }
};
