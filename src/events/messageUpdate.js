const config = require('../../config');
const { base, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  execute(oldMsg, newMsg) {
    if (!newMsg.guild || newMsg.author?.bot || !oldMsg.content || oldMsg.content === newMsg.content) return;
    sendLog(newMsg.guild, base(config.colors.warning).setTitle(`✏️ Mensagem editada`)
      .setDescription(`**Autor:** ${newMsg.author}\n**Canal:** ${newMsg.channel} • [ir para mensagem](${newMsg.url})`)
      .addFields(
        { name: 'Antes', value: oldMsg.content.slice(0, 1000) },
        { name: 'Depois', value: (newMsg.content || '*vazio*').slice(0, 1000) }
      ));
  }
};
