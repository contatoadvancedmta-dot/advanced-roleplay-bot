const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
let data = { guilds: {} };

try {
  if (fs.existsSync(FILE)) data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
  console.error('[DB] Falha ao ler db.json, iniciando vazio:', err.message);
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  }, 500);
}

function guild(id) {
  if (!data.guilds[id]) data.guilds[id] = {};
  const g = data.guilds[id];
  g.channels ??= {};
  g.roles ??= {};
  g.admins ??= {};
  g.suggestions ??= {};
  g.suggestionCounter ??= 0;
  g.tickets ??= {};
  g.ticketCounter ??= 0;
  g.cases ??= {};
  g.caseCounter ??= 0;
  g.tempbans ??= {};
  g.appeals ??= {};
  g.whitelist ??= {};
  g.giveaways ??= {};
  g.giveawayCounter ??= 0;
  g.xp ??= {};
  g.status ??= {};
  g.scheduled ??= {};
  g.scheduledCounter ??= 0;
  return g;
}

/** Dados globais (ex: emojis do bot) */
function global() {
  data.global ??= {};
  data.global.emojis ??= {};
  return data.global;
}

module.exports = { guild, global, save };
