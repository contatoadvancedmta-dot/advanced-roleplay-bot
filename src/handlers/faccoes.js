/**
 * FACÇÕES / ORGANIZAÇÕES — registro com líder, membros, cargo automático e lista que se atualiza sozinha
 */
const config = require('../../config');
const db = require('../database');
const { base, e, line } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');
const { ts } = require('../utils/time');

const TYPES = {
  criminosa: { label: 'Facção criminosa', emoji: '🏴' },
  policia: { label: 'Polícia / Governo', emoji: '🚓' },
  empresa: { label: 'Empresa / Legal', emoji: '💼' },
  outra: { label: 'Outra organização', emoji: '📌' }
};
const store = (gid) => { const g = db.guild(gid); g.faccoes ??= {}; return g.faccoes; };
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const find = (gid, q) => store(gid)[slug(q)] ?? Object.values(store(gid)).find((f) => f.sigla.toLowerCase() === q.toLowerCase());

function infoEmbed(f) {
  const t = TYPES[f.tipo];
  return base().setTitle(`${t.emoji} [${f.sigla}] ${f.nome}`)
    .setDescription(`${t.label}${f.roleId ? ` • <@&${f.roleId}>` : ''}\n${line}`)
    .addFields(
      { name: `${e.crown} Líder`, value: `<@${f.liderId}>`, inline: true },
      { name: `${e.user} Membros`, value: `**${f.membros.length}**${config.faccoes?.maxMembers ? `/${config.faccoes.maxMembers}` : ''}`, inline: true },
      { name: `${e.clock} Criada`, value: ts(f.createdAt, 'D'), inline: true },
      { name: 'Integrantes', value: f.membros.length ? f.membros.slice(0, 40).map((id) => `${id === f.liderId ? e.crown : e.dot} <@${id}>`).join('\n').slice(0, 1024) : '—' }
    );
}

function listEmbed(guild) {
  const all = Object.values(store(guild.id)).sort((a, b) => a.tipo.localeCompare(b.tipo) || b.membros.length - a.membros.length);
  const embed = base().setTitle(`🏴 Facções e organizações — ${config.brand.name}`)
    .setDescription(all.length ? Object.entries(TYPES).map(([k, t]) => {
      const list = all.filter((f) => f.tipo === k);
      return list.length ? `**${t.emoji} ${t.label}**\n${list.map((f) => `${e.dot} **[${f.sigla}] ${f.nome}** — líder <@${f.liderId}> • ${f.membros.length} membros`).join('\n')}` : null;
    }).filter(Boolean).join('\n\n') : 'Nenhuma facção registrada ainda.');
  return withBanner({ embeds: [embed] }, embed, 'faccoes');
}

module.exports = { TYPES, store, slug, find, infoEmbed, listEmbed };
