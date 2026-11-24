const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../../config');
const perms = require('../utils/permissions');
const { base, success, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

const chOpt = (o) => o.setName('canal').setDescription('Canal (padrão: aqui)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

async function setLock(i, locked) {
  if (!(await perms.check(i, 'moderador'))) return;
  const ch = i.options.getChannel('canal') ?? i.channel;
  const reason = i.options.getString('motivo');
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: locked ? false : null }, { reason: `${locked ? 'Trancado' : 'Destrancado'} por ${i.user.tag}` });
  await ch.send({ embeds: [base(locked ? config.colors.error : config.colors.success)
    .setTitle(locked ? `${e.lock} Canal trancado` : `${e.check} Canal liberado`)
    .setDescription(`${locked ? 'Ninguém pode enviar mensagens por enquanto.' : 'Podem voltar a conversar!'}${reason ? `\n${e.log} ${reason}` : ''}`)] });
  sendLog(i.guild, base().setDescription(`${locked ? e.lock : e.check} ${i.user} ${locked ? 'trancou' : 'destrancou'} ${ch}`));
  await i.reply({ embeds: [success(`${ch} ${locked ? 'trancado' : 'destrancado'}.`)], flags: MessageFlags.Ephemeral });
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('trancar').setDescription('🔒 Tranca um canal')
      .addChannelOption(chOpt).addStringOption((o) => o.setName('motivo').setDescription('Motivo')),
    execute: (i) => setLock(i, true)
  },
  {
    data: new SlashCommandBuilder().setName('destrancar').setDescription('🔓 Destranca um canal')
      .addChannelOption(chOpt).addStringOption((o) => o.setName('motivo').setDescription('Motivo')),
    execute: (i) => setLock(i, false)
  },
  {
    data: new SlashCommandBuilder().setName('modolento').setDescription('🐢 Ativa o modo lento')
      .addIntegerOption((o) => o.setName('segundos').setDescription('0 = desligar').setMinValue(0).setMaxValue(21600).setRequired(true))
      .addChannelOption(chOpt),
    async execute(i) {
      if (!(await perms.check(i, 'moderador'))) return;
      const ch = i.options.getChannel('canal') ?? i.channel;
      const s = i.options.getInteger('segundos');
      await ch.setRateLimitPerUser(s, `Modo lento por ${i.user.tag}`);
      await i.reply({ embeds: [success(s ? `Modo lento de **${s}s** ativado em ${ch}.` : `Modo lento desligado em ${ch}.`)], flags: MessageFlags.Ephemeral });
    }
  }
];
