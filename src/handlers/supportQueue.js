/**
 * FILA DE SUPORTE POR VOZ — quem entra em "Espera Suporte" aparece para a staff,
 * que clica em "Atender no Suporte #N" e o bot move o jogador (e o staff, se estiver em call).
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const ROOMS = ['suporte_1', 'suporte_2', 'suporte_3', 'suporte_4'];
const waiting = new Map(); // guildId:userId -> { messageId, channelId, since }

function rooms(guild) {
  const g = db.guild(guild.id);
  return ROOMS.map((k, i) => ({ key: k, n: i + 1, ch: guild.channels.cache.get(g.channels[k]) })).filter((r) => r.ch);
}

function buttons(guild, userId, disabled = false) {
  const list = rooms(guild);
  if (!list.length) return [];
  return [new ActionRowBuilder().addComponents(list.map((r) => new ButtonBuilder()
    .setCustomId(`fila:take:${userId}:${r.n}`)
    .setLabel(`${r.ch.name.replace(/^[^\p{L}\d#]+/u, '').slice(0, 30)} (${r.ch.members.size}${r.ch.userLimit ? `/${r.ch.userLimit}` : ''})`)
    .setEmoji(e.support).setStyle(r.ch.members.size ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(disabled)))];
}

async function onVoice(oldState, newState) {
  const guild = newState.guild;
  const g = db.guild(guild.id);
  const espera = g.channels.espera_suporte;
  if (!espera) return;
  const notify = guild.channels.cache.get(g.channels.fila_suporte);
  const key = `${guild.id}:${newState.id}`;

  // entrou na espera
  if (newState.channelId === espera && oldState.channelId !== espera) {
    if (!notify || newState.member?.user.bot) return;
    const roles = Object.keys(config.levels).map((k) => g.roles[k]).filter(Boolean).map((r) => `<@&${r}>`).join(' ');
    const msg = await notify.send({
      content: roles || undefined,
      embeds: [base().setAuthor({ name: newState.member.displayName, iconURL: newState.member.displayAvatarURL() })
        .setDescription(`${e.support} ${newState.member} está na **espera do suporte** desde ${ts(Date.now(), 't')}.\nClique na sala para atender — o bot move a pessoa (e você, se estiver em call).`)],
      components: buttons(guild, newState.id)
    }).catch(() => null);
    if (msg) waiting.set(key, { messageId: msg.id, channelId: notify.id, since: Date.now() });
    return;
  }
  // saiu da espera sem ser atendido
  if (oldState.channelId === espera && newState.channelId !== espera && waiting.has(key)) {
    const w = waiting.get(key);
    waiting.delete(key);
    if (w.taken) return;
    const msg = await guild.channels.cache.get(w.channelId)?.messages.fetch(w.messageId).catch(() => null);
    await msg?.edit({ content: null, embeds: [base().setDescription(`${e.leave} <@${newState.id}> saiu da espera ${ts(Date.now())}.`)], components: [] }).catch(() => null);
  }
}

async function handle(interaction) {
  const [, , userId, n] = interaction.customId.split(':');
  if (!(await perms.check(interaction, 'suporte'))) return;
  const g = db.guild(interaction.guild.id);
  const room = interaction.guild.channels.cache.get(g.channels[`suporte_${n}`]);
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!room) return interaction.reply({ embeds: [error('Essa sala não está configurada.')], flags: EPH });
  if (member?.voice.channelId !== g.channels.espera_suporte) {
    await interaction.update({ content: null, embeds: [base().setDescription(`${e.leave} <@${userId}> não está mais na espera.`)], components: [] });
    return;
  }
  const w = waiting.get(`${interaction.guild.id}:${userId}`);
  if (w) w.taken = true;
  await member.voice.setChannel(room, `Suporte por ${interaction.user.tag}`).catch(() => null);
  const staffMoved = interaction.member.voice.channelId
    ? await interaction.member.voice.setChannel(room).then(() => true).catch(() => false) : false;
  await interaction.update({ content: null, components: [], embeds: [base().setDescription(`${e.approved} <@${userId}> foi atendido por ${interaction.user} em **${room.name}** ${ts(Date.now())}.`)] });
  if (!staffMoved) await interaction.followUp({ embeds: [success(`<@${userId}> foi movido para **${room}**. Entre na sala para atender.`)], flags: EPH });
}

module.exports = { onVoice, handle };
