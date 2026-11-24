const db = require('../database');

/** Envia uma embed no canal de logs configurado (se existir) */
async function sendLog(guild, embed, files = []) {
  const id = db.guild(guild.id).channels.logs;
  if (!id) return;
  const channel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [embed], files }).catch(() => null);
}

module.exports = { sendLog };
