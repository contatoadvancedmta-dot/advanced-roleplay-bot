/** "10m", "2h", "7d", "30s" -> milissegundos (null se inválido) */
function parseDuration(text) {
  const m = /^(\d+)\s*(s|m|h|d|w)$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[m[2].toLowerCase()];
}

/** milissegundos -> "2 dias", "3 h", "15 min" */
function formatDuration(ms) {
  if (ms >= 864e5) { const d = Math.round(ms / 864e5); return `${d} dia${d > 1 ? 's' : ''}`; }
  if (ms >= 36e5) return `${Math.round(ms / 36e5)} h`;
  if (ms >= 6e4) return `${Math.round(ms / 6e4)} min`;
  return `${Math.round(ms / 1e3)} s`;
}

const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;

module.exports = { parseDuration, formatDuration, ts };
