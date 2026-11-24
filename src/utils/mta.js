/**
 * Consulta de status de servidor MTA:SA (protocolo ASE, UDP na porta do jogo + 123)
 */
const dgram = require('node:dgram');

/** Remove códigos de cor do MTA (#FF0000Nome -> Nome) */
const stripColors = (s) => String(s ?? '').replace(/#[0-9a-f]{6}/gi, '').trim();

function parse(buf) {
  if (buf.toString('ascii', 0, 4) !== 'EYE1') throw new Error('Resposta inválida (não é ASE)');
  let o = 4;
  // cada texto começa com 1 byte de tamanho (que conta ele mesmo)
  const str = () => {
    if (o >= buf.length) return '';
    const len = buf[o];
    const s = len > 1 ? buf.toString('utf8', o + 1, Math.min(o + len, buf.length)) : '';
    o += Math.max(len, 1);
    return s;
  };
  const info = {
    game: str(), port: Number(str()), name: str(), gamemode: str(), map: str(), version: str(),
    passworded: str() === '1', players: Number(str()) || 0, max: Number(str()) || 0, rules: {}, list: []
  };
  while (o < buf.length) { // regras (termina com texto vazio)
    const k = str();
    if (!k) break;
    info.rules[k] = str();
  }
  while (o < buf.length) { // jogadores
    const flags = buf[o++];
    const p = {};
    if (flags & 1) p.name = stripColors(str());
    if (flags & 2) p.team = str();
    if (flags & 4) p.skin = str();
    if (flags & 8) p.score = str();
    if (flags & 16) p.ping = Number(str());
    if (flags & 32) p.time = str();
    if (p.name) info.list.push(p);
  }
  info.name = stripColors(info.name);
  return info;
}

/** @returns {Promise<ReturnType<typeof parse>>} */
function query(host, gamePort, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => { socket.close(); reject(new Error('Sem resposta (servidor offline?)')); }, timeout);
    socket.on('error', (err) => { clearTimeout(timer); socket.close(); reject(err); });
    socket.on('message', (msg) => {
      clearTimeout(timer);
      socket.close();
      try { resolve(parse(msg)); } catch (err) { reject(err); }
    });
    socket.send(Buffer.from('s'), Number(gamePort) + 123, host);
  });
}

module.exports = { query, parse, stripColors };
