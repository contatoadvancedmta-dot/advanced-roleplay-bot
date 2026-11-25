/**
 * GERENCIADOR DE ADMINISTRADORES (somente donos)
 * Funciona por comando (/admin) e por botões (/admin painel).
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  UserSelectMenuBuilder, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, emo, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const lvlEmoji = (lvl) => config.emojis[config.levels[lvl].emoji];

function panel() {
  const embed = base()
    .setTitle(`${e.crown} Gerenciador de Staff — ${config.brand.name}`)
    .setDescription([
      'Painel exclusivo dos **donos** para gerenciar a equipe.',
      line,
      `${e.check} **Adicionar** ${e.arrow} promove um membro a staff`,
      `${e.cross} **Remover** ${e.arrow} retira o membro da staff`,
      `${e.log} **Lista** ${e.arrow} mostra toda a equipe atual`,
      line,
      '**Níveis disponíveis:**',
      ...Object.entries(config.levels).map(([k, v]) => `${lvlEmoji(k)} ${v.label}`)
    ].join('\n'))
    .setThumbnail(config.brand.logo);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:add').setLabel('Adicionar').setEmoji(e.check).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin:remove').setLabel('Remover').setEmoji(e.cross).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('admin:list').setLabel('Lista da staff').setEmoji(e.log).setStyle(ButtonStyle.Secondary)
  );
  return withBanner({ embeds: [embed], components: [row] }, embed, 'staff');
}

function listEmbed(guild) {
  const g = db.guild(guild.id);
  const embed = base().setTitle(`${e.staff} Equipe ${config.brand.name}`).setThumbnail(guild.iconURL());
  const owners = [...new Set([guild.ownerId, ...config.owners])].map((id) => `${e.crown} <@${id}>`);
  embed.addFields({ name: 'Donos', value: owners.join('\n') });

  const sorted = Object.entries(config.levels).sort((a, b) => b[1].weight - a[1].weight);
  for (const [lvl, data] of sorted) {
    const members = Object.entries(g.admins).filter(([, a]) => a.level === lvl)
      .map(([id, a]) => `${lvlEmoji(lvl)} <@${id}> • <t:${Math.floor(a.addedAt / 1000)}:R>`);
    embed.addFields({ name: `${data.label} (${members.length})`, value: members.join('\n') || '*Ninguém ainda*' });
  }
  return embed;
}

async function setLevel(interaction, userId, level) {
  const g = db.guild(interaction.guild.id);
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return error('Membro não encontrado no servidor.');
  if (member.user.bot) return error('Não é possível adicionar bots na staff.');

  // remove cargos de outros níveis e aplica o novo
  for (const lvl of Object.keys(config.levels)) {
    const roleId = g.roles[lvl];
    if (!roleId) continue;
    if (lvl === level) await member.roles.add(roleId, `Staff: ${level} por ${interaction.user.tag}`).catch(() => null);
    else await member.roles.remove(roleId).catch(() => null);
  }
  const roleId = g.roles.staff;
  if (roleId) await member.roles.add(roleId).catch(() => null);

  g.admins[userId] = { level, addedBy: interaction.user.id, addedAt: Date.now() };
  db.save();
  require('./tickets').syncStaffAccess(interaction.guild).catch(() => null); // já vê os tickets abertos

  const label = config.levels[level].label;
  sendLog(interaction.guild, base(config.colors.success).setTitle(`${e.crown} Staff atualizada`)
    .setDescription(`${member} agora é ${lvlEmoji(level)} **${label}**\n${e.arrow} por ${interaction.user}`));
  member.send({ embeds: [base(config.colors.success).setTitle(`${e.star} Parabéns!`)
    .setDescription(`Você agora faz parte da equipe **${config.brand.name}** como ${lvlEmoji(level)} **${label}**!`)] }).catch(() => null);

  return success(`${member} agora é ${lvlEmoji(level)} **${label}**.`, 'Staff adicionada');
}

async function removeStaff(interaction, userId) {
  const g = db.guild(interaction.guild.id);
  if (!g.admins[userId]) return error('Esse membro não está na staff.');
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (member) {
    for (const key of [...Object.keys(config.levels), 'staff']) {
      if (g.roles[key]) await member.roles.remove(g.roles[key]).catch(() => null);
    }
  }
  delete g.admins[userId];
  db.save();
  // tira o acesso individual dos tickets abertos (quem tiver cargo de staff continua vendo pelo cargo)
  for (const channelId of Object.keys(g.tickets ?? {})) {
    const ch = interaction.guild.channels.cache.get(channelId);
    const t = g.tickets[channelId];
    if (ch && t.ownerId !== userId && !(t.members ?? []).includes(userId)) await ch.permissionOverwrites.delete(userId).catch(() => null);
  }
  sendLog(interaction.guild, base(config.colors.error).setTitle(`${e.crown} Staff removida`)
    .setDescription(`<@${userId}> foi removido da staff por ${interaction.user}`));
  return success(`<@${userId}> foi removido da staff.`, 'Staff removida');
}

function levelSelect(userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`admin:level:${userId}`).setPlaceholder('Escolha o nível')
      .addOptions(Object.entries(config.levels).map(([k, v]) => ({ label: v.label, value: k, emoji: emo(lvlEmoji(k)) })))
  );
}

async function handle(interaction) {
  if (!(await perms.check(interaction, 'owner'))) return;
  const [, action, arg] = interaction.customId.split(':');

  if (action === 'list') return interaction.reply({ embeds: [listEmbed(interaction.guild)], flags: EPH });

  if (action === 'add' || action === 'remove') {
    const select = new UserSelectMenuBuilder().setCustomId(`admin:pick:${action}`)
      .setPlaceholder(action === 'add' ? 'Selecione quem vai entrar na staff' : 'Selecione quem vai sair da staff');
    return interaction.reply({
      embeds: [base().setDescription(`${e.user} Selecione o membro abaixo:`)],
      components: [new ActionRowBuilder().addComponents(select)],
      flags: EPH
    });
  }

  if (action === 'pick') {
    const userId = interaction.values[0];
    if (arg === 'remove') return interaction.update({ embeds: [await removeStaff(interaction, userId)], components: [] });
    return interaction.update({
      embeds: [base().setDescription(`${e.shield} Qual nível <@${userId}> vai receber?`)],
      components: [levelSelect(userId)]
    });
  }

  if (action === 'level') {
    return interaction.update({ embeds: [await setLevel(interaction, arg, interaction.values[0])], components: [] });
  }
}

module.exports = { handle, panel, listEmbed, setLevel, removeStaff };
