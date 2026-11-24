/**
 * QR Code personalizado (sem bibliotecas nativas): cores, estilo dos pontos, logo no meio e moldura.
 */
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

const DEFAULTS = { dark: '#111111', light: '#ffffff', style: 'quadrado', logo: 'bot', frame: '#f97316' };
const BOT_LOGO = path.join(__dirname, '..', '..', 'assets', 'banners', 'avatar-bot.png');
const customLogoPath = (guildId) => path.join(__dirname, '..', '..', 'data', `pix-logo-${guildId}.png`);

const hex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Contraste WCAG entre duas cores (o leitor de QR precisa de ~3:1 ou mais) */
function contrast(a, b) {
  const lum = ([r, g, bl]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function blend(png, x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || a <= 0) return;
  const i = (png.width * y + x) << 2;
  const d = png.data;
  d[i] = Math.round(r * a + d[i] * (1 - a));
  d[i + 1] = Math.round(g * a + d[i + 1] * (1 - a));
  d[i + 2] = Math.round(b * a + d[i + 2] * (1 - a));
  d[i + 3] = 255;
}

function rect(png, x0, y0, w, h, color, radius = 0) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (radius) { // cantos arredondados
        const cx = x < radius ? radius - x - 0.5 : x >= w - radius ? x - (w - radius) + 0.5 : 0;
        const cy = y < radius ? radius - y - 0.5 : y >= h - radius ? y - (h - radius) + 0.5 : 0;
        if (cx && cy) {
          const dist = Math.hypot(cx, cy);
          if (dist > radius) continue;
          blend(png, x0 + x, y0 + y, color, Math.min(1, radius - dist + 0.5));
          continue;
        }
      }
      blend(png, x0 + x, y0 + y, color);
    }
  }
}

function circle(png, cx, cy, r, color) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist <= r + 0.5) blend(png, x, y, color, Math.min(1, r + 0.5 - dist));
    }
  }
}

/** Desenha a imagem (PNG) redimensionada dentro do quadrado indicado */
function drawImage(png, img, x0, y0, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x / size) * img.width));
      const sy = Math.min(img.height - 1, Math.floor((y / size) * img.height));
      const i = (img.width * sy + sx) << 2;
      blend(png, x0 + x, y0 + y, [img.data[i], img.data[i + 1], img.data[i + 2]], img.data[i + 3] / 255);
    }
  }
}

/** Carrega a logo escolhida (PNG) ou null */
async function loadLogo(opts, guild) {
  try {
    if (opts.logo === 'nenhuma') return null;
    if (opts.logo === 'personalizada' && guild && fs.existsSync(customLogoPath(guild.id))) return PNG.sync.read(fs.readFileSync(customLogoPath(guild.id)));
    if (opts.logo === 'servidor' && guild?.icon) {
      const buf = await fetch(guild.iconURL({ extension: 'png', size: 256 })).then((r) => r.arrayBuffer());
      return PNG.sync.read(Buffer.from(buf));
    }
    return PNG.sync.read(fs.readFileSync(BOT_LOGO));
  } catch {
    return null;
  }
}

/**
 * Gera o PNG do QR.
 * @param {string} text conteúdo (PIX copia e cola)
 * @param {object} options { dark, light, style: 'quadrado'|'redondo', logo: 'bot'|'servidor'|'personalizada'|'nenhuma', frame: '#hex'|null }
 * @param {import('discord.js').Guild} [guild]
 */
async function render(text, options = {}, guild) {
  const opts = { ...DEFAULTS, ...options };
  const logo = await loadLogo(opts, guild);
  const qr = QRCode.create(text, { errorCorrectionLevel: logo ? 'H' : 'M' }); // H aguenta a logo cobrindo o meio
  const n = qr.modules.size;
  const mod = Math.max(6, Math.floor(560 / n));
  const quiet = 4 * mod;
  const frameW = hex(opts.frame) ? Math.round(mod * 1.6) : 0;
  const W = n * mod + quiet * 2 + frameW * 2;
  const dark = hex(opts.dark) ?? hex(DEFAULTS.dark);
  const light = hex(opts.light) ?? hex(DEFAULTS.light);

  const png = new PNG({ width: W, height: W });
  png.data.fill(0);
  if (frameW) {
    rect(png, 0, 0, W, W, hex(opts.frame), Math.round(mod * 3));
    rect(png, frameW, frameW, W - frameW * 2, W - frameW * 2, light, Math.round(mod * 2));
  } else {
    rect(png, 0, 0, W, W, light);
  }
  const off = frameW + quiet;
  const isFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // espaço da logo (limpa os módulos do centro)
  const logoMods = logo ? Math.floor(n * 0.22) | 1 : 0;
  const lStart = Math.floor((n - logoMods) / 2);
  const inLogo = (r, c) => logo && r >= lStart - 1 && r < lStart + logoMods + 1 && c >= lStart - 1 && c < lStart + logoMods + 1;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || isFinder(r, c) || inLogo(r, c)) continue;
      const x = off + c * mod, y = off + r * mod;
      if (opts.style === 'redondo') circle(png, x + mod / 2, y + mod / 2, mod * 0.5, dark);
      else rect(png, x, y, mod, mod, dark);
    }
  }
  // olhos do QR (cantos) sempre bem definidos, arredondados no estilo redondo
  const rad = opts.style === 'redondo' ? Math.round(mod * 1.6) : 0;
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = off + c0 * mod, y = off + r0 * mod;
    rect(png, x, y, 7 * mod, 7 * mod, dark, rad);
    rect(png, x + mod, y + mod, 5 * mod, 5 * mod, light, rad ? Math.round(rad * 0.7) : 0);
    rect(png, x + 2 * mod, y + 2 * mod, 3 * mod, 3 * mod, dark, rad ? Math.round(rad * 0.5) : 0);
  }
  if (logo) {
    const box = logoMods * mod;
    const bx = off + lStart * mod, by = off + lStart * mod;
    rect(png, bx - mod, by - mod, box + 2 * mod, box + 2 * mod, light, Math.round(mod * 1.5));
    drawImage(png, logo, bx, by, box);
  }
  return PNG.sync.write(png);
}

module.exports = { render, hex, contrast, DEFAULTS, customLogoPath };
