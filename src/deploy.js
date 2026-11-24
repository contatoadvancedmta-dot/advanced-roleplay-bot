const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({
  path: [process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '..', '..')].map((d) => path.join(d, '.env')).filter((p) => fs.existsSync(p))
});
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const commands = fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))
  .flatMap((f) => [].concat(require(`./commands/${f}`)).map((c) => c.data.toJSON()));

const rest = new REST().setToken(DISCORD_TOKEN);
const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);
rest.put(route, { body: commands })
  .then(() => console.log(`✅ ${commands.length} comandos registrados${GUILD_ID ? ' no servidor' : ' globalmente'}.`))
  .catch(console.error);
