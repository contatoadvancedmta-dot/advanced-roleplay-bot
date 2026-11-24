/**
 * BATE-PONTO DA STAFF — botões Entrar/Sair, painel com quem está em serviço, horas e ranking
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');
const { formatDuration, ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const data = (guildId) => {
  const g = db.guild(guildId);
  g.ponto ??= { open: {}, sessions: [] };
  return g.ponto;
};
const hours = (ms) => `${(ms / 36e5).toFixed(1).replace('.', ',')}h`;

/** Soma das horas de cada staff no período (inclui ponto aberto) */
function totals(guildId, days) {
  const p = data(guildId);
  const since = days ? Date.now() - days * 864e5 : 0;
  const t = {};
  for (const s of p.sessions) {
    if (s.end < since) continue;
    t[s.userId] = (t[s.userId] ?? 0) + (s.end - Math.max(s.start, since));
  }
  for (const [uid, start] of Object.entries(p.open)) t[uid] = (t[uid] ?? 0) + (Date.now() - Math.max(start, since));
  return t;
}

function panelEmbed(guildId) {
  const p = data(guildId);
  const on = Object.entries(p.open).sort((a, b) => a[1] - b[1]);
  return base()
    .setTitle(`${e.clock} Bate-ponto — ${config.brand.name}`)
    .setDescription([
      'Registre quando começar e terminar seu turno na staff.',
      line,
      `${e.online} **Em serviço agora (${on.length})**`,
      on.length ? on.map(([uid, start]) => `${e.dot} <@${uid}> desde ${ts(start, 't')} (${ts(start)})`).join('\n') : '*Ninguém em serviço.*',
      line,
      `${e.warn} Esqueceu de sair? O ponto fecha sozinho depois de **${config.ponto.maxHours}h**.`
    ].join('\n'));
}

const panelButtons = () => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ponto:in').setLabel('Entrar em serviço').setEmoji(e.online).setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('ponto:out').setLabel('Sair de serviço').setEmoji(e.offline).setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('ponto:me').setLabel('Minhas horas').setEmoji(e.clock).setStyle(ButtonStyle.Secondary))];

function panel(guildId) {
  const embed = panelEmbed(guildId);
  return withBanner({ embeds: [embed], components: panelButtons() }, embed, 'ponto');
}

async function refreshPanels(guild) {
  const p = data(guild.id);
  if (!p.panel) return;
  const msg = await guild.channels.cache.get(p.panel.channelId)?.messages.fetch(p.panel.messageId).catch(() => null);
  if (!msg) return;
  const embed = panelEmbed(guild.id);
  if (msg.attachments.size) embed.setImage(`attachment://${[...msg.attachments.values()][0].name}`);
  await msg.edit({ embeds: [embed], components: panelButtons() }).catch(() => null);
}

async function log(guild, text) {
  const id = db.guild(guild.id).channels.ponto_log;
  await guild.channels.cache.get(id)?.send({ embeds: [base().setDescription(text)] }).catch(() => null);
}

function closeSession(guildId, uid, auto = false) {
  const p = data(guildId);
  const start = p.open[uid];
  if (!start) return null;
  const end = auto ? start + config.ponto.maxHours * 36e5 : Date.now();
  delete p.open[uid];
  p.sessions.push({ userId: uid, start, end, auto });
  if (p.sessions.length > 20000) p.sessions.splice(0, p.sessions.length - 20000);
  db.save();
  return end - start;
}

function myEmbed(guildId, user) {
  const t = (d) => hours(totals(guildId, d)[user.id] ?? 0);
  const open = data(guildId).open[user.id];
  const rank = Object.entries(totals(guildId, 7)).sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === user.id) + 1;
  return base().setAuthor({ name: `Ponto • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setDescription(open ? `${e.online} **Em serviço** desde ${ts(open, 't')} (${formatDuration(Date.now() - open)})` : `${e.offline} Fora de serviço`)
    .addFields(
      { name: 'Hoje', value: `**${t(1)}**`, inline: true },
      { name: '7 dias', value: `**${t(7)}**${rank ? ` • #${rank}` : ''}`, inline: true },
      { name: '30 dias', value: `**${t(30)}**`, inline: true }
    );
}

function rankingEmbed(guild, days = 7) {
  const medals = ['🥇', '🥈', '🥉'];
  const list = Object.entries(totals(guild.id, days)).filter(([, ms]) => ms > 60000).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const on = data(guild.id).open;
  const embed = base().setTitle(`${e.clock} Ranking de horas — ${days === 7 ? 'últimos 7 dias' : days === 30 ? 'últimos 30 dias' : 'total'}`)
    .setDescription(list.length ? list.map(([id, ms], n) => `${medals[n] ?? `\`#${n + 1}\``} <@${id}> ${e.arrow} **${hours(ms)}**${on[id] ? ` ${e.online}` : ''}`).join('\n') : 'Ninguém bateu ponto nesse período.');
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

/** Fecha pontos esquecidos (chamado a cada 30s) */
async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const p = data(guild.id);
    for (const [uid, start] of Object.entries(p.open)) {
      if (Date.now() - start < config.ponto.maxHours * 36e5) continue;
      closeSession(guild.id, uid, true);
      await log(guild, `${e.warn} Ponto de <@${uid}> fechado automaticamente após **${config.ponto.maxHours}h**.`);
      await refreshPanels(guild);
    }
  }
}

async function handle(interaction) {
  const action = interaction.customId.split(':')[1];
  if (!(await perms.check(interaction, 'suporte'))) return;
  const p = data(interaction.guild.id);
  const uid = interaction.user.id;
  if (action === 'me') return interaction.reply({ embeds: [myEmbed(interaction.guild.id, interaction.user)], flags: EPH });
  if (action === 'in') {
    if (p.open[uid]) return interaction.reply({ embeds: [error(`Você já está em serviço desde ${ts(p.open[uid], 't')}.`)], flags: EPH });
    p.open[uid] = Date.now();
    db.save();
    await interaction.reply({ embeds: [success('Ponto aberto. Bom serviço!', 'Em serviço')], flags: EPH });
    await log(interaction.guild, `${e.online} ${interaction.user} **entrou** em serviço.`);
  }
  if (action === 'out') {
    const ms = closeSession(interaction.guild.id, uid);
    if (ms == null) return interaction.reply({ embeds: [error('Você não está em serviço.')], flags: EPH });
    await interaction.reply({ embeds: [success(`Ponto fechado: **${formatDuration(ms)}** de serviço.`, 'Fora de serviço')], flags: EPH });
    await log(interaction.guild, `${e.offline} ${interaction.user} **saiu** de serviço • ${formatDuration(ms)}`);
  }
  await refreshPanels(interaction.guild);
  require('./rankingBoard').touch(interaction.client);
}

module.exports = { handle, panel, tick, totals, rankingEmbed, myEmbed, data, closeSession, refreshPanels, hours };
