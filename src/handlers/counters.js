/**
 * CONTADORES — canais de voz trancados no topo que mostram:
 *   🟢 Na cidade: 97/500   (jogadores no MTA)
 *   👥 Membros: 1.284      (membros do Discord)
 * O Discord só deixa renomear um canal 2x a cada 10 min, então só atualiza quando muda e no máximo a cada 5 min.
 */
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const db = require('../database');

const MIN_INTERVAL = 5.5 * 60_000;
const lastRename = new Map(); // channelId -> timestamp

const fmt = (n) => Number(n).toLocaleString('pt-BR');

function names(guild, status) {
  return {
    contador: !config.fivem.ip ? null
      : status?.online ? `🟢 Na cidade: ${fmt(status.players.length)}/${fmt(status.max)}` : '🔴 Cidade offline',
    contadormembros: `👥 Membros: ${fmt(guild.memberCount)}`
  };
}

async function rename(guild, channelId, name, force = false) {
  const ch = channelId && guild.channels.cache.get(channelId);
  if (!ch || !name || ch.name === name) return;
  if (!force && Date.now() - (lastRename.get(ch.id) ?? 0) < MIN_INTERVAL) return;
  lastRename.set(ch.id, Date.now());
  await ch.setName(name, 'Contador automático').catch((err) => console.error('[Contador]', err.message));
}

/** Atualiza os contadores de todos os servidores (status = resultado da consulta da cidade) */
async function update(client, status, force = false) {
  for (const guild of client.guilds.cache.values()) {
    const g = db.guild(guild.id);
    const n = names(guild, status);
    await rename(guild, g.channels.contador, n.contador, force);
    await rename(guild, g.channels.contadormembros, n.contadormembros, force);
  }
}

/** Cria os canais de contador no topo do servidor (ninguém consegue entrar neles) */
async function create(guild, status) {
  const g = db.guild(guild.id);
  const n = names(guild, status);
  const perms = [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] },
    { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect] }
  ];
  const category = await guild.channels.create({ name: `📊 ${config.brand.name}`, type: ChannelType.GuildCategory, position: 0, permissionOverwrites: perms });
  const created = [];
  for (const key of ['contador', 'contadormembros']) {
    if (!n[key]) continue;
    const old = g.channels[key] && guild.channels.cache.get(g.channels[key]);
    if (old) await old.delete('Recriando contador').catch(() => null);
    const ch = await guild.channels.create({ name: n[key], type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: perms });
    g.channels[key] = ch.id;
    lastRename.set(ch.id, Date.now());
    created.push(ch);
  }
  await category.setPosition(0).catch(() => null);
  db.save();
  return created;
}

module.exports = { update, create };
