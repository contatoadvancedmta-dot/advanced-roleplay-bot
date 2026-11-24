/**
 * FORMULÁRIOS — motor único para bug, denúncias, edital, tags e ausência.
 * Cada formulário (config.forms) tem: painel com botão → formulário (com imagens) → chega para a staff
 * com botões de status → o autor recebe cada atualização na DM → resultado público (opcional).
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, LabelBuilder, StringSelectMenuBuilder, FileUploadBuilder, TextDisplayBuilder,
  AttachmentBuilder, EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const STYLE = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
const em = (k) => config.emojis[k] ?? k;
const MAX_SIZE = 8 * 1024 * 1024;

const form = (id) => config.forms[id];
const storeOf = (guildId, id) => {
  const g = db.guild(guildId);
  g.forms ??= {};
  g.forms[id] ??= { counter: 0, items: {} };
  return g.forms[id];
};

/* ───────────── Painel ───────────── */

function panel(id) {
  const f = form(id);
  const embed = base()
    .setTitle(`${em(f.emoji)} ${f.name} — ${config.brand.name}`)
    .setDescription([
      f.intro,
      line,
      `${e.dot} Clique em **${f.button}** e preencha o formulário`,
      f.images ? `${e.dot} Anexe até **${f.images} ${f.images > 1 ? 'imagens' : 'imagem'}** como prova` : null,
      `${e.dot} A ${f.level === 'admin' ? 'administração' : 'staff'} analisa e você recebe cada atualização na **DM**`,
      f.staffOnly ? `${e.lock} Somente para a staff.` : null
    ].filter(Boolean).join('\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`form:open:${id}`).setLabel(f.button).setEmoji(em(f.emoji)).setStyle(ButtonStyle.Primary))]
  }, embed, f.banner);
}

/* ───────────── Formulário ───────────── */

function modal(id) {
  const f = form(id);
  const parts = [];
  for (const q of f.fields.slice(0, 4)) {
    const label = new LabelBuilder().setLabel(q.label.slice(0, 45));
    if (q.style === 'tag') {
      label.setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId(q.id).setRequired(true).setPlaceholder('Escolha a tag')
        .addOptions(config.tags.map((t) => ({ label: t.label, value: t.id, emoji: t.emoji }))));
    } else {
      const input = new TextInputBuilder().setCustomId(q.id).setRequired(q.required !== false).setMaxLength(q.max ?? 1000)
        .setStyle(q.style === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short);
      if (q.placeholder) input.setPlaceholder(q.placeholder);
      label.setTextInputComponent(input);
    }
    parts.push(label);
  }
  if (f.images) {
    parts.push(new LabelBuilder().setLabel(`Prints / imagens (opcional)`).setDescription(`Até ${f.images} • PNG, JPG, GIF ou WEBP • até 8 MB`)
      .setFileUploadComponent(new FileUploadBuilder().setCustomId('imagens').setRequired(false).setMinValues(0).setMaxValues(f.images)));
  }
  const m = new ModalBuilder().setCustomId(`form:submit:${id}`).setTitle(f.name.slice(0, 45));
  if (parts.length < 5 && f.intro) m.addTextDisplayComponents(new TextDisplayBuilder().setContent(f.intro));
  return m.addLabelComponents(...parts);
}

/* ───────────── Mensagem para a staff ───────────── */

function statusOf(f, item) {
  const s = f.statuses.find((x) => x.id === item.status);
  return s ? { ...s, label: s.done ?? s.label } : { label: 'Aguardando análise', emoji: 'pending' };
}

function buildEmbeds(id, item) {
  const f = form(id);
  const st = statusOf(f, item);
  const embed = base()
    .setAuthor({ name: `${f.name} #${f.tag}${item.n} • ${item.authorTag}`, iconURL: item.authorAvatar })
    .setTitle(`${em(f.emoji)} ${f.name}`)
    .setThumbnail(item.authorAvatar)
    .addFields(
      { name: `${e.user} Enviado por`, value: `<@${item.authorId}>\n\`${item.authorId}\``, inline: true },
      { name: `${e.clock} Quando`, value: ts(item.at), inline: true },
      { name: `${em(st.emoji)} Status`, value: `**${st.label}**`, inline: true },
      ...f.fields.map((q) => ({ name: q.label, value: (q.style === 'tag' ? tagLabel(item.answers[q.id]) : item.answers[q.id] || '—').slice(0, 1024) }))
    );
  if (item.history?.length) {
    embed.addFields({ name: `${e.log} Histórico`, value: item.history.slice(-5).map((h) => `${em(statusOf(f, { status: h.status }).emoji)} **${statusOf(f, { status: h.status }).label}** por <@${h.by}> ${ts(h.at)}${h.note ? `\n> ${h.note.slice(0, 200)}` : ''}`).join('\n').slice(0, 1024) });
  }
  const images = item.images ?? [];
  if (!images.length) return [embed];
  const galleryUrl = `https://discord.com/form/${id}/${item.n}`;
  embed.setURL(galleryUrl).setImage(`attachment://${images[0]}`);
  return [embed, ...images.slice(1).map((n) => new EmbedBuilder().setURL(galleryUrl).setImage(`attachment://${n}`))];
}

function buildButtons(id, item) {
  const f = form(id);
  const closed = f.statuses.find((s) => s.id === item.status)?.final;
  const rows = [];
  const buttons = f.statuses.map((s) => new ButtonBuilder().setCustomId(`form:st:${id}:${item.n}:${s.id}`)
    .setLabel(s.label.slice(0, 80)).setEmoji(em(s.emoji)).setStyle(STYLE[s.style] ?? ButtonStyle.Secondary)
    .setDisabled(!!closed || s.id === item.status));
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  return rows;
}

const tagLabel = (tid) => {
  const t = config.tags.find((x) => x.id === tid);
  return t ? `${t.emoji} ${t.label}` : tid ?? '—';
};

/* ───────────── Envio ───────────── */

async function submit(interaction, id) {
  const f = form(id);
  const g = db.guild(interaction.guild.id);
  const channel = g.channels[f.review] && interaction.guild.channels.cache.get(g.channels[f.review]);
  if (!channel) return interaction.reply({ embeds: [error(`O canal que recebe **${f.name}** ainda não foi configurado. Avise a staff (\`/setup staff\`).`)], flags: EPH });

  const uploaded = f.images ? [...(interaction.fields.getUploadedFiles('imagens')?.values() ?? [])] : [];
  const bad = uploaded.find((a) => !/^image\/(png|jpe?g|gif|webp)$/.test(a.contentType ?? '') || a.size > MAX_SIZE);
  if (bad) return interaction.reply({ embeds: [error(`Envie apenas imagens **PNG, JPG, GIF ou WEBP** de até 8 MB.\nRecusado: \`${bad.name}\``)], flags: EPH });
  await interaction.deferReply({ flags: EPH });

  const st = storeOf(interaction.guild.id, id);
  const n = ++st.counter;
  const files = [];
  for (const [i, a] of uploaded.slice(0, f.images).entries()) {
    const buf = await fetch(a.url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    if (!buf) continue;
    const ext = (a.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z]/g, '') || 'png';
    files.push(new AttachmentBuilder(Buffer.from(buf), { name: `${id}-${n}-${i + 1}.${ext}` }));
  }
  const answers = {};
  for (const q of f.fields) {
    answers[q.id] = q.style === 'tag' ? interaction.fields.getStringSelectValues(q.id)?.[0] ?? null : interaction.fields.getTextInputValue(q.id);
  }
  const item = {
    n, answers, images: files.map((x) => x.name), status: null, history: [],
    authorId: interaction.user.id, authorTag: interaction.user.username, authorAvatar: interaction.user.displayAvatarURL(), at: Date.now()
  };
  const mentions = f.level === 'admin' ? ['admin'] : Object.keys(config.levels);
  const ping = mentions.map((k) => g.roles[k]).filter(Boolean).map((r) => `<@&${r}>`).join(' ');
  const msg = await channel.send({ content: ping || undefined, embeds: buildEmbeds(id, item), components: buildButtons(id, item), files });
  item.channelId = channel.id;
  item.messageId = msg.id;
  st.items[n] = item;
  db.save();
  await interaction.editReply({ embeds: [success(`Seu **${f.name.toLowerCase()}** foi enviado (protocolo **#${f.tag}${n}**).\nVocê recebe as atualizações aqui na DM. ${e.star}`, 'Enviado')] });
}

/* ───────────── Mudança de status ───────────── */

async function setStatus(interaction, id, n, statusId) {
  const f = form(id);
  const item = storeOf(interaction.guild.id, id).items[n];
  if (!item) return interaction.reply({ embeds: [error('Protocolo não encontrado.')], flags: EPH });
  const raw = f.statuses.find((s) => s.id === statusId);
  if (!raw) return interaction.reply({ embeds: [error('Status inválido.')], flags: EPH });
  const st = { ...raw, label: raw.done ?? raw.label };
  const note = interaction.fields.getTextInputValue('nota')?.trim() || null;

  item.status = statusId;
  item.history.push({ status: statusId, by: interaction.user.id, at: Date.now(), note });
  db.save();

  // cargo ao aprovar (edital / tag)
  let roleText = '';
  if (st.role) {
    const roleKey = st.role === '$tag' ? `tag_${item.answers.tag}` : st.role;
    const roleId = db.guild(interaction.guild.id).roles[roleKey];
    const member = await interaction.guild.members.fetch(item.authorId).catch(() => null);
    if (roleId && member) {
      const ok = await member.roles.add(roleId, `${f.name} #${f.tag}${n}`).then(() => true).catch(() => false);
      roleText = ok ? `\n${e.check} Cargo <@&${roleId}> entregue.` : `\n${e.warn} Não consegui dar o cargo (o cargo do bot precisa ficar acima).`;
    } else if (!roleId) {
      roleText = `\n${e.warn} Cargo não configurado — use \`/setup cargo\`.`;
    }
  }

  const channel = interaction.guild.channels.cache.get(item.channelId);
  const msg = channel && (await channel.messages.fetch(item.messageId).catch(() => null));
  await msg?.edit({ embeds: buildEmbeds(id, item), components: buildButtons(id, item) }).catch(() => null);
  await interaction.reply({ embeds: [success(`**#${f.tag}${n}** → ${em(st.emoji)} **${st.label}**${roleText}`)], flags: EPH });

  // DM para o autor
  const author = await interaction.client.users.fetch(item.authorId).catch(() => null);
  await author?.send({ embeds: [base()
    .setTitle(`${em(st.emoji)} ${f.name} #${f.tag}${n}: ${st.label}`)
    .setDescription(`${note ? `> ${note}\n\n` : ''}${st.final ? 'Seu protocolo foi **finalizado**.' : 'Atualizamos o andamento do seu protocolo.'}`)
    .addFields({ name: 'Servidor', value: interaction.guild.name, inline: true })] }).catch(() => null);

  // resultado público (ex: edital)
  if (st.final && f.result) {
    const resCh = interaction.guild.channels.cache.get(db.guild(interaction.guild.id).channels[f.result]);
    await resCh?.send({ embeds: [base().setDescription(`${em(st.emoji)} <@${item.authorId}> — **${st.label}** no ${f.name.toLowerCase()}!${note && st.id !== 'reprovado' ? `\n> ${note}` : ''}`)] }).catch(() => null);
  }
  sendLog(interaction.guild, base().setTitle(`${em(f.emoji)} ${f.name} #${f.tag}${n}`).setDescription(`${em(st.emoji)} ${st.label} por ${interaction.user}${note ? `\n> ${note}` : ''}`));
}

/* ───────────── Roteador "form:..." ───────────── */

async function handle(interaction) {
  const [, action, id, n, statusId] = interaction.customId.split(':');
  const f = form(id);
  if (!f) return interaction.reply({ embeds: [error('Formulário não existe mais.')], flags: EPH });

  if (action === 'open') {
    if (f.staffOnly && !(await perms.check(interaction, 'suporte'))) return;
    if (f.once) { // só um em aberto por pessoa (ex: edital)
      const open = Object.values(storeOf(interaction.guild.id, id).items).find((i) => i.authorId === interaction.user.id && !f.statuses.find((s) => s.id === i.status)?.final);
      if (open) return interaction.reply({ embeds: [error(`Você já tem um **${f.name.toLowerCase()}** em análise (#${f.tag}${open.n}).`)], flags: EPH });
    }
    return interaction.showModal(modal(id));
  }
  if (action === 'submit') return submit(interaction, id);

  if (!(await perms.check(interaction, f.level))) return;
  if (action === 'st') { // pede observação opcional
    const st = f.statuses.find((s) => s.id === statusId);
    return interaction.showModal(new ModalBuilder().setCustomId(`form:note:${id}:${n}:${statusId}`).setTitle(`${st.label} — #${f.tag}${n}`.slice(0, 45))
      .addLabelComponents(new LabelBuilder().setLabel('Observação para o autor (opcional)')
        .setTextInputComponent(new TextInputBuilder().setCustomId('nota').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))));
  }
  if (action === 'note') return setStatus(interaction, id, n, statusId);
}

module.exports = { handle, panel, modal, buildEmbeds };
