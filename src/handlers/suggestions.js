/**
 * SUGESTÕES — dois sistemas com o mesmo visual:
 *   sug:  sugestões da comunidade (todo mundo envia e vota, Moderador+ aprova)
 *   ssug: sugestões da staff (só a equipe envia e vota, num canal privado; Admin+ aprova)
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, ChannelType, LabelBuilder, StringSelectMenuBuilder, FileUploadBuilder,
  TextDisplayBuilder, AttachmentBuilder, EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, progressBar, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;

const SCOPES = {
  sug: {
    store: 'suggestions', counter: 'suggestionCounter', channel: 'sugestoes', tag: '#',
    categories: () => config.suggestionCategories,
    modalTitle: '💡 Nova sugestão — Advanced',
    intro: 'Conte sua ideia para melhorar a cidade. Se tiver **prints, mapas ou referências**, anexe no final!',
    placeholder: 'Ex: Adicionar nova rota de fuga no porto',
    name: 'Sugestão', emoji: () => e.suggestion, approval: 'Aprovação da comunidade', voters: 'A comunidade',
    submitLevel: null, voteLevel: null, reviewLevel: 'moderador', file: 'sugestao', thread: '💬 Sugestão'
  },
  ssug: {
    store: 'staffSuggestions', counter: 'staffSuggestionCounter', channel: 'sugestoes_staff', tag: '#S',
    categories: () => config.staffSuggestionCategories,
    modalTitle: '🛠️ Sugestão da staff — Advanced',
    intro: 'Ideia para melhorar a **equipe, as regras ou o atendimento**? Só a staff vê e vota.',
    placeholder: 'Ex: Criar escala de horários no suporte',
    name: 'Sugestão da staff', emoji: () => e.staff, approval: 'Aprovação da equipe', voters: 'A equipe',
    submitLevel: 'suporte', voteLevel: 'suporte', reviewLevel: 'admin', file: 'sugestao-staff', thread: '🛠️ Staff'
  }
};

// getters para pegar o emoji atualizado (os emojis do bot são carregados ao ligar)
const STATUS = {
  pendente: { label: 'Em votação', get emoji() { return e.pending; }, color: config.colors.warning },
  aprovada: { label: 'Aprovada', get emoji() { return e.approved; }, color: config.colors.success },
  recusada: { label: 'Recusada', get emoji() { return e.rejected; }, color: config.colors.error }
};

const MAX_IMAGES = 3;
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB por imagem
const category = (sc, id) => sc.categories().find((c) => c.id === id) ?? sc.categories().at(-1);
const store = (g, sc) => (g[sc.store] ??= {});

/** Formulário: título, categoria, descrição e imagens */
function modal(scope = 'sug') {
  const sc = SCOPES[scope];
  return new ModalBuilder()
    .setCustomId(`${scope}:submit`)
    .setTitle(sc.modalTitle)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(sc.intro))
    .addLabelComponents(
      new LabelBuilder().setLabel('Título da sugestão').setTextInputComponent(
        new TextInputBuilder().setCustomId('titulo').setStyle(TextInputStyle.Short)
          .setMaxLength(80).setRequired(true).setPlaceholder(sc.placeholder)),
      new LabelBuilder().setLabel('Categoria').setStringSelectMenuComponent(
        new StringSelectMenuBuilder().setCustomId('categoria').setPlaceholder('Sobre o que é sua sugestão?')
          .setRequired(true)
          .addOptions(sc.categories().map((c) => ({ label: c.label, value: c.id, emoji: c.emoji })))),
      new LabelBuilder().setLabel('Descreva sua ideia').setTextInputComponent(
        new TextInputBuilder().setCustomId('descricao').setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1500).setRequired(true).setPlaceholder('Explique como funcionaria e por que melhora o servidor.')),
      new LabelBuilder().setLabel('Imagens (opcional)').setDescription(`Até ${MAX_IMAGES} imagens • PNG, JPG, GIF ou WEBP • até 8 MB`)
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('imagens').setRequired(false).setMinValues(0).setMaxValues(MAX_IMAGES))
    );
}

/** Embed principal + até 2 embeds extras que viram galeria de imagens no Discord */
function buildEmbeds(sug, scope = 'sug') {
  const sc = SCOPES[scope];
  const s = STATUS[sug.status];
  const up = sug.up.length, down = sug.down.length;
  const cat = sug.category ? category(sc, sug.category) : null;
  const embed = base(s.color)
    .setAuthor({ name: `${sc.name} ${sc.tag}${sug.id} • ${sug.authorTag}`, iconURL: sug.authorAvatar })
    .setTitle(`${sc.emoji()} ${sug.title}`)
    .setDescription(`${cat ? `${cat.emoji} **${cat.label}**\n` : ''}>>> ${sug.description}`)
    .addFields(
      { name: `${e.up} A favor`, value: `\`${up}\``, inline: true },
      { name: `${e.down} Contra`, value: `\`${down}\``, inline: true },
      { name: `${s.emoji} Status`, value: `**${s.label}**`, inline: true },
      { name: sc.approval, value: progressBar(up, down) }
    )
    .setThumbnail(sug.authorAvatar);
  if (sug.reviewer) {
    embed.addFields({
      name: `${e.staff} Resposta${scope === 'ssug' ? ' da administração' : ' da staff'}`,
      value: `${sug.reason || '*Sem motivo informado.*'}\n${e.arrow} por <@${sug.reviewer}>`
    });
  }
  const images = sug.images ?? [];
  if (!images.length) return [embed];
  // mesma URL em todas = o Discord junta as imagens numa galeria
  const galleryUrl = `https://discord.com/${scope}/${sug.id}`;
  embed.setURL(galleryUrl).setImage(`attachment://${images[0]}`);
  return [embed, ...images.slice(1).map((name) => new EmbedBuilder().setURL(galleryUrl).setImage(`attachment://${name}`))];
}

function buildButtons(sug, scope = 'sug') {
  const closed = sug.status !== 'pendente';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${scope}:up:${sug.id}`).setEmoji(e.up)
        .setLabel(String(sug.up.length)).setStyle(ButtonStyle.Success).setDisabled(closed),
      new ButtonBuilder().setCustomId(`${scope}:down:${sug.id}`).setEmoji(e.down)
        .setLabel(String(sug.down.length)).setStyle(ButtonStyle.Danger).setDisabled(closed),
      new ButtonBuilder().setCustomId(`${scope}:approve:${sug.id}`).setEmoji(e.check)
        .setLabel('Aprovar').setStyle(ButtonStyle.Secondary).setDisabled(closed),
      new ButtonBuilder().setCustomId(`${scope}:reject:${sug.id}`).setEmoji(e.cross)
        .setLabel('Recusar').setStyle(ButtonStyle.Secondary).setDisabled(closed)
    )
  ];
}

/** Painel da staff com o botão de enviar */
function staffPanel() {
  const embed = base()
    .setTitle(`${e.staff} Sugestões da Staff — ${config.brand.name}`)
    .setDescription([
      'Espaço **exclusivo da equipe** para propor melhorias internas.',
      line,
      `${e.dot} Clique em **Enviar sugestão** e preencha o formulário`,
      `${e.dot} Escolha a **categoria** e anexe até **3 imagens**`,
      `${e.dot} A equipe vota com ${e.up} / ${e.down}`,
      `${e.dot} A **administração** aprova ou recusa e você recebe a resposta na DM`,
      line,
      `${e.lock} Só a staff consegue enviar e votar aqui.`
    ].join('\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ssug:open').setLabel('Enviar sugestão').setEmoji(e.staff).setStyle(ButtonStyle.Primary)
    )]
  }, embed, 'staff');
}

async function submit(interaction, scope) {
  const sc = SCOPES[scope];
  const g = db.guild(interaction.guild.id);
  const channel = g.channels[sc.channel] && interaction.guild.channels.cache.get(g.channels[sc.channel]);
  if (!channel) {
    return interaction.reply({ embeds: [error(`O canal de ${sc.name.toLowerCase()} ainda não foi configurado. Peça para um admin usar \`/setup ${scope === 'ssug' ? 'staff' : 'canal'}\`.`)], flags: EPH });
  }

  // Imagens enviadas no formulário: baixa e reenvia junto da sugestão (o link do formulário expira)
  const uploaded = [...(interaction.fields.getUploadedFiles('imagens')?.values() ?? [])];
  const invalid = uploaded.filter((a) => !/^image\/(png|jpe?g|gif|webp)$/.test(a.contentType ?? '') || a.size > MAX_SIZE);
  if (invalid.length) {
    return interaction.reply({ embeds: [error(`Envie apenas imagens **PNG, JPG, GIF ou WEBP** de até **8 MB**.\nArquivo recusado: \`${invalid[0].name}\``)], flags: EPH });
  }
  await interaction.deferReply({ flags: EPH });

  g[sc.counter] = (g[sc.counter] ?? 0) + 1;
  const id = g[sc.counter];
  const files = [];
  for (const [n, a] of uploaded.slice(0, MAX_IMAGES).entries()) {
    const buf = await fetch(a.url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    if (!buf) continue;
    const ext = (a.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z]/g, '') || 'png';
    files.push(new AttachmentBuilder(Buffer.from(buf), { name: `${sc.file}-${id}-${n + 1}.${ext}` }));
  }

  const sug = {
    id,
    title: interaction.fields.getTextInputValue('titulo'),
    category: interaction.fields.getStringSelectValues('categoria')?.[0] ?? null,
    description: interaction.fields.getTextInputValue('descricao'),
    images: files.map((f) => f.name),
    authorId: interaction.user.id,
    authorTag: interaction.user.username,
    authorAvatar: interaction.user.displayAvatarURL(),
    up: [], down: [],
    status: 'pendente',
    createdAt: Date.now()
  };

  const msg = await channel.send({ embeds: buildEmbeds(sug, scope), components: buildButtons(sug, scope), files });
  sug.messageId = msg.id;
  sug.channelId = channel.id;
  store(g, sc)[sug.id] = sug;
  db.save();

  if (channel.type === ChannelType.GuildText) {
    msg.startThread({ name: `${sc.thread} ${sc.tag}${sug.id} — Debate`, autoArchiveDuration: 10080 }).catch(() => null);
  }

  await interaction.editReply({
    embeds: [success(`Sua sugestão **${sc.tag}${sug.id}** foi enviada em ${channel}!${files.length ? ` (${files.length} imagem${files.length > 1 ? 'ns' : ''})` : ''}\n${sc.voters} já pode votar. ${e.star}`, 'Sugestão enviada')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ver sugestão').setStyle(ButtonStyle.Link).setURL(msg.url))]
  });
}

async function vote(interaction, sug, type, scope) {
  const uid = interaction.user.id;
  const other = type === 'up' ? 'down' : 'up';
  sug[other] = sug[other].filter((id) => id !== uid);
  let text;
  if (sug[type].includes(uid)) {
    sug[type] = sug[type].filter((id) => id !== uid);
    text = 'Seu voto foi **removido**.';
  } else {
    sug[type].push(uid);
    text = `Você votou ${type === 'up' ? `**a favor** ${e.up}` : `**contra** ${e.down}`}.`;
  }
  db.save();
  await interaction.update({ embeds: buildEmbeds(sug, scope), components: buildButtons(sug, scope) });
  await interaction.followUp({ embeds: [success(text, 'Voto registrado')], flags: EPH });
}

async function askReason(interaction, sug, action, scope) {
  if (!(await perms.check(interaction, SCOPES[scope].reviewLevel))) return;
  const m = new ModalBuilder()
    .setCustomId(`${scope}:reason:${action}:${sug.id}`)
    .setTitle(`${action === 'approve' ? 'Aprovar' : 'Recusar'} sugestão ${SCOPES[scope].tag}${sug.id}`)
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('motivo').setLabel('Motivo / resposta (opcional)')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
    ));
  await interaction.showModal(m);
}

async function review(interaction, sug, action, scope) {
  if (!(await perms.check(interaction, SCOPES[scope].reviewLevel))) return;
  const sc = SCOPES[scope];
  sug.status = action === 'approve' ? 'aprovada' : 'recusada';
  sug.reviewer = interaction.user.id;
  sug.reason = interaction.fields.getTextInputValue('motivo');
  db.save();

  const channel = interaction.guild.channels.cache.get(sug.channelId);
  const msg = channel && (await channel.messages.fetch(sug.messageId).catch(() => null));
  if (msg) await msg.edit({ embeds: buildEmbeds(sug, scope), components: buildButtons(sug, scope) });

  const st = STATUS[sug.status];
  await interaction.reply({ embeds: [success(`Sugestão **${sc.tag}${sug.id}** marcada como ${st.emoji} **${st.label}**.`)], flags: EPH });

  // Avisa o autor na DM
  const author = await interaction.client.users.fetch(sug.authorId).catch(() => null);
  author?.send({
    embeds: [base(st.color)
      .setTitle(`${st.emoji} Sua ${sc.name.toLowerCase()} foi ${st.label.toLowerCase()}!`)
      .setDescription(`**${sug.title}**\n\n${sug.reason ? `> ${sug.reason}` : ''}`)
      .addFields({ name: 'Servidor', value: interaction.guild.name, inline: true })]
  }).catch(() => null);

  sendLog(interaction.guild, base(st.color).setTitle(`${e.log} ${sc.name} revisada`)
    .setDescription(`**${sc.tag}${sug.id}** — ${sug.title}\n${st.emoji} ${st.label} por ${interaction.user}`));
}

/** Roteador de customIds "sug:..." e "ssug:..." */
async function handle(interaction) {
  const [scope, action, a, b] = interaction.customId.split(':');
  const sc = SCOPES[scope];
  if (!sc) return;

  // sugestões da staff: só a equipe envia/vota
  if (sc.submitLevel && ['open', 'submit', 'up', 'down'].includes(action) && !(await perms.check(interaction, sc.submitLevel))) return;

  if (action === 'open') return interaction.showModal(modal(scope));
  if (action === 'submit') return submit(interaction, scope);

  const g = db.guild(interaction.guild.id);
  const id = action === 'reason' ? b : a;
  const sug = store(g, sc)[id];
  if (!sug) return interaction.reply({ embeds: [error('Sugestão não encontrada.')], flags: EPH });
  if (sug.status !== 'pendente') return interaction.reply({ embeds: [error('Essa sugestão já foi revisada.')], flags: EPH });

  if (action === 'up' || action === 'down') return vote(interaction, sug, action, scope);
  if (action === 'approve' || action === 'reject') return askReason(interaction, sug, action, scope);
  if (action === 'reason') return review(interaction, sug, a, scope);
}

module.exports = { handle, modal, staffPanel, SCOPES };
