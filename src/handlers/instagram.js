/**
 * INSTAGRAM DO RP — quem posta foto no canal de instagram vira um "post" com curtidas e comentários.
 * (O bot apaga a mensagem original e reposta bonitinho.)
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, error, e } = require('../utils/embeds');

const COOLDOWN = 2 * 60_000;
const last = new Map();
const store = (gid) => { const g = db.guild(gid); g.insta ??= {}; return g.insta; };

const likeRow = (id, n) => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`insta:like:${id}`).setLabel(String(n)).setEmoji('❤️').setStyle(ButtonStyle.Secondary))];

async function onMessage(message) {
  const g = db.guild(message.guild.id);
  if (message.channel.id !== g.channels.instagram) return false;
  const img = message.attachments.find((a) => /^image\//.test(a.contentType ?? ''));
  const notice = async (text) => {
    await message.delete().catch(() => null);
    const w = await message.channel.send({ content: `${message.author}`, embeds: [error(text)] }).catch(() => null);
    setTimeout(() => w?.delete().catch(() => null), 7000);
  };
  if (!img) { await notice('Aqui só vale **foto com legenda** 📸. Converse nos comentários dos posts.'); return true; }
  if (img.size > 8 * 1024 * 1024) { await notice('A foto passa de 8 MB.'); return true; }
  if (Date.now() - (last.get(message.author.id) ?? 0) < COOLDOWN) { await notice('Calma! Espere 2 minutos entre um post e outro.'); return true; }
  last.set(message.author.id, Date.now());

  const buf = Buffer.from(await fetch(img.url).then((r) => r.arrayBuffer()));
  const ext = (img.name.split('.').pop() || 'png').toLowerCase();
  const file = new AttachmentBuilder(buf, { name: `post.${ext}` });
  const nick = message.member?.displayName ?? message.author.username;
  await message.delete().catch(() => null);

  const embed = base()
    .setAuthor({ name: `@${nick.toLowerCase().replace(/\s+/g, '')}`, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content ? message.content.slice(0, 2000) : null)
    .setImage(`attachment://post.${ext}`)
    .setFooter({ text: `📸 ${config.instagramName ?? 'Insta'} • ${config.brand.name}`, iconURL: config.brand.logo ?? undefined });
  const post = await message.channel.send({ embeds: [embed], files: [file], components: likeRow('0', 0) });
  store(message.guild.id)[post.id] = { authorId: message.author.id, likes: [], at: Date.now() };
  db.save();
  await post.edit({ components: likeRow(post.id, 0) }).catch(() => null);
  if (message.channel.type === ChannelType.GuildText) {
    await post.startThread({ name: `💬 Comentários • ${nick}`.slice(0, 100), autoArchiveDuration: 1440 }).catch(() => null);
  }
  return true;
}

async function handle(interaction) {
  const id = interaction.customId.split(':')[2];
  const p = store(interaction.guild.id)[id];
  if (!p) return interaction.reply({ content: 'Post antigo 😅', flags: MessageFlags.Ephemeral });
  const uid = interaction.user.id;
  p.likes = p.likes.includes(uid) ? p.likes.filter((x) => x !== uid) : [...p.likes, uid];
  db.save();
  await interaction.update({ components: likeRow(id, p.likes.length) });
}

module.exports = { onMessage, handle };
