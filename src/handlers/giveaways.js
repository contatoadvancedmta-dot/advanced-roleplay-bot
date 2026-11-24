/**
 * SORTEIOS — botão "Participar", encerra sozinho no horário
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;

const { parseDuration } = require('../utils/time');

function embed(gw) {
  const ended = gw.ended;
  const ts = Math.floor(gw.endsAt / 1000);
  const em = base(ended ? config.colors.dark : config.colors.primary)
    .setTitle(`${e.gift} SORTEIO — ${gw.prize}`)
    .setDescription([
      gw.description ? `${gw.description}\n${line}` : null,
      `${e.trophy} **Vencedores:** ${gw.winnersCount}`,
      `${e.user} **Participantes:** ${gw.entries.length}`,
      ended ? `${e.clock} **Encerrado** <t:${ts}:R>` : `${e.clock} **Termina:** <t:${ts}:R> (<t:${ts}:f>)`,
      gw.role ? `${e.lock} **Requisito:** <@&${gw.role}>` : null,
      `${e.crown} **Criado por:** <@${gw.hostId}>`,
      ended ? `${line}\n${e.star} **Ganhador(es):** ${gw.winners.length ? gw.winners.map((id) => `<@${id}>`).join(', ') : 'ninguém participou'}` : null
    ].filter(Boolean).join('\n'))
    .setThumbnail(config.brand.logo);
  if (gw.bannerUrl) em.setImage(gw.bannerUrl);
  return em;
}

function buttons(gw) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gw:join:${gw.id}`).setLabel(gw.ended ? 'Encerrado' : `Participar (${gw.entries.length})`)
      .setEmoji(e.gift).setStyle(gw.ended ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(!!gw.ended)
  )];
}

function pick(entries, n) {
  const pool = [...entries];
  const winners = [];
  while (pool.length && winners.length < n) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return winners;
}

async function create(interaction, { prize, ms, winnersCount, channel, description, role }) {
  const g = db.guild(interaction.guild.id);
  const gw = {
    id: ++g.giveawayCounter, prize, description, role, winnersCount,
    hostId: interaction.user.id, channelId: channel.id, endsAt: Date.now() + ms, entries: [], winners: []
  };
  const em0 = embed(gw);
  const msg = await channel.send(withBanner({ content: `${e.gift} **NOVO SORTEIO!** ${e.gift}`, embeds: [em0], components: buttons(gw) }, em0, 'sorteio'));
  gw.bannerUrl = msg.attachments.some((a) => a.name === 'sorteio.png') ? 'attachment://sorteio.png' : null;
  gw.messageId = msg.id;
  g.giveaways[gw.id] = gw;
  db.save();
  return gw;
}

async function end(client, guildId, gw, reroll = false) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  gw.ended = true;
  gw.winners = pick(gw.entries, gw.winnersCount);
  db.save();

  const channel = guild.channels.cache.get(gw.channelId);
  const msg = channel && (await channel.messages.fetch(gw.messageId).catch(() => null));
  if (msg) await msg.edit({ content: `${e.gift} **SORTEIO ENCERRADO** ${e.gift}`, embeds: [embed(gw)], components: buttons(gw) });
  if (channel) {
    await channel.send({
      content: gw.winners.map((id) => `<@${id}>`).join(' ') || undefined,
      embeds: [base(config.colors.success).setDescription(gw.winners.length
        ? `${e.trophy} ${reroll ? '**Novo sorteio!** ' : ''}Parabéns ${gw.winners.map((id) => `<@${id}>`).join(', ')}! Vocês ganharam **${gw.prize}**!\nAbra um ticket para resgatar.`
        : `${e.warn} Ninguém participou do sorteio **${gw.prize}**.`)]
    }).catch(() => null);
  }
}

/** Checa sorteios vencidos (chamado a cada 15s) */
function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const g = db.guild(guild.id);
    for (const gw of Object.values(g.giveaways)) {
      if (!gw.ended && gw.endsAt <= Date.now()) end(client, guild.id, gw).catch((err) => console.error('[Sorteio]', err));
    }
  }
}

async function handle(interaction) {
  const [, , id] = interaction.customId.split(':');
  const gw = db.guild(interaction.guild.id).giveaways[id];
  if (!gw || gw.ended) return interaction.reply({ embeds: [error('Este sorteio já foi encerrado.')], flags: EPH });
  if (gw.role && !interaction.member.roles.cache.has(gw.role)) {
    return interaction.reply({ embeds: [error(`Você precisa do cargo <@&${gw.role}> para participar.`)], flags: EPH });
  }

  const uid = interaction.user.id;
  const joined = gw.entries.includes(uid);
  gw.entries = joined ? gw.entries.filter((x) => x !== uid) : [...gw.entries, uid];
  db.save();
  await interaction.update({ embeds: [embed(gw)], components: buttons(gw) });
  await interaction.followUp({ embeds: [joined ? error('Você saiu do sorteio.', 'Participação removida') : success(`Você está participando! Boa sorte ${e.star}`, 'Participando')], flags: EPH });
}

module.exports = { handle, create, end, tick, parseDuration };
