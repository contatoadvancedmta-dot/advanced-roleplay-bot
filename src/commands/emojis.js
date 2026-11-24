const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const perms = require('../utils/permissions');
const emojis = require('../handlers/emojis');
const { base, success, error, e } = require('../utils/embeds');

const EPH = MessageFlags.Ephemeral;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emojis')
    .setDescription('😎 Emojis próprios do Advanced (somente donos)')
    .addSubcommand((s) => s.setName('lista').setDescription('Mostra todos os emojis do bot'))
    .addSubcommand((s) => s.setName('sincronizar').setDescription('Envia os emojis da pasta assets/emojis')
      .addBooleanOption((o) => o.setName('reenviar').setDescription('Reenviar todos (use depois de trocar as imagens)')))
    .addSubcommand((s) => s.setName('adicionar').setDescription('Troca um emoji do bot por uma imagem sua')
      .addStringOption((o) => o.setName('chave').setDescription('Qual emoji trocar (ex: check, logo, ticket)').setRequired(true).setAutocomplete(true))
      .addAttachmentOption((o) => o.setName('imagem').setDescription('PNG/GIF quadrado, até 256KB').setRequired(true))),

  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toLowerCase();
    await interaction.respond(Object.keys(config.emojis).filter((k) => k.includes(q)).slice(0, 25).map((k) => ({ name: k, value: k })));
  },

  async execute(interaction) {
    if (!(await perms.check(interaction, 'owner'))) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'lista') {
      const lines = Object.entries(config.emojis).map(([k, v]) => `${v} \`${k}\``);
      const half = Math.ceil(lines.length / 2);
      return interaction.reply({ embeds: [base().setTitle(`${e.logo} Emojis do ${config.brand.name}`)
        .addFields({ name: '​', value: lines.slice(0, half).join('\n'), inline: true },
                   { name: '​', value: lines.slice(half).join('\n'), inline: true })], flags: EPH });
    }

    await interaction.deferReply({ flags: EPH });
    if (sub === 'sincronizar') {
      const r = await emojis.sync(interaction.client, interaction.options.getBoolean('reenviar') ?? false);
      return interaction.editReply({ embeds: [success(`**${r.created}** emojis enviados • **${r.total}** na pasta.\nOs emojis já estão sendo usados pelo bot. ${e.star}`, 'Emojis sincronizados')] });
    }

    const key = interaction.options.getString('chave');
    const file = interaction.options.getAttachment('imagem');
    if (!(key in config.emojis)) return interaction.editReply({ embeds: [error(`A chave \`${key}\` não existe. Veja \`/emojis lista\`.`)] });
    if (!/image\/(png|gif|jpeg|webp)/.test(file.contentType ?? '') || file.size > 256_000) {
      return interaction.editReply({ embeds: [error('Envie um PNG/GIF/JPG de até **256KB**.')] });
    }
    try {
      const existing = await interaction.client.application.emojis.fetch();
      const emoji = await emojis.upload(interaction.client, key, file.url, existing);
      await interaction.editReply({ embeds: [success(`Emoji \`${key}\` trocado por <${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`, 'Emoji atualizado')] });
    } catch (err) {
      await interaction.editReply({ embeds: [error(`Não consegui enviar: ${err.message}`)] });
    }
  }
};
