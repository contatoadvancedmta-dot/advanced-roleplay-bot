/**
 * NÍVEIS / XP por mensagens
 */
const config = require('../../config');
const db = require('../database');
const { base, e } = require('../utils/embeds');

const need = (level) => 5 * level ** 2 + 50 * level + 100; // XP para passar do nível

function getData(guildId, userId) {
  const g = db.guild(guildId);
  g.xp[userId] ??= { xp: 0, level: 0, total: 0, last: 0 };
  return g.xp[userId];
}

async function grant(message) {
  const cfg = config.xp;
  if (!cfg.enabled) return;
  const d = getData(message.guild.id, message.author.id);
  if (Date.now() - d.last < cfg.cooldownSeconds * 1000) return;

  const gained = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));
  d.xp += gained;
  d.total += gained;
  d.last = Date.now();

  let leveled = false;
  while (d.xp >= need(d.level)) {
    d.xp -= need(d.level);
    d.level++;
    leveled = true;
  }
  db.save();
  if (!leveled) return;

  // cargos por nível
  let roleText = '';
  for (const [lvl, roleId] of Object.entries(cfg.roles)) {
    if (d.level >= Number(lvl) && !message.member.roles.cache.has(roleId)) {
      await message.member.roles.add(roleId, `Nível ${lvl}`).catch(() => null);
      if (d.level === Number(lvl)) roleText = `\n${e.star} Você ganhou o cargo <@&${roleId}>!`;
    }
  }

  const g = db.guild(message.guild.id);
  const channel = (g.channels.levelup && message.guild.channels.cache.get(g.channels.levelup)) || message.channel;
  channel.send({
    content: `${message.author}`,
    embeds: [base().setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setDescription(`${e.level} **Subiu de nível!** Agora você está no **nível ${d.level}**.${roleText}`)]
  }).catch(() => null);
}

function rankOf(guildId, userId) {
  const sorted = Object.entries(db.guild(guildId).xp).sort((a, b) => b[1].total - a[1].total);
  return sorted.findIndex(([id]) => id === userId) + 1;
}

function top(guildId, n = 10) {
  return Object.entries(db.guild(guildId).xp).sort((a, b) => b[1].total - a[1].total).slice(0, n);
}

module.exports = { grant, getData, need, rankOf, top };
