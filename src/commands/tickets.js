const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const stats = require('../handlers/ticketStats');

const period = (o) => o.setName('periodo').setDescription('Período').addChoices(
  { name: 'Últimos 7 dias', value: 7 }, { name: 'Últimos 30 dias', value: 30 }, { name: 'Desde o início', value: 0 });

module.exports = {
  data: new SlashCommandBuilder().setName('tickets').setDescription('🎫 Ranking e estatísticas dos tickets')
    .addSubcommand((s) => s.setName('ranking').setDescription('Quem mais assumiu tickets').addIntegerOption(period))
    .addSubcommand((s) => s.setName('staff').setDescription('Desempenho de um membro da staff')
      .addUserOption((o) => o.setName('membro').setDescription('Membro (padrão: você)')).addIntegerOption(period))
    .addSubcommand((s) => s.setName('apoiadores').setDescription('Quem mais comprou pelos tickets (PIX confirmados)').addIntegerOption(period)),

  async execute(i) {
    const sub = i.options.getSubcommand();
    const days = i.options.getInteger('periodo') ?? (sub === 'apoiadores' ? 0 : 30);
    if (sub === 'ranking') return i.reply(stats.rankingEmbed(i.guild, days));
    if (sub === 'apoiadores') return i.reply(stats.supportersEmbed(i.guild, days));
    if (!(await perms.check(i, 'suporte'))) return;
    await i.reply({ embeds: [stats.staffEmbed(i.guild, i.options.getUser('membro') ?? i.user, days)], flags: MessageFlags.Ephemeral });
  }
};
