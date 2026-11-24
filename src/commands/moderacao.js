const {
  SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const mod = require('../handlers/moderation');
const { base, success, error, e } = require('../utils/embeds');
const { parseDuration, ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const memberOpt = (o) => o.setName('membro').setDescription('Membro').setRequired(true);
const reasonOpt = (req = false) => (o) => o.setName('motivo').setDescription('Motivo').setRequired(req).setMaxLength(500);

/** Executa punição a partir de um slash command */
async function run(i, type, { duration = null, deleteDays = 0, reason } = {}) {
  const user = i.options.getUser('membro');
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  const err = mod.canPunish(i.member, member, type);
  if (err) return i.reply({ embeds: [err], flags: EPH });
  if (['warn', 'timeout', 'kick'].includes(type) && !member) return i.reply({ embeds: [error('Esse usuário não está no servidor.')], flags: EPH });
  if ((type === 'kick' && !member.kickable) || (type === 'ban' && member && !member.bannable) || (type === 'timeout' && !member.moderatable)) {
    return i.reply({ embeds: [error('Meu cargo está abaixo desse membro — não consigo aplicar.')], flags: EPH });
  }
  await i.deferReply();
  const r = await mod.punish(i.guild, {
    type, user, member, mod: i.member, duration, deleteDays,
    reason: reason ?? i.options.getString('motivo') ?? 'Não informado'
  });
  await i.editReply({ embeds: [r.embed] });
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('mod').setDescription('🛡️ Abre a ficha de moderação de um membro (com botões)')
      .addUserOption(memberOpt),
    async execute(i) {
      if (!(await perms.check(i, 'suporte'))) return;
      await i.reply({ ...(await mod.profile(i.guild, i.options.getUser('membro'))), flags: EPH });
    }
  },
  {
    data: new ContextMenuCommandBuilder().setName('Ficha de moderação').setType(ApplicationCommandType.User),
    async execute(i) {
      if (!(await perms.check(i, 'suporte'))) return;
      await i.reply({ ...(await mod.profile(i.guild, i.targetUser)), flags: EPH });
    }
  },
  {
    data: new ContextMenuCommandBuilder().setName('Denunciar mensagem').setType(ApplicationCommandType.Message),
    async execute(i) {
      if (i.targetMessage.author.bot) return i.reply({ embeds: [error('Não dá para denunciar mensagens de bots.')], flags: EPH });
      await i.showModal(mod.reportModal(i.channelId, i.targetMessage.id));
    }
  },
  {
    data: new SlashCommandBuilder().setName('banir').setDescription('🔨 Bane um membro (permanente ou temporário)')
      .addUserOption(memberOpt).addStringOption(reasonOpt(true))
      .addStringOption((o) => o.setName('duracao').setDescription('Ex: 7d, 12h — vazio = permanente'))
      .addIntegerOption((o) => o.setName('apagar_dias').setDescription('Apagar mensagens dos últimos X dias').setMinValue(0).setMaxValue(7)),
    async execute(i) {
      const raw = i.options.getString('duracao');
      const duration = raw ? parseDuration(raw) : null;
      if (raw && !duration) return i.reply({ embeds: [error('Duração inválida. Ex: `7d`, `12h`.')], flags: EPH });
      await run(i, 'ban', { duration, deleteDays: i.options.getInteger('apagar_dias') ?? 0 });
    }
  },
  {
    data: new SlashCommandBuilder().setName('desbanir').setDescription('✅ Remove o banimento de alguém')
      .addStringOption((o) => o.setName('usuario').setDescription('Usuário banido').setRequired(true).setAutocomplete(true))
      .addStringOption(reasonOpt()),
    async autocomplete(i) {
      const q = i.options.getFocused().toLowerCase();
      const bans = await i.guild.bans.fetch().catch(() => null);
      await i.respond([...(bans?.values() ?? [])].filter((b) => b.user.username.toLowerCase().includes(q) || b.user.id.includes(q))
        .slice(0, 25).map((b) => ({ name: `${b.user.username} (${b.user.id})`, value: b.user.id })));
    },
    async execute(i) {
      if (!(await perms.check(i, 'admin'))) return;
      const ban = await i.guild.bans.fetch(i.options.getString('usuario')).catch(() => null);
      if (!ban) return i.reply({ embeds: [error('Esse usuário não está banido.')], flags: EPH });
      await i.deferReply();
      const r = await mod.punish(i.guild, { type: 'unban', user: ban.user, mod: i.member, reason: i.options.getString('motivo') ?? 'Não informado' });
      await i.editReply({ embeds: [r.embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('expulsar').setDescription('🚪 Expulsa um membro')
      .addUserOption(memberOpt).addStringOption(reasonOpt(true)),
    execute: (i) => run(i, 'kick')
  },
  {
    data: new SlashCommandBuilder().setName('castigo').setDescription('🔇 Silencia um membro por um tempo')
      .addUserOption(memberOpt)
      .addStringOption((o) => o.setName('duracao').setDescription('Ex: 10m, 2h, 1d (máx 28d)').setRequired(true))
      .addStringOption(reasonOpt()),
    async execute(i) {
      const duration = parseDuration(i.options.getString('duracao'));
      if (!duration) return i.reply({ embeds: [error('Duração inválida. Ex: `10m`, `2h`, `1d`.')], flags: EPH });
      await run(i, 'timeout', { duration });
    }
  },
  {
    data: new SlashCommandBuilder().setName('aviso').setDescription('⚠️ Sistema de avisos')
      .addSubcommand((s) => s.setName('dar').setDescription('Dá um aviso').addUserOption(memberOpt).addStringOption(reasonOpt(true)))
      .addSubcommand((s) => s.setName('ver').setDescription('Histórico do membro').addUserOption(memberOpt))
      .addSubcommand((s) => s.setName('limpar').setDescription('Expira todos os avisos ativos').addUserOption(memberOpt)),
    async execute(i) {
      const sub = i.options.getSubcommand();
      if (sub === 'dar') return run(i, 'warn');
      if (!(await perms.check(i, 'moderador'))) return;
      const user = i.options.getUser('membro');
      if (sub === 'ver') return i.reply({ ...mod.history(i.guild, user, 0), flags: EPH });
      for (const c of mod.userCases(i.guild.id, user.id)) if (c.type === 'warn') c.active = false;
      db.save();
      await i.reply({ embeds: [success(`Avisos de ${user} foram limpos.`)], flags: EPH });
    }
  },
  {
    data: new SlashCommandBuilder().setName('caso').setDescription('📁 Gerencia casos de moderação')
      .addSubcommand((s) => s.setName('ver').setDescription('Ver um caso').addIntegerOption((o) => o.setName('numero').setDescription('Nº do caso').setRequired(true)))
      .addSubcommand((s) => s.setName('motivo').setDescription('Editar o motivo de um caso')
        .addIntegerOption((o) => o.setName('numero').setDescription('Nº do caso').setRequired(true))
        .addStringOption((o) => o.setName('texto').setDescription('Novo motivo').setRequired(true).setMaxLength(500)))
      .addSubcommand((s) => s.setName('anular').setDescription('Anula um aviso (deixa de contar)')
        .addIntegerOption((o) => o.setName('numero').setDescription('Nº do caso').setRequired(true))),
    async execute(i) {
      if (!(await perms.check(i, 'moderador'))) return;
      const c = db.guild(i.guild.id).cases[i.options.getInteger('numero')];
      if (!c) return i.reply({ embeds: [error('Caso não encontrado.')], flags: EPH });
      const user = await i.client.users.fetch(c.userId);
      const sub = i.options.getSubcommand();
      if (sub === 'motivo') { c.reason = i.options.getString('texto'); c.editedBy = i.user.id; }
      if (sub === 'anular') c.active = false;
      db.save();
      const embed = mod.caseEmbed(c, user);
      if (!c.active && c.type === 'warn') embed.addFields({ name: '​', value: `${e.cross} *Aviso anulado/expirado*` });
      await i.reply({ embeds: [embed], flags: EPH });
    }
  },
  {
    data: new SlashCommandBuilder().setName('modstats').setDescription('📊 Ranking de atuação da staff')
      .addIntegerOption((o) => o.setName('dias').setDescription('Período (padrão 30)').setMinValue(1).setMaxValue(365)),
    async execute(i) {
      if (!(await perms.check(i, 'admin'))) return;
      const days = i.options.getInteger('dias') ?? 30;
      const since = Date.now() - days * 864e5;
      const stats = {};
      for (const c of Object.values(db.guild(i.guild.id).cases)) {
        if (c.at < since || c.auto) continue;
        stats[c.modId] ??= { total: 0 };
        stats[c.modId].total++;
        stats[c.modId][c.type] = (stats[c.modId][c.type] ?? 0) + 1;
      }
      const list = Object.entries(stats).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
      const medals = ['🥇', '🥈', '🥉'];
      const embed = base().setTitle(`${e.trophy} Atuação da staff — últimos ${days} dias`)
        .setDescription(list.map(([id, s], n) => `${medals[n] ?? `\`#${n + 1}\``} <@${id}> — **${s.total}** ações\n` +
          `${e.dot} ${Object.entries(s).filter(([k]) => k !== 'total').map(([k, v]) => `${mod.TYPES[k].label}: ${v}`).join(' • ')}`).join('\n\n')
          || 'Nenhuma ação registrada nesse período.');
      await i.reply({ embeds: [embed] });
    }
  }
];
