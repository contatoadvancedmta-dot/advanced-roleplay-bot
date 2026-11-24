const config = require('../../config');
const db = require('../database');
const { base, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const g = db.guild(member.guild.id);
    const channel = g.channels.saida && member.guild.channels.cache.get(g.channels.saida);
    channel?.send({ embeds: [base(config.colors.dark)
      .setDescription(`${e.leave} **${member.user.username}** saiu da cidade. Agora somos **${member.guild.memberCount}**.`)
      .setThumbnail(member.user.displayAvatarURL())] }).catch(() => null);
    sendLog(member.guild, base(config.colors.error).setTitle(`${e.leave} Membro saiu`).setDescription(`\`${member.user.tag}\` (${member.id})`));
  }
};
