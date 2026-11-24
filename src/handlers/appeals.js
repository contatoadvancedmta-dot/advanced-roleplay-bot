/**
 * RECURSO DE BANIMENTO — o banido clica no botão da DM, preenche e a staff decide
 * (funciona fora do servidor, pela DM do bot)
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;

async function handle(interaction) {
  const [, action, guildId, userId] = interaction.customId.split(':');
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) return interaction.reply({ embeds: [error('Servidor não encontrado.')], flags: EPH });
  const g = db.guild(guildId);

  if (action === 'open') {
    if (g.appeals[interaction.user.id]?.status === 'pendente') {
      return interaction.reply({ embeds: [error('Você já tem um recurso em análise.')] });
    }
    if (g.appeals[interaction.user.id]?.status === 'negado') {
      return interaction.reply({ embeds: [error('Seu recurso já foi analisado e negado.')] });
    }
    return interaction.showModal(new ModalBuilder().setCustomId(`appeal:submit:${guildId}`).setTitle('Recurso de banimento')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('porque').setLabel('Por que você foi banido?')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('defesa').setLabel('Por que devemos te desbanir?')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))
      ));
  }

  if (action === 'submit') {
    const channel = guild.channels.cache.get(g.channels.recursos);
    if (!channel) return interaction.reply({ embeds: [error('O servidor não está recebendo recursos no momento.')] });
    g.appeals[interaction.user.id] = { status: 'pendente', at: Date.now() };
    db.save();
    const banCase = Object.values(g.cases).filter((c) => c.userId === interaction.user.id && c.type === 'ban').pop();
    await channel.send({
      embeds: [base(config.colors.warning)
        .setAuthor({ name: `Recurso • ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setTitle(`${e.whitelist} Pedido de desbanimento`)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: `${e.user} Usuário`, value: `<@${interaction.user.id}> \`${interaction.user.id}\``, inline: true },
          { name: `${e.ban} Banimento`, value: banCase ? `Caso #${banCase.id} • ${ts(banCase.at)}\n> ${banCase.reason || 'sem motivo'}` : 'Sem registro', inline: true },
          { name: 'Por que foi banido?', value: interaction.fields.getTextInputValue('porque') },
          { name: 'Por que devemos desbanir?', value: interaction.fields.getTextInputValue('defesa') }
        )],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`appeal:accept:${guildId}:${interaction.user.id}`).setLabel('Aceitar e desbanir').setEmoji(e.check).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`appeal:deny:${guildId}:${interaction.user.id}`).setLabel('Negar').setEmoji(e.cross).setStyle(ButtonStyle.Danger)
      )]
    });
    await interaction.message?.edit({ components: [] }).catch(() => null);
    return interaction.reply({ embeds: [success('Seu recurso foi enviado! A staff vai analisar e você recebe a resposta aqui.', 'Recurso enviado')] });
  }

  // Decisão da staff
  if (!(await perms.check(interaction, 'admin'))) return;
  const appeal = g.appeals[userId];
  if (!appeal || appeal.status !== 'pendente') return interaction.reply({ embeds: [error('Esse recurso já foi analisado.')], flags: EPH });
  const user = await interaction.client.users.fetch(userId);
  const accepted = action === 'accept';
  appeal.status = accepted ? 'aceito' : 'negado';
  appeal.by = interaction.user.id;
  db.save();

  let invite = null;
  if (accepted) {
    const { punish } = require('./moderation');
    await punish(guild, { type: 'unban', user, mod: interaction.member, reason: 'Recurso aceito' }).catch(() => null);
    const ch = guild.channels.cache.get(g.channels.boasvindas) ?? guild.systemChannel;
    invite = await ch?.createInvite({ maxUses: 1, maxAge: 86400, unique: true }).catch(() => null);
  }
  await user.send({ embeds: [base(accepted ? config.colors.success : config.colors.error)
    .setTitle(accepted ? `${e.approved} Recurso aceito!` : `${e.rejected} Recurso negado`)
    .setDescription(accepted
      ? `Você foi desbanido do **${guild.name}**. Respeite as regras!${invite ? `\n\n${e.arrow} Volte pelo convite: ${invite.url}` : ''}`
      : `Seu pedido de desbanimento no **${guild.name}** foi negado.`)] }).catch(() => null);

  await interaction.update({
    embeds: [...interaction.message.embeds, base(accepted ? config.colors.success : config.colors.error)
      .setDescription(`${accepted ? e.approved : e.rejected} Recurso **${accepted ? 'aceito' : 'negado'}** por ${interaction.user}`)],
    components: []
  });
}

module.exports = { handle };
