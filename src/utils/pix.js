/**
 * Gerador de PIX "copia e cola" (BR Code / EMV padrão Banco Central) + QR Code
 * Funciona com qualquer chave: CPF, CNPJ, e-mail, telefone (+55...) ou aleatória.
 */
const QRCode = require('qrcode');

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// remove acentos e caracteres que o padrão não aceita
const clean = (s, max) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-@+]/g, '').toUpperCase().slice(0, max);

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * @param {{key:string, name:string, city:string, amount?:number, txid?:string, description?:string}} o
 */
function payload({ key, name, city, amount, txid, description }) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key.trim()) +
    (description ? field('02', clean(description, 40)) : '');
  let p = field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (amount ? field('54', Number(amount).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(name, 25)) +
    field('60', clean(city, 15)) +
    field('62', field('05', (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
  p += '6304';
  return p + crc16(p);
}

/** PNG do QR com o visual configurado em /pix qrcode (cores, logo, moldura) */
async function qrBuffer(code, guild) {
  try {
    const qr = guild ? require('../database').guild(guild.id).pix?.qr ?? {} : {};
    return await require('./qrstyle').render(code, qr, guild);
  } catch (err) {
    console.error('[QR] Falha no QR personalizado, usando o simples:', err.message);
    return QRCode.toBuffer(code, { width: 420, margin: 2, errorCorrectionLevel: 'M' });
  }
}

module.exports = { payload, qrBuffer, crc16 };

/* ───────────── Configuração e validação de chave ───────────── */

const KEY_TYPES = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Chave aleatória'
};

function validCpf(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function validCnpj(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (n) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Valida e deixa a chave no formato que o Banco Central espera. Lança erro com mensagem amigável. */
function normalizeKey(type, raw) {
  const v = String(raw ?? '').trim();
  const digits = v.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      if (!validCpf(digits)) throw new Error('CPF inválido. Confira os números.');
      return digits;
    case 'cnpj':
      if (!validCnpj(digits)) throw new Error('CNPJ inválido. Confira os números.');
      return digits;
    case 'email':
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || v.length > 77) throw new Error('E-mail inválido.');
      return v.toLowerCase();
    case 'telefone': {
      const d = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
      if (!/^55\d{10,11}$/.test(d)) throw new Error('Telefone inválido. Use DDD + número, ex: 11 91234-5678.');
      return `+${d}`;
    }
    case 'aleatoria':
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new Error('Chave aleatória inválida (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');
      return v.toLowerCase();
    default:
      throw new Error('Tipo de chave inválido.');
  }
}

/** Configuração ativa: o que foi salvo pelo /pix tem prioridade sobre o config.js */
function getConfig(guildId) {
  const config = require('../../config');
  const saved = guildId ? require('../database').guild(guildId).pix ?? {} : {};
  return { ...config.pix, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v)) };
}

module.exports.KEY_TYPES = KEY_TYPES;
module.exports.normalizeKey = normalizeKey;
module.exports.getConfig = getConfig;
