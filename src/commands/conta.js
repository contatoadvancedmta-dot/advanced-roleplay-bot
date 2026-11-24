/**
 * /conta — anotações da staff sobre contas do jogo (canal anotar-contas)
 */
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../database');
const perms = require('../utils/permissions');
const { base, success, error, e } = require('../utils/embeds');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const store = (gid) => { const g = db.guild(gid); g.contas ??= {}; g.contaCounter ??= 0; return g; };
const contaOpt = (o) => o.setName('conta').setDescription('Login/nick da conta no MTA').setRequired(true).setAutocomplete(true).setMaxLength(40);

module.exports = {
  data: new SlashCommandBuilder().setName('conta').setDescription('📋 Anotações da staff sobre contas do jogo')
    .addSubcommand((s) => s.setName('anotar').setDescription('Adiciona uma anotação').addStringOption(contaOpt)
      .addStringOption((o) => o.setName('anotacao').setDescription('O que aconteceu').setRequired(true).setMaxLength(800))
      .addUserOption((o) => o.setName('discord').setDescription('Discord do dono da conta (opcional)')))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra as anotações de uma conta').addStringOption(contaOpt))
    .addSubcommand((s) => s.setName('apagar').setDescription('Apaga uma anotação (Admin)').addStringOption(contaOpt)
      .addIntegerOption((o) => o.setName('numero').setDescription('Nº da anotação').setRequired(true))),

  async autocomplete(i) {
    const q = i.options.getFocused().toLowerCase();
    await i.respond(Object.keys(store(i.guild.id).contas).filter((k) => k.includes(q)).slice(0, 25).map((k) => ({ name: k, value: k })));
  },

  async execute(i) {
    if (!(await perms.check(i, 'suporte'))) return;
    const g = store(i.guild.id);
    const sub = i.options.getSubcommand();
    const conta = i.options.getString('conta').trim().toLowerCase();
    const list = (g.contas[conta] ??= []);

    if (sub === 'anotar') {
      const note = { n: ++g.contaCounter, text: i.options.getString('anotacao'), by: i.user.id, at: Date.now(), discordId: i.options.getUser('discord')?.id ?? null };
      list.push(note);
      db.save();
      const embed = base().setTitle(`📋 Conta: ${conta}`).setDescription(`>>> ${note.text}`)
        .addFields({ name: 'Anotação', value: `#${note.n}`, inline: true }, { name: 'Staff', value: `${i.user}`, inline: true },
          ...(note.discordId ? [{ name: 'Discord', value: `<@${note.discordId}>`, inline: true }] : []),
          { name: 'Total na conta', value: `${list.length}`, inline: true });
      await i.guild.channels.cache.get(g.channels.contas)?.send({ embeds: [embed] }).catch(() => null);
      return i.reply({ embeds: [success(`Anotação **#${note.n}** salva na conta **${conta}** (${list.length} no total).`)], flags: EPH });
    }
    if (sub === 'ver') {
      if (!list.length) { delete g.contas[conta]; return i.reply({ embeds: [base().setDescription(`${e.check} Nenhuma anotação na conta **${conta}**.`)], flags: EPH }); }
      return i.reply({ embeds: [base().setTitle(`📋 Conta: ${conta} — ${list.length} anotações`)
        .setDescription(list.slice(-15).reverse().map((n) => `**#${n.n}** • <@${n.by}> ${ts(n.at)}${n.discordId ? ` • <@${n.discordId}>` : ''}\n> ${n.text.slice(0, 300)}`).join('\n\n').slice(0, 4000))], flags: EPH });
    }
    if (!(await perms.check(i, 'admin'))) return;
    const idx = list.findIndex((n) => n.n === i.options.getInteger('numero'));
    if (idx < 0) return i.reply({ embeds: [error('Anotação não encontrada nessa conta.')], flags: EPH });
    list.splice(idx, 1);
    if (!list.length) delete g.contas[conta];
    db.save();
    await i.reply({ embeds: [success('Anotação apagada.')], flags: EPH });
  }
};
