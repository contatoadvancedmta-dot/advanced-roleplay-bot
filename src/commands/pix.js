/**
 * /pix — configura o PIX dos tickets pelo Discord (somente donos)
 */
const {
  SlashCommandBuilder, MessageFlags, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, AttachmentBuilder
} = require('discord.js');
const db = require('../database');
const perms = require('../utils/permissions');
const pix = require('../utils/pix');
const { base, success, error, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');
const qrstyle = require('../utils/qrstyle');
const fs = require('node:fs');
const path = require('node:path');

const COLOR_PRESETS = [
  ['Preto', '#111111'], ['Laranja Advanced', '#c2410c'], ['Laranja claro (moldura)', '#f97316'], ['Azul escuro', '#1e3a8a'],
  ['Azul', '#3b82f6'], ['Roxo escuro', '#4c1d95'], ['Roxo', '#8b5cf6'], ['Verde escuro', '#14532d'], ['Verde', '#22c55e'],
  ['Vermelho escuro', '#7f1d1d'], ['Vermelho', '#ef4444'], ['Cinza escuro', '#27272a'], ['Branco', '#ffffff'], ['Creme', '#fff7ed']
];
const LOGOS = { bot: 'Logo do bot (chama)', servidor: 'Ícone do servidor', personalizada: 'Imagem enviada', nenhuma: 'Sem logo' };

const EPH = MessageFlags.Ephemeral;
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Esconde o meio da chave para mostrar com segurança */
const mask = (k) => (!k ? '—' : k.length <= 8 ? k : `${k.slice(0, 4)}••••${k.slice(-4)}`);

function configEmbed(guildId) {
  const cfg = pix.getConfig(guildId);
  const saved = db.guild(guildId).pix ?? {};
  return base()
    .setTitle(`${e.money} Configuração do PIX`)
    .setDescription(cfg.key ? `${e.approved} PIX **ativo** — o botão **Gerar PIX** dos tickets já funciona.` : `${e.warn} PIX **não configurado**. Use \`/pix configurar\`.`)
    .addFields(
      { name: 'Tipo de chave', value: saved.keyType ? pix.KEY_TYPES[saved.keyType] : cfg.key ? 'definido no config.js' : '—', inline: true },
      { name: 'Chave', value: `\`${mask(cfg.key)}\``, inline: true },
      { name: 'Recebedor', value: cfg.receiverName || '—', inline: true },
      { name: 'Cidade', value: cfg.city || '—', inline: true },
      { name: 'Nome da loja', value: cfg.storeName || '—', inline: true },
      { name: 'Atualizado', value: saved.updatedAt ? `<t:${Math.floor(saved.updatedAt / 1000)}:R> por <@${saved.updatedBy}>` : '—', inline: true }
    );
}

function configModal(guildId) {
  const cfg = pix.getConfig(guildId);
  const saved = db.guild(guildId).pix ?? {};
  const text = (id, value, placeholder, max) => new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short)
    .setRequired(true).setMaxLength(max).setPlaceholder(placeholder).setValue(value || '');
  return new ModalBuilder().setCustomId('pixcfg:save').setTitle('Configurar PIX').addLabelComponents(
    new LabelBuilder().setLabel('Tipo de chave').setStringSelectMenuComponent(
      new StringSelectMenuBuilder().setCustomId('tipo').setRequired(true).setPlaceholder('Escolha o tipo da chave')
        .addOptions(Object.entries(pix.KEY_TYPES).map(([value, label]) => ({ label, value, default: value === saved.keyType })))),
    new LabelBuilder().setLabel('Chave PIX').setDescription('CPF/CNPJ com ou sem pontos, telefone com DDD, e-mail ou chave aleatória')
      .setTextInputComponent(text('chave', cfg.key, 'Ex: pagamentos@f1loja.com', 80)),
    new LabelBuilder().setLabel('Nome do recebedor').setDescription('Como aparece no banco (sem acentos, até 25 letras)')
      .setTextInputComponent(text('nome', cfg.receiverName, 'Ex: F1 LOJA', 25)),
    new LabelBuilder().setLabel('Cidade do recebedor').setTextInputComponent(text('cidade', cfg.city, 'Ex: SAO PAULO', 15)),
    new LabelBuilder().setLabel('Nome da loja (aparece na cobrança)').setTextInputComponent(text('loja', cfg.storeName, 'Ex: F1 Loja', 40))
  );
}

/** Formulário enviado */
async function handleModal(interaction) {
  if (!(await perms.check(interaction, 'owner'))) return;
  const type = interaction.fields.getStringSelectValues('tipo')?.[0];
  let key;
  try {
    key = pix.normalizeKey(type, interaction.fields.getTextInputValue('chave'));
  } catch (err) {
    return interaction.reply({ embeds: [error(`${err.message}\nUse \`/pix configurar\` de novo.`, 'Chave inválida')], flags: EPH });
  }
  const g = db.guild(interaction.guild.id);
  g.pix = {
    keyType: type, key,
    receiverName: interaction.fields.getTextInputValue('nome').trim(),
    city: interaction.fields.getTextInputValue('cidade').trim(),
    storeName: interaction.fields.getTextInputValue('loja').trim(),
    updatedBy: interaction.user.id, updatedAt: Date.now()
  };
  db.save();
  sendLog(interaction.guild, base().setTitle(`${e.money} PIX atualizado`).setDescription(`${interaction.user} alterou a chave PIX (${pix.KEY_TYPES[type]} \`${mask(key)}\`)`));
  await interaction.reply({ embeds: [success('PIX configurado! Use `/pix testar` para conferir no app do banco.', 'Salvo'), configEmbed(interaction.guild.id)], flags: EPH });
}

/** /pix qrcode — salva o visual do QR e mostra uma prévia */
async function qrSettings(i) {
  const g = db.guild(i.guild.id);
  g.pix ??= {};
  if (i.options.getBoolean('resetar')) {
    delete g.pix.qr;
    db.save();
  } else {
    const qr = { ...qrstyle.DEFAULTS, ...(g.pix.qr ?? {}) };
    for (const k of ['cor', 'fundo']) {
      const v = i.options.getString(k);
      if (!v) continue;
      if (!qrstyle.hex(v)) return i.reply({ embeds: [error(`Cor inválida: \`${v}\`. Use o formato #RRGGBB, ex: #111111.`)], flags: EPH });
      qr[k === 'cor' ? 'dark' : 'light'] = v.startsWith('#') ? v : `#${v}`;
    }
    const frame = i.options.getString('moldura');
    if (frame) {
      if (frame !== 'nenhuma' && !qrstyle.hex(frame)) return i.reply({ embeds: [error(`Cor de moldura inválida: \`${frame}\`.`)], flags: EPH });
      qr.frame = frame === 'nenhuma' ? null : frame.startsWith('#') ? frame : `#${frame}`;
    }
    if (i.options.getString('estilo')) qr.style = i.options.getString('estilo');
    if (i.options.getString('logo')) qr.logo = i.options.getString('logo');

    const img = i.options.getAttachment('imagem');
    if (img) {
      if (img.contentType !== 'image/png' || img.size > 1024 * 1024) return i.reply({ embeds: [error('A logo precisa ser **PNG** de até **1 MB** (de preferência quadrada e com fundo transparente).')], flags: EPH });
      await i.deferReply({ flags: EPH });
      const buf = Buffer.from(await fetch(img.url).then((r) => r.arrayBuffer()));
      fs.mkdirSync(path.dirname(qrstyle.customLogoPath(i.guild.id)), { recursive: true });
      fs.writeFileSync(qrstyle.customLogoPath(i.guild.id), buf);
      qr.logo = 'personalizada';
    }
    // o leitor do banco precisa de contraste entre os pontos e o fundo
    const ratio = qrstyle.contrast(qrstyle.hex(qr.dark), qrstyle.hex(qr.light));
    if (ratio < 3.5) {
      const payload = { embeds: [error(`As cores **${qr.dark}** e **${qr.light}** têm pouco contraste — o banco pode não conseguir ler o QR.\nUse pontos **escuros** em fundo **claro**.`, 'Cores sem contraste')], flags: EPH };
      return i.deferred ? i.editReply(payload) : i.reply(payload);
    }
    g.pix.qr = qr;
    db.save();
  }
  if (!i.deferred) await i.deferReply({ flags: EPH });

  const cfg = pix.getConfig(i.guild.id);
  const code = pix.payload({ key: cfg.key || 'exemplo@advanced.com', name: cfg.receiverName || 'ADVANCED', city: cfg.city || 'SAO PAULO', amount: 1, txid: 'PREVIA' });
  const qr = { ...qrstyle.DEFAULTS, ...(g.pix.qr ?? {}) };
  const embed = base()
    .setTitle(`${e.money} Visual do QR Code`)
    .setDescription(`${e.check} Salvo! É assim que o QR vai aparecer nas cobranças dos tickets.\n${cfg.key ? `${e.info} Escaneie com o app do banco para conferir que lê certinho (não precisa pagar).` : `${e.warn} Prévia com chave de exemplo — configure a sua em \`/pix configurar\`.`}`)
    .addFields(
      { name: 'Pontos', value: `\`${qr.dark}\``, inline: true },
      { name: 'Fundo', value: `\`${qr.light}\``, inline: true },
      { name: 'Moldura', value: qr.frame ? `\`${qr.frame}\`` : 'nenhuma', inline: true },
      { name: 'Estilo', value: qr.style === 'redondo' ? 'Bolinhas' : 'Quadrado', inline: true },
      { name: 'Logo', value: LOGOS[qr.logo] ?? qr.logo, inline: true }
    )
    .setImage('attachment://qr-previa.png');
  await i.editReply({ embeds: [embed], files: [new AttachmentBuilder(await pix.qrBuffer(code, i.guild), { name: 'qr-previa.png' })] });
}

module.exports = {
  data: new SlashCommandBuilder().setName('pix').setDescription('💸 Configura o PIX dos tickets (somente donos)')
    .addSubcommand((s) => s.setName('configurar').setDescription('Abre o formulário para definir a chave PIX'))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand((s) => s.setName('testar').setDescription('Gera um QR de teste (só você vê) para conferir no banco')
      .addNumberOption((o) => o.setName('valor').setDescription('Valor do teste (padrão R$ 1,00)').setMinValue(0.01).setMaxValue(10000)))
    .addSubcommand((s) => s.setName('remover').setDescription('Apaga a chave configurada pelo Discord'))
    .addSubcommand((s) => s.setName('qrcode').setDescription('Personaliza o visual do QR Code (cores, logo, moldura)')
      .addStringOption((o) => o.setName('cor').setDescription('Cor dos pontos (ex: #111111)').setAutocomplete(true))
      .addStringOption((o) => o.setName('fundo').setDescription('Cor do fundo (ex: #ffffff)').setAutocomplete(true))
      .addStringOption((o) => o.setName('estilo').setDescription('Formato dos pontos').addChoices(
        { name: '◼️ Quadrado (clássico)', value: 'quadrado' }, { name: '⚫ Bolinhas (moderno)', value: 'redondo' }))
      .addStringOption((o) => o.setName('logo').setDescription('Imagem no meio do QR').addChoices(
        ...Object.entries(LOGOS).map(([value, name]) => ({ name, value }))))
      .addStringOption((o) => o.setName('moldura').setDescription('Cor da moldura (ou "nenhuma")').setAutocomplete(true))
      .addAttachmentOption((o) => o.setName('imagem').setDescription('Sua logo em PNG (quadrada, até 1 MB)'))
      .addBooleanOption((o) => o.setName('resetar').setDescription('Volta o QR para o visual padrão'))),
  handleModal,

  async autocomplete(i) {
    const focused = i.options.getFocused(true);
    const q = focused.value.toLowerCase();
    const list = (focused.name === 'moldura' ? [['Nenhuma', 'nenhuma'], ...COLOR_PRESETS] : COLOR_PRESETS)
      .filter(([n, v]) => n.toLowerCase().includes(q) || v.includes(q));
    if (/^#?[0-9a-f]{6}$/i.test(focused.value)) list.unshift([`Usar ${focused.value}`, focused.value.startsWith('#') ? focused.value : `#${focused.value}`]);
    await i.respond(list.slice(0, 25).map(([name, value]) => ({ name: `${name} ${value !== 'nenhuma' ? value : ''}`.trim(), value })));
  },

  async execute(i) {
    if (!(await perms.check(i, 'owner'))) return;
    const sub = i.options.getSubcommand();
    if (sub === 'configurar') return i.showModal(configModal(i.guild.id));
    if (sub === 'qrcode') return qrSettings(i);
    if (sub === 'ver') return i.reply({ embeds: [configEmbed(i.guild.id)], flags: EPH });
    if (sub === 'remover') {
      delete db.guild(i.guild.id).pix;
      db.save();
      return i.reply({ embeds: [success('Chave PIX removida. O botão **Gerar PIX** dos tickets fica desativado até configurar de novo.')], flags: EPH });
    }
    // testar
    const cfg = pix.getConfig(i.guild.id);
    if (!cfg.key) return i.reply({ embeds: [error('Configure primeiro com `/pix configurar`.')], flags: EPH });
    const value = i.options.getNumber('valor') ?? 1;
    const code = pix.payload({ key: cfg.key, name: cfg.receiverName, city: cfg.city, amount: value, txid: 'TESTE', description: 'Teste do bot' });
    const file = new AttachmentBuilder(await pix.qrBuffer(code, i.guild), { name: 'pix-teste.png' });
    const embed = base()
      .setTitle(`${e.money} PIX de teste • ${cfg.storeName}`)
      .setDescription(`Abra o app do banco, escaneie o QR e **confira se o nome do recebedor está certo**.\n${e.warn} **Não precisa pagar** — é só para conferir.\n\n**Valor:** ${brl(value)}\n\`\`\`${code}\`\`\``)
      .setImage('attachment://pix-teste.png');
    await i.reply({ embeds: [embed], files: [file], flags: EPH });
  }
};
