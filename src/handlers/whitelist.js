/**
 * WHITELIST — formulário por botão, análise da staff com Aprovar/Reprovar
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const wl = config.whitelist;

function panel() {
  const embed = base()
    .setTitle(`${e.whitelist} Whitelist — ${config.brand.name}`)
    .setDescription([
      'Quer entrar na cidade? Faça sua **whitelist**!',
      line,
      `${e.dot} Clique em **Fazer whitelist** e responda o formulário`,
      `${e.dot} Nossa equipe vai analisar suas respostas`,
      `${e.dot} Você recebe o resultado na **DM**`,
      line,
      `${e.warn} Leia as regras antes. Se reprovar, aguarde **${wl.cooldownHours}h** para tentar novamente.`
    ].join('\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wl:open').setLabel('Fazer whitelist').setEmoji(e.whitelist).setStyle(ButtonStyle.Success)
    )]
  }, embed, 'whitelist');
}

function modal() {
  return new ModalBuilder().setCustomId('wl:submit').setTitle(`Whitelist — ${config.brand.name}`.slice(0, 45))
    .addComponents(wl.questions.slice(0, 5).map((q) => new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(q.id).setLabel(q.label.slice(0, 45))
        .setStyle(q.style === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setMaxLength(q.max ?? 1000).setRequired(true)
    )));
}

function reviewEmbed(entry, user, status) {
  const colors = { pendente: config.colors.warning, aprovada: config.colors.success, reprovada: config.colors.error };
  const labels = { pendente: `${e.pending} Aguardando análise`, aprovada: `${e.approved} Aprovada`, reprovada: `${e.rejected} Reprovada` };
  const embed = base(colors[status])
    .setAuthor({ name: `Whitelist • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setTitle(`${e.whitelist} Nova whitelist — tentativa #${entry.attempts}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: `${e.user} Membro`, value: `<@${entry.userId}>\n\`${entry.userId}\``, inline: true },
      { name: `${e.clock} Conta criada`, value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Status', value: labels[status], inline: true },
      ...wl.questions.map((q) => ({ name: q.label, value: (entry.answers[q.id] || '—').slice(0, 1024) }))
    );
  if (entry.reviewer) embed.addFields({ name: `${e.staff} Analisado por`, value: `<@${entry.reviewer}>${entry.reason ? `\n> ${entry.reason}` : ''}` });
  return embed;
}

function reviewButtons(userId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`wl:approve:${userId}`).setLabel('Aprovar').setEmoji(e.check).setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`wl:reject:${userId}`).setLabel('Reprovar').setEmoji(e.cross).setStyle(ButtonStyle.Danger).setDisabled(disabled)
  )];
}

async function open(interaction) {
  const g = db.guild(interaction.guild.id);
  const entry = g.whitelist[interaction.user.id];
  if (g.roles.whitelist && interaction.member.roles.cache.has(g.roles.whitelist)) {
    return interaction.reply({ embeds: [success('Você já está na whitelist! Bom jogo na cidade.')], flags: EPH });
  }
  if (entry?.status === 'pendente') {
    return interaction.reply({ embeds: [error('Sua whitelist já está em análise. Aguarde a resposta na DM.')], flags: EPH });
  }
  if (entry?.status === 'reprovada') {
    const retry = entry.reviewedAt + wl.cooldownHours * 3_600_000;
    if (Date.now() < retry) {
      return interaction.reply({ embeds: [error(`Você poderá tentar novamente <t:${Math.floor(retry / 1000)}:R>.`)], flags: EPH });
    }
  }
  await interaction.showModal(modal());
}

async function submit(interaction) {
  const g = db.guild(interaction.guild.id);
  const channel = g.channels.whitelist && interaction.guild.channels.cache.get(g.channels.whitelist);
  if (!channel) return interaction.reply({ embeds: [error('Canal de análise da whitelist não configurado (`/setup staff` → Análise da whitelist).')], flags: EPH });

  const prev = g.whitelist[interaction.user.id];
  const entry = {
    userId: interaction.user.id,
    answers: Object.fromEntries(wl.questions.map((q) => [q.id, interaction.fields.getTextInputValue(q.id)])),
    status: 'pendente',
    attempts: (prev?.attempts ?? 0) + 1,
    sentAt: Date.now()
  };
  g.whitelist[interaction.user.id] = entry;
  db.save();

  const mentions = Object.keys(config.levels).map((l) => g.roles[l]).filter(Boolean).map((id) => `<@&${id}>`).join(' ');
  await channel.send({ content: mentions || undefined, embeds: [reviewEmbed(entry, interaction.user, 'pendente')], components: reviewButtons(entry.userId) });
  await interaction.reply({ embeds: [success('Sua whitelist foi enviada! A equipe vai analisar e você recebe o resultado na DM.', 'Whitelist enviada')], flags: EPH });
}

async function finish(interaction, userId, approved, reason) {
  const g = db.guild(interaction.guild.id);
  const entry = g.whitelist[userId];
  entry.status = approved ? 'aprovada' : 'reprovada';
  entry.reviewer = interaction.user.id;
  entry.reviewedAt = Date.now();
  entry.reason = reason || null;
  db.save();

  const user = await interaction.client.users.fetch(userId);
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (approved && member) {
    if (g.roles.whitelist) await member.roles.add(g.roles.whitelist, 'Whitelist aprovada').catch(() => null);
    if (wl.nickname) {
      const nick = wl.nickname.replace(/\{(\w+)\}/g, (_, k) => entry.answers[k] ?? '').slice(0, 32);
      await member.setNickname(nick).catch(() => null);
    }
  }

  await interaction.message?.edit({ embeds: [reviewEmbed(entry, user, entry.status)], components: reviewButtons(userId, true) }).catch(() => null);

  user.send({ embeds: [base(approved ? config.colors.success : config.colors.error)
    .setTitle(approved ? `${e.approved} Whitelist aprovada!` : `${e.rejected} Whitelist reprovada`)
    .setDescription(approved
      ? `Parabéns! Você foi aprovado(a) no **${config.brand.name}**. ${e.car}\nJá pode entrar na cidade!${config.brand.connect ? `\n\`\`\`${config.brand.connect}\`\`\`` : ''}`
      : `Infelizmente sua whitelist no **${config.brand.name}** foi reprovada.\n${reason ? `> ${reason}\n` : ''}\nVocê pode tentar novamente em **${wl.cooldownHours}h**.`)]
  }).catch(() => null);

  const resultId = g.channels.whitelistresultado;
  const resultCh = resultId && interaction.guild.channels.cache.get(resultId);
  resultCh?.send({ embeds: [base(approved ? config.colors.success : config.colors.error)
    .setDescription(`${approved ? e.approved : e.rejected} <@${userId}> foi **${approved ? 'aprovado(a)' : 'reprovado(a)'}** na whitelist!`)] }).catch(() => null);

  sendLog(interaction.guild, base(approved ? config.colors.success : config.colors.error).setTitle(`${e.whitelist} Whitelist ${entry.status}`)
    .setDescription(`<@${userId}> por ${interaction.user}${reason ? `\n> ${reason}` : ''}`));
}

async function handle(interaction) {
  const [, action, userId] = interaction.customId.split(':');
  if (action === 'open') return open(interaction);
  if (action === 'submit') return submit(interaction);

  if (!(await perms.check(interaction, 'suporte'))) return;
  const entry = db.guild(interaction.guild.id).whitelist[userId];
  if (!entry || entry.status !== 'pendente') {
    return interaction.reply({ embeds: [error('Essa whitelist já foi analisada.')], flags: EPH });
  }

  if (action === 'approve') {
    await interaction.deferReply({ flags: EPH });
    await finish(interaction, userId, true);
    return interaction.editReply({ embeds: [success(`Whitelist de <@${userId}> **aprovada**.`)] });
  }
  if (action === 'reject') {
    return interaction.showModal(new ModalBuilder().setCustomId(`wl:reason:${userId}`).setTitle('Reprovar whitelist')
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('motivo').setLabel('Motivo da reprovação').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      )));
  }
  if (action === 'reason') {
    await interaction.deferReply({ flags: EPH });
    await finish(interaction, userId, false, interaction.fields.getTextInputValue('motivo'));
    return interaction.editReply({ embeds: [success(`Whitelist de <@${userId}> **reprovada**.`)] });
  }
}

module.exports = { handle, panel };
