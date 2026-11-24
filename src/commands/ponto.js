const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const ponto = require('../handlers/ponto');
const { success, error } = require('../utils/embeds');

const period = (o) => o.setName('periodo').setDescription('Período').addChoices(
  { name: 'Últimos 7 dias', value: 7 }, { name: 'Últimos 30 dias', value: 30 }, { name: 'Desde o início', value: 0 });

module.exports = {
  data: new SlashCommandBuilder().setName('ponto').setDescription('⏰ Bate-ponto da staff')
    .addSubcommand((s) => s.setName('ranking').setDescription('Ranking de horas da staff').addIntegerOption(period))
    .addSubcommand((s) => s.setName('ver').setDescription('Horas de um membro da staff').addUserOption((o) => o.setName('membro').setDescription('Membro (padrão: você)')))
    .addSubcommand((s) => s.setName('fechar').setDescription('Fecha o ponto de alguém que esqueceu (Admin)').addUserOption((o) => o.setName('membro').setDescription('Membro').setRequired(true))),
  async execute(i) {
    if (!(await perms.check(i, 'suporte'))) return;
    const sub = i.options.getSubcommand();
    if (sub === 'ranking') return i.reply(ponto.rankingEmbed(i.guild, i.options.getInteger('periodo') ?? 7));
    if (sub === 'ver') return i.reply({ embeds: [ponto.myEmbed(i.guild.id, i.options.getUser('membro') ?? i.user)], flags: MessageFlags.Ephemeral });
    if (!(await perms.check(i, 'admin'))) return;
    const user = i.options.getUser('membro');
    const ms = ponto.closeSession(i.guild.id, user.id);
    if (ms == null) return i.reply({ embeds: [error(`${user} não está em serviço.`)], flags: MessageFlags.Ephemeral });
    await ponto.refreshPanels(i.guild);
    await i.reply({ embeds: [success(`Ponto de ${user} fechado (${ponto.hours(ms)}).`)], flags: MessageFlags.Ephemeral });
  }
};
