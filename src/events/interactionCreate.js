const { MessageFlags } = require('discord.js');
const { error } = require('../utils/embeds');
const suggestions = require('../handlers/suggestions');
const tickets = require('../handlers/tickets');
const admin = require('../handlers/admin');
const panels = require('../handlers/panels');
const announce = require('../handlers/announce');
const whitelist = require('../handlers/whitelist');
const giveaways = require('../handlers/giveaways');
const moderation = require('../handlers/moderation');
const appeals = require('../handlers/appeals');
const forms = require('../handlers/forms');
const ponto = require('../handlers/ponto');
const feedback = require('../handlers/feedback');
const supportQueue = require('../handlers/supportQueue');
const instagram = require('../handlers/instagram');
const pixCommand = require('../commands/pix');

// prefixo do customId -> handler
const ROUTES = {
  sug: suggestions.handle,
  ssug: suggestions.handle,
  ticket: tickets.handle,
  admin: admin.handle,
  verify: panels.handleVerify,
  help: panels.handleHelp,
  ann: announce.handle,
  wl: whitelist.handle,
  gw: giveaways.handle,
  mod: moderation.handle,
  appeal: appeals.handle,
  trate: tickets.rate,
  form: forms.handle,
  cp: require('../handlers/control').handle,
  ponto: ponto.handle,
  fb: feedback.handle,
  fila: supportQueue.handle,
  insta: instagram.handle,
  pixcfg: pixCommand.handleModal
};
// estes funcionam também na DM do bot
const DM_ROUTES = new Set(['appeal', 'trate']);

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isAutocomplete()) {
        if (interaction.inGuild()) await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
        return;
      }
      if (interaction.isCommand()) { // slash + menus de clique direito
        if (!interaction.inGuild()) return;
        await client.commands.get(interaction.commandName)?.execute(interaction);
        return;
      }
      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
        const prefix = interaction.customId.split(':')[0];
        if (!interaction.inGuild() && !DM_ROUTES.has(prefix)) return;
        await ROUTES[prefix]?.(interaction);
      }
    } catch (err) {
      console.error('[Interação]', err);
      const payload = { embeds: [error('Ocorreu um erro inesperado. Tente novamente.')], flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) interaction.followUp(payload).catch(() => null);
      else interaction.reply?.(payload).catch(() => null);
    }
  }
};
