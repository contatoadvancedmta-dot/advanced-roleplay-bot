const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const { base, success, error, e } = require('../utils/embeds');

const EPH = MessageFlags.Ephemeral;

/** Aplica o IP salvo pelo /cidade ip (chamado ao ligar e ao salvar) */
function applySaved() {
  const c = db.global().cidade;
  if (!c?.ip) return;
  config.fivem.ip = c.ip;
  config.brand.connect = `mtasa://${c.ip}`;
  if (c.link) config.fivem.joinUrl = c.link;
}

function ipMessage() {
  const embed = base().setTitle(`${e.car} Entrar no ${config.brand.name}`)
    .setDescription(config.brand.connect
      ? `Abra o **MTA:SA** e conecte em:\n\`\`\`${config.brand.connect}\`\`\`\nOu clique no botão abaixo.`
      : `${e.warn} O IP da cidade ainda não foi configurado (\`/cidade ip\`).`)
    .setThumbnail(config.brand.logo);
  const buttons = [];
  if (config.fivem.joinUrl) buttons.push(new ButtonBuilder().setLabel('Entrar na cidade').setEmoji(e.car).setStyle(ButtonStyle.Link).setURL(config.fivem.joinUrl));
  buttons.push(new ButtonBuilder().setLabel('Baixar MTA:SA').setStyle(ButtonStyle.Link).setURL('https://multitheftauto.com/'));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('ip').setDescription('🏙️ IP da cidade para entrar'),
    applySaved, ipMessage,
    execute: (i) => i.reply(ipMessage())
  },
  {
    data: new SlashCommandBuilder().setName('cidade').setDescription('🏙️ Configura a cidade (Donos)')
      .addSubcommand((s) => s.setName('ip').setDescription('Define o IP:porta da cidade (MTA:SA)')
        .addStringOption((o) => o.setName('endereco').setDescription('Ex: 191.96.78.19:22003').setRequired(true))
        .addStringOption((o) => o.setName('link').setDescription('Link https para o botão "Entrar na cidade" (opcional)')))
      .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração da cidade')),
    async execute(i) {
      if (!(await perms.check(i, 'owner'))) return;
      if (i.options.getSubcommand() === 'ver') {
        return i.reply({ embeds: [base().setTitle('🏙️ Cidade').addFields(
          { name: 'IP', value: `\`${config.fivem.ip ?? 'não definido'}\``, inline: true },
          { name: 'Conectar', value: `\`${config.brand.connect ?? '—'}\``, inline: true },
          { name: 'Botão', value: config.fivem.joinUrl ?? '—', inline: true })], flags: EPH });
      }
      const ip = i.options.getString('endereco').trim().replace(/^mtasa:\/\//, '');
      if (!/^[\w.-]+:\d{2,5}$/.test(ip)) return i.reply({ embeds: [error('Use o formato **IP:PORTA**, ex: `191.96.78.19:22003`.')], flags: EPH });
      const link = i.options.getString('link');
      if (link && !/^https:\/\//.test(link)) return i.reply({ embeds: [error('O link precisa começar com https://')], flags: EPH });
      db.global().cidade = { ip, link: link || null };
      db.save();
      applySaved();
      require('../handlers/fivem').tick(i.client).catch(() => null);
      await i.reply({ embeds: [success(`Cidade configurada: \`mtasa://${ip}\`\nO status e os contadores já vão usar esse IP.`)], flags: EPH });
    }
  },
  {
    data: new SlashCommandBuilder().setName('progresso').setDescription('📈 Atualiza o progresso da cidade (canal de voz)')
      .addIntegerOption((o) => o.setName('porcentagem').setDescription('0 a 100').setRequired(true).setMinValue(0).setMaxValue(100)),
    async execute(i) {
      if (!(await perms.check(i, 'admin'))) return;
      const g = db.guild(i.guild.id);
      const ch = i.guild.channels.cache.get(g.channels.progresso);
      if (!ch) return i.reply({ embeds: [error('Configure o canal: `/setup cidade tipo:Progresso` (o canal de voz "Progress").')], flags: EPH });
      const p = i.options.getInteger('porcentagem');
      const name = (config.progressFormat ?? '🏆・Progress | {p}%').replace('{p}', p);
      await i.deferReply({ flags: EPH });
      const ok = await ch.setName(name, `Progresso por ${i.user.tag}`).then(() => true).catch(() => false);
      g.progresso = { value: p, at: Date.now(), by: i.user.id };
      db.save();
      await i.editReply({ embeds: [ok ? success(`Progresso atualizado para **${p}%** → ${ch}`) : error('O Discord só deixa renomear um canal **2 vezes a cada 10 minutos**. Tente de novo daqui a pouco.')] });
    }
  }
];
