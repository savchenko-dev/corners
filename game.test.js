import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyMove, legalMoves, checkWinner, homeSquares, WHITE, BLACK, SIZE } from './game.js';

test('initial setup has 12 pieces each in opposite corners', () => {
  const g = createGame();
  assert.equal(g.board.filter((v) => v === WHITE).length, 12);
  assert.equal(g.board.filter((v) => v === BLACK).length, 12);
  assert.equal(g.board[7 * SIZE + 0], WHITE);
  assert.equal(g.board[0 * SIZE + 7], BLACK);
  assert.equal(g.turn, WHITE);
});

test('front piece can step forward and jump over own piece', () => {
  const g = createGame();
  // White piece at row 5, col 3 (front corner). Can step to (4,3) and (5,4).
  const from = 5 * SIZE + 3;
  const moves = legalMoves(g.board, from);
  assert.ok(moves.has(4 * SIZE + 3));
  assert.ok(moves.has(5 * SIZE + 4));
  // Piece at (7,2) can jump over (6,2)? No: (5,2) is occupied. Piece at (5,0) jumps over (5,1)? (5,2) occupied.
  // Piece at (6,2): jump right over nothing; jump up over (5,2) to (4,2) -> allowed.
  const jumps = legalMoves(g.board, 6 * SIZE + 3);
  assert.ok(jumps.has(4 * SIZE + 3));
});

test('turn enforcement and illegal moves', () => {
  const g = createGame();
  assert.equal(applyMove(g, BLACK, 2 * SIZE + 5, 3 * SIZE + 5).ok, false);
  assert.equal(applyMove(g, WHITE, 5 * SIZE + 2, 3 * SIZE + 2).ok, false); // two-step slide is illegal
  assert.equal(applyMove(g, WHITE, 5 * SIZE + 2, 4 * SIZE + 2).ok, true);
  assert.equal(g.turn, BLACK);
});

test('chained jumps produce a multi-square path', () => {
  const board = new Array(64).fill(0);
  board[7 * SIZE + 0] = WHITE;
  board[6 * SIZE + 0] = BLACK;
  board[4 * SIZE + 0] = WHITE;
  const moves = legalMoves(board, 7 * SIZE + 0);
  assert.deepEqual(moves.get(3 * SIZE + 0), [7 * SIZE + 0, 5 * SIZE + 0, 3 * SIZE + 0]);
});

test('winner detected when opposite corner filled', () => {
  const board = new Array(64).fill(0);
  for (const i of homeSquares(BLACK)) board[i] = WHITE;
  assert.equal(checkWinner(board), WHITE);
});
