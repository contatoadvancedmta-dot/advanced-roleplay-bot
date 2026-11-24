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

/** Cria facção. Retorna { f } ou { error } */
async function create(guild, by, { nome, sigla, tipo, liderId, createRole = true }) {
  const st = store(guild.id);
  nome = nome.trim();
  sigla = sigla.trim().toUpperCase();
  const id = slug(nome);
  if (!id || !sigla) return { error: 'Preencha nome e sigla.' };
  if (!TYPES[tipo]) return { error: 'Tipo inválido.' };
  if (st[id] || find(guild.id, sigla)) return { error: 'Já existe uma facção com esse nome ou sigla.' };
  let roleId = null;
  if (createRole) {
    const role = await guild.roles.create({ name: `[${sigla}] ${nome}`, mentionable: true, reason: `Facção criada por ${by.tag ?? by.id}` }).catch(() => null);
    roleId = role?.id ?? null;
  }
  st[id] = { id, nome, sigla, tipo, liderId, membros: [liderId], roleId, createdAt: Date.now(), by: by.id };
  db.save();
  if (roleId) await (await guild.members.fetch(liderId).catch(() => null))?.roles.add(roleId).catch(() => null);
  return { f: st[id] };
}

/** Adiciona/remove membro. Retorna texto do resultado (ou { error }) */
async function setMember(guild, f, userId, add) {
  const st = store(guild.id);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (add) {
    if (f.membros.includes(userId)) return { error: `<@${userId}> já é da facção.` };
    const other = Object.values(st).find((x) => x.membros.includes(userId));
    if (other) return { error: `<@${userId}> já é da facção **[${other.sigla}]**.` };
    if (config.faccoes?.maxMembers && f.membros.length >= config.faccoes.maxMembers) return { error: `Limite de ${config.faccoes.maxMembers} membros.` };
    f.membros.push(userId);
    if (f.roleId) await member?.roles.add(f.roleId).catch(() => null);
  } else {
    if (userId === f.liderId) return { error: 'Não dá para remover o líder. Troque o líder antes.' };
    if (!f.membros.includes(userId)) return { error: `<@${userId}> não é da facção.` };
    f.membros = f.membros.filter((x) => x !== userId);
    if (f.roleId) await member?.roles.remove(f.roleId).catch(() => null);
  }
  db.save();
  return { text: `<@${userId}> ${add ? 'entrou na' : 'saiu da'} **[${f.sigla}] ${f.nome}**.` };
}

async function remove(guild, f) {
  if (f.roleId) await guild.roles.delete(f.roleId).catch(() => null);
  delete store(guild.id)[f.id];
  db.save();
}

module.exports = { TYPES, store, slug, find, infoEmbed, listEmbed, create, setMember, remove };
