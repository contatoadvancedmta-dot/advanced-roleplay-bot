const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const perms = require('../utils/permissions');
const admin = require('../handlers/admin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('👑 Gerenciador de staff (somente donos)')
    .addSubcommand((s) => s.setName('painel').setDescription('Abre o painel de gerenciamento com botões'))
    .addSubcommand((s) => s.setName('adicionar').setDescription('Adiciona ou altera o nível de um membro da staff')
      .addUserOption((o) => o.setName('membro').setDescription('Membro').setRequired(true))
      .addStringOption((o) => o.setName('nivel').setDescription('Nível').setRequired(true)
        .addChoices(...Object.entries(config.levels).map(([k, v]) => ({ name: v.label, value: k })))))
    .addSubcommand((s) => s.setName('remover').setDescription('Remove um membro da staff')
      .addUserOption((o) => o.setName('membro').setDescription('Membro').setRequired(true)))
    .addSubcommand((s) => s.setName('lista').setDescription('Mostra toda a equipe')),

  async execute(interaction) {
    if (!(await perms.check(interaction, 'owner'))) return;
    const sub = interaction.options.getSubcommand();
    if (sub === 'painel') return interaction.reply(admin.panel());
    if (sub === 'lista') return interaction.reply({ embeds: [admin.listEmbed(interaction.guild)] });
    const user = interaction.options.getUser('membro');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const embed = sub === 'adicionar'
      ? await admin.setLevel(interaction, user.id, interaction.options.getString('nivel'))
      : await admin.removeStaff(interaction, user.id);
    await interaction.editReply({ embeds: [embed] });
  }
};
