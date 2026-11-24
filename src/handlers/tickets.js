/**
 * TICKETS MODERNOS
 * - Painel com menu de categorias
 * - Painel de controle: assumir, notificar na DM, adicionar/remover membros, gerar PIX, fechar
 * - PIX com QR Code + copia e cola + confirmação de pagamento
 * - Transcript em HTML + avaliação do atendimento na DM
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, MessageFlags, AttachmentBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, emo, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const pix = require('../utils/pix');
const { ts } = require('../utils/time');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const em = (key) => config.emojis[key] ?? key;
const MEMBER_PERMS = { ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true, EmbedLinks: true };
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ───────────── Painel público ───────────── */

function panel() {
  const embed = base()
    .setTitle(`${e.ticket} Central de Atendimento — ${config.brand.name}`)
    .setDescription([
      'Precisa de ajuda da equipe? Abra um ticket escolhendo a categoria abaixo.',
      line,
      ...config.ticketTypes.map((t) => `${em(t.emoji)} **${t.label}**\n${e.arrow} ${t.description}`),
      line,
      `${e.clock} Respondemos o mais rápido possível. Você recebe avisos na **DM**.`
    ].join('\n'))
    .setThumbnail(config.brand.logo);
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:open')
    .setPlaceholder('Selecione o tipo de atendimento')
    .addOptions(config.ticketTypes.map((t) => ({ label: t.label, description: t.description, value: t.id, emoji: emo(em(t.emoji)) })));
  return withBanner({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] }, embed, 'tickets');
}

const staffRoleIds = (g) => Object.keys(config.levels).map((l) => g.roles[l]).filter(Boolean);
const getTicket = (interaction) => db.guild(interaction.guild.id).tickets[interaction.channel.id];

/* ───────────── Painel de controle dentro do ticket ───────────── */

function controlRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir').setEmoji(e.claim).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:notify').setLabel('Notificar membro').setEmoji(e.announce).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:pix').setLabel('Gerar PIX').setEmoji(e.money).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar').setEmoji(e.lock).setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('ticket:members').setPlaceholder('Adicionar ou remover membros do ticket').setMinValues(1).setMaxValues(5)
    )
  ];
}

function ticketEmbed(t, user) {
  const type = config.ticketTypes.find((x) => x.id === t.type) ?? config.ticketTypes[0];
  return base()
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
    .setTitle(`${em(type.emoji)} ${type.label} • Ticket #${t.number}`)
    .setDescription([
      `Olá <@${t.ownerId}>, seja bem-vindo(a) ao seu atendimento!`,
      '',
      `${e.dot} Explique seu caso com o máximo de detalhes.`,
      `${e.dot} Envie prints/vídeos se tiver.`,
      `${e.dot} Você será avisado na **DM** quando a staff responder.`,
      line
    ].join('\n'))
    .addFields(
      { name: `${e.user} Aberto por`, value: `<@${t.ownerId}>`, inline: true },
      { name: `${e.claim} Responsável`, value: t.claimedBy ? `<@${t.claimedBy}>` : '*Aguardando...*', inline: true },
      { name: `${e.clock} Aberto`, value: ts(t.createdAt), inline: true },
      { name: `${e.user} Participantes`, value: t.members?.length ? t.members.map((id) => `<@${id}>`).join(' ') : '—' }
    );
}

async function refreshControl(channel, t) {
  const msg = t.controlMessageId && (await channel.messages.fetch(t.controlMessageId).catch(() => null));
  const user = await channel.client.users.fetch(t.ownerId);
  if (msg) await msg.edit({ embeds: [ticketEmbed(t, user)], components: controlRows() }).catch(() => null);
}

async function dmOwner(client, t, embed, components = []) {
  const user = await client.users.fetch(t.ownerId).catch(() => null);
  return user?.send({ embeds: [embed], components }).catch(() => null);
}

const goButton = (url) => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel('Ir para o ticket').setEmoji(e.ticket).setStyle(ButtonStyle.Link).setURL(url))];

/* ───────────── Abrir ───────────── */

async function open(interaction) {
  const type = config.ticketTypes.find((t) => t.id === interaction.values[0]);
  const g = db.guild(interaction.guild.id);

  const existing = Object.entries(g.tickets).find(([, t]) => t.ownerId === interaction.user.id && !t.closed);
  if (existing && interaction.guild.channels.cache.has(existing[0])) {
    return interaction.reply({ embeds: [error(`Você já tem um ticket aberto: <#${existing[0]}>`)], flags: EPH });
  }

  await interaction.deferReply({ flags: EPH });
  const number = String(++g.ticketCounter).padStart(4, '0');

  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    ...staffRoleIds(g).map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }))
  ];

  const channel = await interaction.guild.channels.create({
    name: `${type.id}-${number}`,
    type: ChannelType.GuildText,
    parent: g.channels.tickets || null,
    topic: `Ticket #${number} de ${interaction.user.tag} • ${type.label}`,
    permissionOverwrites: overwrites
  });

  const t = { ownerId: interaction.user.id, type: type.id, number, createdAt: Date.now(), members: [], payments: [] };
  g.tickets[channel.id] = t;

  const mentions = staffRoleIds(g).map((id) => `<@&${id}>`).join(' ');
  const msg = await channel.send({ content: `${interaction.user} ${mentions}`, embeds: [ticketEmbed(t, interaction.user)], components: controlRows() });
  await msg.pin().catch(() => null);
  t.controlMessageId = msg.id;
  db.save();

  dmOwner(interaction.client, t, base().setTitle(`${e.ticket} Ticket #${number} aberto`)
    .setDescription(`Seu atendimento de **${type.label}** foi aberto no **${interaction.guild.name}**.\nVocê será avisado aqui quando a staff responder.`), goButton(channel.url));

  await interaction.editReply({ embeds: [success(`Seu ticket foi criado: ${channel}`, 'Ticket aberto')], components: goButton(channel.url) });
}

/* ───────────── Ações ───────────── */

async function claim(interaction, t) {
  if (!(await perms.check(interaction, 'suporte'))) return;
  if (t.claimedBy) return interaction.reply({ embeds: [error(`Já assumido por <@${t.claimedBy}>.`)], flags: EPH });
  t.claimedBy = interaction.user.id;
  // registra para o ranking de quem mais assumiu
  const g = db.guild(interaction.guild.id);
  g.ticketClaims ??= [];
  g.ticketClaims.push({ staffId: interaction.user.id, number: t.number, type: t.type, ownerId: t.ownerId, at: Date.now() });
  db.save();
  require('./rankingBoard').touch(interaction.client);
  await refreshControl(interaction.channel, t);
  await interaction.reply({ embeds: [base(config.colors.info).setDescription(`${e.claim} ${interaction.user} **assumiu este atendimento.**`)] });
  dmOwner(interaction.client, t, base(config.colors.info).setTitle(`${e.claim} Seu ticket foi assumido`)
    .setDescription(`**${interaction.user.username}** está cuidando do seu ticket **#${t.number}**.`), goButton(interaction.channel.url));
}

async function notify(interaction, t) {
  if (!(await perms.check(interaction, 'suporte'))) return;
  const sent = await dmOwner(interaction.client, t, base(config.colors.warning)
    .setTitle(`${e.announce} A staff está te esperando!`)
    .setDescription(`**${interaction.user.username}** respondeu seu ticket **#${t.number}** no **${interaction.guild.name}**.\nClique abaixo para ver.`),
  goButton(interaction.channel.url));
  await interaction.reply({ embeds: [sent ? success(`<@${t.ownerId}> foi notificado na DM.`) : error('Não consegui enviar DM (privado fechado).')], flags: EPH });
}

async function members(interaction, t) {
  if (!(await perms.check(interaction, 'suporte'))) return;
  const added = [], removed = [];
  for (const id of interaction.values) {
    if (id === t.ownerId || id === interaction.client.user.id) continue;
    if (t.members.includes(id)) {
      await interaction.channel.permissionOverwrites.delete(id).catch(() => null);
      t.members = t.members.filter((x) => x !== id);
      removed.push(id);
    } else {
      await interaction.channel.permissionOverwrites.edit(id, MEMBER_PERMS).catch(() => null);
      t.members.push(id);
      added.push(id);
      const u = await interaction.client.users.fetch(id).catch(() => null);
      u?.send({ embeds: [base().setTitle(`${e.ticket} Você foi adicionado a um ticket`)
        .setDescription(`${interaction.user.username} te adicionou ao ticket **#${t.number}** no **${interaction.guild.name}**.`)], components: goButton(interaction.channel.url) }).catch(() => null);
    }
  }
  db.save();
  await interaction.update({ embeds: [ticketEmbed(t, await interaction.client.users.fetch(t.ownerId))], components: controlRows() });
  const parts = [];
  if (added.length) parts.push(`${e.check} Adicionado(s): ${added.map((id) => `<@${id}>`).join(' ')}`);
  if (removed.length) parts.push(`${e.cross} Removido(s): ${removed.map((id) => `<@${id}>`).join(' ')}`);
  if (parts.length) await interaction.channel.send({ embeds: [base(config.colors.info).setDescription(parts.join('\n') + `\n${e.arrow} por ${interaction.user}`)] });
}

/* ───────────── PIX ───────────── */

function pixModal() {
  return new ModalBuilder().setCustomId('ticket:pixsubmit').setTitle('Gerar cobrança PIX')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('valor').setLabel('Valor (R$)').setPlaceholder('Ex: 25,90')
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('produto').setLabel('Produto / descrição').setPlaceholder('Ex: VIP Ouro 30 dias')
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60))
    );
}

async function createPix(interaction, t) {
  const cfg = pix.getConfig(interaction.guild.id);
  if (!cfg.key) return interaction.reply({ embeds: [error('A chave PIX ainda não foi configurada. Um dono pode usar `/pix configurar`.')], flags: EPH });
  const value = Number(interaction.fields.getTextInputValue('valor').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  if (!value || value <= 0 || value > 100000) return interaction.reply({ embeds: [error('Valor inválido. Ex: `25,90`')], flags: EPH });
  const product = interaction.fields.getTextInputValue('produto');

  await interaction.deferReply();
  t.payments ??= [];
  const id = t.payments.length + 1;
  const txid = `ADV${t.number}P${id}`;
  const code = pix.payload({ key: cfg.key, name: cfg.receiverName, city: cfg.city, amount: value, txid, description: product });
  const file = new AttachmentBuilder(await pix.qrBuffer(code, interaction.guild), { name: 'pix.png' });

  t.payments.push({ id, value, product, txid, code, by: interaction.user.id, at: Date.now(), status: 'pendente' });
  db.save();

  const embed = base(0x32bcad)
    .setTitle(`${e.money} Pagamento via PIX • ${cfg.storeName}`)
    .setDescription(`Escaneie o **QR Code** no app do seu banco ou use o **copia e cola** abaixo.\n${line}`)
    .addFields(
      { name: `${e.gift} Produto`, value: product, inline: true },
      { name: `${e.money} Valor`, value: `**${brl(value)}**`, inline: true },
      { name: `${e.log} Pedido`, value: `\`${txid}\``, inline: true },
      { name: `${e.user} Recebedor`, value: `${cfg.receiverName}`, inline: true },
      { name: `${e.pending} Status`, value: 'Aguardando pagamento', inline: true },
      { name: 'PIX copia e cola', value: `\`\`\`${code}\`\`\`` },
      { name: '​', value: `${e.warn} Após pagar, **envie o comprovante aqui** no ticket. A staff vai confirmar.` }
    )
    .setImage('attachment://pix.png');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:pixcopy:${id}`).setLabel('Copiar código (celular)').setEmoji(e.log).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:pixpaid:${id}`).setLabel('Confirmar pagamento').setEmoji(e.check).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket:pixcancel:${id}`).setLabel('Cancelar').setEmoji(e.cross).setStyle(ButtonStyle.Danger)
  );
  await interaction.editReply({ content: `<@${t.ownerId}>`, embeds: [embed], files: [file], components: [row] });

  dmOwner(interaction.client, t, base(0x32bcad).setTitle(`${e.money} Nova cobrança PIX`)
    .setDescription(`**${product}** — **${brl(value)}**\nO QR Code e o copia e cola estão no seu ticket **#${t.number}**.`), goButton(interaction.channel.url));
  sendLog(interaction.guild, base(0x32bcad).setTitle(`${e.money} PIX gerado`)
    .setDescription(`Ticket \`#${t.number}\` • <@${t.ownerId}>\n**${product}** — ${brl(value)} • \`${txid}\`\nGerado por ${interaction.user}`));
}

async function pixAction(interaction, t, action, id) {
  const p = t.payments?.find((x) => x.id === Number(id));
  if (!p) return interaction.reply({ embeds: [error('Cobrança não encontrada.')], flags: EPH });

  if (action === 'pixcopy') return interaction.reply({ content: p.code, flags: EPH }); // texto puro = fácil de copiar no celular

  if (!(await perms.check(interaction, 'suporte'))) return;
  if (p.status !== 'pendente') return interaction.reply({ embeds: [error(`Essa cobrança já está **${p.status}**.`)], flags: EPH });
  const paid = action === 'pixpaid';
  p.status = paid ? 'paga' : 'cancelada';
  p.confirmedBy = interaction.user.id;
  db.save();

  const old = interaction.message.embeds[0];
  const embed = base(paid ? config.colors.success : config.colors.error)
    .setTitle(old.title).setDescription(old.description)
    .addFields(old.fields.filter((f) => !f.name.includes('Status') && f.name !== '​')
      .concat({ name: `${paid ? e.approved : e.rejected} Status`, value: `**${paid ? 'PAGO' : 'CANCELADO'}** por ${interaction.user} ${ts(Date.now())}` }))
    .setImage(paid ? 'attachment://pix.png' : null);
  await interaction.update({ embeds: [embed], components: [], ...(paid ? {} : { attachments: [] }) }); // cancelado: some o QR

  if (paid) {
    await interaction.channel.send({ embeds: [base(config.colors.success).setDescription(`${e.approved} Pagamento de **${brl(p.value)}** (${p.product}) confirmado! Obrigado pela compra ${e.star}`)] });
    dmOwner(interaction.client, t, base(config.colors.success).setTitle(`${e.approved} Pagamento confirmado!`)
      .setDescription(`Recebemos seu pagamento de **${brl(p.value)}** referente a **${p.product}**.\nObrigado por apoiar o **${config.brand.name}**! ${e.star}`));
  }
  sendLog(interaction.guild, base(paid ? config.colors.success : config.colors.error).setTitle(`${e.money} PIX ${paid ? 'confirmado' : 'cancelado'}`)
    .setDescription(`Ticket \`#${t.number}\` • <@${t.ownerId}>\n**${p.product}** — ${brl(p.value)} • \`${p.txid}\`\npor ${interaction.user}`));
}

/* ───────────── Fechar + transcript + avaliação ───────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function transcript(channel, t) {
  const all = [];
  let before;
  for (let i = 0; i < 10; i++) { // até 1000 mensagens
    const batch = await channel.messages.fetch({ limit: 100, before });
    all.push(...batch.values());
    if (batch.size < 100) break;
    before = batch.last().id;
  }
  const msgs = all.reverse().map((m) => `
    <div class="m"><img class="a" src="${m.author.displayAvatarURL({ size: 64 })}"><div>
      <div><b style="color:${m.member?.displayHexColor && m.member.displayHexColor !== '#000000' ? m.member.displayHexColor : '#fff'}">${esc(m.member?.displayName ?? m.author.username)}</b>
      ${m.author.bot ? '<span class="bot">BOT</span>' : ''}<span class="t">${new Date(m.createdTimestamp).toLocaleString('pt-BR')}</span></div>
      ${m.content ? `<div class="c">${esc(m.content).replace(/\n/g, '<br>')}</div>` : ''}
      ${m.embeds.map((em2) => `<div class="e" style="border-color:${em2.hexColor ?? '#f97316'}">${em2.title ? `<b>${esc(em2.title)}</b><br>` : ''}${esc(em2.description ?? '').replace(/\n/g, '<br>')}${(em2.fields ?? []).map((f) => `<div><b>${esc(f.name)}</b><br>${esc(f.value)}</div>`).join('')}</div>`).join('')}
      ${m.attachments.map((a) => a.contentType?.startsWith('image/') ? `<img class="img" src="${a.url}">` : `<a href="${a.url}">${esc(a.name)}</a>`).join('')}
    </div></div>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ticket #${t.number}</title><style>
    body{background:#313338;color:#dbdee1;font-family:Segoe UI,Arial,sans-serif;margin:0}
    header{background:#1e1f22;padding:20px 28px;border-bottom:3px solid #f97316}h1{margin:0;color:#fff;font-size:20px}header p{margin:4px 0 0;color:#949ba4}
    .m{display:flex;gap:14px;padding:8px 28px}.m:hover{background:#2e3035}.a{width:40px;height:40px;border-radius:50%}
    .t{color:#949ba4;font-size:12px;margin-left:8px}.bot{background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px;margin-left:4px}
    .c{margin-top:2px;line-height:1.4}.e{background:#2b2d31;border-left:4px solid;border-radius:4px;padding:10px 14px;margin-top:6px;max-width:520px;font-size:14px}
    .e div{margin-top:6px}.img{max-width:400px;border-radius:6px;margin-top:6px;display:block}a{color:#00a8fc}</style></head><body>
    <header><h1>🔥 ${esc(config.brand.name)} — Ticket #${t.number}</h1><p>#${esc(channel.name)} • ${all.length} mensagens • gerado em ${new Date().toLocaleString('pt-BR')}</p></header>${msgs}</body></html>`;
  return new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${t.number}.html` });
}

function closeModal() {
  return new ModalBuilder().setCustomId('ticket:closesubmit').setTitle('Fechar ticket')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo')
      .setLabel('Motivo / resumo do atendimento (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
}

async function close(interaction, t) {
  t.closed = true;
  db.save();
  const reason = interaction.fields.getTextInputValue('motivo');
  await interaction.reply({ embeds: [base(config.colors.error).setDescription(`${e.lock} Ticket fechado por ${interaction.user}. Gerando transcript e excluindo em 5 segundos...`)] });

  const guild = interaction.guild;
  const html = await transcript(interaction.channel, t);
  const duration = Date.now() - t.createdAt;
  const paid = (t.payments ?? []).filter((p) => p.status === 'paga');

  const summary = base(config.colors.dark).setTitle(`${e.ticket} Ticket #${t.number} fechado`).addFields(
    { name: `${e.user} Autor`, value: `<@${t.ownerId}>`, inline: true },
    { name: `${e.lock} Fechado por`, value: `${interaction.user}`, inline: true },
    { name: `${e.claim} Responsável`, value: t.claimedBy ? `<@${t.claimedBy}>` : '—', inline: true },
    { name: `${e.clock} Duração`, value: `${Math.max(1, Math.round(duration / 60000))} min`, inline: true },
    { name: `${e.money} Pagamentos`, value: paid.length ? paid.map((p) => `${brl(p.value)} • ${p.product}`).join('\n') : '—', inline: true },
    { name: `${e.log} Motivo`, value: reason || '—' }
  );
  const logId = db.guild(guild.id).channels.ticketlogs || db.guild(guild.id).channels.logs;
  const logCh = logId && guild.channels.cache.get(logId);
  await logCh?.send({ embeds: [summary], files: [html] }).catch(() => null);

  // DM para o dono: resumo + transcript + avaliação
  const stars = new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map((n) =>
    new ButtonBuilder().setCustomId(`trate:${guild.id}:${t.number}:${n}:${t.claimedBy ?? '0'}`).setLabel('⭐'.repeat(n)).setStyle(n >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)));
  const user = await interaction.client.users.fetch(t.ownerId).catch(() => null);
  await user?.send({
    embeds: [base().setTitle(`${e.ticket} Seu ticket #${t.number} foi fechado`)
      .setDescription(`${reason ? `> ${reason}\n\n` : ''}O histórico completo está no arquivo abaixo.\n${line}\n${e.star} **Como foi seu atendimento?** Avalie abaixo:`)],
    files: [html],
    components: [stars]
  }).catch(() => null);

  // histórico para o ranking e estatísticas
  const gh = db.guild(guild.id);
  gh.ticketHistory ??= [];
  gh.ticketHistory.push({
    number: t.number, type: t.type, ownerId: t.ownerId, claimedBy: t.claimedBy ?? null, closedBy: interaction.user.id,
    createdAt: t.createdAt, closedAt: Date.now(), firstResponseAt: t.firstResponseAt ?? null, firstResponder: t.firstResponder ?? null,
    paid: paid.map((p) => ({ value: p.value, product: p.product }))
  });
  if (gh.ticketHistory.length > 5000) gh.ticketHistory.splice(0, gh.ticketHistory.length - 5000);
  delete gh.tickets[interaction.channel.id];
  db.save();
  require('./rankingBoard').touch(interaction.client);
  setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
}

/** Avaliação clicada na DM (fora do servidor) */
async function rate(interaction) {
  const [, guildId, number, stars, staffId] = interaction.customId.split(':');
  const guild = interaction.client.guilds.cache.get(guildId);
  await interaction.update({ components: [] });
  await interaction.followUp({ embeds: [success(`Obrigado pela avaliação: ${'⭐'.repeat(Number(stars))}`)] });
  if (!guild) return;
  const g = db.guild(guildId);
  g.ratings ??= [];
  g.ratings.push({ number, stars: Number(stars), staffId: staffId !== '0' ? staffId : null, userId: interaction.user.id, at: Date.now() });
  db.save();
  const logId = g.channels.ticketlogs || g.channels.logs;
  guild.channels.cache.get(logId)?.send({ embeds: [base(Number(stars) >= 4 ? config.colors.success : config.colors.warning)
    .setTitle(`${e.star} Avaliação de atendimento`)
    .setDescription(`Ticket \`#${number}\` • ${interaction.user}\n${'⭐'.repeat(Number(stars))} (${stars}/5)${staffId !== '0' ? `\nAtendido por <@${staffId}>` : ''}`)] }).catch(() => null);
}

/* ───────────── Roteador ───────────── */

async function handle(interaction) {
  const [, action, arg] = interaction.customId.split(':');
  if (action === 'open') return open(interaction);

  const t = getTicket(interaction);
  if (!t) return interaction.reply({ embeds: [error('Este canal não é um ticket ativo.')], flags: EPH });

  if (action === 'claim') return claim(interaction, t);
  if (action === 'notify') return notify(interaction, t);
  if (action === 'members') return members(interaction, t);
  if (action === 'pix') {
    if (!(await perms.check(interaction, 'suporte'))) return;
    return interaction.showModal(pixModal());
  }
  if (action === 'pixsubmit') return createPix(interaction, t);
  if (action.startsWith('pix')) return pixAction(interaction, t, action, arg);
  if (action === 'close') {
    if (t.ownerId !== interaction.user.id && !perms.hasLevel(interaction.member, 'suporte')) {
      return interaction.reply({ embeds: [error('Apenas o autor ou a staff pode fechar.')], flags: EPH });
    }
    return interaction.showModal(closeModal());
  }
  if (action === 'closesubmit') return close(interaction, t);
}

module.exports = { handle, panel, rate };
