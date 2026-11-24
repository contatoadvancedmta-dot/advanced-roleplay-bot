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
      await i.deferReply({ flags: EPH });
      const lider = i.options.getUser('lider');
      const r = await fac.create(i.guild, i.user, { nome: i.options.getString('nome'), sigla: i.options.getString('sigla'), tipo: i.options.getString('tipo'), liderId: lider.id, createRole: i.options.getBoolean('criar_cargo') !== false });
      if (r.error) return i.editReply({ embeds: [error(r.error)] });
      sendLog(i.guild, base().setDescription(`🏴 ${i.user} criou a facção **[${r.f.sigla}] ${r.f.nome}** (líder ${lider})`));
      touch(i);
      return i.editReply({ embeds: [success(`Facção **[${r.f.sigla}] ${r.f.nome}** criada!${r.f.roleId ? ` Cargo <@&${r.f.roleId}> criado e entregue ao líder.` : ''}`), fac.infoEmbed(r.f)] });
    }

    const f = fac.find(i.guild.id, i.options.getString('faccao'));
    if (!f) return i.reply({ embeds: [error('Facção não encontrada.')], flags: EPH });
    if (sub === 'info') return i.reply({ embeds: [fac.infoEmbed(f)] });

    if (sub === 'membro') {
      if (f.liderId !== i.user.id && !(await perms.check(i, 'suporte'))) return;
      const user = i.options.getUser('membro');
      const add = i.options.getString('acao') === 'add';
      const r = await fac.setMember(i.guild, f, user.id, add);
      if (r.error) return i.reply({ embeds: [error(r.error)], flags: EPH });
      touch(i);
      sendLog(i.guild, base().setDescription(`🏴 **[${f.sigla}]** ${i.user} ${add ? 'adicionou' : 'removeu'} ${user}`));
      return i.reply({ embeds: [success(`${r.text} (${f.membros.length} membros)`)] });
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
      await fac.remove(i.guild, f);
      touch(i);
      return i.reply({ embeds: [success(`Facção **[${f.sigla}] ${f.nome}** excluída.`)], flags: EPH });
    }
  }
};
