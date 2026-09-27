// Corners (Уголки) rules. 8x8 board, 9 pieces each in opposite 3x3 corners.
// A move is either one orthogonal step to an empty square, or a chain of one
// or more orthogonal jumps over any piece (own or opponent's) onto empty squares.
// A player wins by filling the opponent's starting corner with all 9 pieces.

export const SIZE = 8;
export const WHITE = 1;
export const BLACK = 2;

const idx = (r, c) => r * SIZE + c;
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// White starts bottom-left (rows 5-7, cols 0-2), Black top-right (rows 0-2, cols 5-7).
export function homeSquares(player) {
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(player === WHITE ? idx(SIZE - 1 - r, c) : idx(r, SIZE - 1 - c));
    }
  }
  return out;
}

export function createBoard() {
  const board = new Array(SIZE * SIZE).fill(0);
  for (const i of homeSquares(WHITE)) board[i] = WHITE;
  for (const i of homeSquares(BLACK)) board[i] = BLACK;
  return board;
}

export function createGame() {
  return { board: createBoard(), turn: WHITE, winner: 0, moves: 0 };
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Returns a Map of destination index -> path (array of indices incl. start)
export function legalMoves(board, from) {
  const result = new Map();
  if (!board[from]) return result;
  const r0 = Math.floor(from / SIZE);
  const c0 = from % SIZE;

  // Simple steps
  for (const [dr, dc] of DIRS) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (inBounds(r, c) && board[idx(r, c)] === 0) result.set(idx(r, c), [from, idx(r, c)]);
  }

  // Jump chains (BFS)
  const visited = new Set([from]);
  const queue = [[from, [from]]];
  while (queue.length) {
    const [cur, path] = queue.shift();
    const r = Math.floor(cur / SIZE);
    const c = cur % SIZE;
    for (const [dr, dc] of DIRS) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (!inBounds(lr, lc)) continue;
      const mid = idx(mr, mc);
      const land = idx(lr, lc);
      if (board[mid] !== 0 && board[land] === 0 && !visited.has(land)) {
        visited.add(land);
        const newPath = [...path, land];
        // Jumps override a simple step to the same square only if no step exists.
        if (!result.has(land)) result.set(land, newPath);
        queue.push([land, newPath]);
      }
    }
  }
  return result;
}

export function checkWinner(board) {
  const whiteWon = homeSquares(BLACK).every((i) => board[i] === WHITE);
  if (whiteWon) return WHITE;
  const blackWon = homeSquares(WHITE).every((i) => board[i] === BLACK);
  if (blackWon) return BLACK;
  return 0;
}

// Applies a move. Returns { ok, error?, path? }
export function applyMove(game, player, from, to) {
  if (game.winner) return { ok: false, error: 'Game is over' };
  if (game.turn !== player) return { ok: false, error: 'Not your turn' };
  if (!Number.isInteger(from) || !Number.isInteger(to)) return { ok: false, error: 'Bad move' };
  if (from < 0 || from >= SIZE * SIZE || to < 0 || to >= SIZE * SIZE) return { ok: false, error: 'Bad move' };
  if (game.board[from] !== player) return { ok: false, error: 'Not your piece' };

  const moves = legalMoves(game.board, from);
  const path = moves.get(to);
  if (!path) return { ok: false, error: 'Illegal move' };

  game.board[to] = player;
  game.board[from] = 0;
  game.moves += 1;
  game.winner = checkWinner(game.board);
  if (!game.winner) game.turn = player === WHITE ? BLACK : WHITE;
  return { ok: true, path };
}
