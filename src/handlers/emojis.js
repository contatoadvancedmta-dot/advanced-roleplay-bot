/**
 * EMOJIS PRÓPRIOS DO ADVANCED
 * Envia as imagens de assets/emojis como "Emojis do Aplicativo" (do próprio bot)
 * e troca automaticamente os emojis do config.js por eles.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');
const db = require('../database');

const DIR = path.join(__dirname, '..', '..', 'assets', 'emojis');
const PREFIX = 'adv_';
const ORIGINAL = { ...config.emojis }; // padrão do config (para saber o que o dono já trocou à mão)

const toName = (key) => (PREFIX + key).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
const format = (emoji) => `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;

/** Aplica os emojis salvos no config (não sobrescreve quem já colocou <:emoji:id> manualmente) */
function apply() {
  for (const [key, value] of Object.entries(db.global().emojis)) {
    if (!String(ORIGINAL[key] ?? '').startsWith('<')) config.emojis[key] = value;
  }
}

async function upload(client, key, attachment, existing) {
  const name = toName(key);
  const old = existing?.find((em) => em.name === name);
  if (old) await old.delete().catch(() => null);
  const emoji = await client.application.emojis.create({ attachment, name });
  db.global().emojis[key] = format(emoji);
  db.save();
  apply();
  return emoji;
}

/** Sincroniza a pasta com os emojis do bot. force = reenvia mesmo os que já existem */
async function sync(client, force = false) {
  if (!fs.existsSync(DIR)) return { created: 0, total: 0 };
  const existing = await client.application.emojis.fetch();
  const files = fs.readdirSync(DIR).filter((f) => /\.(png|gif|jpe?g|webp)$/i.test(f));
  let created = 0;

  for (const file of files) {
    const key = path.parse(file).name;
    const found = existing.find((em) => em.name === toName(key));
    if (found && !force) {
      db.global().emojis[key] = format(found);
      continue;
    }
    try {
      await upload(client, key, path.join(DIR, file), existing);
      created++;
    } catch (err) {
      console.error(`[Emojis] Falha ao enviar ${file}:`, err.message);
    }
  }
  db.save();
  apply();
  return { created, total: files.length };
}

module.exports = { sync, apply, upload, toName };
