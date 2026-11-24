const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const db = require('../database');
const perms = require('../utils/permissions');
const gw = require('../handlers/giveaways');
const { success, error } = require('../utils/embeds');

const EPH = MessageFlags.Ephemeral;
const idOpt = (o) => o.setName('id').setDescription('Número do sorteio').setRequired(true);

module.exports = {
  data: new SlashCommandBuilder().setName('sorteio').setDescription('🎁 Sistema de sorteios')
    .addSubcommand((s) => s.setName('criar').setDescription('Cria um sorteio com botão de participar')
      .addStringOption((o) => o.setName('premio').setDescription('Prêmio (ex: VIP Ouro 30 dias)').setRequired(true).setMaxLength(100))
      .addStringOption((o) => o.setName('duracao').setDescription('Ex: 30m, 2h, 1d').setRequired(true))
      .addIntegerOption((o) => o.setName('vencedores').setDescription('Quantidade de vencedores').setMinValue(1).setMaxValue(20))
      .addChannelOption((o) => o.setName('canal').setDescription('Canal (padrão: aqui)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addRoleOption((o) => o.setName('requisito').setDescription('Cargo necessário para participar'))
      .addStringOption((o) => o.setName('descricao').setDescription('Texto extra').setMaxLength(500)))
    .addSubcommand((s) => s.setName('encerrar').setDescription('Encerra agora').addIntegerOption(idOpt))
    .addSubcommand((s) => s.setName('resortear').setDescription('Sorteia novos vencedores').addIntegerOption(idOpt)),

  async execute(i) {
    if (!(await perms.check(i, 'admin'))) return;
    const sub = i.options.getSubcommand();

    if (sub === 'criar') {
      const ms = gw.parseDuration(i.options.getString('duracao'));
      if (!ms) return i.reply({ embeds: [error('Duração inválida. Use por exemplo `30m`, `2h` ou `1d`.')], flags: EPH });
      const channel = i.options.getChannel('canal') ?? i.channel;
      const created = await gw.create(i, {
        prize: i.options.getString('premio'), ms,
        winnersCount: i.options.getInteger('vencedores') ?? 1,
        channel, description: i.options.getString('descricao'), role: i.options.getRole('requisito')?.id
      });
      return i.reply({ embeds: [success(`Sorteio **#${created.id}** criado em ${channel}.`)], flags: EPH });
    }

    const g = db.guild(i.guild.id);
    const item = g.giveaways[i.options.getInteger('id')];
    if (!item) return i.reply({ embeds: [error('Sorteio não encontrado.')], flags: EPH });
    if (sub === 'encerrar' && item.ended) return i.reply({ embeds: [error('Esse sorteio já acabou.')], flags: EPH });
    if (sub === 'resortear' && !item.ended) return i.reply({ embeds: [error('Esse sorteio ainda não acabou.')], flags: EPH });
    await gw.end(i.client, i.guild.id, item, sub === 'resortear');
    await i.reply({ embeds: [success(`Sorteio **#${item.id}** ${sub === 'encerrar' ? 'encerrado' : 'resorteado'}.`)], flags: EPH });
  }
};
