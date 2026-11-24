const { ActivityType } = require('discord.js');
const config = require('../../config');
const emojis = require('../handlers/emojis');
const giveaways = require('../handlers/giveaways');
const fivem = require('../handlers/fivem');
const moderation = require('../handlers/moderation');
const announce = require('../handlers/announce');
const ponto = require('../handlers/ponto');
const rankingBoard = require('../handlers/rankingBoard');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`\n🏙️ ${config.brand.name} online como ${client.user.tag}\n`);
    require('../commands/cidade')[0].applySaved(); // IP salvo pelo /cidade ip

    // Logo automática: ícone do servidor Advanced, ou a foto do bot
    if (!config.brand.logo || config.brand.logo === 'auto' || config.brand.logo.includes('/embed/avatars/')) {
      const guild = client.guilds.cache.get(process.env.GUILD_ID) ?? client.guilds.cache.first();
      config.brand.logo = guild?.iconURL({ size: 512, extension: 'png' }) ?? client.user.displayAvatarURL({ size: 512, extension: 'png' });
      console.log(`🖼️  Logo: ${guild?.icon ? 'ícone do servidor' : 'foto do bot'}`);
    }

    // Registra os comandos sozinho ao ligar (não precisa rodar npm run deploy)
    try {
      const body = [...new Set(client.commands.values())].map((c) => c.data.toJSON());
      const guildId = process.env.GUILD_ID;
      if (guildId && client.guilds.cache.has(guildId)) await client.guilds.cache.get(guildId).commands.set(body);
      else await client.application.commands.set(body);
      console.log(`✅ ${body.length} comandos registrados${guildId ? ' no servidor' : ' globalmente'}`);
    } catch (err) {
      console.error('[Comandos] Falha ao registrar:', err.message);
    }

    // Emojis próprios do Advanced
    emojis.apply();
    if (config.emojiSync) {
      emojis.sync(client)
        .then((r) => console.log(`😎 Emojis: ${r.total} na pasta, ${r.created} enviados agora`))
        .catch((err) => console.error('[Emojis]', err.message));
    }

    // Sorteios e status da cidade
    setInterval(() => giveaways.tick(client), 15_000);
    setInterval(() => { moderation.tick(client); announce.tick(client); ponto.tick(client); }, 30_000);
    setTimeout(() => rankingBoard.update(client).catch(() => null), 15_000);
    setInterval(() => rankingBoard.update(client).catch(() => null), 10 * 60_000); // canal de rankings // ban temporário + anúncios agendados
    fivem.tick(client);
    setInterval(() => fivem.tick(client), config.fivem.updateSeconds * 1000);

    // Status rotativo
    let i = 0;
    const rotate = () => {
      const lines = config.presence.filter((t) => !t.includes('{players}') || fivem.getLast().online);
      const members = client.guilds.cache.reduce((n, g) => n + g.memberCount, 0);
      const text = lines[i++ % lines.length]
        .replace('{members}', members)
        .replace('{players}', fivem.getLast().players.length);
      client.user.setPresence({ activities: [{ name: text, type: ActivityType.Custom, state: text }], status: 'online' });
    };
    rotate();
    setInterval(rotate, 20_000);
  }
};
