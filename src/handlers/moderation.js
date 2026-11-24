/**
 * MODERAÇÃO MODERNA
 * - Casos numerados (#1, #2...) com histórico
 * - Ficha do membro com botões (avisar, castigar, expulsar, banir, anotação...)
 * - Ban temporário com desban automático
 * - Recurso de banimento pela DM
 * - Denúncia de mensagens (clique direito)
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { parseDuration, formatDuration, ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const C = config.colors;

const TYPES = {
  warn: { label: 'Aviso', past: 'advertido(a)', emoji: 'alert', color: C.warning, level: 'moderador' },
  timeout: { label: 'Castigo', past: 'castigado(a)', emoji: 'mute', color: C.warning, level: 'moderador' },
  untimeout: { label: 'Castigo removido', past: 'liberado(a) do castigo', emoji: 'check', color: C.success, level: 'moderador' },
  kick: { label: 'Expulsão', past: 'expulso(a)', emoji: 'leave', color: C.error, level: 'moderador' },
  ban: { label: 'Banimento', past: 'banido(a)', emoji: 'ban', color: C.error, level: 'admin' },
  unban: { label: 'Desbanimento', past: 'desbanido(a)', emoji: 'verify', color: C.success, level: 'admin' },
  note: { label: 'Anotação', past: 'anotado(a)', emoji: 'log', color: C.info, level: 'suporte' }
};
const em = (type) => config.emojis[TYPES[type].emoji];

/* ───────────── Casos ───────────── */

function userCases(guildId, userId) {
  return Object.values(db.guild(guildId).cases).filter((c) => c.userId === userId).sort((a, b) => b.id - a.id);
}
const activeWarns = (guildId, userId) => userCases(guildId, userId).filter((c) => c.type === 'warn' && c.active).length;

function createCase(guild, data) {
  const g = db.guild(guild.id);
  const c = { id: ++g.caseCounter, at: Date.now(), active: true, ...data };
  g.cases[c.id] = c;
  db.save();
  return c;
}

function caseEmbed(c, user) {
  const t = TYPES[c.type];
  const embed = base(t.color)
    .setAuthor({ name: `${user.username} foi ${t.past}`, iconURL: user.displayAvatarURL() })
    .setTitle(`${em(c.type)} ${t.label} • Caso #${c.id}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: `${e.user} Membro`, value: `<@${c.userId}>\n\`${c.userId}\``, inline: true },
      { name: `${e.staff} Staff`, value: c.auto ? `${e.shield} AutoMod` : `<@${c.modId}>`, inline: true },
      { name: `${e.clock} Quando`, value: ts(c.at), inline: true },
      { name: `${e.log} Motivo`, value: c.reason || 'Não informado' }
    );
  if (c.duration) embed.addFields({ name: `${e.pending} Duração`, value: `**${formatDuration(c.duration)}** • termina ${ts(c.at + c.duration)}` });
  if (c.extra) embed.addFields({ name: '​', value: c.extra });
  return embed;
}

/* ───────────── Ações ───────────── */

/** Retorna embed de erro se o executor não puder agir no alvo */
function canPunish(executor, target, type) {
  if (!perms.hasLevel(executor, TYPES[type].level)) return error(`Você precisa ser **${config.levels[TYPES[type].level].label}** ou superior.`, 'Sem permissão');
  if (!target) return null; // usuário fora do servidor (ban por ID / desban / anotação)
  if (target.id === executor.id) return error('Você não pode usar isso em si mesmo.');
  if (target.user.bot) return error('Não é possível punir bots.');
  if (perms.weight(target) >= perms.weight(executor)) return error('Você não pode punir alguém do mesmo nível ou superior.');
  return null;
}

async function dm(guild, user, c) {
  if (c.type === 'note') return;
  const t = TYPES[c.type];
  const embed = base(t.color)
    .setTitle(`${em(c.type)} Você foi ${t.past} no ${guild.name}`)
    .setThumbnail(guild.iconURL() ?? config.brand.logo)
    .addFields({ name: `${e.log} Motivo`, value: c.reason || 'Não informado' }, { name: 'Caso', value: `#${c.id}`, inline: true });
  if (c.duration) embed.addFields({ name: `${e.pending} Duração`, value: `${formatDuration(c.duration)} • termina ${ts(c.at + c.duration)}`, inline: true });

  const g = db.guild(guild.id);
  const components = c.type === 'ban' && config.moderation.appeals && g.channels.recursos
    ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`appeal:open:${guild.id}`)
        .setLabel('Recorrer banimento').setEmoji(e.whitelist).setStyle(ButtonStyle.Primary))]
    : [];
  await user.send({ embeds: [embed], components }).catch(() => null);
}

/**
 * Executa uma punição completa: ação no Discord + caso + DM + logs + canal de punições
 * @returns {Promise<{case, embed}>}
 */
async function punish(guild, { type, user, member, mod, reason, duration, auto = false, deleteDays = 0 }) {
  const g = db.guild(guild.id);
  const by = auto ? 'AutoMod' : mod.user?.tag ?? mod.tag;
  const auditReason = `${reason || 'Sem motivo'} — ${by}`;
  if (type === 'timeout') duration = Math.min(duration || 6e5, 28 * 864e5);

  const c = createCase(guild, { type, userId: user.id, modId: auto ? guild.client.user.id : mod.id, reason, duration: duration || null, auto });

  // DM antes de expulsar/banir (depois não dá mais para mandar)
  await dm(guild, user, c);

  if (type === 'timeout') await member.timeout(duration, auditReason);
  if (type === 'untimeout') await member.timeout(null, auditReason);
  if (type === 'kick') await member.kick(auditReason);
  if (type === 'ban') {
    await guild.members.ban(user.id, { reason: auditReason, deleteMessageSeconds: deleteDays * 86400 });
    if (duration) g.tempbans[user.id] = { expiresAt: Date.now() + duration, caseId: c.id };
    else delete g.tempbans[user.id];
  }
  if (type === 'unban') {
    await guild.members.unban(user.id, auditReason);
    delete g.tempbans[user.id];
  }

  // Avisos acumulados = castigo automático
  if (type === 'warn' && member) {
    const n = activeWarns(guild.id, user.id);
    const { warnLimit, warnPunishMinutes } = config.moderation;
    c.extra = `${e.warn} Avisos ativos: **${n}/${warnLimit}**`;
    if (warnLimit && n >= warnLimit) {
      for (const w of userCases(guild.id, user.id)) if (w.type === 'warn') w.active = false;
      c.extra += `\n${e.mute} Limite atingido — castigo automático de **${warnPunishMinutes} min**.`;
      await punish(guild, { type: 'timeout', user, member, auto: true, reason: `Atingiu ${warnLimit} avisos`, duration: warnPunishMinutes * 6e4 }).catch(() => null);
    }
  }
  db.save();

  const embed = caseEmbed(c, user);
  sendLog(guild, caseEmbed(c, user));
  const pub = g.channels.punicoes && guild.channels.cache.get(g.channels.punicoes);
  if (pub && type !== 'note') pub.send({ embeds: [caseEmbed(c, user)] }).catch(() => null);
  return { case: c, embed };
}

/** Desbane quem tinha ban temporário vencido (chamado a cada 30s) */
async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const g = db.guild(guild.id);
    for (const [userId, tb] of Object.entries(g.tempbans)) {
      if (tb.expiresAt > Date.now()) continue;
      delete g.tempbans[userId];
      db.save();
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) await punish(guild, { type: 'unban', user, auto: true, reason: `Fim do ban temporário (caso #${tb.caseId})` }).catch(() => null);
    }
  }
}

/* ───────────── Ficha do membro ───────────── */

async function profile(guild, user) {
  const member = await guild.members.fetch(user.id).catch(() => null);
  const cases = userCases(guild.id, user.id);
  const count = (t) => cases.filter((c) => c.type === t).length;
  const banned = !member && (await guild.bans.fetch(user.id).catch(() => null));

  let status = `${e.approved} Normal`;
  if (banned) status = `${e.ban} **Banido**${db.guild(guild.id).tempbans[user.id] ? ` • sai ${ts(db.guild(guild.id).tempbans[user.id].expiresAt)}` : ''}`;
  else if (!member) status = `${e.leave} Fora do servidor`;
  else if (member.communicationDisabledUntilTimestamp > Date.now()) status = `${e.mute} Castigado até ${ts(member.communicationDisabledUntilTimestamp)}`;

  const flagNew = Date.now() - user.createdTimestamp < config.antiraid.minAccountDays * 864e5;
  const embed = base(banned ? C.error : C.primary)
    .setAuthor({ name: `Ficha de moderação • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`${e.user} <@${user.id}> \`${user.id}\`\n${line}`)
    .addFields(
      { name: 'Status', value: status, inline: true },
      { name: `${e.clock} Conta criada`, value: `${ts(user.createdTimestamp)}${flagNew ? ` ${e.warn}` : ''}`, inline: true },
      { name: `${e.welcome} Entrou`, value: member ? ts(member.joinedTimestamp) : '—', inline: true },
      { name: `${em('warn')} Avisos ativos`, value: `\`${activeWarns(guild.id, user.id)}/${config.moderation.warnLimit}\``, inline: true },
      { name: `${em('timeout')} Castigos`, value: `\`${count('timeout')}\``, inline: true },
      { name: `${em('ban')} Bans / Expulsões`, value: `\`${count('ban')} / ${count('kick')}\``, inline: true },
      { name: `${e.log} Últimos casos`, value: cases.slice(0, 5).map((c) => `${em(c.type)} \`#${c.id}\` ${TYPES[c.type].label} — ${(c.reason || 'sem motivo').slice(0, 50)} ${ts(c.at)}`).join('\n') || `${e.check} Ficha limpa!` }
    );

  const id = user.id;
  const btn = (action, label, emoji, style, disabled = false) => new ButtonBuilder()
    .setCustomId(`mod:${action}:${id}`).setLabel(label).setEmoji(emoji).setStyle(style).setDisabled(disabled);
  const rows = [
    new ActionRowBuilder().addComponents(
      btn('warn', 'Avisar', em('warn'), ButtonStyle.Secondary, !member),
      btn('timeout', 'Castigar', em('timeout'), ButtonStyle.Secondary, !member),
      btn('kick', 'Expulsar', em('kick'), ButtonStyle.Danger, !member),
      banned ? btn('unban', 'Desbanir', em('unban'), ButtonStyle.Success) : btn('ban', 'Banir', em('ban'), ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      btn('note', 'Anotação', em('note'), ButtonStyle.Secondary),
      btn('hist:0', 'Histórico', e.clock, ButtonStyle.Primary),
      btn('untimeout', 'Tirar castigo', em('untimeout'), ButtonStyle.Secondary, !(member?.communicationDisabledUntilTimestamp > Date.now())),
      btn('clearwarns', 'Limpar avisos', e.trash, ButtonStyle.Secondary, !activeWarns(guild.id, id))
    )
  ];
  return { embeds: [embed], components: rows };
}

function history(guild, user, page = 0) {
  const PER = 6;
  const cases = userCases(guild.id, user.id);
  const pages = Math.max(1, Math.ceil(cases.length / PER));
  page = Math.min(Math.max(page, 0), pages - 1);
  const embed = base()
    .setAuthor({ name: `Histórico • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setDescription(cases.slice(page * PER, page * PER + PER).map((c) =>
      `${em(c.type)} **#${c.id} • ${TYPES[c.type].label}**${c.type === 'warn' && !c.active ? ' *(expirado)*' : ''}\n` +
      `${e.arrow} ${c.reason || 'Sem motivo'}${c.duration ? ` • ${formatDuration(c.duration)}` : ''}\n` +
      `${e.dot} ${c.auto ? 'AutoMod' : `<@${c.modId}>`} • ${ts(c.at)}`).join('\n\n') || `${e.check} Nenhum registro.`)
    .setFooter({ text: `Página ${page + 1}/${pages} • ${cases.length} casos • ${config.brand.footer}` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mod:hist:${user.id}:${page - 1}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`mod:profile:${user.id}`).setLabel('Voltar à ficha').setEmoji(e.user).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mod:hist:${user.id}:${page + 1}`).setLabel('Próxima').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1)
  );
  return { embeds: [embed], components: [row] };
}

/* ───────────── Modais ───────────── */

function actionModal(action, userId) {
  const t = TYPES[action];
  const m = new ModalBuilder().setCustomId(`mod:do:${action}:${userId}`).setTitle(`${t.label} — Advanced`);
  const rows = [new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo')
    .setLabel(action === 'note' ? 'Anotação interna (só a staff vê)' : 'Motivo').setStyle(TextInputStyle.Paragraph)
    .setRequired(action !== 'unban').setMaxLength(500))];
  if (action === 'timeout' || action === 'ban') {
    rows.unshift(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duracao')
      .setLabel(action === 'ban' ? 'Duração (ex: 7d) — vazio = permanente' : 'Duração (ex: 10m, 2h, 1d)')
      .setStyle(TextInputStyle.Short).setRequired(action === 'timeout').setMaxLength(6)
      .setValue(action === 'timeout' ? '10m' : '')));
  }
  return m.addComponents(rows);
}

/** Responde atualizando a ficha se já estamos numa mensagem efêmera, senão abre uma nova */
function respond(interaction, payload) {
  const ephemeral = interaction.message?.flags?.has(MessageFlags.Ephemeral);
  return ephemeral ? interaction.update(payload) : interaction.reply({ ...payload, flags: EPH });
}

/* ───────────── Denúncias ───────────── */

function reportModal(channelId, messageId) {
  return new ModalBuilder().setCustomId(`mod:report:${channelId}:${messageId}`).setTitle('Denunciar mensagem')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo')
      .setLabel('O que essa mensagem tem de errado?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
}

async function submitReport(interaction, channelId, messageId) {
  const g = db.guild(interaction.guild.id);
  const target = g.channels.denuncias && interaction.guild.channels.cache.get(g.channels.denuncias);
  if (!target) return interaction.reply({ embeds: [error('O canal de denúncias não foi configurado.')], flags: EPH });
  const msg = await interaction.guild.channels.cache.get(channelId)?.messages.fetch(messageId).catch(() => null);
  if (!msg) return interaction.reply({ embeds: [error('Mensagem não encontrada (talvez já tenha sido apagada).')], flags: EPH });

  const embed = base(C.error)
    .setAuthor({ name: `Denúncia contra ${msg.author.username}`, iconURL: msg.author.displayAvatarURL() })
    .setTitle(`${e.report} Mensagem denunciada`)
    .setDescription(`>>> ${msg.content?.slice(0, 1500) || '*sem texto*'}`)
    .addFields(
      { name: `${e.user} Autor`, value: `${msg.author} \`${msg.author.id}\``, inline: true },
      { name: 'Canal', value: `${msg.channel} • [ir para mensagem](${msg.url})`, inline: true },
      { name: `${e.whitelist} Denunciado por`, value: `${interaction.user}`, inline: true },
      { name: `${e.log} Motivo`, value: interaction.fields.getTextInputValue('motivo') }
    );
  const img = msg.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (img) embed.setImage(img.url);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mod:profile:${msg.author.id}`).setLabel('Abrir ficha').setEmoji(e.user).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mod:repdel:${channelId}:${messageId}`).setLabel('Apagar mensagem').setEmoji(e.trash).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('mod:repok').setLabel('Resolvido').setEmoji(e.check).setStyle(ButtonStyle.Success)
  );
  await target.send({ embeds: [embed], components: [row] });
  await interaction.reply({ embeds: [success('Sua denúncia foi enviada para a staff. Obrigado por ajudar a manter a cidade em ordem!', 'Denúncia enviada')], flags: EPH });
}

/* ───────────── Roteador "mod:..." ───────────── */

async function handle(interaction) {
  const [, action, a, b] = interaction.customId.split(':');
  const guild = interaction.guild;

  if (action === 'report') return submitReport(interaction, a, b);

  if (!(await perms.check(interaction, 'suporte'))) return;

  if (action === 'profile') {
    const user = await interaction.client.users.fetch(a);
    return respond(interaction, await profile(guild, user));
  }
  if (action === 'hist') {
    const user = await interaction.client.users.fetch(a);
    return respond(interaction, history(guild, user, Number(b) || 0));
  }
  if (action === 'repdel') {
    if (!(await perms.check(interaction, 'moderador'))) return;
    const msg = await guild.channels.cache.get(a)?.messages.fetch(b).catch(() => null);
    await msg?.delete().catch(() => null);
    return interaction.reply({ embeds: [success(msg ? 'Mensagem apagada.' : 'A mensagem já não existe.')], flags: EPH });
  }
  if (action === 'repok') {
    const embed = base(C.success).setDescription(`${e.approved} Denúncia resolvida por ${interaction.user} ${ts(Date.now())}`);
    return interaction.update({ embeds: [...interaction.message.embeds, embed], components: [] });
  }
  if (action === 'clearwarns') {
    if (!(await perms.check(interaction, 'moderador'))) return;
    for (const c of userCases(guild.id, a)) if (c.type === 'warn') c.active = false;
    db.save();
    sendLog(guild, base(C.success).setDescription(`${e.trash} ${interaction.user} limpou os avisos de <@${a}>`));
    return respond(interaction, await profile(guild, await interaction.client.users.fetch(a)));
  }

  // Ações que pedem motivo (abre formulário)
  if (TYPES[action]) {
    const member = await guild.members.fetch(a).catch(() => null);
    const err = canPunish(interaction.member, member, action);
    if (err) return interaction.reply({ embeds: [err], flags: EPH });
    if (action === 'untimeout') {
      await punish(guild, { type: 'untimeout', user: member.user, member, mod: interaction.member, reason: 'Castigo removido pela staff' });
      return respond(interaction, await profile(guild, member.user));
    }
    return interaction.showModal(actionModal(action, a));
  }

  // Formulário enviado
  if (action === 'do') {
    const type = a;
    const user = await interaction.client.users.fetch(b);
    const member = await guild.members.fetch(b).catch(() => null);
    const err = canPunish(interaction.member, member, type);
    if (err) return interaction.reply({ embeds: [err], flags: EPH });

    let duration = null;
    if (type === 'timeout' || type === 'ban') {
      const raw = interaction.fields.getTextInputValue('duracao');
      if (raw) {
        duration = parseDuration(raw);
        if (!duration) return interaction.reply({ embeds: [error('Duração inválida. Use por exemplo `10m`, `2h`, `7d`.')], flags: EPH });
      }
    }
    if ((type === 'kick' && !member?.kickable) || (type === 'ban' && member && !member.bannable) || (type === 'timeout' && !member?.moderatable)) {
      return interaction.reply({ embeds: [error('Meu cargo está abaixo desse membro — não consigo aplicar.')], flags: EPH });
    }
    await interaction.deferReply({ flags: EPH });
    const r = await punish(guild, { type, user, member, mod: interaction.member, reason: interaction.fields.getTextInputValue('motivo'), duration });
    return interaction.editReply({ embeds: [r.embed] });
  }
}

module.exports = { TYPES, punish, canPunish, createCase, caseEmbed, userCases, activeWarns, profile, history, reportModal, tick, handle };
