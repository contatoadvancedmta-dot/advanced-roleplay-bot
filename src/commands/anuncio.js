const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const ann = require('../handlers/announce');
const { base, success, error, e } = require('../utils/embeds');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;

module.exports = {
  data: new SlashCommandBuilder().setName('anuncio').setDescription('📢 Sistema de anúncios')
    .addSubcommand((s) => s.setName('criar').setDescription('Abre o construtor de anúncio com prévia')
      .addStringOption((o) => o.setName('modelo').setDescription('Começar de um modelo pronto')
        .addChoices(...Object.entries(config.announceTemplates).map(([value, t]) => ({ name: t.label, value }))))
      .addChannelOption((o) => o.setName('canal').setDescription('Canal (padrão: canal de anúncios)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((s) => s.setName('agendados').setDescription('Lista os anúncios agendados'))
    .addSubcommand((s) => s.setName('cancelar').setDescription('Cancela um anúncio agendado')
      .addIntegerOption((o) => o.setName('id').setDescription('Número do agendamento').setRequired(true))),

  async execute(i) {
    if (!(await perms.check(i, 'admin'))) return;
    const sub = i.options.getSubcommand();
    const g = db.guild(i.guild.id);

    if (sub === 'criar') {
      const d = ann.newDraft(i, i.options.getString('modelo') ?? 'livre', i.options.getChannel('canal')?.id);
      return i.showModal(ann.textModal(d));
    }
    if (sub === 'agendados') {
      const list = Object.values(g.scheduled).sort((a, b) => a.at - b.at);
      return i.reply({ embeds: [base().setTitle(`${e.clock} Anúncios agendados`)
        .setDescription(list.map((s) => `**#${s.id}** • ${s.draft.title}\n${e.arrow} <#${s.draft.channelId}> • ${ts(s.at, 'f')} (${ts(s.at)}) • por <@${s.by}>`).join('\n\n') || 'Nenhum anúncio agendado.')], flags: EPH });
    }
    const id = i.options.getInteger('id');
    if (!g.scheduled[id]) return i.reply({ embeds: [error('Agendamento não encontrado.')], flags: EPH });
    delete g.scheduled[id];
    db.save();
    await i.reply({ embeds: [success(`Anúncio agendado **#${id}** cancelado.`)], flags: EPH });
  }
};
