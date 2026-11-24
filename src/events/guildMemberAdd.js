const config = require('../../config');
const db = require('../database');
const { base, e, line } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');

/* ── Anti-raid ── */
const joins = new Map();   // guildId -> timestamps
const raidUntil = new Map(); // guildId -> fim do modo raid

async function antiRaid(member) {
  const cfg = config.antiraid;
  if (!cfg?.enabled) return false;
  const now = Date.now();
  const list = (joins.get(member.guild.id) ?? []).filter((t) => now - t < cfg.seconds * 1000);
  list.push(now);
  joins.set(member.guild.id, list);

  if (list.length >= cfg.joins && !(raidUntil.get(member.guild.id) > now)) {
    raidUntil.set(member.guild.id, now + cfg.raidMinutes * 6e4);
    const g = db.guild(member.guild.id);
    const mentions = Object.keys(config.levels).map((l) => g.roles[l]).filter(Boolean).map((id) => `<@&${id}>`).join(' ');
    const logCh = g.channels.logs && member.guild.channels.cache.get(g.channels.logs);
    logCh?.send({ content: mentions || undefined, embeds: [base(config.colors.error).setTitle(`${e.alert} MODO RAID ATIVADO`)
      .setDescription(`**${list.length} entradas** em ${cfg.seconds}s!
Pelos próximos **${cfg.raidMinutes} min** contas com menos de **${cfg.minAccountDays} dias** ${cfg.kickNewDuringRaid ? 'serão expulsas automaticamente' : 'serão sinalizadas'}.
${e.arrow} Considere usar \`/trancar\` nos canais principais.`)] }).catch(() => null);
  }

  const isNew = now - member.user.createdTimestamp < cfg.minAccountDays * 864e5;
  if (raidUntil.get(member.guild.id) > now && isNew && cfg.kickNewDuringRaid && member.kickable) {
    await member.send({ embeds: [base(config.colors.warning).setDescription(`${e.shield} O **${member.guild.name}** está sob proteção anti-raid. Contas novas não podem entrar agora — tente novamente mais tarde.`)] }).catch(() => null);
    await member.kick('Anti-raid: conta nova durante raid').catch(() => null);
    sendLog(member.guild, base(config.colors.error).setDescription(`${e.shield} Anti-raid expulsou ${member.user.tag} (conta criada <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)`));
    return true;
  }
  return false;
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (await antiRaid(member)) return;
    const g = db.guild(member.guild.id);
    if (g.roles.autorole) await member.roles.add(g.roles.autorole, 'Autorole').catch(() => null);

    const channel = g.channels.boasvindas && member.guild.channels.cache.get(g.channels.boasvindas);
    if (channel) {
      const embed = base()
        .setAuthor({ name: `${member.user.username} chegou na cidade!`, iconURL: member.user.displayAvatarURL() })
        .setTitle(`${e.welcome} Bem-vindo(a) ao ${config.brand.name}!`)
        .setDescription([
          `Olá ${member}, que bom ter você aqui! ${e.car}`,
          line,
          g.channels.sugestoes ? `${e.suggestion} Ideias? <#${g.channels.sugestoes}>` : null,
          `${e.ticket} Precisa de ajuda? Abra um ticket.`,
          line,
          `${e.user} Você é o membro **#${member.guild.memberCount}**`
        ].filter(Boolean).join('\n'))
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }));
      channel.send(withBanner({ content: `${member}`, embeds: [embed] }, embed, 'boasvindas')).catch(() => null);
    }

    sendLog(member.guild, base(config.colors.success).setTitle(`${e.welcome} Membro entrou`)
      .setDescription(`${member} \`${member.user.tag}\`\nConta criada <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>${Date.now() - member.user.createdTimestamp < config.antiraid.minAccountDays * 864e5 ? `\n${e.warn} **Conta nova — fique de olho!**` : ''}`)
      .setThumbnail(member.user.displayAvatarURL()));
  }
};
