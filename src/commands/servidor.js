const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, e } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');

module.exports = {
  data: new SlashCommandBuilder().setName('servidor').setDescription('🚔 Informações do Advanced Fugas'),
  async execute(interaction) {
    const guild = interaction.guild;
    const g = db.guild(guild.id);
    const embed = base()
      .setTitle(`${e.logo} ${config.brand.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? config.brand.logo)
      .addFields(
        { name: `${e.user} Membros`, value: `\`${guild.memberCount}\``, inline: true },
        { name: `${e.staff} Staff`, value: `\`${Object.keys(g.admins).length}\``, inline: true },
        { name: `${e.suggestion} Sugestões`, value: `\`${g.suggestionCounter}\``, inline: true },
        { name: `${e.clock} Criado em`, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: `${e.crown} Dono`, value: `<@${guild.ownerId}>`, inline: true }
      );
    if (config.brand.connect) embed.addFields({ name: `${e.car} Conectar`, value: `\`\`\`${config.brand.connect}\`\`\`` });
    const buttons = [];
    if (config.fivem.joinUrl) buttons.push(new ButtonBuilder().setLabel('Entrar na cidade').setStyle(ButtonStyle.Link).setURL(config.fivem.joinUrl).setEmoji(e.car));
    if (config.brand.site) buttons.push(new ButtonBuilder().setLabel('Site oficial').setStyle(ButtonStyle.Link).setURL(config.brand.site).setEmoji(e.star));
    const components = buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [];
    await interaction.reply(withBanner({ embeds: [embed], components }, embed, 'perfil-bot'));
  }
};
