const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { error } = require('./embeds');

function isOwner(member) {
  return config.owners.includes(member.id) || member.guild.ownerId === member.id;
}

/** Peso do membro: owner = 99, admin do Discord = 3, ou nível salvo pelo gerenciador */
function weight(member) {
  if (isOwner(member)) return 99;
  const g = db.guild(member.guild.id);
  const saved = g.admins[member.id];
  let w = saved ? config.levels[saved.level]?.weight ?? 0 : 0;
  // quem tem cargo configurado para o nível também conta
  for (const [lvl, data] of Object.entries(config.levels)) {
    const roleId = g.roles[lvl];
    if (roleId && member.roles.cache.has(roleId)) w = Math.max(w, data.weight);
  }
  if (member.permissions.has(PermissionFlagsBits.Administrator)) w = Math.max(w, config.levels.admin.weight);
  return w;
}

function hasLevel(member, level) {
  if (level === 'owner') return isOwner(member);
  return weight(member) >= config.levels[level].weight;
}

/** Retorna true se pode; caso contrário responde com erro e retorna false */
async function check(interaction, level) {
  if (hasLevel(interaction.member, level)) return true;
  const label = level === 'owner' ? 'Dono' : config.levels[level].label;
  await interaction.reply({
    embeds: [error(`Você precisa ser **${label}** ou superior para usar isso.`, 'Sem permissão')],
    flags: MessageFlags.Ephemeral
  });
  return false;
}

module.exports = { isOwner, weight, hasLevel, check };
