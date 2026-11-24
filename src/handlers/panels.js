/**
 * Painéis simples: verificação, sugestões, regras e ajuda (todos com botões)
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;

function verifyPanel() {
  const embed = base()
    .setTitle(`${e.verify} Verificação — ${config.brand.name}`)
    .setDescription([
      `${e.welcome} Bem-vindo(a) à cidade!`,
      '',
      'Para liberar todos os canais, clique no botão abaixo.',
      `${e.dot} Ao se verificar você concorda com as **regras** do servidor.`
    ].join('\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:go').setLabel('Verificar-me').setEmoji(e.verify).setStyle(ButtonStyle.Success)
    )]
  }, embed, 'verificacao');
}

function suggestionPanel() {
  const embed = base()
    .setTitle(`${e.suggestion} Sugestões — ${config.brand.name}`)
    .setDescription([
      'Tem uma ideia para deixar o **Advanced** ainda melhor?',
      line,
      `${e.dot} Clique em **Enviar sugestão** e preencha o formulário`,
      `${e.dot} Escolha a **categoria** e anexe até **3 imagens** (prints, mapas...)`,
      `${e.dot} A comunidade vota com ${e.up} / ${e.down}`,
      `${e.dot} A staff analisa e você recebe a resposta na DM`,
      line,
      `${e.warn} Sugestões ofensivas ou repetidas serão recusadas.`
    ].join('\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sug:open').setLabel('Enviar sugestão').setEmoji(e.suggestion).setStyle(ButtonStyle.Primary)
    )]
  }, embed, 'sugestoes');
}

function rulesPanel() {
  const rules = [
    'Respeite todos os jogadores e a staff.',
    'Proibido RDM / VDM (matar ou atropelar sem motivo).',
    'Proibido Metagaming e Powergaming.',
    'Respeite o valor da vida (amor à vida).',
    'Fugas devem seguir o roteiro e as rotas permitidas.',
    'Proibido uso de hacks, bugs ou programas externos.',
    'Divulgação de outros servidores = banimento.'
  ];
  const embed = base()
    .setTitle(`${e.rules} Regras — ${config.brand.name}`)
    .setDescription(rules.map((r, i) => `**${String(i + 1).padStart(2, '0')}.** ${r}`).join('\n\n'))
    .setThumbnail(config.brand.logo);
  return withBanner({ embeds: [embed] }, embed, 'regras');
}

async function handleVerify(interaction) {
  const roleId = db.guild(interaction.guild.id).roles.verificado;
  if (!roleId) return interaction.reply({ embeds: [error('Cargo de verificado não configurado. Use `/setup cargo`.')], flags: EPH });
  if (interaction.member.roles.cache.has(roleId)) {
    return interaction.reply({ embeds: [success('Você já está verificado!')], flags: EPH });
  }
  await interaction.member.roles.add(roleId).catch(() => null);
  await interaction.reply({ embeds: [success(`Bem-vindo(a) ao **${config.brand.name}**! Todos os canais foram liberados. ${e.car}`, 'Verificado')], flags: EPH });
}

/** Ajuda com botões de categoria */
const HELP = {
  geral: {
    label: 'Geral', emoji: 'user', lines: [
      '`/sugestao` — enviar uma sugestão',
      '`/status` — jogadores online na cidade',
      '`/rank` — seu nível e XP',
      '`/top` — ranking dos mais ativos',
      '`/servidor` — informações do servidor',
      '**Clique direito numa mensagem → Apps → Denunciar mensagem**',
      '`/ajuda` — este menu'
    ]
  },
  rp: {
    label: 'Roleplay', emoji: 'car', lines: [
      '`/ip` — IP da cidade com botão de entrar',
      '`/faccao info` `lista` — facções da cidade',
      '`/faccao membro` — líder adiciona/remove membros',
      '**#instagram** — poste foto com legenda e ganhe curtidas ❤️',
      'Painéis: **report de bug**, **denúncia**, **contra-denúncia**, **solicitar tag**, **edital**, **feedback**'
    ]
  },
  staff: {
    label: 'Staff', emoji: 'shield', lines: [
      '`/mod` ou **clique direito → Apps → Ficha de moderação**',
      '`/aviso` `/castigo` `/expulsar` `/caso` *(Moderador)*',
      '`/banir` (pode ser temporário) `/desbanir` `/modstats` *(Admin)*',
      '`/trancar` `/destrancar` `/modolento` *(Moderador)*',
      '`/limpar` — apagar mensagens *(Moderador)*',
      '`/sorteio` — criar/encerrar sorteios *(Admin)*',
      'Botões **Aprovar/Reprovar** whitelist *(Suporte)*',
      '`/anuncio criar` — construtor com prévia e agendamento *(Admin)*',
      'Tickets: **Gerar PIX**, adicionar membros, notificar *(Suporte)*',
      '`/sugestao-staff` — sugestão interna da equipe *(Suporte)*',
      '**Bate-ponto** (botões) • `/ponto ranking` `ver` *(Suporte)*',
      '`/conta anotar` `ver` — anotações de contas do jogo *(Suporte)*',
      '`/faccao criar` `lider` `excluir` *(Admin)* • `/progresso` *(Admin)*',
      '`/tickets ranking` — quem mais assumiu • `/tickets staff` — seu desempenho',
      '`/painel` — enviar painéis com botões *(Admin)*',
      '`/setup` — configurar canais e cargos *(Admin)*',
      'Botões de **Aprovar/Recusar** sugestões *(Moderador)*',
      'Botão **Assumir** ticket *(Suporte)*'
    ]
  },
  donos: {
    label: 'Donos', emoji: 'crown', lines: [
      '`/admin painel` — gerenciador de staff por botões',
      '`/admin adicionar` — promover membro',
      '`/admin remover` — remover da staff',
      '`/admin lista` — ver toda a equipe',
      '`/emojis` — emojis próprios do Advanced',
      '`/pix configurar` `ver` `testar` `qrcode` `remover` — PIX dos tickets',
      '`/cidade ip` — define o IP da cidade'
    ]
  }
};

function helpMessage(category = 'geral') {
  const cat = HELP[category];
  const embed = base()
    .setTitle(`${e.logo} Central de Ajuda — ${config.brand.name}`)
    .setDescription(`${config.emojis[cat.emoji]} **Comandos: ${cat.label}**\n${line}\n${cat.lines.map((l) => `${e.arrow} ${l}`).join('\n')}`)
    .setThumbnail(config.brand.logo);
  const row = new ActionRowBuilder().addComponents(
    Object.entries(HELP).map(([k, v]) => new ButtonBuilder()
      .setCustomId(`help:${k}`).setLabel(v.label).setEmoji(config.emojis[v.emoji])
      .setStyle(k === category ? ButtonStyle.Primary : ButtonStyle.Secondary))
  );
  return { embeds: [embed], components: [row] };
}

async function handleHelp(interaction) {
  const cat = interaction.customId.split(':')[1];
  await interaction.update(helpMessage(cat));
}

module.exports = { verifyPanel, suggestionPanel, rulesPanel, handleVerify, helpMessage, handleHelp };
