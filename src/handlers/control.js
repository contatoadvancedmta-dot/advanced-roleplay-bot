/**
 * CENTRAL DE CONTROLE — configura o bot inteiro por botões e menus (sem digitar comando).
 * Abre com /central ou pelo painel "Central de Controle" (botão Abrir).
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  UserSelectMenuBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags, AttachmentBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const setup = () => require('../commands/setup');
const painel = () => require('../commands/painel');
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
const back = (to = 'cp:home', label = 'Voltar') => btn(to, label, '⬅️');

/* ───────────── Menu principal ───────────── */

function home(guild) {
  const g = db.guild(guild.id);
  const { SECTIONS, ROLES } = setup();
  const allCh = Object.values(SECTIONS).flatMap((s) => Object.keys(s.items));
  const chOk = allCh.filter((k) => g.channels[k]).length;
  const rolesOk = Object.keys(ROLES).filter((k) => g.roles[k]).length;
  const pixOk = !!require('../utils/pix').getConfig(guild.id).key;
  const facs = Object.keys(g.faccoes ?? {}).length;
  const embed = base()
    .setTitle(`🎛️ Central de Controle — ${config.brand.name}`)
    .setDescription([
      'Configure tudo por aqui, só com botões. Escolha uma área:',
      line,
      `${chOk === allCh.length ? e.check : e.warn} **Canais:** ${chOk}/${allCh.length} configurados`,
      `${rolesOk >= 3 ? e.check : e.warn} **Cargos:** ${rolesOk}/${Object.keys(ROLES).length} configurados`,
      `${config.fivem.ip ? e.check : e.warn} **Cidade:** ${config.fivem.ip ? `\`${config.fivem.ip}\`` : 'IP não definido'}`,
      `${pixOk ? e.check : e.warn} **PIX:** ${pixOk ? 'ativo' : 'não configurado'}`,
      `🏴 **Facções:** ${facs}`
    ].join('\n'));
  return {
    content: null, embeds: [embed], files: [], attachments: [],
    components: [
      row(btn('cp:ch', 'Canais', '📁', ButtonStyle.Primary), btn('cp:role', 'Cargos', '👥', ButtonStyle.Primary), btn('cp:panel', 'Enviar painéis', '🧩', ButtonStyle.Primary), btn('cp:city', 'Cidade', '🏙️', ButtonStyle.Primary)),
      row(btn('cp:pix', 'PIX', '💸'), btn('cp:fac', 'Facções', '🏴'), btn('cp:ann', 'Anúncio', '📢'), btn('cp:team', 'Equipe', '👑')),
      row(btn('cp:view', 'Ver tudo que está configurado', '📋'))
    ]
  };
}

/** Mensagem fixa com o botão "Abrir central" (para deixar num canal da staff) */
function panel() {
  const embed = base().setTitle(`🎛️ Central de Controle — ${config.brand.name}`)
    .setDescription(`Configure canais, cargos, painéis, cidade, PIX, facções e equipe **só com botões**.\n${line}\n${e.lock} Só a administração consegue abrir.`);
  return withBanner({ embeds: [embed], components: [row(btn('cp:open', 'Abrir central', '🎛️', ButtonStyle.Primary))] }, embed, 'staff');
}

const page = (title, desc, components) => ({ content: null, embeds: [base().setTitle(title).setDescription(desc)], components, files: [], attachments: [] });
const done = (text, to) => ({ content: null, embeds: [success(text, 'Pronto')], components: [row(back(to, 'Continuar'), back('cp:home', 'Menu'))], files: [], attachments: [] });

/* ───────────── Telas ───────────── */

function channelSections(guild) {
  const g = db.guild(guild.id);
  const { SECTIONS } = setup();
  return page('📁 Canais', 'Escolha a área que você quer configurar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:chsec').setPlaceholder('Escolha a área').addOptions(Object.entries(SECTIONS).map(([k, s]) => {
      const keys = Object.keys(s.items);
      return { label: s.title.replace(/^\S+\s/, '').slice(0, 100), value: k, emoji: s.title.split(' ')[0], description: `${keys.filter((x) => g.channels[x]).length}/${keys.length} configurados` };
    }))),
    row(back())
  ]);
}

function channelItems(guild, section) {
  const g = db.guild(guild.id);
  const sec = setup().SECTIONS[section];
  return page(sec.title, `Escolha o que configurar:${section === 'staff' ? `\n${e.lock} Canais da staff são **trancados** automaticamente para só a equipe ver.` : ''}`, [
    row(new StringSelectMenuBuilder().setCustomId(`cp:chitem:${section}`).setPlaceholder('Escolha o item').addOptions(Object.entries(sec.items).map(([k, label]) => {
      const ch = g.channels[k] && guild.channels.cache.get(g.channels[k]);
      return { label: label.slice(0, 100), value: k, emoji: ch ? '✅' : '❌', description: ch ? `#${ch.name}`.slice(0, 100) : 'não configurado' };
    }))),
    row(back('cp:ch'))
  ]);
}

function rolesPage(guild) {
  const g = db.guild(guild.id);
  const { ROLES } = setup();
  return page('👥 Cargos', 'Escolha qual cargo configurar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:rolekey').setPlaceholder('Escolha o cargo').addOptions(Object.entries(ROLES).slice(0, 25).map(([k, label]) => {
      const r = g.roles[k] && guild.roles.cache.get(g.roles[k]);
      return { label: label.slice(0, 100), value: k, emoji: r ? '✅' : '❌', description: r ? `@${r.name}`.slice(0, 100) : 'não configurado' };
    }))),
    row(back())
  ]);
}

function panelsPage() {
  return page('🧩 Enviar painéis', 'Escolha o painel e depois o canal onde ele vai ficar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:pansel').setPlaceholder('Escolha o painel').addOptions(painel().PANEL_CHOICES().slice(0, 25).map((c) => ({ label: c.name.replace(/^\S+\s/, '').slice(0, 100), value: c.value, emoji: c.name.split(' ')[0] })))),
    row(back())
  ]);
}

function cityPage(guild) {
  const g = db.guild(guild.id);
  return page('🏙️ Cidade', [
    `**IP:** ${config.fivem.ip ? `\`${config.fivem.ip}\`` : '`não definido`'}`,
    `**Conectar:** ${config.brand.connect ? `\`${config.brand.connect}\`` : '—'}`,
    `**Progresso:** ${g.progresso ? `${g.progresso.value}%` : '—'}`,
    `**Contadores:** ${g.channels.contador ? `<#${g.channels.contador}>` : 'não criados'}`
  ].join('\n'), [
    row(btn('cp:cityip', 'Definir IP', '🌐', ButtonStyle.Primary), btn('cp:prog', 'Atualizar progresso', '📈'), btn('cp:counters', 'Criar contadores', '📊')),
    row(back())
  ]);
}

function pixPage(guild) {
  const pixCmd = require('../commands/pix');
  return { content: null, files: [], attachments: [], embeds: [pixCmd.configEmbed(guild.id)], components: [
    row(btn('cp:pixcfg', 'Configurar chave', '💸', ButtonStyle.Primary), btn('cp:pixtest', 'Gerar QR de teste', '🧪'), btn('cp:pixdel', 'Remover chave', '🗑️', ButtonStyle.Danger)),
    row(new StringSelectMenuBuilder().setCustomId('cp:pixstyle').setPlaceholder('🎨 Visual do QR Code').addOptions(Object.entries(QR_PRESETS).map(([k, p]) => ({ label: p.label, value: k, emoji: p.emoji })))),
    row(back())
  ] };
}

const QR_PRESETS = {
  roxo_bolinhas: { label: 'Roxo Advanced • bolinhas', emoji: '🟣', qr: { dark: '#5b21b6', light: '#ffffff', style: 'redondo', logo: 'bot', frame: '#8b5cf6' } },
  roxo: { label: 'Roxo Advanced • clássico', emoji: '💜', qr: { dark: '#4c1d95', light: '#ffffff', style: 'quadrado', logo: 'bot', frame: '#8b5cf6' } },
  preto: { label: 'Preto clássico', emoji: '⬛', qr: { dark: '#111111', light: '#ffffff', style: 'quadrado', logo: 'bot', frame: '#8b5cf6' } },
  servidor: { label: 'Com o ícone do servidor', emoji: '🏙️', qr: { dark: '#4c1d95', light: '#ffffff', style: 'redondo', logo: 'servidor', frame: '#8b5cf6' } },
  simples: { label: 'Simples (sem logo e sem moldura)', emoji: '⚪', qr: { dark: '#111111', light: '#ffffff', style: 'quadrado', logo: 'nenhuma', frame: null } }
};

function facPage(guild) {
  const fac = require('./faccoes');
  const all = Object.values(fac.store(guild.id));
  const comps = [row(btn('cp:faccreate', 'Criar facção', '➕', ButtonStyle.Success))];
  if (all.length) {
    comps.push(row(new StringSelectMenuBuilder().setCustomId('cp:facpick').setPlaceholder('Gerenciar uma facção').addOptions(all.slice(0, 25).map((f) => ({
      label: `[${f.sigla}] ${f.nome}`.slice(0, 100), value: f.id, emoji: fac.TYPES[f.tipo].emoji, description: `${f.membros.length} membros` })))));
  }
  comps.push(row(back()));
  return page('🏴 Facções', all.length ? all.map((f) => `${fac.TYPES[f.tipo].emoji} **[${f.sigla}] ${f.nome}** — líder <@${f.liderId}> • ${f.membros.length} membros`).join('\n').slice(0, 3500) : 'Nenhuma facção ainda.', comps);
}

function facManage(guild, f) {
  const fac = require('./faccoes');
  return { content: null, files: [], attachments: [], embeds: [fac.infoEmbed(f)], components: [
    row(new UserSelectMenuBuilder().setCustomId(`cp:facadd:${f.id}`).setPlaceholder('➕ Adicionar membros').setMaxValues(10)),
    row(new UserSelectMenuBuilder().setCustomId(`cp:facrem:${f.id}`).setPlaceholder('➖ Remover membros').setMaxValues(10)),
    row(new UserSelectMenuBuilder().setCustomId(`cp:faclead:${f.id}`).setPlaceholder('👑 Trocar o líder').setMaxValues(1)),
    row(back('cp:fac'), btn(`cp:facdel:${f.id}`, 'Excluir facção', '🗑️', ButtonStyle.Danger))
  ] };
}

/* ───────────── Roteador "cp:..." ───────────── */

const OWNER_ONLY = new Set(['pix', 'pixcfg', 'pixtest', 'pixdel', 'pixstyle', 'team', 'cityip', 'cityipm']);

async function handle(i) {
  const [, action, a, b] = i.customId.split(':');
  if (!(await perms.check(i, OWNER_ONLY.has(action) ? 'owner' : 'admin'))) return;
  const guild = i.guild;
  const g = db.guild(guild.id);

  switch (action) {
    case 'open': return i.reply({ ...home(guild), flags: EPH });
    case 'home': return i.update(home(guild));
    case 'view': return i.update({ content: null, embeds: [setup().configEmbed(guild)], components: [row(back())], files: [], attachments: [] });

    /* canais */
    case 'ch': return i.update(channelSections(guild));
    case 'chsec': return i.update(channelItems(guild, i.values[0]));
    case 'chitem': {
      const tipo = i.values[0];
      const label = setup().SECTIONS[a].items[tipo];
      return i.update(page(`📁 ${label}`, `Escolha o canal para **${label}**:`, [
        row(new ChannelSelectMenuBuilder().setCustomId(`cp:chset:${a}:${tipo}`).setPlaceholder('Escolha o canal').setChannelTypes(...setup().TYPES_FOR[a])),
        row(back(`cp:chback:${a}`))
      ]));
    }
    case 'chback': return i.update(channelItems(guild, a));
    case 'chset': {
      await i.deferUpdate();
      const ch = guild.channels.cache.get(i.values[0]);
      const notes = await setup().applyChannel(i, a, b, ch, true);
      return i.editReply(done(notes.join('\n'), `cp:chback:${a}`));
    }

    /* cargos */
    case 'role': return i.update(rolesPage(guild));
    case 'rolekey': return i.update(page(`👥 ${setup().ROLES[i.values[0]]}`, 'Escolha o cargo:', [
      row(new RoleSelectMenuBuilder().setCustomId(`cp:roleset:${i.values[0]}`).setPlaceholder('Escolha o cargo')), row(back('cp:role'))]));
    case 'roleset':
      g.roles[a] = i.values[0];
      db.save();
      return i.update(done(`**${setup().ROLES[a]}** → <@&${i.values[0]}>`, 'cp:role'));

    /* painéis */
    case 'panel': return i.update(panelsPage());
    case 'pansel': return i.update(page('🧩 Onde enviar?', 'Escolha o canal:', [
      row(new ChannelSelectMenuBuilder().setCustomId(`cp:panch:${i.values[0]}`).setPlaceholder('Escolha o canal').setChannelTypes(0, 5)), row(back('cp:panel'))]));
    case 'panch': {
      if (a === 'staff' && !(await perms.check(i, 'owner'))) return;
      await i.deferUpdate();
      const ch = guild.channels.cache.get(i.values[0]);
      await painel().sendPanel(guild, a, ch);
      return i.editReply(done(`Painel enviado em ${ch}.`, 'cp:panel'));
    }

    /* cidade */
    case 'city': return i.update(cityPage(guild));
    case 'cityip': return i.showModal(new ModalBuilder().setCustomId('cp:cityipm').setTitle('IP da cidade').addLabelComponents(
      new LabelBuilder().setLabel('IP:PORTA do MTA').setTextInputComponent(new TextInputBuilder().setCustomId('ip').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('191.96.78.19:22003').setValue(config.fivem.ip ?? '')),
      new LabelBuilder().setLabel('Link https do botão Entrar (opcional)').setTextInputComponent(new TextInputBuilder().setCustomId('link').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.fivem.joinUrl ?? ''))));
    case 'cityipm': {
      const ip = i.fields.getTextInputValue('ip').trim().replace(/^mtasa:\/\//, '');
      const link = i.fields.getTextInputValue('link').trim();
      if (!/^[\w.-]+:\d{2,5}$/.test(ip)) return i.reply({ embeds: [error('Use o formato **IP:PORTA**, ex: `191.96.78.19:22003`.')], flags: EPH });
      if (link && !/^https:\/\//.test(link)) return i.reply({ embeds: [error('O link precisa começar com https://')], flags: EPH });
      db.global().cidade = { ip, link: link || null };
      db.save();
      require('../commands/cidade')[0].applySaved();
      require('./fivem').tick(i.client).catch(() => null);
      return i.update(cityPage(guild));
    }
    case 'prog': return i.showModal(new ModalBuilder().setCustomId('cp:progm').setTitle('Progresso da cidade').addLabelComponents(
      new LabelBuilder().setLabel('Porcentagem (0 a 100)').setTextInputComponent(new TextInputBuilder().setCustomId('p').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3).setValue(String(g.progresso?.value ?? '')))));
    case 'progm': {
      const p = Math.max(0, Math.min(100, parseInt(i.fields.getTextInputValue('p'), 10)));
      if (Number.isNaN(p)) return i.reply({ embeds: [error('Digite um número de 0 a 100.')], flags: EPH });
      const ch = guild.channels.cache.get(g.channels.progresso);
      if (!ch) return i.reply({ embeds: [error('Configure antes o canal de progresso: Canais → Cidade → Progresso.')], flags: EPH });
      const ok = await ch.setName((config.progressFormat ?? '🏆・Progress | {p}%').replace('{p}', p)).then(() => true).catch(() => false);
      g.progresso = { value: p, at: Date.now(), by: i.user.id };
      db.save();
      if (!ok) return i.reply({ embeds: [error('O Discord só deixa renomear um canal 2 vezes a cada 10 minutos. Tente daqui a pouco.')], flags: EPH });
      return i.update(cityPage(guild));
    }
    case 'counters': {
      await i.deferUpdate();
      const status = config.fivem.ip ? await require('./fivem').fetchStatus() : null;
      const created = await require('./counters').create(guild, status);
      return i.editReply(done(`Contadores criados no topo do servidor:\n${created.map((c) => `${e.arrow} ${c}`).join('\n')}`, 'cp:city'));
    }

    /* pix */
    case 'pix': return i.update(pixPage(guild));
    case 'pixcfg': return i.showModal(require('../commands/pix').configModal(guild.id));
    case 'pixdel':
      delete g.pix;
      db.save();
      return i.update(pixPage(guild));
    case 'pixstyle': {
      g.pix ??= {};
      g.pix.qr = { ...QR_PRESETS[i.values[0]].qr };
      db.save();
      return pixTest(i, true);
    }
    case 'pixtest': return pixTest(i);

    /* facções */
    case 'fac': return i.update(facPage(guild));
    case 'faccreate': return i.showModal(new ModalBuilder().setCustomId('cp:faccm').setTitle('Criar facção').addLabelComponents(
      new LabelBuilder().setLabel('Nome').setTextInputComponent(new TextInputBuilder().setCustomId('nome').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
      new LabelBuilder().setLabel('Sigla').setTextInputComponent(new TextInputBuilder().setCustomId('sigla').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(8)),
      new LabelBuilder().setLabel('Tipo').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('tipo').setRequired(true)
        .addOptions(Object.entries(require('./faccoes').TYPES).map(([value, t]) => ({ label: t.label, value, emoji: t.emoji })))),
      new LabelBuilder().setLabel('Líder').setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('lider').setRequired(true).setMaxValues(1))));
    case 'faccm': {
      const fac = require('./faccoes');
      const lider = i.fields.getSelectedUsers('lider')?.first();
      const r = await fac.create(guild, i.user, { nome: i.fields.getTextInputValue('nome'), sigla: i.fields.getTextInputValue('sigla'), tipo: i.fields.getStringSelectValues('tipo')?.[0], liderId: lider?.id });
      if (r.error) return i.reply({ embeds: [error(r.error)], flags: EPH });
      require('./rankingBoard').touch(i.client);
      return i.update(facManage(guild, r.f));
    }
    case 'facpick': return i.update(facManage(guild, require('./faccoes').store(guild.id)[i.values[0]]));
    case 'facadd':
    case 'facrem': {
      const fac = require('./faccoes');
      const f = fac.store(guild.id)[a];
      if (!f) return i.update(facPage(guild));
      const results = [];
      for (const uid of i.values) {
        const r = await fac.setMember(guild, f, uid, action === 'facadd');
        results.push(r.error ? `${e.cross} ${r.error}` : `${e.check} ${r.text}`);
      }
      require('./rankingBoard').touch(i.client);
      const view = facManage(guild, f);
      view.embeds.unshift(base().setDescription(results.join('\n').slice(0, 4000)));
      return i.update(view);
    }
    case 'faclead': {
      const fac = require('./faccoes');
      const f = fac.store(guild.id)[a];
      f.liderId = i.values[0];
      if (!f.membros.includes(f.liderId)) await fac.setMember(guild, f, f.liderId, true);
      db.save();
      require('./rankingBoard').touch(i.client);
      return i.update(facManage(guild, f));
    }
    case 'facdel': return i.update(page('🗑️ Excluir facção?', `Isso apaga a facção **e o cargo dela**. Tem certeza?`, [
      row(btn(`cp:facdelok:${a}`, 'Sim, excluir', '🗑️', ButtonStyle.Danger), back(`cp:facback:${a}`, 'Cancelar'))]));
    case 'facback': return i.update(facManage(guild, require('./faccoes').store(guild.id)[a]));
    case 'facdelok': {
      const fac = require('./faccoes');
      const f = fac.store(guild.id)[a];
      if (f) await fac.remove(guild, f);
      require('./rankingBoard').touch(i.client);
      return i.update(facPage(guild));
    }

    /* anúncio */
    case 'ann': return i.update(page('📢 Novo anúncio', 'Escolha um modelo para começar:', [
      row(new StringSelectMenuBuilder().setCustomId('cp:anntpl').setPlaceholder('Escolha o modelo').addOptions(Object.entries(config.announceTemplates).map(([k, t]) => ({ label: t.label, value: k })))),
      row(back())]));
    case 'anntpl': {
      const ann = require('./announce');
      return i.showModal(ann.textModal(ann.newDraft(i, i.values[0])));
    }

    /* equipe */
    case 'team': {
      const p = require('./admin').panel();
      return i.update({ content: null, attachments: [], ...p, components: [...p.components, row(back())] });
    }
  }
}

async function pixTest(i, styleChanged = false) {
  const pix = require('../utils/pix');
  const cfg = pix.getConfig(i.guild.id);
  const code = pix.payload({ key: cfg.key || 'exemplo@advanced.com', name: cfg.receiverName || 'ADVANCED', city: cfg.city || 'SAO PAULO', amount: 1, txid: 'TESTE' });
  await i.deferUpdate();
  const file = new AttachmentBuilder(await pix.qrBuffer(code, i.guild), { name: 'qr.png' });
  const embed = base().setTitle(styleChanged ? '🎨 Visual do QR salvo!' : '🧪 QR de teste')
    .setDescription(`${cfg.key ? 'Escaneie no app do banco e confira o **nome do recebedor** (não precisa pagar).' : `${e.warn} Chave ainda não configurada — este QR usa uma chave de exemplo.`}`)
    .setImage('attachment://qr.png');
  await i.editReply({ content: null, embeds: [embed], files: [file], attachments: [], components: [row(back('cp:pix'), back('cp:home', 'Menu'))] });
}

module.exports = { handle, home, panel };
