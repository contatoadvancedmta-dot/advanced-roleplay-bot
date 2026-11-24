/**
 * CANAL DE RANKINGS — mensagens fixas que o bot edita sozinho (não spamma o canal)
 */
const config = require('../../config');
const db = require('../database');
const ticketStats = require('./ticketStats');

const BOARDS = {
  tickets: (guild) => ticketStats.rankingEmbed(guild, 30),
  apoiadores: (guild) => ticketStats.supportersEmbed(guild, 0),
  ponto: (guild) => require('./ponto').rankingEmbed(guild, 7),
  faccoes: (guild) => require('./faccoes').listEmbed(guild)
};

// canal próprio de cada ranking (se não tiver, usa o canal geral "rankings")
const CHANNEL_KEYS = { tickets: 'ranking_tickets', apoiadores: 'ranking_apoiadores', ponto: 'ranking_ponto', faccoes: 'faccoes_lista' };

let running = false;
async function update(client) {
  if (running) return;
  running = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      const g = db.guild(guild.id);
      g.rankingMessages ??= {};
      for (const key of Object.keys(BOARDS)) {
        const own = g.channels[CHANNEL_KEYS[key]];
        const listed = (config.rankingBoard ?? Object.keys(BOARDS)).includes(key);
        const chId = own || (listed ? g.channels.rankings : null);
        const ch = chId && guild.channels.cache.get(chId);
        if (!ch) continue;

        const payload = BOARDS[key](guild);
        const em = payload.embeds[0];
        em.setDescription(`${em.data.description ?? ''}\n\n-# 🔄 Atualiza sozinho • última atualização <t:${Math.floor(Date.now() / 1000)}:R>`);

        let stored = g.rankingMessages[key];
        if (typeof stored === 'string') stored = { channelId: ch.id, messageId: stored }; // formato antigo
        let msg = null;
        if (stored?.channelId === ch.id) msg = await ch.messages.fetch(stored.messageId).catch(() => null);
        else if (stored) { // mudou de canal: apaga a mensagem antiga
          await guild.channels.cache.get(stored.channelId)?.messages.delete(stored.messageId).catch(() => null);
        }
        if (msg) {
          if (payload.files && msg.attachments.size) delete payload.files; // banner já está na mensagem
          await msg.edit(payload).catch((err) => console.error('[Rankings]', err.message));
        } else {
          const sent = await ch.send(payload).catch((err) => console.error('[Rankings]', err.message));
          if (sent) { g.rankingMessages[key] = { channelId: ch.id, messageId: sent.id }; db.save(); }
        }
      }
    }
  } finally {
    running = false;
  }
}

/** Pede uma atualização em breve (junta vários eventos seguidos numa só edição) */
let timer = null;
function touch(client) {
  clearTimeout(timer);
  timer = setTimeout(() => update(client).catch(() => null), 20_000);
}

module.exports = { update, touch, BOARDS, CHANNEL_KEYS };
