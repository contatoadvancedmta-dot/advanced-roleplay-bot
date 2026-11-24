/**
 * FEEDBACK DA STAFF — o membro escolhe o staff, dá nota e comenta. Entra no ranking de atendimento.
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, LabelBuilder, UserSelectMenuBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const COOLDOWN = 24 * 36e5; // 1 avaliação por staff a cada 24h

function panel() {
  const embed = base().setTitle(`${e.star} Feedback da Staff — ${config.brand.name}`)
    .setDescription([
      'Foi atendido por alguém da equipe? Conte como foi!',
      line,
      `${e.dot} Escolha **quem te atendeu**`,
      `${e.dot} Dê uma nota de **1 a 5 ⭐**`,
      `${e.dot} Deixe um comentário (opcional)`,
      line,
      `${e.info} As notas entram no ranking de atendimento da staff.`
    ].join('\n'));
  return withBanner({ embeds: [embed], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fb:open').setLabel('Avaliar staff').setEmoji(e.star).setStyle(ButtonStyle.Primary))] }, embed, 'feedback');
}

function modal() {
  return new ModalBuilder().setCustomId('fb:submit').setTitle('Avaliar atendimento').addLabelComponents(
    new LabelBuilder().setLabel('Quem te atendeu?').setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('staff').setRequired(true).setMaxValues(1)),
    new LabelBuilder().setLabel('Nota').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('nota').setRequired(true).setPlaceholder('Escolha de 1 a 5')
      .addOptions([5, 4, 3, 2, 1].map((n) => ({ label: `${'⭐'.repeat(n)}  (${n})`, value: String(n) })))),
    new LabelBuilder().setLabel('Comentário (opcional)').setTextInputComponent(new TextInputBuilder().setCustomId('comentario')
      .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(600))
  );
}

async function handle(interaction) {
  const action = interaction.customId.split(':')[1];
  if (action === 'open') return interaction.showModal(modal());
  if (action !== 'submit') return;

  const staff = interaction.fields.getSelectedUsers('staff')?.first();
  const stars = Number(interaction.fields.getStringSelectValues('nota')?.[0] ?? 0);
  const comment = interaction.fields.getTextInputValue('comentario')?.trim();
  if (!staff || !stars) return interaction.reply({ embeds: [error('Escolha o staff e a nota.')], flags: EPH });
  if (staff.id === interaction.user.id) return interaction.reply({ embeds: [error('Você não pode se avaliar 😅')], flags: EPH });
  const member = await interaction.guild.members.fetch(staff.id).catch(() => null);
  if (!member || perms.weight(member) < 1) return interaction.reply({ embeds: [error(`${staff} não faz parte da staff.`)], flags: EPH });

  const g = db.guild(interaction.guild.id);
  g.ratings ??= [];
  const recent = g.ratings.find((r) => r.userId === interaction.user.id && r.staffId === staff.id && r.source === 'feedback' && Date.now() - r.at < COOLDOWN);
  if (recent) return interaction.reply({ embeds: [error(`Você já avaliou ${staff} nas últimas 24h.`)], flags: EPH });
  g.ratings.push({ staffId: staff.id, stars, userId: interaction.user.id, at: Date.now(), source: 'feedback', comment: comment || null });
  db.save();

  const ch = interaction.guild.channels.cache.get(g.channels.feedback_staff);
  await ch?.send({ embeds: [base()
    .setAuthor({ name: `Feedback de ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(`${e.staff} **Staff:** ${staff}\n${e.star} **Nota:** ${'⭐'.repeat(stars)} (${stars}/5)${comment ? `\n\n>>> ${comment}` : ''}`)
    .setThumbnail(staff.displayAvatarURL())] }).catch(() => null);
  staff.send({ embeds: [base().setTitle(`${e.star} Você recebeu um feedback!`).setDescription(`${'⭐'.repeat(stars)} (${stars}/5)${comment ? `\n> ${comment}` : ''}`)] }).catch(() => null);
  require('./rankingBoard').touch(interaction.client);
  await interaction.reply({ embeds: [success(`Obrigado! Sua avaliação para ${staff} foi registrada.`, 'Feedback enviado')], flags: EPH });
}

module.exports = { handle, panel };
