const config = require('../../config');
const { base, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  execute(message) {
    if (!message.guild || message.author?.bot || !message.content) return;
    sendLog(message.guild, base(config.colors.error).setTitle(`${e.trash} Mensagem apagada`)
      .setDescription(`**Autor:** ${message.author}\n**Canal:** ${message.channel}\n\n>>> ${message.content.slice(0, 1800)}`));
  }
};
