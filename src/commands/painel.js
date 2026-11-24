const config = require('../../config');
const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const { success } = require('../utils/embeds');
const panels = require('../handlers/panels');
const tickets = require('../handlers/tickets');
const admin = require('../handlers/admin');
const whitelist = require('../handlers/whitelist');
const fivem = require('../handlers/fivem');

const TYPES = {
  sugestoes: () => panels.suggestionPanel(),
  tickets: () => tickets.panel(),
  verificacao: () => panels.verifyPanel(),
  regras: () => panels.rulesPanel(),
  staff: () => admin.panel(),
  sugestoes_staff: () => require('../handlers/suggestions').staffPanel(),
  ...Object.fromEntries(Object.keys(config.forms).map((id) => [`form_${id}`, () => require('../handlers/forms').panel(id)])),
  ponto: () => null, // tratado abaixo (precisa do servidor)
  feedback: () => require('../handlers/feedback').panel(),
  ip: () => require('./cidade')[0].ipMessage(),
  whitelist: () => whitelist.panel(),
  status: async () => fivem.statusMessage(await fivem.fetchStatus())
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('🧩 Envia um painel com botões')
    .addStringOption((o) => o.setName('tipo').setDescription('Qual painel').setRequired(true).addChoices(
      { name: '💡 Sugestões', value: 'sugestoes' },
      { name: '🛠️ Sugestões da staff', value: 'sugestoes_staff' },
      ...Object.entries(config.forms).map(([id, f]) => ({ name: `📝 ${f.name}`, value: `form_${id}` })),
      { name: '⏰ Bate-ponto', value: 'ponto' },
      { name: '⭐ Feedback da staff', value: 'feedback' },
      { name: '🏙️ IP da cidade', value: 'ip' },
      { name: '🎫 Tickets', value: 'tickets' },
      { name: '✔️ Verificação', value: 'verificacao' },
      { name: '📜 Regras', value: 'regras' },
      { name: '📝 Whitelist', value: 'whitelist' },
      { name: '🖥️ Status da cidade', value: 'status' },
      { name: '👑 Gerenciador de staff (donos)', value: 'staff' }
    ))
    .addChannelOption((o) => o.setName('canal').setDescription('Onde enviar (padrão: aqui)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    const tipo = interaction.options.getString('tipo');
    if (!(await perms.check(interaction, tipo === 'staff' ? 'owner' : 'admin'))) return;
    const channel = interaction.options.getChannel('canal') ?? interaction.channel;
    const payload = tipo === 'ponto' ? require('../handlers/ponto').panel(interaction.guild.id) : await TYPES[tipo]();
    const sent = await channel.send(payload);
    if (tipo === 'ponto') { // painel de ponto se atualiza com quem está em serviço
      require('../handlers/ponto').data(interaction.guild.id).panel = { channelId: channel.id, messageId: sent.id };
      require('../database').save();
    }
    if (tipo === 'status') { // essa mensagem passa a ser atualizada sozinha
      const g = require('../database').guild(interaction.guild.id);
      const oldCh = g.channels.status && interaction.guild.channels.cache.get(g.channels.status);
      if (g.status?.messageId && g.status.messageId !== sent.id) await oldCh?.messages.delete(g.status.messageId).catch(() => null);
      g.channels.status = channel.id;
      g.status = { messageId: sent.id };
      require('../database').save();
    }
    await interaction.reply({ embeds: [success(`Painel enviado em ${channel}.`)], flags: MessageFlags.Ephemeral });
  }
};
