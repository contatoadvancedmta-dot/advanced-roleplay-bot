/**
 * RANKING DOS TICKETS — quem mais assumiu, nota média, tempo de resposta e top apoiadores
 */
const config = require('../../config');
const db = require('../database');
const { base, e, line } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');
const { formatDuration } = require('../utils/time');

const MEDALS = ['🥇', '🥈', '🥉'];
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PERIODS = { 7: 'últimos 7 dias', 30: 'últimos 30 dias', 0: 'desde o início' };
const stars = (n) => (n ? `${'⭐'.repeat(Math.round(n))} ${n.toFixed(1)}` : 'sem avaliações');

function data(guildId, days) {
  const g = db.guild(guildId);
  const since = days ? Date.now() - days * 864e5 : 0;
  return {
    claims: (g.ticketClaims ?? []).filter((c) => c.at >= since),
    history: (g.ticketHistory ?? []).filter((h) => h.closedAt >= since),
    ratings: (g.ratings ?? []).filter((r) => r.at >= since && r.staffId)
  };
}

/** Estatísticas por membro da staff */
function staffStats(guildId, days) {
  const { claims, history, ratings } = data(guildId, days);
  const s = {};
  const get = (id) => (s[id] ??= { claims: 0, closed: 0, ratings: [], responses: [] });
  for (const c of claims) get(c.staffId).claims++;
  for (const h of history) {
    if (h.closedBy) get(h.closedBy).closed++;
    if (h.firstResponder && h.firstResponseAt) get(h.firstResponder).responses.push(h.firstResponseAt - h.createdAt);
  }
  for (const r of ratings) get(r.staffId).ratings.push(r.stars);
  for (const v of Object.values(s)) {
    v.avgRating = v.ratings.length ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length : 0;
    v.avgResponse = v.responses.length ? v.responses.reduce((a, b) => a + b, 0) / v.responses.length : null;
  }
  return s;
}

function rankingEmbed(guild, days = 30) {
  const stats = staffStats(guild.id, days);
  const list = Object.entries(stats).filter(([, v]) => v.claims > 0)
    .sort((a, b) => b[1].claims - a[1].claims || b[1].avgRating - a[1].avgRating).slice(0, 10);
  const total = list.reduce((n, [, v]) => n + v.claims, 0);
  const embed = base()
    .setTitle(`${e.ticket} Ranking de atendimento — ${PERIODS[days] ?? `${days} dias`}`)
    .setDescription(list.length
      ? `${e.claim} **Quem mais assumiu tickets**\n${line}\n` + list.map(([id, v], n) =>
        `${MEDALS[n] ?? `\`#${n + 1}\``} <@${id}> ${e.arrow} **${v.claims}** assumido${v.claims > 1 ? 's' : ''}\n` +
        `${e.dot} ${stars(v.avgRating)}${v.ratings.length ? ` (${v.ratings.length})` : ''}` +
        `${v.avgResponse != null ? ` • ${e.clock} responde em ~${formatDuration(v.avgResponse)}` : ''}`).join('\n\n')
      : 'Ninguém assumiu tickets nesse período ainda.')
    .setFooter({ text: `${total} tickets assumidos no período • ${config.brand.footer}`, iconURL: config.brand.logo ?? undefined });
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

function staffEmbed(guild, user, days = 30) {
  const v = staffStats(guild.id, days)[user.id] ?? { claims: 0, closed: 0, ratings: [], avgRating: 0, avgResponse: null };
  const all = Object.entries(staffStats(guild.id, days)).sort((a, b) => b[1].claims - a[1].claims);
  const pos = all.findIndex(([id]) => id === user.id) + 1;
  const dist = [5, 4, 3, 2, 1].map((n) => `${n}⭐ ${'█'.repeat(v.ratings.filter((r) => r === n).length).slice(0, 15) || '░'} ${v.ratings.filter((r) => r === n).length}`).join('\n');
  return base()
    .setAuthor({ name: `Atendimento • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setTitle(`${e.ticket} Desempenho — ${PERIODS[days] ?? `${days} dias`}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: `${e.claim} Assumidos`, value: `**${v.claims}**${pos && v.claims ? ` • #${pos} no ranking` : ''}`, inline: true },
      { name: `${e.lock} Fechados`, value: `**${v.closed}**`, inline: true },
      { name: `${e.clock} 1ª resposta`, value: v.avgResponse != null ? `~${formatDuration(v.avgResponse)}` : '—', inline: true },
      { name: `${e.star} Nota média`, value: stars(v.avgRating), inline: true },
      { name: 'Avaliações', value: `**${v.ratings.length}**`, inline: true },
      { name: '​', value: '​', inline: true },
      ...(v.ratings.length ? [{ name: 'Distribuição das notas', value: `\`\`\`${dist}\`\`\`` }] : [])
    );
}

function supportersEmbed(guild, days = 0) {
  const { history } = data(guild.id, days);
  const totals = {};
  for (const h of history) for (const p of h.paid ?? []) totals[h.ownerId] = (totals[h.ownerId] ?? 0) + p.value;
  const list = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const embed = base()
    .setTitle(`💎 Top apoiadores — ${PERIODS[days] ?? `${days} dias`}`)
    .setDescription(list.length
      ? `Obrigado a quem fortalece o **${config.brand.name}**! ${e.star}\n${line}\n` + list.map(([id, v], n) => `${MEDALS[n] ?? `\`#${n + 1}\``} <@${id}> ${e.arrow} **${brl(v)}**`).join('\n')
      : 'Nenhuma compra confirmada nesse período.');
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

module.exports = { rankingEmbed, staffEmbed, supportersEmbed, staffStats };
