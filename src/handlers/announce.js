/**
 * ANÚNCIOS MODERNOS
 * Construtor com prévia ao vivo: modelo pronto, cor, menção, canal, imagem, botão de link,
 * enviar agora ou agendar. Publica automaticamente em canais de anúncio (seguidores).
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, emo, e } = require('../utils/embeds');
const { parseDuration, ts } = require('../utils/time');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const drafts = new Map(); // rascunhos em memória: guildId:userId -> draft

const COLORS = {
  invisivel: { label: 'Invisível (sem cor)', hex: config.invisibleColor, emoji: '⬛' },
  laranja: { label: 'Laranja Advanced', hex: config.colors.primary, emoji: '🟠' },
  verde: { label: 'Verde', hex: 0x22c55e, emoji: '🟢' },
  vermelho: { label: 'Vermelho', hex: 0xef4444, emoji: '🔴' },
  amarelo: { label: 'Amarelo', hex: 0xf59e0b, emoji: '🟡' },
  azul: { label: 'Azul', hex: 0x3b82f6, emoji: '🔵' },
  roxo: { label: 'Roxo', hex: 0x8b5cf6, emoji: '🟣' },
  escuro: { label: 'Escuro', hex: 0x2b2d31, emoji: '⚫' }
};

const key = (i) => `${i.guild.id}:${i.user.id}`;

function newDraft(i, templateId, channelId) {
  const t = config.announceTemplates[templateId] ?? config.announceTemplates.livre;
  const d = {
    title: t.title, text: t.text, color: config.invisibleEmbeds ? 'invisivel' : t.color ?? 'laranja', emoji: t.emoji ?? 'announce',
    image: '', buttonLabel: '', buttonUrl: '', ping: 'none',
    channelId: channelId ?? db.guild(i.guild.id).channels.anuncios ?? i.channel.id
  };
  drafts.set(key(i), d);
  return d;
}

/* ───────────── Montagem do anúncio final ───────────── */

function build(d, guild, author) {
  const embed = base(COLORS[d.color]?.hex ?? config.colors.primary, true) // cor escolhida no construtor
    .setAuthor({ name: `${config.brand.name} • Anúncio oficial`, iconURL: config.brand.logo })
    .setTitle(`${config.emojis[d.emoji] ?? e.announce} ${d.title || 'Sem título'}`.slice(0, 256))
    .setDescription(d.text || '*Escreva o texto do anúncio...*')
    .setThumbnail(config.brand.logo);
  if (author) embed.addFields({ name: '​', value: `${e.arrow} Anunciado por ${author}` });
  const customImage = /^https?:\/\//.test(d.image);
  if (customImage) embed.setImage(d.image);

  const components = d.buttonLabel && /^https?:\/\//.test(d.buttonUrl)
    ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(d.buttonLabel.slice(0, 80)).setURL(d.buttonUrl).setStyle(ButtonStyle.Link))]
    : [];
  const content = d.ping === 'none' ? undefined : d.ping === 'everyone' ? '@everyone' : d.ping === 'here' ? '@here' : `<@&${d.ping}>`;
  const payload = {
    content, embeds: [embed], components,
    allowedMentions: d.ping === 'none' ? { parse: [] } : ['everyone', 'here'].includes(d.ping) ? { parse: ['everyone'] } : { roles: [d.ping] }
  };
  return customImage ? payload : withBanner(payload, embed, 'anuncio');
}

/* ───────────── Construtor (mensagem efêmera com controles) ───────────── */

function pingOptions(guild, d) {
  const g = db.guild(guild.id);
  const opts = [
    { label: 'Não marcar ninguém', value: 'none', emoji: '🔕' },
    { label: '@everyone', value: 'everyone', emoji: '📣' },
    { label: '@here (só online)', value: 'here', emoji: '📍' }
  ];
  for (const [k, label] of [['whitelist', 'Cargo Whitelist'], ['verificado', 'Cargo Verificado'], ['staff', 'Cargo Staff']]) {
    const role = g.roles[k] && guild.roles.cache.get(g.roles[k]);
    if (role) opts.push({ label: `@${role.name}`.slice(0, 100), value: role.id, emoji: '🏷️', description: label });
  }
  return opts.map((o) => ({ ...o, default: o.value === d.ping }));
}

function builder(i, d, note) {
  const preview = build(d, i.guild, i.user);
  const pingText = { none: 'ninguém', everyone: '@everyone', here: '@here' }[d.ping] ?? `<@&${d.ping}>`;
  const info = [
    `### ${e.announce} Construtor de anúncio`,
    `${e.arrow} Canal: <#${d.channelId}> • Marcar: ${pingText}${d.buttonLabel ? ` • Botão: **${d.buttonLabel}**` : ''}`,
    note ? `${e.check} ${note}` : '-# A prévia abaixo é exatamente como o anúncio vai ficar.'
  ].join('\n');

  const rows = [
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ann:color').setPlaceholder('Cor do anúncio')
      .addOptions(Object.entries(COLORS).map(([k, c]) => ({ label: c.label, value: k, emoji: c.emoji, default: k === d.color })))),
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ann:ping').setPlaceholder('Quem marcar').addOptions(pingOptions(i.guild, d))),
    new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('ann:channel').setPlaceholder('Canal onde publicar')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(d.channelId)),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ann:edit').setLabel('Texto').setEmoji(e.log).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:extra').setLabel('Imagem e botão').setEmoji(e.star).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:send').setLabel('Publicar').setEmoji(e.announce).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ann:schedule').setLabel('Agendar').setEmoji(e.clock).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ann:cancel').setEmoji(e.cross).setStyle(ButtonStyle.Danger)
    )
  ];
  return { content: info, embeds: preview.embeds, files: preview.files ?? [], attachments: [], components: [...preview.components, ...rows].slice(0, 5) };
}

function textModal(d) {
  return new ModalBuilder().setCustomId('ann:textsubmit').setTitle('Texto do anúncio').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título').setStyle(TextInputStyle.Short)
      .setRequired(true).setMaxLength(200).setValue(d.title || '')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texto').setLabel('Mensagem (aceita **negrito**, listas...)')
      .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setValue(d.text || ''))
  );
}

function extraModal(d) {
  const input = (id, label, value, ph) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label)
    .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500).setValue(value || '').setPlaceholder(ph));
  return new ModalBuilder().setCustomId('ann:extrasubmit').setTitle('Imagem e botão').addComponents(
    input('imagem', 'URL de imagem (vazio = banner oficial)', d.image, 'https://...png'),
    input('btnlabel', 'Texto do botão (opcional)', d.buttonLabel, 'Ex: Entrar na cidade'),
    input('btnurl', 'Link do botão', d.buttonUrl, 'https://...')
  );
}

/** "30m" / "2h" / "21:30" / "25/12 20:00" -> timestamp */
function parseWhen(text) {
  text = text.trim();
  const dur = parseDuration(text);
  if (dur) return Date.now() + dur;
  const off = config.timezoneOffset * 36e5;
  const local = new Date(Date.now() + off);
  let m = /^(\d{1,2})[:h](\d{2})$/.exec(text);
  if (m) {
    let at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), +m[1], +m[2]) - off;
    if (at <= Date.now()) at += 864e5;
    return at;
  }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2})[:h](\d{2})$/.exec(text);
  if (m) return Date.UTC(m[3] ? +m[3] : local.getUTCFullYear(), +m[2] - 1, +m[1], +m[4], +m[5]) - off;
  return null;
}

/* ───────────── Publicar ───────────── */

async function publish(guild, d, authorId) {
  const channel = guild.channels.cache.get(d.channelId);
  if (!channel) throw new Error('Canal não encontrado');
  const author = await guild.client.users.fetch(authorId).catch(() => null);
  const msg = await channel.send(build(d, guild, author));
  if (channel.type === ChannelType.GuildAnnouncement) await msg.crosspost().catch(() => null); // envia para servidores que seguem o canal
  sendLog(guild, base().setTitle(`${e.announce} Anúncio publicado`).setDescription(`**${d.title}**\n${channel} • por <@${authorId}> • [ver](${msg.url})`));
  return msg;
}

/** Publica anúncios agendados vencidos (chamado a cada 30s) */
function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const g = db.guild(guild.id);
    for (const s of Object.values(g.scheduled)) {
      if (s.at > Date.now()) continue;
      delete g.scheduled[s.id];
      db.save();
      publish(guild, s.draft, s.by).catch((err) => console.error('[Anúncio agendado]', err.message));
    }
  }
}

/* ───────────── Roteador "ann:..." ───────────── */

async function handle(i) {
  const action = i.customId.split(':')[1];
  const d = drafts.get(key(i));
  if (!d) return i.reply({ embeds: [error('Esse rascunho expirou. Use `/anuncio criar` de novo.')], flags: EPH });

  // atualiza o construtor (vindo de botão/menu ou de formulário aberto pelo construtor)
  const refresh = (note) => (i.isModalSubmit() && !i.isFromMessage() ? i.reply({ ...builder(i, d, note), flags: EPH }) : i.update(builder(i, d, note)));

  switch (action) {
    case 'edit': return i.showModal(textModal(d));
    case 'extra': return i.showModal(extraModal(d));
    case 'schedule':
      return i.showModal(new ModalBuilder().setCustomId('ann:schedsubmit').setTitle('Agendar anúncio').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quando').setLabel('Quando publicar?')
          .setPlaceholder('Ex: 30m, 2h, 21:30 ou 25/12 20:00').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20))));
    case 'textsubmit':
      d.title = i.fields.getTextInputValue('titulo');
      d.text = i.fields.getTextInputValue('texto');
      return refresh('Texto atualizado.');
    case 'extrasubmit': {
      d.image = i.fields.getTextInputValue('imagem').trim();
      d.buttonLabel = i.fields.getTextInputValue('btnlabel').trim();
      d.buttonUrl = i.fields.getTextInputValue('btnurl').trim();
      const bad = (d.image && !/^https?:\/\//.test(d.image)) || (d.buttonLabel && !/^https?:\/\//.test(d.buttonUrl));
      return refresh(bad ? `${e.warn} Links precisam começar com https://` : 'Imagem e botão atualizados.');
    }
    case 'color': d.color = i.values[0]; return refresh('Cor alterada.');
    case 'ping': d.ping = i.values[0]; return refresh('Menção alterada.');
    case 'channel': d.channelId = i.values[0]; return refresh('Canal alterado.');
    case 'cancel':
      drafts.delete(key(i));
      return i.update({ content: `${e.cross} Anúncio descartado.`, embeds: [], components: [] });
    case 'send': {
      const msg = await publish(i.guild, d, i.user.id).catch((err) => err);
      if (msg instanceof Error) return refresh(`${e.cross} Não consegui publicar: ${msg.message}`);
      drafts.delete(key(i));
      return i.update({ content: `${e.approved} **Anúncio publicado!** ${msg.url}`, embeds: [], components: [] });
    }
    case 'schedsubmit': {
      const at = parseWhen(i.fields.getTextInputValue('quando'));
      if (!at || at <= Date.now()) return refresh(`${e.cross} Horário inválido. Use \`30m\`, \`2h\`, \`21:30\` ou \`25/12 20:00\`.`);
      const g = db.guild(i.guild.id);
      const id = ++g.scheduledCounter;
      g.scheduled[id] = { id, at, by: i.user.id, draft: { ...d } };
      db.save();
      drafts.delete(key(i));
      return i.update({ content: `${e.clock} **Anúncio #${id} agendado** para ${ts(at, 'F')} (${ts(at)}) em <#${d.channelId}>.`, embeds: [], components: [] });
    }
  }
}

module.exports = { handle, newDraft, builder, textModal, extraModal, tick, COLORS, parseWhen };
