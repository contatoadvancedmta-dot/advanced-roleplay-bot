const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const xp = require('../handlers/xp');
const { base, progressBar, e } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = [
  {
    data: new SlashCommandBuilder().setName('rank').setDescription('📈 Mostra seu nível')
      .addUserOption((o) => o.setName('membro').setDescription('Ver de outro membro')),
    async execute(i) {
      const user = i.options.getUser('membro') ?? i.user;
      const d = xp.getData(i.guild.id, user.id);
      const needed = xp.need(d.level);
      const embed = base()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle(`${e.level} Nível ${d.level}`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: `${e.trophy} Posição`, value: `**#${xp.rankOf(i.guild.id, user.id) || '—'}**`, inline: true },
          { name: `${e.star} XP total`, value: `\`${d.total}\``, inline: true },
          { name: `Progresso — ${d.xp}/${needed} XP`, value: progressBar(d.xp, needed - d.xp, 16) }
        );
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('top').setDescription('🏆 Ranking dos mais ativos'),
    async execute(i) {
      const list = xp.top(i.guild.id, 10);
      const embed = base()
        .setTitle(`${e.trophy} Ranking — ${config.brand.name}`)
        .setThumbnail(i.guild.iconURL() ?? config.brand.logo)
        .setDescription(list.length
          ? list.map(([id, d], n) => `${MEDALS[n] ?? `\`#${n + 1}\``} <@${id}> ${e.arrow} Nível **${d.level}** • \`${d.total} XP\``).join('\n')
          : 'Ninguém tem XP ainda. Bora conversar!');
      await i.reply(withBanner({ embeds: [embed] }, embed, 'ranking'));
    }
  }
];
