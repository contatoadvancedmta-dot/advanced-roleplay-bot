/**
 * Banners locais (assets/banners/*.png) — enviados como anexo, sem precisar hospedar.
 */
const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const config = require('../../config');

const DIR = path.join(__dirname, '..', '..', 'assets', 'banners');

/**
 * Coloca o banner na embed e adiciona o arquivo no payload.
 * Se o dono configurou brand.banner (URL), usa a URL. Se banners estiverem desligados, não faz nada.
 */
function withBanner(payload, embed, name) {
  if (config.banners === false) return payload;
  const file = path.join(DIR, `${name}.png`);
  if (fs.existsSync(file)) {
    embed.setImage(`attachment://${name}.png`);
    payload.files = [...(payload.files ?? []), new AttachmentBuilder(file, { name: `${name}.png` })];
  } else if (config.brand.banner) {
    embed.setImage(config.brand.banner);
  }
  return payload;
}

module.exports = { withBanner };
