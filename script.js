const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');
const scoreEls = {
  X: document.getElementById('score-x'),
  O: document.getElementById('score-o'),
  draw: document.getElementById('score-draw'),
};

const labelEls = {
  X: document.getElementById('label-x'),
  O: document.getElementById('label-o'),
};
const nameInputs = {
  X: document.getElementById('name-x'),
  O: document.getElementById('name-o'),
};
const palettes = {
  X: document.getElementById('color-x'),
  O: document.getElementById('color-o'),
};
const colorButtons = {
  X: document.getElementById('color-btn-x'),
  O: document.getElementById('color-btn-o'),
};

const STORAGE_KEY = 'tictactoe-players';

const COLORS = {
  Red: '#e03131',
  Orange: '#f76707',
  Yellow: '#f59f00',
  Green: '#2f9e44',
  Teal: '#0c8599',
  Blue: '#1971c2',
  Purple: '#7048e8',
  Pink: '#d6336c',
};

const state = {
  board: Array(9).fill(null),
  current: 'X',
  starter: 'X',
  over: false,
  result: null,
  score: { X: 0, O: 0, draw: 0 },
  aiTimer: null,
  // color is null until the player picks one, so the theme's light/dark defaults apply.
  players: { X: { name: '', color: null }, O: { name: '', color: null } },
};

const cells = Array.from({ length: 9 }, (_, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cell';
  btn.dataset.index = i;
  btn.setAttribute('aria-label', `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, empty`);
  btn.addEventListener('click', () => handleMove(i));
  btn.addEventListener('keydown', (e) => moveFocus(e, i));
  boardEl.appendChild(btn);
  return btn;
});

function winnerOf(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { player: board[a], line };
    }
  }
  return board.every(Boolean) ? { player: 'draw', line: [] } : null;
}

function isAiTurn() {
  return modeEl.value !== 'pvp' && state.current === 'O' && !state.over;
}

function handleMove(i) {
  if (state.over || state.board[i] || isAiTurn()) return;
  place(i);
  if (isAiTurn()) scheduleAi();
}

function place(i) {
  state.board[i] = state.current;
  const cell = cells[i];
  cell.textContent = state.current;
  cell.classList.add(state.current.toLowerCase(), 'placed');
  cell.setAttribute('aria-label', cell.getAttribute('aria-label').replace('empty', state.current));

  const result = winnerOf(state.board);
  if (result) {
    finish(result);
  } else {
    state.current = state.current === 'X' ? 'O' : 'X';
    render();
  }
}

function finish(result) {
  state.over = true;
  state.result = result;
  state.score[result.player]++;
  result.line.forEach((i) => cells[i].classList.add('win'));
  render();
}

const COMPUTER_NAMES = { easy: 'Sir Beep-a-Lot', hard: 'The Grand Algorithm' };

function defaultName(player) {
  return player === 'O' && modeEl.value !== 'pvp' ? COMPUTER_NAMES[modeEl.value] : `Player ${player}`;
}

function displayName(player) {
  return state.players[player].name.trim() || defaultName(player);
}

// Writes the status line in the player's colour, with their name emphasised.
function setStatus(player, text) {
  const name = document.createElement('span');
  name.className = 'status-name';
  name.textContent = displayName(player);
  statusEl.className = `status ${player.toLowerCase()}`;
  statusEl.replaceChildren(name, text);
}

function render() {
  cells.forEach((cell, i) => {
    cell.setAttribute('aria-disabled', String(state.over || Boolean(state.board[i])));
  });
  if (state.result) {
    const { player } = state.result;
    if (player === 'draw') {
      statusEl.className = 'status';
      statusEl.textContent = "It's a draw!";
    } else {
      setStatus(player, ' wins!');
    }
  } else if (isAiTurn()) {
    setStatus('O', ' is thinking…');
  } else {
    setStatus(state.current, `'s turn (${state.current})`);
  }
  for (const key of Object.keys(scoreEls)) scoreEls[key].textContent = state.score[key];
  for (const p of ['X', 'O']) {
    labelEls[p].textContent = displayName(p);
    labelEls[p].title = displayName(p);
    nameInputs[p].placeholder = defaultName(p);
  }
}

function applyColors() {
  const root = document.documentElement;
  for (const p of ['X', 'O']) {
    const { color } = state.players[p];
    const prop = `--${p.toLowerCase()}`;
    if (color) root.style.setProperty(prop, color);
    else root.style.removeProperty(prop);
    for (const swatch of palettes[p].children) {
      swatch.setAttribute('aria-pressed', swatch.dataset.color === color);
    }
  }
}

function loadPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    for (const p of ['X', 'O']) {
      if (typeof saved?.[p]?.name === 'string') state.players[p].name = saved[p].name;
      if (Object.values(COLORS).includes(saved?.[p]?.color)) state.players[p].color = saved[p].color;
    }
  } catch {
    // Storage unavailable or corrupt; fall back to defaults.
  }
}

function savePlayers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.players));
  } catch {
    // Storage unavailable; settings just won't persist.
  }
}

function scheduleAi() {
  render();
  state.aiTimer = setTimeout(() => {
    state.aiTimer = null;
    place(modeEl.value === 'hard' ? bestMove() : easyMove());
  }, 400);
}

function emptyCells(board) {
  return board.reduce((acc, v, i) => (v ? acc : [...acc, i]), []);
}

// Easy: take a win or block a loss when one is available, otherwise play randomly.
function easyMove() {
  const empty = emptyCells(state.board);
  for (const player of ['O', 'X']) {
    for (const i of empty) {
      const trial = [...state.board];
      trial[i] = player;
      if (winnerOf(trial)?.player === player) return i;
    }
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

// Hard: full minimax search; prefers faster wins and slower losses.
function bestMove() {
  let best = { score: -Infinity, index: null };
  for (const i of emptyCells(state.board)) {
    const trial = [...state.board];
    trial[i] = 'O';
    const score = minimax(trial, false, 1);
    if (score > best.score) best = { score, index: i };
  }
  return best.index;
}

function minimax(board, maximizing, depth) {
  const result = winnerOf(board);
  if (result) {
    if (result.player === 'O') return 10 - depth;
    if (result.player === 'X') return depth - 10;
    return 0;
  }
  const scores = emptyCells(board).map((i) => {
    const trial = [...board];
    trial[i] = maximizing ? 'O' : 'X';
    return minimax(trial, !maximizing, depth + 1);
  });
  return maximizing ? Math.max(...scores) : Math.min(...scores);
}

function newRound() {
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  state.board.fill(null);
  state.over = false;
  state.result = null;
  // Alternate who starts each round to keep things fair.
  state.starter = state.starter === 'X' ? 'O' : 'X';
  state.current = state.starter;
  cells.forEach((cell, i) => {
    cell.textContent = '';
    cell.className = 'cell';
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, empty`);
  });
  if (isAiTurn()) scheduleAi();
  else render();
}

function moveFocus(e, i) {
  const deltas = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
  const delta = deltas[e.key];
  if (delta === undefined) return;
  e.preventDefault();
  const row = Math.floor(i / 3);
  let next = i + delta;
  if (delta === -1 && i % 3 === 0) next = row * 3 + 2;
  if (delta === 1 && i % 3 === 2) next = row * 3;
  if (next < 0) next += 9;
  if (next > 8) next -= 9;
  cells[next].focus();
}

document.getElementById('new-round').addEventListener('click', newRound);
document.getElementById('reset-score').addEventListener('click', () => {
  state.score = { X: 0, O: 0, draw: 0 };
  state.starter = 'O'; // so the next round starts with X
  newRound();
});
modeEl.addEventListener('change', () => {
  state.starter = 'O';
  newRound();
});

function toggleColorMenu(p, open) {
  palettes[p].hidden = !open;
  colorButtons[p].setAttribute('aria-expanded', open);
  if (open) {
    const selected = palettes[p].querySelector('[aria-pressed="true"]');
    (selected || palettes[p].firstElementChild).focus();
  }
}

document.addEventListener('click', (e) => {
  for (const p of ['X', 'O']) {
    if (!palettes[p].hidden && !palettes[p].parentElement.contains(e.target)) toggleColorMenu(p, false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const p of ['X', 'O']) {
    if (!palettes[p].hidden) {
      toggleColorMenu(p, false);
      colorButtons[p].focus();
    }
  }
});

for (const p of ['X', 'O']) {
  colorButtons[p].addEventListener('click', () => toggleColorMenu(p, palettes[p].hidden));
  nameInputs[p].addEventListener('input', () => {
    state.players[p].name = nameInputs[p].value;
    savePlayers();
    render();
  });
  for (const [name, hex] of Object.entries(COLORS)) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = hex;
    swatch.dataset.color = hex;
    swatch.title = name;
    swatch.setAttribute('aria-label', name);
    // Clicking the selected swatch again returns to the theme's default colour.
    swatch.addEventListener('click', () => {
      state.players[p].color = state.players[p].color === hex ? null : hex;
      savePlayers();
      applyColors();
      toggleColorMenu(p, false);
      colorButtons[p].focus();
    });
    palettes[p].append(swatch);
  }
}

loadPlayers();
for (const p of ['X', 'O']) nameInputs[p].value = state.players[p].name;
applyColors();
render();
