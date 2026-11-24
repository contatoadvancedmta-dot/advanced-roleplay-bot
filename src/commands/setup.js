const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const { base, success, e } = require('../utils/embeds');

// Seções do /setup (cada uma vira um subcomando)
const SECTIONS = {
  canal: {
    title: '📁 Canais gerais',
    items: {
      boasvindas: 'Chegada (boas-vindas)',
      saida: 'Saída de membros',
      anuncios: 'Anúncios',
      sugestoes: 'Sugestões da comunidade',
      instagram: 'Instagram do RP (fotos com curtidas)',
      punicoes: 'Banimentos / punições (público)',
      resultado_edital: 'Resultado do edital',
      feedback_staff: 'Feedback da staff',
      levelup: 'Avisos de nível',
      tickets: 'Categoria dos tickets',
      whitelistresultado: 'Resultados da whitelist'
    }
  },
  staff: {
    title: '🛠️ Canais da staff (trancados)',
    items: {
      sugestoes_staff: 'Sugestões da staff',
      logs: 'Logs gerais',
      ticketlogs: 'Logs/transcripts dos tickets',
      bugs_staff: 'Recebe os reports de bug',
      denuncias_staff: 'Recebe denúncias e contra-denúncias',
      denunciastaff_review: 'Recebe denúncias contra staff (admin)',
      edital_review: 'Recebe as inscrições do edital (admin)',
      tags_review: 'Recebe os pedidos de tag',
      ausencias: 'Justificativas de ausência',
      contas: 'Anotar contas',
      ponto_log: 'Registro do bate-ponto',
      fila_suporte: 'Aviso da fila de suporte (voz)',
      recursos: 'Recursos de banimento',
      whitelist: 'Análise da whitelist'
    }
  },
  ranking: {
    title: '🏆 Rankings e listas (atualizam sozinhos)',
    items: {
      ranking_tickets: 'Ranking de tickets (quem mais assumiu)',
      ranking_ponto: 'Ranking de horas (bate-ponto)',
      ranking_apoiadores: 'Ranking de apoiadores',
      faccoes_lista: 'Lista de facções',
      rankings: 'Todos os rankings juntos'
    }
  },
  atendimento: {
    title: '📞 Atendimento por voz',
    items: {
      espera_suporte: 'Espera Suporte (voz)',
      suporte_1: 'Suporte #1 (voz)',
      suporte_2: 'Suporte #2 (voz)',
      suporte_3: 'Suporte #3 (voz)',
      suporte_4: 'Suporte #4 (voz)'
    }
  },
  cidade: {
    title: '🏙️ Cidade',
    items: {
      status: 'Status da cidade (atualiza sozinho)',
      avisoscrash: 'Avisos de crash (caiu/voltou)',
      progresso: 'Progresso (canal de voz)',
      contador: 'Contador de jogadores (voz)',
      contadormembros: 'Contador de membros (voz)'
    }
  }
};
const CHANNELS = Object.assign({}, ...Object.values(SECTIONS).map((sec) => sec.items));
const TYPES_FOR = {
  canal: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildCategory],
  staff: [ChannelType.GuildText],
  ranking: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
  atendimento: [ChannelType.GuildVoice],
  cidade: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice]
};

/** Tranca um canal para só a staff (e o bot) ver */
async function lockToStaff(interaction, ch, g) {
  const staffRoles = [...Object.keys(config.levels), 'staff'].map((k) => g.roles[k]).filter(Boolean);
  await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }).catch(() => null);
  await ch.permissionOverwrites.edit(interaction.client.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true, CreatePublicThreads: true, SendMessagesInThreads: true, ReadMessageHistory: true }).catch(() => null);
  for (const r of staffRoles) await ch.permissionOverwrites.edit(r, { ViewChannel: true, ReadMessageHistory: true, SendMessagesInThreads: true }).catch(() => null);
  return staffRoles;
}

const ROLES = {
  autorole: 'Cargo automático ao entrar',
  verificado: 'Cargo dado ao se verificar',
  whitelist: 'Cargo de whitelist aprovada',
  staff: 'Cargo geral de staff',
  ...Object.fromEntries(Object.entries(config.levels).map(([k, v]) => [k, `Cargo de ${v.label}`])),
  edital_aprovado: 'Cargo dado a quem passa no edital',
  ...Object.fromEntries(config.tags.map((t) => [`tag_${t.id}`, `Tag: ${t.label}`]))
};

function channelSub(s, name, description) {
  return s.setName(name).setDescription(description)
    .addStringOption((o) => o.setName('tipo').setDescription('O que configurar').setRequired(true)
      .addChoices(...Object.entries(SECTIONS[name].items).map(([value, label]) => ({ name: label, value }))))
    .addChannelOption((o) => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(...TYPES_FOR[name]));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configura canais e cargos do bot')
    .addSubcommand((s) => channelSub(s, 'canal', 'Define um canal geral (sugestões, boas-vindas, eventos...)'))
    .addSubcommand((s) => channelSub(s, 'staff', 'Define um canal da equipe — tranca para só a staff ver')
      .addBooleanOption((o) => o.setName('trancar').setDescription('Trancar o canal para só a staff ver (padrão: sim)')))
    .addSubcommand((s) => channelSub(s, 'ranking', 'Define o canal de cada ranking'))
    .addSubcommand((s) => channelSub(s, 'atendimento', 'Salas de voz do suporte (espera e Suporte #1, #2...)'))
    .addSubcommand((s) => channelSub(s, 'cidade', 'Status, avisos de crash, progresso e contadores'))
    .addSubcommand((s) => s.setName('cargo').setDescription('Define um cargo')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true)
        .addChoices(...Object.entries(ROLES).map(([value, name]) => ({ name, value }))))
      .addRoleOption((o) => o.setName('cargo').setDescription('Cargo').setRequired(true)))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand((s) => s.setName('contador').setDescription('Cria os contadores de jogadores e membros no topo do servidor')),

  async execute(interaction) {
    if (!(await perms.check(interaction, 'admin'))) return;
    const g = db.guild(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'contador') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const status = config.fivem.ip ? await require('../handlers/fivem').fetchStatus() : null;
      const created = await require('../handlers/counters').create(interaction.guild, status);
      return interaction.editReply({ embeds: [success(`Contadores criados no topo do servidor:\n${created.map((c) => `${e.arrow} ${c}`).join('\n')}\n\nEles se atualizam sozinhos (o Discord permite renomear a cada ~5 min).`, 'Contadores criados')] });
    }
    const EPH = MessageFlags.Ephemeral;

    if (SECTIONS[sub]) {
      const tipo = interaction.options.getString('tipo');
      const ch = interaction.options.getChannel('canal');
      g.channels[tipo] = ch.id; db.save();
      const notes = [];

      if (sub === 'staff' && interaction.options.getBoolean('trancar') !== false && ch.permissionOverwrites) {
        const roles = await lockToStaff(interaction, ch, g);
        notes.push(`${e.lock} Canal trancado: só ${roles.length ? roles.map((r) => `<@&${r}>`).join(', ') : 'quem é admin'} vê.`);
        if (!roles.length) notes.push(`${e.warn} Nenhum cargo de staff configurado — use \`/setup cargo\` (Suporte, Moderador, Admin) e rode de novo.`);
      }
      const AUTO_PANEL = {
        sugestoes_staff: () => require('../handlers/suggestions').staffPanel(),
        ausencias: () => require('../handlers/forms').panel('ausencia'),
        feedback_staff: () => require('../handlers/feedback').panel()
      };
      if (AUTO_PANEL[tipo] && ch.send) {
        await ch.send(AUTO_PANEL[tipo]()).catch(() => null);
        notes.push(`${e.check} Painel com o botão já foi enviado lá.`);
      }
      if (sub === 'ranking') {
        require('../handlers/rankingBoard').update(interaction.client).catch(() => null);
        notes.push(`${e.check} Ranking postado — atualiza sozinho.`);
      }
      if (tipo === 'status') {
        g.status = {};
        db.save();
        require('../handlers/fivem').tick(interaction.client).catch(() => null);
        notes.push(`${e.check} Status postado — atualiza a cada minuto.`);
      }
      return interaction.reply({ embeds: [success(`**${CHANNELS[tipo]}** → ${ch}${notes.length ? `\n${notes.join('\n')}` : ''}`, 'Configurado')], flags: EPH });
    }
    if (sub === 'cargo') {
      const tipo = interaction.options.getString('tipo');
      const role = interaction.options.getRole('cargo');
      g.roles[tipo] = role.id; db.save();
      return interaction.reply({ embeds: [success(`**${ROLES[tipo]}** definido como ${role}.`)], flags: EPH });
    }
    const fmt = (map, store, mention) => Object.entries(map)
      .map(([k, label]) => `${store[k] ? e.check : e.cross} ${label}: ${store[k] ? mention(store[k]) : '`não definido`'}`).join('\n');
    const embed = base().setTitle(`⚙️ Configuração — ${config.brand.name}`)
      .setDescription(`Use \`/setup canal\`, \`/setup staff\`, \`/setup ranking\`, \`/setup atendimento\`, \`/setup cidade\` e \`/setup cargo\`.`)
      .addFields(
        ...Object.entries(SECTIONS).map(([k, sec]) => ({ name: `${sec.title} — /setup ${k}`, value: fmt(sec.items, g.channels, (id) => `<#${id}>`).slice(0, 1024) })),
        { name: '👥 Cargos — /setup cargo', value: fmt(ROLES, g.roles, (id) => `<@&${id}>`).slice(0, 1024) }
      );
    return interaction.reply({ embeds: [embed], flags: EPH });
  }
};
