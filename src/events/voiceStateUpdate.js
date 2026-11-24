const queue = require('../handlers/supportQueue');

module.exports = {
  name: 'voiceStateUpdate',
  execute: (oldState, newState) => queue.onVoice(oldState, newState).catch((err) => console.error('[Fila suporte]', err.message))
};
