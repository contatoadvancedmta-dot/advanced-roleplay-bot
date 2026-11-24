/**
 * AUTOMOD MODERNO + XP
 * Convites, menções em massa, flood (spam), CAPS, links, palavras proibidas.
 * Infrações repetidas viram aviso automático (caso registrado).
 */
const config = require('../../config');
const { base, e } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const xp = require('../handlers/xp');
const db = require('../database');
const moderation = require('../handlers/moderation');

const INVITE = /(discord\.gg|discord(app)?\.com\/invite)\/[\w-]+/i;
const LINK = /https?:\/\/([^\s/]+)/gi;
const recent = new Map();  // guild:user -> timestamps das mensagens (anti-spam)
const strikes = new Map(); // guild:user -> timestamps de infrações

function check(message) {
  const am = config.automod;
  const text = message.content;

  if (am.antiInvite && INVITE.test(text)) return { reason: 'Divulgação de outro servidor', invite: text.match(INVITE)[0].split('/').pop() };
  if (am.antiMassMention && message.mentions.users.size >= am.antiMassMention) return { reason: 'Menções em massa' };

  if (am.antiLink?.enabled) {
    for (const [, host] of text.matchAll(LINK)) {
      const h = host.toLowerCase().replace(/^www\./, '');
      if (!am.antiLink.allowed.some((d) => h === d || h.endsWith(`.${d}`))) return { reason: 'Link não permitido' };
    }
  }
  if (am.badWords?.length) {
    const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (am.badWords.some((w) => new RegExp(`\\b${w.toLowerCase()}\\b`).test(norm))) return { reason: 'Palavra proibida' };
  }
  if (am.antiCaps) {
    const letters = text.replace(/[^a-zA-ZÀ-ú]/g, '');
    if (letters.length >= am.antiCaps.minLength && letters.replace(/[^A-ZÀ-Ý]/g, '').length / letters.length * 100 >= am.antiCaps.percent) return { reason: 'Excesso de letras maiúsculas' };
  }
  if (am.antiSpam) {
    const k = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const list = (recent.get(k) ?? []).filter((t) => now - t < am.antiSpam.seconds * 1000);
    list.push(now);
    recent.set(k, list);
    if (list.length >= am.antiSpam.messages) { recent.delete(k); return { reason: 'Flood / spam de mensagens', spam: true }; }
  }
  return null;
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    if (await require('../handlers/instagram').onMessage(message).catch((err) => { console.error('[Insta]', err.message); return false; })) return;
    if (perms.hasLevel(message.member, 'suporte')) {
      // primeira resposta da staff num ticket (para o tempo médio de resposta)
      const t = db.guild(message.guild.id).tickets[message.channel.id];
      if (t && !t.firstResponseAt && message.author.id !== t.ownerId) {
        t.firstResponseAt = Date.now();
        t.firstResponder = message.author.id;
        db.save();
      }
      return xp.grant(message); // staff ignora automod
    }

    const hit = check(message);
    if (hit?.invite) {
      const invites = await message.guild.invites.fetch().catch(() => null);
      if (invites?.has(hit.invite)) return xp.grant(message); // convite do próprio servidor
    }
    if (!hit) return xp.grant(message);

    await message.delete().catch(() => null);
    const am = config.automod;

    // Flood = castigo direto
    if (hit.spam && message.member.moderatable) {
      await message.channel.bulkDelete(
        (await message.channel.messages.fetch({ limit: 20 }).catch(() => new Map())).filter((m) => m.author.id === message.author.id && Date.now() - m.createdTimestamp < 15000),
        true
      ).catch(() => null);
      await moderation.punish(message.guild, { type: 'timeout', user: message.author, member: message.member, auto: true, reason: hit.reason, duration: am.antiSpam.timeoutMinutes * 6e4 }).catch(() => null);
    }

    const warn = await message.channel.send({ embeds: [base(config.colors.error)
      .setDescription(`${e.shield} ${message.author}, sua mensagem foi removida: **${hit.reason}**.`)] }).catch(() => null);
    setTimeout(() => warn?.delete().catch(() => null), 6000);
    sendLog(message.guild, base(config.colors.error).setTitle(`${e.shield} AutoMod`)
      .setDescription(`**Usuário:** ${message.author}\n**Motivo:** ${hit.reason}\n**Canal:** ${message.channel}\n\n>>> ${message.content.slice(0, 1500) || '*vazio*'}`));

    // Infrações repetidas = aviso automático
    if (hit.spam || !am.strikes) return;
    const k = `${message.guild.id}:${message.author.id}`;
    const list = (strikes.get(k) ?? []).filter((t) => Date.now() - t < am.strikes.minutes * 6e4);
    list.push(Date.now());
    strikes.set(k, list);
    if (list.length >= am.strikes.limit) {
      strikes.delete(k);
      await moderation.punish(message.guild, { type: 'warn', user: message.author, member: message.member, auto: true, reason: `AutoMod: ${am.strikes.limit} infrações (${hit.reason})` }).catch(() => null);
    }
  }
};
