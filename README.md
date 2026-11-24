# 🏙️ Bot Advanced Roleplay

Bot oficial do **Advanced Roleplay** (MTA:SA) — identidade **roxa**: embeds invisíveis, banners próprios, emojis do Advanced e tudo por **botões e formulários**.

## Instalação (hospedagem com GitHub)
1. Crie o bot em https://discord.com/developers/applications → aba **Bot** → ative **Server Members Intent** e **Message Content Intent**.
2. Convide com permissão de **Administrador** (escopos `bot` + `applications.commands`).
3. Na hospedagem: repositório deste projeto, branch `main`, arquivo de entrada `index.js`.
4. Crie o `.env` na raiz do servidor:
```
DISCORD_TOKEN=token_do_bot
CLIENT_ID=id_do_aplicativo
GUILD_ID=id_do_servidor
```
5. Ligue. Os comandos são registrados sozinhos.

## Primeiros passos no Discord — tudo por botões
Use **`/central`** (ou deixe o painel fixo com `/painel tipo:Central de Controle` num canal da staff).
A Central configura **canais, cargos, painéis, cidade (IP/progresso/contadores), PIX, facções, anúncios e equipe** só com botões e menus.

Se preferir comandos:
1. `/cidade ip endereco:IP:PORTA` — IP da cidade (status, contador, avisos de crash e /ip)
2. `/setup cargo` — Suporte, Moderador, Administrador, cargo do edital e as tags
3. `/setup canal` · `/setup staff` · `/setup ranking` · `/setup atendimento` · `/setup cidade`
4. `/painel` — envie cada painel no canal certo
5. `/setup ver` — confere o que falta

## Onde vai cada coisa (sugestão com os seus canais)
| Canal | Comando |
|---|---|
| chegada / saída | `/setup canal` → Chegada / Saída |
| abrir-ticket | `/painel tipo:Tickets` |
| solicitar-tag | `/painel tipo:Pedido de tag` + `/setup staff` → Recebe os pedidos de tag |
| feedback-staff | `/setup canal` → Feedback da staff (envia o painel sozinho) |
| bate-ponto | `/painel tipo:Bate-ponto` + `/setup staff` → Registro do bate-ponto |
| Espera Suporte / Suporte #1-#3 | `/setup atendimento` + `/setup staff` → Aviso da fila de suporte |
| edital-staff / resultado-edital | `/painel tipo:Edital da staff` + `/setup canal` → Resultado do edital + `/setup staff` → Recebe as inscrições |
| banimentos | `/setup canal` → Banimentos / punições |
| denúncias / contra-denúncia / denúncia-staff | `/painel` de cada um + `/setup staff` → Recebe denúncias / Recebe denúncias contra staff |
| justificar-ausência | `/setup staff` → Justificativas de ausência (envia o painel sozinho) |
| anotar-contas | `/setup staff` → Anotar contas • `/conta anotar` |
| report-bugs / report-bug | `/painel tipo:Report de bug` + `/setup staff` → Recebe os reports de bug |
| instagram | `/setup canal` → Instagram do RP |
| sugestões | `/painel tipo:Sugestões` + `/setup canal` → Sugestões |
| avisos-crash | `/setup cidade` → Avisos de crash |
| ip-connect | `/painel tipo:IP da cidade` |
| Progress (voz) | `/setup cidade` → Progresso • `/progresso 10` |

## Personalizar (`config.js`)
- `forms` — perguntas, status e quem decide cada formulário
- `tags` — tags que podem ser pedidas (o cargo de cada uma: `/setup cargo`)
- `suggestionCategories`, `ticketTypes`, `announceTemplates`, `ponto.maxHours`
- Banners em `assets/banners` (troque o PNG mantendo o nome) • emojis em `assets/emojis`
