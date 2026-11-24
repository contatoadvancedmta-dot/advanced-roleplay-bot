/**
 * ╔══════════════════════════════════════════════╗
 * ║      ADVANCED ROLEPLAY — CONFIGURAÇÃO         ║
 * ╚══════════════════════════════════════════════╝
 *
 * EMOJIS PERSONALIZADOS:
 *  1. Envie o emoji no Discord com uma barra antes:  \:advanced_check:
 *  2. O Discord mostra algo como  <:advanced_check:123456789012345678>
 *  3. Cole aqui no lugar do emoji padrão.
 *  Emoji animado fica assim: <a:nome:ID>
 */
module.exports = {
  // IDs dos DONOS (acesso total, gerenciam os administradores)
  owners: [
    // '123456789012345678',
  ],

  brand: {
    name: 'Advanced Roleplay',
    footer: 'Advanced Roleplay • Sistema Oficial',
    logo: 'auto', // 'auto' = usa o ícone do servidor (ou a foto do bot). Ou coloque um link de imagem
    banner: null, // URL de banner reserva (usado só se faltar o arquivo em assets/banners)
    site: null,   // ex: 'https://advancedrp.com'
    connect: null // endereço para entrar na cidade, ex: 'mtasa://IP:PORTA' (ou use /cidade ip)
  },

  /**
   * EMBEDS INVISÍVEIS: a barrinha lateral fica da mesma cor do fundo do Discord (some).
   * Coloque false para voltar a usar as cores (laranja, verde, vermelho...).
   */
  invisibleEmbeds: true,
  invisibleColor: 0x2b2d31, // cor do fundo das embeds no tema escuro do Discord

  // Banners de assets/banners são enviados junto com os painéis (false = desliga)
  banners: true,

  colors: {
    primary: 0xf97316,  // laranja Advanced
    success: 0x22c55e,
    error: 0xef4444,
    warning: 0xf59e0b,
    info: 0x3b82f6,
    dark: 0x2b2d31
  },

  emojis: {
    logo: '🔥',
    check: '✅',
    cross: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    crown: '👑',
    shield: '🛡️',
    staff: '🛠️',
    support: '🎧',
    suggestion: '💡',
    up: '👍',
    down: '👎',
    pending: '🟡',
    approved: '🟢',
    rejected: '🔴',
    ticket: '🎫',
    lock: '🔒',
    claim: '🙋',
    welcome: '👋',
    leave: '🚪',
    announce: '📢',
    rules: '📜',
    verify: '✔️',
    car: '🚔',
    money: '💰',
    bug: '🐛',
    report: '🚨',
    trash: '🗑️',
    log: '📋',
    arrow: '➜',
    dot: '•',
    user: '👤',
    clock: '⏰',
    star: '⭐',
    whitelist: '📝',
    ban: '🔨',
    mute: '🔇',
    gift: '🎁',
    server: '🖥️',
    online: '🟢',
    offline: '🔴',
    trophy: '🏆',
    level: '📈',
    alert: '🛑'
  },

  /**
   * EMOJIS PRÓPRIOS DO ADVANCED (automático)
   * Todo .png/.gif da pasta assets/emojis é enviado como emoji do bot ao ligar
   * (Emojis do Aplicativo — não ocupa vaga de emoji do servidor).
   * O nome do arquivo é a chave acima. Ex: check.png substitui o emoji "check".
   * Para usar sua própria arte: troque o arquivo e rode /emojis sincronizar
   * ou use /emojis adicionar direto pelo Discord.
   */
  emojiSync: true,

  // Níveis de staff (maior número = mais poder). "owner" é fixo pelos IDs acima.
  levels: {
    suporte: { weight: 1, label: 'Suporte', emoji: 'support' },
    moderador: { weight: 2, label: 'Moderador', emoji: 'shield' },
    admin: { weight: 3, label: 'Administrador', emoji: 'staff' }
  },

  // Rankings fixos no canal "todos os rankings" (/setup ranking). Tire o que não quiser.
  rankingBoard: ['tickets', 'apoiadores', 'ponto'],

  // Categorias das sugestões (aparecem no formulário)
  suggestionCategories: [
    { id: 'empregos', label: 'Empregos / Economia', emoji: '💼' },
    { id: 'faccoes', label: 'Facções / Organizações', emoji: '🏴' },
    { id: 'policia', label: 'Polícia / Governo', emoji: '🚓' },
    { id: 'veiculos', label: 'Veículos', emoji: '🚗' },
    { id: 'casas', label: 'Casas / Mapas', emoji: '🏠' },
    { id: 'eventos', label: 'Eventos', emoji: '🎉' },
    { id: 'discord', label: 'Discord / Bot', emoji: '💬' },
    { id: 'outros', label: 'Outros', emoji: '📌' }
  ],

  // Categorias das sugestões da staff
  staffSuggestionCategories: [
    { id: 'regras', label: 'Regras da cidade', emoji: '📜' },
    { id: 'moderacao', label: 'Moderação / Punições', emoji: '🛡️' },
    { id: 'tickets', label: 'Tickets / Atendimento', emoji: '🎫' },
    { id: 'eventos', label: 'Eventos', emoji: '🎉' },
    { id: 'equipe', label: 'Organização da equipe', emoji: '👥' },
    { id: 'bot', label: 'Bot / Discord', emoji: '🤖' },
    { id: 'outros', label: 'Outros', emoji: '📌' }
  ],

  // Categorias de ticket
  ticketTypes: [
    { id: 'suporte', label: 'Suporte Geral', description: 'Dúvidas e ajuda no servidor', emoji: 'support' },
    { id: 'denuncia', label: 'Denúncia', description: 'Denunciar jogador ou staff', emoji: 'report' },
    { id: 'doacao', label: 'Doações / VIP', description: 'Compras, VIPs e ativação de produtos', emoji: 'money' },
    { id: 'faccao', label: 'Facções', description: 'Criação, membros e assuntos de facção', emoji: 'shield' },
    { id: 'bug', label: 'Reportar Bug', description: 'Encontrou um bug na cidade?', emoji: 'bug' }
  ],

  /**
   * PIX (usado no botão "Gerar PIX" dos tickets)
   * Coloque a chave PIX da loja (CPF, CNPJ, e-mail, telefone +55... ou chave aleatória).
   * O bot gera o QR Code e o "copia e cola" com o valor certo — o dinheiro cai direto na conta da chave.
   */
  pix: {
    key: '',                       // ex: 'pagamentos@f1loja.com' ou '12345678000199'
    receiverName: 'F1 LOJA',       // nome do recebedor (aparece no app do banco, máx 25)
    city: 'SAO PAULO',             // cidade do recebedor (máx 15)
    storeName: 'F1 Loja'           // nome exibido na embed
  },

  timezoneOffset: -3, // fuso usado nos agendamentos (Brasília = -3)

  // Modelos prontos do /anuncio
  announceTemplates: {
    livre: { label: 'Em branco', emoji: 'announce', color: 'laranja', title: '', text: '' },
    online: { label: 'Cidade online', emoji: 'online', color: 'verde', title: 'A CIDADE ESTÁ ONLINE!',
      text: 'Os portões estão abertos! Entre agora e viva sua história.\n\n**Conectar:** veja em #ip-connect' },
    reinicio: { label: 'Reinício', emoji: 'clock', color: 'amarelo', title: 'Reinício programado',
      text: 'A cidade vai reiniciar em **10 minutos**.\nGuarde seus veículos e finalize suas ações para não perder nada.' },
    manutencao: { label: 'Manutenção', emoji: 'staff', color: 'vermelho', title: 'Cidade em manutenção',
      text: 'Estamos realizando melhorias no servidor.\n\n**Previsão de retorno:** --:--\nAcompanhe as novidades por aqui!' },
    atualizacao: { label: 'Atualização', emoji: 'level', color: 'laranja', title: 'Nova atualização na cidade',
      text: '**Novidades:**\n• \n• \n\n**Correções:**\n• \n\nBom RP a todos!' },
    evento: { label: 'Evento', emoji: 'gift', color: 'roxo', title: 'EVENTO NA CIDADE!',
      text: '**Quando:** --/-- às --:--\n**Onde:** \n**Prêmio:** \n\nNão fiquem de fora!' },
    edital: { label: 'Edital da staff aberto', emoji: 'whitelist', color: 'azul', title: 'EDITAL DA STAFF ABERTO!',
      text: 'Quer fazer parte da equipe **Advanced Roleplay**?\nPreencha o formulário no canal **#edital-staff**.\n\n**Requisitos:**\n• \n• \n\nBoa sorte!' },
    whitelist: { label: 'Whitelist aberta', emoji: 'whitelist', color: 'verde', title: 'Whitelist aberta!',
      text: 'As vagas para novos cidadãos estão abertas.\nFaça sua whitelist no canal de whitelist e boa sorte!' }
  },

  // Status que o bot fica alternando
  presence: [
    'Advanced Roleplay 🏙️',
    '{members} cidadãos no Discord',
    'Use /ajuda',
    '{players} jogadores na cidade',
    'Abra um ticket em #abrir-ticket'
  ],

  // Tags que os membros podem pedir em #solicitar-tag (o cargo de cada uma: /setup cargo)
  tags: [
    { id: 'streamer', label: 'Streamer', emoji: '🎥' },
    { id: 'youtuber', label: 'YouTuber', emoji: '▶️' },
    { id: 'policial', label: 'Policial', emoji: '🚓' },
    { id: 'medico', label: 'Médico / SAMU', emoji: '🚑' },
    { id: 'mecanico', label: 'Mecânico', emoji: '🔧' },
    { id: 'faccao', label: 'Membro de facção', emoji: '🏴' },
    { id: 'vip', label: 'VIP', emoji: '💎' }
  ],

  /**
   * FORMULÁRIOS — cada um vira um painel com botão (/painel) e chega para a staff com botões de status.
   * fields: até 4 perguntas (style: short | long | tag). images: quantas imagens podem anexar (0 = nenhuma).
   * review: canal onde chega (/setup staff) • level: quem decide • role: cargo dado ao aprovar (/setup cargo)
   * result: canal público onde sai o resultado (/setup canal) • done: texto mostrado depois (o label é o do botão)
   */
  forms: {
    bug: {
      name: 'Report de bug', tag: 'BUG', emoji: 'bug', banner: 'bugs', button: 'Reportar bug',
      intro: 'Encontrou um bug na cidade? Conte com detalhes e mande prints/vídeos.',
      fields: [
        { id: 'titulo', label: 'Resumo do bug', style: 'short', max: 80, placeholder: 'Ex: Carro some ao guardar na garagem' },
        { id: 'descricao', label: 'O que aconteceu?', style: 'long', max: 1000 },
        { id: 'passos', label: 'Como fazer o bug acontecer?', style: 'long', max: 600, required: false }
      ],
      images: 3, review: 'bugs_staff', level: 'suporte',
      statuses: [
        { id: 'analise', label: 'Em análise', emoji: 'pending', style: 'secondary' },
        { id: 'confirmado', label: 'Confirmado', emoji: 'check', style: 'primary' },
        { id: 'corrigido', label: 'Corrigido', emoji: 'approved', style: 'success', final: true },
        { id: 'naobug', label: 'Não é bug', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    denuncia: {
      name: 'Denúncia', tag: 'DEN', emoji: 'report', banner: 'denuncias', button: 'Fazer denúncia',
      intro: 'Denuncie quem quebrou as regras. **Sem provas a denúncia é recusada.**',
      fields: [
        { id: 'acusado', label: 'Nick e ID do acusado', style: 'short', max: 80 },
        { id: 'quando', label: 'Quando aconteceu? (data e hora)', style: 'short', max: 60 },
        { id: 'relato', label: 'O que aconteceu?', style: 'long', max: 1200 },
        { id: 'provas', label: 'Link das provas (vídeo/clip)', style: 'short', max: 300, required: false }
      ],
      images: 3, review: 'denuncias_staff', level: 'moderador',
      statuses: [
        { id: 'analise', label: 'Em análise', emoji: 'pending', style: 'secondary' },
        { id: 'procedente', label: 'Procedente (punido)', emoji: 'ban', style: 'success', final: true },
        { id: 'improcedente', label: 'Improcedente', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    contradenuncia: {
      name: 'Contra-denúncia', tag: 'CTR', emoji: 'shield', banner: 'denuncias', button: 'Fazer contra-denúncia',
      intro: 'Foi denunciado ou punido e quer se defender? Mostre sua versão com provas.',
      fields: [
        { id: 'denuncia', label: 'Qual denúncia/punição? (nº ou motivo)', style: 'short', max: 100 },
        { id: 'nick', label: 'Seu nick e ID', style: 'short', max: 80 },
        { id: 'defesa', label: 'Sua defesa', style: 'long', max: 1200 },
        { id: 'provas', label: 'Link das provas (vídeo/clip)', style: 'short', max: 300, required: false }
      ],
      images: 3, review: 'denuncias_staff', level: 'moderador',
      statuses: [
        { id: 'analise', label: 'Em análise', emoji: 'pending', style: 'secondary' },
        { id: 'aceita', label: 'Aceita', emoji: 'approved', style: 'success', final: true },
        { id: 'negada', label: 'Negada', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    denunciastaff: {
      name: 'Denúncia contra staff', tag: 'DST', emoji: 'alert', banner: 'denuncias', button: 'Denunciar staff',
      intro: 'Denúncia contra membro da equipe. **Só a administração vê.**',
      fields: [
        { id: 'staff', label: 'Nome do staff denunciado', style: 'short', max: 80 },
        { id: 'quando', label: 'Quando aconteceu?', style: 'short', max: 60 },
        { id: 'relato', label: 'O que aconteceu?', style: 'long', max: 1200 },
        { id: 'provas', label: 'Link das provas', style: 'short', max: 300, required: false }
      ],
      images: 3, review: 'denunciastaff_review', level: 'admin',
      statuses: [
        { id: 'analise', label: 'Em análise', emoji: 'pending', style: 'secondary' },
        { id: 'procedente', label: 'Procedente', emoji: 'approved', style: 'success', final: true },
        { id: 'improcedente', label: 'Improcedente', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    edital: {
      name: 'Edital da staff', tag: 'ED', emoji: 'whitelist', banner: 'edital', button: 'Quero ser staff',
      intro: 'Quer fazer parte da equipe? Responda com sinceridade. O resultado sai em #resultado-edital.',
      fields: [
        { id: 'nome', label: 'Seu nome e idade', style: 'short', max: 60 },
        { id: 'horarios', label: 'Dias e horários disponíveis', style: 'short', max: 120 },
        { id: 'experiencia', label: 'Já foi staff? Conte sua experiência', style: 'long', max: 1000 },
        { id: 'porque', label: 'Por que devemos te escolher?', style: 'long', max: 1000 }
      ],
      images: 0, review: 'edital_review', level: 'admin', result: 'resultado_edital', once: true,
      statuses: [
        { id: 'entrevista', label: 'Chamar p/ entrevista', done: 'Chamado para entrevista', emoji: 'clock', style: 'primary' },
        { id: 'aprovado', label: 'Aprovado', emoji: 'approved', style: 'success', final: true, role: 'edital_aprovado' },
        { id: 'reprovado', label: 'Reprovado', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    tag: {
      name: 'Pedido de tag', tag: 'TAG', emoji: 'star', banner: 'tags', button: 'Solicitar tag',
      intro: 'Escolha a tag e mostre a prova (print do canal, contrato da facção, etc).',
      fields: [
        { id: 'tag', label: 'Qual tag você quer?', style: 'tag' },
        { id: 'nick', label: 'Seu nick e ID na cidade', style: 'short', max: 80 },
        { id: 'motivo', label: 'Por que você tem direito à tag?', style: 'long', max: 800 }
      ],
      images: 1, review: 'tags_review', level: 'suporte',
      statuses: [
        { id: 'aprovado', label: 'Aprovar e dar tag', done: 'Aprovado', emoji: 'approved', style: 'success', final: true, role: '$tag' },
        { id: 'recusado', label: 'Recusar', done: 'Recusado', emoji: 'rejected', style: 'danger', final: true }
      ]
    },
    ausencia: {
      name: 'Justificativa de ausência', tag: 'AUS', emoji: 'clock', banner: 'ausencia', button: 'Justificar ausência',
      intro: 'Vai ficar ausente da staff? Avise com antecedência.', staffOnly: true,
      fields: [
        { id: 'inicio', label: 'A partir de quando? (dd/mm)', style: 'short', max: 20 },
        { id: 'fim', label: 'Até quando? (dd/mm)', style: 'short', max: 20 },
        { id: 'motivo', label: 'Motivo', style: 'long', max: 600 }
      ],
      images: 0, review: 'ausencias', level: 'admin',
      statuses: [
        { id: 'aprovada', label: 'Aprovar', done: 'Aprovada', emoji: 'approved', style: 'success', final: true },
        { id: 'recusada', label: 'Recusar', done: 'Recusada', emoji: 'rejected', style: 'danger', final: true }
      ]
    }
  },

  // Bate-ponto da staff
  ponto: {
    maxHours: 12 // fecha sozinho quem esquecer o ponto aberto depois de X horas
  },

  // Perguntas da whitelist (máximo 5 — limite do formulário do Discord)
  whitelist: {
    cooldownHours: 2, // tempo para tentar de novo após reprovação
    nickname: '{nome} | {id}', // apelido aplicado ao aprovar (null = não muda)
    questions: [
      { id: 'nome', label: 'Nome e sobrenome do personagem', style: 'short', max: 40 },
      { id: 'id', label: 'Seu ID na cidade (passaporte)', style: 'short', max: 10 },
      { id: 'idade', label: 'Sua idade real', style: 'short', max: 3 },
      { id: 'historia', label: 'Conte a história do seu personagem', style: 'long', max: 1000 },
      { id: 'regras', label: 'O que é RDM, VDM e Metagaming?', style: 'long', max: 600 }
    ]
  },

  moderation: {
    warnLimit: 3,          // ao chegar nesse nº de avisos ativos o membro leva castigo automático
    warnPunishMinutes: 60,
    appeals: true          // banidos recebem botão "Recorrer" na DM
  },

  // Anti-raid: muitas entradas em pouco tempo = modo raid
  antiraid: {
    enabled: true,
    joins: 8,              // entradas...
    seconds: 10,           // ...em X segundos ativa o modo raid
    raidMinutes: 10,       // duração do modo raid
    minAccountDays: 3,     // contas mais novas que isso são marcadas como suspeitas
    kickNewDuringRaid: true // durante o raid expulsa contas novas automaticamente
  },

  // Status da cidade (atualiza sozinho no canal de status)
  fivem: {
    game: 'mta',                 // 'mta' (MTA:SA) ou 'fivem'
    ip: null,                    // IP:porta do jogo — ou use /cidade ip
    joinUrl: null,               // link https para botão "Entrar na cidade"
    updateSeconds: 60
  },

  // Sistema de níveis por mensagens
  xp: {
    enabled: true,
    min: 15,
    max: 25,
    cooldownSeconds: 60,
    roles: {
      // nível: 'ID do cargo'  ex: 10: '123456789012345678'
    }
  },

  automod: {
    antiInvite: true,      // apaga convites de outros servidores
    antiMassMention: 5,    // apaga mensagens com X+ menções (0 = desligado)
    antiSpam: { messages: 6, seconds: 5, timeoutMinutes: 5 }, // flood = castigo
    antiCaps: { percent: 70, minLength: 15 },                 // CAPS LOCK excessivo
    antiLink: {
      enabled: false,      // true = apaga links que não estejam na lista abaixo
      allowed: ['youtube.com', 'youtu.be', 'twitch.tv', 'tiktok.com', 'tenor.com', 'imgur.com', 'medal.tv', 'discord.com']
    },
    badWords: [],          // palavras proibidas, ex: ['palavra1', 'palavra2']
    strikes: { limit: 3, minutes: 10 } // 3 infrações em 10 min = aviso automático
  }
};
