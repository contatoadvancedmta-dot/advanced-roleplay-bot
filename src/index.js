console.log('[Advanced] Iniciando o bot...');
const fs = require('node:fs');
const path = require('node:path');
// procura o arquivo de configuração na pasta atual, na pasta do projeto e na raiz do servidor (hospedagens).
// Aceita .env, env, env.txt e .env.txt (o Windows às vezes coloca .txt sozinho)
const DIRS = [...new Set([process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '..', '..')])];
const ENV_NAMES = ['.env', 'env', 'env.txt', '.env.txt'];
const envFiles = DIRS.flatMap((d) => ENV_NAMES.map((n) => path.join(d, n))).filter((p) => fs.existsSync(p));
require('dotenv').config({ path: envFiles, quiet: true });

// token.txt: arquivo só com o token dentro (para hospedagens que não deixam criar .env)
const tokenFile = DIRS.map((d) => path.join(d, 'token.txt')).find((p) => fs.existsSync(p));
if (tokenFile && !process.env.DISCORD_TOKEN) {
  const raw = fs.readFileSync(tokenFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
  process.env.DISCORD_TOKEN = raw.includes('=') ? raw.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') : raw.replace(/^['"]|['"]$/g, '');
  console.log(`[Advanced] Token lido de ${tokenFile} (${process.env.DISCORD_TOKEN.length} caracteres)`);
}
console.log(`[Advanced] Pasta: ${process.cwd()}`);
console.log(`[Advanced] Arquivo .env: ${envFiles.length ? envFiles.join(', ') : 'NÃO ENCONTRADO'}${tokenFile ? ` • token.txt: ${tokenFile}` : ''}`);
// Diagnóstico: mostra só os NOMES das variáveis de cada .env (nunca os valores)
for (const file of envFiles) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const info = lines.map((l) => {
    const m = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(l);
    if (!m) return `"${l.slice(0, 15)}..." (linha inválida)`;
    const v = m[2].replace(/^['"]|['"]$/g, '').trim();
    return `${m[1]}=${v ? `ok (${v.length} caracteres)` : 'VAZIO'}`;
  });
  console.log(`[Advanced]   ${file}: ${info.length ? info.join(' | ') : 'arquivo vazio'}`);
}
// IDs do config.js entram quando o .env não tiver
const cfgIds = require('../config').discord ?? {};
process.env.CLIENT_ID ||= cfgIds.clientId || '';
process.env.GUILD_ID ||= cfgIds.guildId || '';
console.log(`[Advanced] Bot ${process.env.CLIENT_ID || '?'} • Servidor ${process.env.GUILD_ID || '?'}`);
// aceita variações comuns do nome
process.env.DISCORD_TOKEN ||= process.env.TOKEN || process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
if (!process.env.DISCORD_TOKEN.trim()) {
  console.error('❌ Token não encontrado. Faça UMA destas opções no Gerenciador de arquivos (pasta principal):');
  console.error('   1) arquivo  token.txt  com só o token dentro');
  console.error('   2) arquivo  .env  com a linha  DISCORD_TOKEN=seu_token');
  process.exit(1);
}
console.log(`[Advanced] Token encontrado (${process.env.DISCORD_TOKEN.length} caracteres). Carregando comandos...`);
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.commands = new Collection();
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const mod = require(`./commands/${file}`);
  for (const cmd of [].concat(mod)) client.commands.set(cmd.data.name, cmd);
}

for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const ev = require(`./events/${file}`);
  const run = (...args) => ev.execute(...args, client);
  ev.once ? client.once(ev.name, run) : client.on(ev.name, run);
}

process.on('unhandledRejection', (err) => console.error('[Erro]', err));
console.log(`[Advanced] ${client.commands.size} comandos carregados. Conectando ao Discord...`);
client.login(process.env.DISCORD_TOKEN.trim()).catch((err) => {
  const msg = String(err?.message ?? err);
  if (/disallowed intents/i.test(msg)) console.error('❌ Ative "Server Members Intent" e "Message Content Intent" no Developer Portal > Bot.');
  else if (/invalid token|TokenInvalid/i.test(msg)) console.error('❌ Token inválido. Gere outro em Developer Portal > Bot > Reset Token e coloque no .env.');
  else console.error('❌ Falha ao conectar:', msg);
  process.exit(1);
});
