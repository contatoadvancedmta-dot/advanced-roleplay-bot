const { EmbedBuilder, parseEmoji } = require('discord.js');
const config = require('../../config');

const e = config.emojis;

// logo 'auto' só é resolvida quando o bot conecta (ícone do servidor) — até lá fica sem imagem
if (config.brand.logo === 'auto') config.brand.logo = null;

/** Embed base com a identidade visual do Advanced */
function base(color = config.colors.primary, force = false) {
  return new EmbedBuilder()
    .setColor(config.invisibleEmbeds && !force ? config.invisibleColor : color)
    .setFooter({ text: config.brand.footer, iconURL: config.brand.logo })
    .setTimestamp();
}

const line = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

function success(text, title = 'Sucesso') {
  return base(config.colors.success).setDescription(`${e.check} **${title}**\n${text}`);
}
function error(text, title = 'Erro') {
  return base(config.colors.error).setDescription(`${e.cross} **${title}**\n${text}`);
}
function warn(text, title = 'Atenção') {
  return base(config.colors.warning).setDescription(`${e.warn} **${title}**\n${text}`);
}
function info(text, title = 'Informação') {
  return base(config.colors.info).setDescription(`${e.info} **${title}**\n${text}`);
}

/** Barra de progresso para votos */
function progressBar(up, down, size = 12) {
  const total = up + down;
  if (!total) return `\`${'░'.repeat(size)}\` 0%`;
  const pct = up / total;
  const filled = Math.round(pct * size);
  return `\`${'█'.repeat(filled)}${'░'.repeat(size - filled)}\` ${Math.round(pct * 100)}%`;
}

/** Converte '<:nome:id>' ou '🔥' no formato aceito por menus de seleção */
function emo(str) {
  const parsed = parseEmoji(str);
  return parsed?.id ? { id: parsed.id, name: parsed.name, animated: parsed.animated } : { name: str };
}

module.exports = { base, success, error, warn, info, progressBar, emo, line, e };
