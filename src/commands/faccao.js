const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const fac = require('../handlers/faccoes');
const { success, error, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');
const { base } = require('../utils/embeds');

const EPH = MessageFlags.Ephemeral;
const nameOpt = (o) => o.setName('faccao').setDescription('Nome ou sigla').setRequired(true).setAutocomplete(true);
const touch = (i) => require('../handlers/rankingBoard').touch(i.client);

module.exports = {
  data: new SlashCommandBuilder().setName('faccao').setDescription('🏴 Facções e organizações')
    .addSubcommand((s) => s.setName('criar').setDescription('Registra uma facção (Admin)')
      .addStringOption((o) => o.setName('nome').setDescription('Nome').setRequired(true).setMaxLength(40))
      .addStringOption((o) => o.setName('sigla').setDescription('Sigla (ex: CV, PCC, PMESP)').setRequired(true).setMaxLength(8))
      .addUserOption((o) => o.setName('lider').setDescription('Líder').setRequired(true))
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true)
        .addChoices(...Object.entries(fac.TYPES).map(([value, t]) => ({ name: `${t.emoji} ${t.label}`, value }))))
      .addBooleanOption((o) => o.setName('criar_cargo').setDescription('Criar um cargo para a facção (padrão: sim)')))
    .addSubcommand((s) => s.setName('membro').setDescription('Adiciona ou remove um membro (líder ou staff)')
      .addStringOption(nameOpt).addUserOption((o) => o.setName('membro').setDescription('Membro').setRequired(true))
      .addStringOption((o) => o.setName('acao').setDescription('Adicionar ou remover').setRequired(true)
        .addChoices({ name: 'Adicionar', value: 'add' }, { name: 'Remover', value: 'remove' })))
    .addSubcommand((s) => s.setName('lider').setDescription('Troca o líder (Admin)').addStringOption(nameOpt)
      .addUserOption((o) => o.setName('novo_lider').setDescription('Novo líder').setRequired(true)))
    .addSubcommand((s) => s.setName('info').setDescription('Informações de uma facção').addStringOption(nameOpt))
    .addSubcommand((s) => s.setName('lista').setDescription('Todas as facções'))
    .addSubcommand((s) => s.setName('excluir').setDescription('Exclui uma facção (Admin)').addStringOption(nameOpt)),

  async autocomplete(i) {
    const q = i.options.getFocused().toLowerCase();
    await i.respond(Object.values(fac.store(i.guild.id)).filter((f) => `${f.nome} ${f.sigla}`.toLowerCase().includes(q)).slice(0, 25)
      .map((f) => ({ name: `[${f.sigla}] ${f.nome}`, value: f.id })));
  },

  async execute(i) {
    const sub = i.options.getSubcommand();
    const store = fac.store(i.guild.id);
    if (sub === 'lista') return i.reply(fac.listEmbed(i.guild));

    if (sub === 'criar') {
      if (!(await perms.check(i, 'admin'))) return;
      const nome = i.options.getString('nome').trim();
      const sigla = i.options.getString('sigla').trim().toUpperCase();
      const id = fac.slug(nome);
      if (store[id] || fac.find(i.guild.id, sigla)) return i.reply({ embeds: [error('Já existe uma facção com esse nome ou sigla.')], flags: EPH });
      const lider = i.options.getUser('lider');
      await i.deferReply({ flags: EPH });
      let roleId = null;
      if (i.options.getBoolean('criar_cargo') !== false) {
        const role = await i.guild.roles.create({ name: `[${sigla}] ${nome}`, mentionable: true, reason: `Facção criada por ${i.user.tag}` }).catch(() => null);
        roleId = role?.id ?? null;
      }
      store[id] = { id, nome, sigla, tipo: i.options.getString('tipo'), liderId: lider.id, membros: [lider.id], roleId, createdAt: Date.now(), by: i.user.id };
      db.save();
      if (roleId) await (await i.guild.members.fetch(lider.id).catch(() => null))?.roles.add(roleId).catch(() => null);
      sendLog(i.guild, base().setDescription(`🏴 ${i.user} criou a facção **[${sigla}] ${nome}** (líder ${lider})`));
      touch(i);
      return i.editReply({ embeds: [success(`Facção **[${sigla}] ${nome}** criada!${roleId ? ` Cargo <@&${roleId}> criado e entregue ao líder.` : ''}`), fac.infoEmbed(store[id])] });
    }

    const f = fac.find(i.guild.id, i.options.getString('faccao'));
    if (!f) return i.reply({ embeds: [error('Facção não encontrada.')], flags: EPH });
    if (sub === 'info') return i.reply({ embeds: [fac.infoEmbed(f)] });

    if (sub === 'membro') {
      const isLeader = f.liderId === i.user.id;
      if (!isLeader && !(await perms.check(i, 'suporte'))) return;
      const user = i.options.getUser('membro');
      const add = i.options.getString('acao') === 'add';
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (add) {
        if (f.membros.includes(user.id)) return i.reply({ embeds: [error(`${user} já é da facção.`)], flags: EPH });
        const other = Object.values(store).find((x) => x.membros.includes(user.id));
        if (other) return i.reply({ embeds: [error(`${user} já é da facção **[${other.sigla}]**.`)], flags: EPH });
        if (config.faccoes?.maxMembers && f.membros.length >= config.faccoes.maxMembers) return i.reply({ embeds: [error(`Limite de ${config.faccoes.maxMembers} membros.`)], flags: EPH });
        f.membros.push(user.id);
        if (f.roleId) await member?.roles.add(f.roleId).catch(() => null);
      } else {
        if (user.id === f.liderId) return i.reply({ embeds: [error('Não dá para remover o líder. Troque o líder antes.')], flags: EPH });
        if (!f.membros.includes(user.id)) return i.reply({ embeds: [error(`${user} não é da facção.`)], flags: EPH });
        f.membros = f.membros.filter((x) => x !== user.id);
        if (f.roleId) await member?.roles.remove(f.roleId).catch(() => null);
      }
      db.save();
      touch(i);
      sendLog(i.guild, base().setDescription(`🏴 **[${f.sigla}]** ${i.user} ${add ? 'adicionou' : 'removeu'} ${user}`));
      return i.reply({ embeds: [success(`${user} ${add ? 'entrou na' : 'saiu da'} **[${f.sigla}] ${f.nome}**. (${f.membros.length} membros)`)] });
    }

    if (!(await perms.check(i, 'admin'))) return;
    if (sub === 'lider') {
      const novo = i.options.getUser('novo_lider');
      f.liderId = novo.id;
      if (!f.membros.includes(novo.id)) f.membros.push(novo.id);
      if (f.roleId) await (await i.guild.members.fetch(novo.id).catch(() => null))?.roles.add(f.roleId).catch(() => null);
      db.save();
      touch(i);
      return i.reply({ embeds: [success(`${novo} agora é líder da **[${f.sigla}] ${f.nome}**.`)] });
    }
    if (sub === 'excluir') {
      if (f.roleId) await i.guild.roles.delete(f.roleId).catch(() => null);
      delete store[f.id];
      db.save();
      touch(i);
      return i.reply({ embeds: [success(`Facção **[${f.sigla}] ${f.nome}** excluída.`)], flags: EPH });
    }
  }
};
