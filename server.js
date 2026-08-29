import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ALLOWED_REACTIONS = new Set(['🔥','😅','😈','👏','🤯']);
const ALLOWED_PHRASES = new Set(['Nice Job!', "You're almost there!", 'So Close!', 'You suck!', 'Oh Man!']);
const BECCA_PHRASE = "You're a peckerhead!";
const VOICE_SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate']);

const send = (res, code, obj, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(obj) : obj);
};
const parse = req => new Promise(resolve => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
});
const roomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const uid = () => crypto.randomUUID();
const shuffle = input => {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function makeDeck() {
  const deck = [{ type: 'number', value: 0, id: 'n0' }];
  for (let value = 1; value <= 12; value++) {
    for (let copy = 0; copy < value; copy++) deck.push({ type: 'number', value, id: `n${value}-${copy}` });
  }
  for (const name of ['freeze', 'flip3', 'second']) {
    for (let copy = 0; copy < 3; copy++) deck.push({ type: 'action', name, id: `${name}-${copy}` });
  }
  for (const value of [2, 4, 6, 8, 10]) deck.push({ type: 'modifier', value, id: `m${value}` });
  deck.push({ type: 'multiplier', value: 2, id: 'x2' });
  return shuffle(deck);
}

function makePlayer(id, name) {
  return {
    id, name: String(name || 'Player').slice(0, 18), score: 0,
    cards: [], mods: [], statusCards: [], active: true, stayed: false, busted: false, frozen: false,
    second: false, roundScore: 0, lastSeen: Date.now(),
    voiceEnabled: false, voiceSpeaking: false
  };
}

function addComputerPlayer(room) {
  const computer = makePlayer(`computer-${uid()}`, 'Computer');
  computer.computer = true;
  room.players.push(computer);
  room.log.push('Computer joined to complete the three-player table.');
  return computer;
}

function calculateScore(player) {
  if (player.busted) return 0;
  let total = player.cards.reduce((sum, card) => sum + card.value, 0);
  if (player.mods.some(card => card.type === 'multiplier')) total *= 2;
  total += player.mods.filter(card => card.type === 'modifier').reduce((sum, card) => sum + card.value, 0);
  if (player.cards.length >= 7) total += 15;
  return total;
}

function activePlayers(room) { return room.players.filter(player => player.active); }
function playerById(room, id) { return room.players.find(player => player.id === id); }
function currentPlayer(room) { return room.players[room.turnIndex]; }
function actionLabel(name) { return name === 'freeze' ? 'Freeze' : name === 'flip3' ? 'Flip Three' : 'Second Chance'; }

function chooseComputerTarget(room, pending) {
  const chooser = playerById(room, pending.chooserId);
  const eligible = pending.eligibleIds
    .map(id => playerById(room, id))
    .filter(player => player?.active);
  if (!eligible.length) return null;

  const people = eligible.filter(player => !player.computer && player.id !== chooser?.id);
  const opponents = eligible.filter(player => player.id !== chooser?.id);
  const choices = people.length ? people : opponents.length ? opponents : eligible;

  if (pending.card.name === 'second') {
    return [...choices].sort((a, b) => calculateScore(a) - calculateScore(b))[0];
  }
  return [...choices].sort((a, b) => calculateScore(b) - calculateScore(a))[0];
}

function computerShouldHit(player) {
  if (!player.cards.length && !player.mods.length && !player.second) return true;
  return calculateScore(player) < 20;
}

function stayPlayer(room, player) {
  player.stayed = true;
  player.active = false;
  player.roundScore = calculateScore(player);
  room.log.push(`${player.name} stayed with ${player.roundScore} points.`);
  advanceTurn(room);
}

function runComputerPlayers(room) {
  let steps = 0;
  while (room.phase === 'playing' && steps++ < 250) {
    const pending = room.pendingAction;
    if (pending) {
      const chooser = playerById(room, pending.chooserId);
      if (!chooser?.computer) return;
      const target = chooseComputerTarget(room, pending);
      const { card, resume } = pending;
      room.pendingAction = null;
      if (!target) {
        room.discard.push(card);
        room.log.push(`${chooser.name} had no eligible target, so ${actionLabel(card.name)} was discarded.`);
        resumeFlow(room, resume);
      } else {
        applyAction(room, chooser, target, card, resume);
      }
      continue;
    }

    const computer = currentPlayer(room);
    if (!computer?.computer || !computer.active) return;
    if (computerShouldHit(computer)) {
      room.log.push(`${computer.name} chose to Flip.`);
      drawForTurn(room, computer);
    } else {
      stayPlayer(room, computer);
    }
  }
}

function replenishDeck(room) {
  if (!room.deck.length && room.discard.length) {
    room.deck = shuffle(room.discard.splice(0));
    room.log.push('The discard pile was shuffled into a new draw pile.');
  }
}

function takeCard(room) {
  replenishDeck(room);
  return room.deck.pop() || null;
}

function discardPlayerCards(room, player) {
  room.discard.push(...player.cards, ...player.mods, ...(player.statusCards || []));
  if (player.second) {
    const sc = room.heldSecondCards.get(player.id);
    if (sc) room.discard.push(sc);
  }
  room.heldSecondCards.delete(player.id);
  player.second = false;
}

function finishRound(room, reason = 'Round complete.') {
  if (room.phase !== 'playing') return;
  room.phase = 'roundEnd';
  room.pendingAction = null;
  room.flow = null;
  for (const player of room.players) {
    player.roundScore = calculateScore(player);
    player.score += player.roundScore;
    player.active = false;
    discardPlayerCards(room, player);
  }
  room.log.push(reason);
  const high = Math.max(...room.players.map(player => player.score));
  const leaders = room.players.filter(player => player.score === high);
  if (high >= 200 && leaders.length === 1) {
    room.phase = 'gameOver';
    room.winner = leaders[0].name;
    room.log.push(`${room.winner} wins with ${high} points!`);
  } else if (high >= 200 && leaders.length > 1) {
    room.winner = null;
    room.log.push(`Game is tied at ${high}. Everyone plays another full round.`);
  }
  room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
}

function checkRoundEnd(room) {
  if (room.phase !== 'playing') return true;
  if (activePlayers(room).length === 0) {
    finishRound(room);
    return true;
  }
  return false;
}

function advanceTurn(room) {
  if (checkRoundEnd(room)) return;
  for (let i = 0; i < room.players.length; i++) {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    if (currentPlayer(room)?.active) return;
  }
}

function startChoiceTurns(room) {
  room.flow = null;
  room.turnIndex = (room.dealerIndex + 1) % room.players.length;
  while (room.phase === 'playing' && !currentPlayer(room)?.active) advanceTurn(room);
  if (room.phase === 'playing') room.log.push(`${currentPlayer(room).name} may Hit or Stay.`);
}

function resumeFlow(room, resume) {
  if (room.phase !== 'playing') return;
  if (!resume) return;
  if (resume.type === 'deal') {
    continueInitialDeal(room, resume.nextOffset);
  } else if (resume.type === 'turn') {
    advanceTurn(room);
  } else if (resume.type === 'flip3') {
    continueFlipThree(room, resume.targetId, resume.remaining, resume.queued || [], resume.after);
  } else if (resume.type === 'resolveQueue') {
    resolveQueuedActions(room, resume.queue || [], resume.after);
  }
}

function grantSecondChance(room, player, card, resume) {
  if (!player || !player.active) {
    room.discard.push(card);
    resumeFlow(room, resume);
    return;
  }
  if (!player.second) {
    player.second = true;
    room.heldSecondCards.set(player.id, card);
    room.log.push(`${player.name} drew and kept a Second Chance.`);
    resumeFlow(room, resume);
    return;
  }

  const eligible = activePlayers(room).filter(candidate => candidate.id !== player.id && !candidate.second);
  if (!eligible.length) {
    room.discard.push(card);
    room.log.push(`${player.name} already has a Second Chance and no other active player can receive the new one, so it was discarded.`);
    resumeFlow(room, resume);
    return;
  }

  room.pendingAction = {
    chooserId: player.id,
    card,
    resume,
    eligibleIds: eligible.map(candidate => candidate.id)
  };
  room.log.push(`${player.name} already has a Second Chance and must give the new one to another active player.`);
}

function offerAction(room, chooserId, card, resume, restrictedTargets = null) {
  if (card.name === 'second') {
    grantSecondChance(room, playerById(room, chooserId), card, resume);
    return;
  }
  const eligible = activePlayers(room).filter(player => !restrictedTargets || restrictedTargets.includes(player.id));
  if (!eligible.length) {
    room.discard.push(card);
    resumeFlow(room, resume);
    return;
  }
  room.pendingAction = {
    chooserId, card, resume,
    eligibleIds: eligible.map(player => player.id)
  };
  room.log.push(`${playerById(room, chooserId)?.name || 'A player'} drew ${actionLabel(card.name)} and must choose a target.`);
}

function resolveNumber(room, target, card) {
  const duplicate = target.cards.some(existing => existing.value === card.value);
  if (duplicate && target.second) {
    target.second = false;
    const held = room.heldSecondCards.get(target.id);
    if (held) room.discard.push(held);
    room.heldSecondCards.delete(target.id);
    room.discard.push(card);
    room.log.push(`${target.name}'s Second Chance blocked a duplicate ${card.value}.`);
    return 'safe';
  }
  target.cards.push(card);
  if (duplicate) {
    target.busted = true;
    target.active = false;
    room.log.push(`${target.name} busted on ${card.value}!`);
    return 'bust';
  }
  room.log.push(`${target.name} flipped ${card.value}.`);
  if (target.cards.length >= 7) {
    finishRound(room, `${target.name} flipped seven unique Number cards and ended the round!`);
    return 'flip7';
  }
  return 'safe';
}

function resolveNonActionCard(room, target, card) {
  if (card.type === 'number') return resolveNumber(room, target, card);
  target.mods.push(card);
  room.log.push(`${target.name} gained ${card.type === 'multiplier' ? '×2' : `+${card.value}`}.`);
  return 'safe';
}

function drawForTurn(room, player) {
  const card = takeCard(room);
  if (!card) return finishRound(room, 'The deck was exhausted.');
  if (card.type !== 'action') {
    resolveNonActionCard(room, player, card);
    if (room.phase === 'playing') advanceTurn(room);
    return;
  }
  offerAction(room, player.id, card, { type: 'turn' });
}

function continueInitialDeal(room, offset = 0) {
  if (room.phase !== 'playing') return;
  if (offset >= room.players.length) return startChoiceTurns(room);
  const index = (room.dealerIndex + 1 + offset) % room.players.length;
  const recipient = room.players[index];
  const card = takeCard(room);
  if (!card) return finishRound(room, 'The deck was exhausted.');
  if (card.type === 'action') {
    offerAction(room, recipient.id, card, { type: 'deal', nextOffset: offset + 1 });
  } else {
    resolveNonActionCard(room, recipient, card);
    if (room.phase === 'playing') continueInitialDeal(room, offset + 1);
  }
}

function applyAction(room, chooser, target, card, resume) {
  if (card.name === 'second') {
    if (!target || !target.active || target.id === chooser.id || target.second) {
      room.discard.push(card);
      room.log.push('The extra Second Chance no longer had an eligible recipient, so it was discarded.');
      resumeFlow(room, resume);
      return;
    }
    target.second = true;
    room.heldSecondCards.set(target.id, card);
    room.log.push(`${chooser.name} gave the extra Second Chance to ${target.name}.`);
    resumeFlow(room, resume);
    return;
  }

  room.discard.push(card);
  if (card.name === 'freeze') {
    room.discard.pop();
    target.statusCards.push(card);
    target.frozen = true;
    target.stayed = true;
    target.active = false;
    target.roundScore = calculateScore(target);
    room.log.push(`${chooser.name} froze ${target.name} at ${target.roundScore} points.`);
    if (!checkRoundEnd(room)) resumeFlow(room, resume);
    return;
  }

  room.log.push(`${chooser.name} played Flip Three on ${target.name}.`);
  continueFlipThree(room, target.id, 3, [], resume);
}

function discardQueuedActions(room, queued) {
  for (const item of queued) room.discard.push(item.card);
}

function continueFlipThree(room, targetId, remaining, queued, after) {
  if (room.phase !== 'playing') {
    discardQueuedActions(room, queued);
    return;
  }
  const target = playerById(room, targetId);
  if (!target) {
    discardQueuedActions(room, queued);
    return resumeFlow(room, after);
  }
  if (remaining <= 0) return resolveQueuedActions(room, queued, after);
  if (!target.active) {
    if (target.busted) {
      discardQueuedActions(room, queued);
      if (room.phase === 'playing') checkRoundEnd(room);
      return;
    }
    return resolveQueuedActions(room, queued, after);
  }

  const card = takeCard(room);
  if (!card) {
    discardQueuedActions(room, queued);
    return finishRound(room, 'The deck was exhausted.');
  }

  if (card.type !== 'action') {
    const result = resolveNonActionCard(room, target, card);
    if (result === 'bust') {
      discardQueuedActions(room, queued);
      if (room.phase === 'playing') checkRoundEnd(room);
      return;
    }
    if (result === 'flip7' || room.phase !== 'playing') {
      discardQueuedActions(room, queued);
      return;
    }
    return continueFlipThree(room, targetId, remaining - 1, queued, after);
  }

  if (card.name === 'second') {
    grantSecondChance(room, target, card, {
      type: 'flip3', targetId, remaining: remaining - 1, queued, after
    });
    return;
  }

  queued.push({ chooserId: target.id, card });
  room.log.push(`${target.name} revealed ${actionLabel(card.name)} during Flip Three; it is set aside. ${target.name} will choose its target after all three flips finish.`);
  continueFlipThree(room, targetId, remaining - 1, queued, after);
}

function offerQueuedFlipThreeAction(room, chooserId, card, resume) {
  const chooser = playerById(room, chooserId);
  if (!chooser || room.phase !== 'playing') {
    room.discard.push(card);
    return resumeFlow(room, resume);
  }
  const eligible = activePlayers(room);
  if (!eligible.length) {
    room.discard.push(card);
    return resumeFlow(room, resume);
  }
  room.pendingAction = {
    chooserId: chooser.id,
    card,
    resume,
    eligibleIds: eligible.map(player => player.id)
  };
  room.log.push(`${chooser.name} completed Flip Three and must now choose who receives the queued ${actionLabel(card.name)}.`);
}

function resolveQueuedActions(room, queue, after) {
  if (room.phase !== 'playing') {
    discardQueuedActions(room, queue);
    return;
  }
  if (!queue.length) return resumeFlow(room, after);
  const [next, ...rest] = queue;
  const chooser = playerById(room, next.chooserId);
  if (!chooser) {
    room.discard.push(next.card);
    return resolveQueuedActions(room, rest, after);
  }
  // Freeze and Flip Three cards revealed inside a Flip Three are never auto-applied.
  // The player who received the Flip Three always chooses the target after all three flips finish.
  offerQueuedFlipThreeAction(room, chooser.id, next.card, { type: 'resolveQueue', queue: rest, after });
}

function startRound(room) {
  room.round += 1;
  room.phase = 'playing';
  room.pendingAction = null;
  room.flow = { type: 'deal' };
  room.winner = null;
  room.reactions = [];
  room.players.forEach(player => Object.assign(player, {
    cards: [], mods: [], statusCards: [], active: true, stayed: false, busted: false, frozen: false,
    second: false, roundScore: 0
  }));
  room.heldSecondCards.clear();
  room.log = [`Round ${room.round} begins. ${room.players[room.dealerIndex].name} is the dealer.`];
  if (!room.deck.length) replenishDeck(room);
  if (!room.deck.length) room.deck = makeDeck();
  continueInitialDeal(room, 0);
}

function publicState(room) {
  const pending = room.pendingAction ? {
    chooserId: room.pendingAction.chooserId,
    card: room.pendingAction.card,
    eligibleIds: room.pendingAction.eligibleIds
  } : null;
  const now = Date.now();
  room.reactions = (room.reactions || []).filter(reaction => now - reaction.at < 4500).slice(-12);
  room.phrases = (room.phrases || []).filter(message => now - message.at < 7000).slice(-12);
  return {
    code: room.code, hostId: room.hostId, phase: room.phase, round: room.round,
    turnIndex: room.turnIndex, dealerIndex: room.dealerIndex,
    deckCount: room.deck.length, discardCount: room.discard.length,
    pendingAction: pending,
    players: room.players.map(player => ({ ...player, connected: player.computer || Date.now() - player.lastSeen < 12000 })),
    reactions: room.reactions,
    phrases: room.phrases,
    log: room.log.slice(-18), winner: room.winner
  };
}

function apiError(res, message, status = 400) { send(res, status, { ok: false, error: message }); }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/health') return send(res, 200, { ok: true, service: 'flip-rush-7' });
  if (url.pathname.startsWith('/api/')) {
    const body = req.method === 'POST' ? await parse(req) : {};
    if (url.pathname === '/api/create') {
      let code = roomCode(); while (rooms.has(code)) code = roomCode();
      const playerId = uid();
      const room = {
        code, hostId: playerId, phase: 'lobby', round: 0, turnIndex: 0, dealerIndex: 0,
        players: [makePlayer(playerId, body.name || 'Host')], deck: makeDeck(), discard: [],
        heldSecondCards: new Map(), pendingAction: null, flow: null, reactions: [], phrases: [], voiceSignals: new Map(),
        log: ['Room created.'], winner: null
      };
      rooms.set(code, room);
      return send(res, 200, { ok: true, room: code, playerId, state: publicState(room) });
    }
    if (url.pathname === '/api/join') {
      const code = String(body.room || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return apiError(res, 'Room not found.', 404);
      if (room.phase !== 'lobby') return apiError(res, 'Game already started.');
      if (room.players.length >= 9) return apiError(res, 'This room is full. Flip 7 supports up to 9 players.');
      const playerId = uid();
      const joined = makePlayer(playerId, body.name);
      room.players.push(joined);
      room.log.push(`${joined.name} joined.`);
      return send(res, 200, { ok: true, room: code, playerId, state: publicState(room) });
    }

    const code = String(body.room || url.searchParams.get('room') || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return apiError(res, 'Room not found.', 404);
    const playerId = body.playerId || url.searchParams.get('playerId');
    const player = room.players.find(item => item.id === playerId);
    if (player) player.lastSeen = Date.now();
    if (url.pathname === '/api/state') return send(res, 200, { ok: true, state: publicState(room) });
    if (!player) return apiError(res, 'Player not found.', 403);

    if (url.pathname === '/api/voice-signals') {
      const queued = room.voiceSignals.get(playerId) || [];
      room.voiceSignals.set(playerId, []);
      return send(res, 200, { ok: true, signals: queued.slice(-120) });
    }

    if (url.pathname === '/api/start') {
      const humanCount = room.players.filter(candidate => !candidate.computer).length;
      if (room.hostId !== playerId || room.phase !== 'lobby' || humanCount < 2) return apiError(res, 'Only the host can start after at least two people have joined.');
      if (humanCount < 3 && !room.players.some(candidate => candidate.computer)) addComputerPlayer(room);
      startRound(room);
    } else if (url.pathname === '/api/hit') {
      if (room.phase !== 'playing' || room.pendingAction || currentPlayer(room)?.id !== playerId) return apiError(res, 'It is not your Hit/Stay decision.');
      drawForTurn(room, player);
    } else if (url.pathname === '/api/stay') {
      if (room.phase !== 'playing' || room.pendingAction || currentPlayer(room)?.id !== playerId) return apiError(res, 'It is not your Hit/Stay decision.');
      if (!player.cards.length && !player.mods.length && !player.second) return apiError(res, 'You need at least one card in front of you before you can Stay.');
      stayPlayer(room, player);
    } else if (url.pathname === '/api/react') {
      const emoji = String(body.emoji || '');
      if (!ALLOWED_REACTIONS.has(emoji)) return apiError(res, 'That reaction is not available.');
      room.reactions = (room.reactions || []).filter(reaction => Date.now() - reaction.at < 4500).slice(-11);
      room.reactions.push({ id: uid(), playerId, emoji, at: Date.now() });
    } else if (url.pathname === '/api/phrase') {
      const phrase = String(body.phrase || '');
      const isBecca = String(player.name || '').trim().toLowerCase() === 'becca';
      if (!ALLOWED_PHRASES.has(phrase) && !(phrase === BECCA_PHRASE && isBecca)) return apiError(res, 'That phrase is not available to this player.');
      room.phrases = (room.phrases || []).filter(message => Date.now() - message.at < 7000).slice(-11);
      room.phrases.push({ id: uid(), playerId, phrase, at: Date.now() });
    } else if (url.pathname === '/api/voice-status') {
      player.voiceEnabled = Boolean(body.enabled);
      player.voiceSpeaking = player.voiceEnabled && Boolean(body.speaking);
      if (!player.voiceEnabled) room.voiceSignals.set(playerId, []);
    } else if (url.pathname === '/api/voice-signal') {
      const targetId = String(body.targetId || '');
      const target = playerById(room, targetId);
      const signal = body.signal;
      if (!target || target.id === playerId) return apiError(res, 'Voice target is not available.');
      if (!player.voiceEnabled || !target.voiceEnabled) return apiError(res, 'Both players must enable voice chat first.');
      if (!signal || typeof signal !== 'object' || !VOICE_SIGNAL_TYPES.has(signal.type)) return apiError(res, 'Invalid voice signal.');
      if (JSON.stringify(signal).length > 50000) return apiError(res, 'Voice signal is too large.');
      const queue = room.voiceSignals.get(targetId) || [];
      queue.push({ id: uid(), fromId: playerId, signal, at: Date.now() });
      room.voiceSignals.set(targetId, queue.slice(-120));
      return send(res, 200, { ok: true });
    } else if (url.pathname === '/api/target') {
      const pending = room.pendingAction;
      if (!pending || pending.chooserId !== playerId) return apiError(res, 'You do not have an action card to resolve.');
      if (!pending.eligibleIds.includes(body.targetId)) return apiError(res, 'That player is not an eligible target.');
      const target = playerById(room, body.targetId);
      const chooser = playerById(room, playerId);
      const { card, resume } = pending;
      if (!target?.active) return apiError(res, 'That player is no longer active.');
      if (card.name === 'second' && (target.id === chooser.id || target.second)) return apiError(res, 'That player cannot receive another Second Chance.');
      room.pendingAction = null;
      applyAction(room, chooser, target, card, resume);
    } else if (url.pathname === '/api/next') {
      if (room.hostId !== playerId || room.phase !== 'roundEnd') return apiError(res, 'Only the host can start the next round.');
      startRound(room);
    } else {
      return apiError(res, 'Unknown action.', 404);
    }
    runComputerPlayers(room);
    return send(res, 200, { ok: true, state: publicState(room) });
  }

  let file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  file = path.resolve(__dirname, file);
  if (file !== __dirname && !file.startsWith(__dirname + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, mime[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Flip Rush 7 running on port ${PORT}`));
