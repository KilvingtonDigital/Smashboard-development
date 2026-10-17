import { generateSinglesRound } from './schedulers/singlesScheduler';
import { generateRoundRobinRound } from './schedulers/doublesScheduler';

// These tests exercise the real scheduler, not a mocked implementation.
// Silence verbose scheduling diagnostics; restore console after every test.
let logSpy, warnSpy, errorSpy;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const roster = (count, { gender = 'male', rating = 3.5 } = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
    gender,
    rating,
    present: true,
  }));

const assertRound = (matches, courts, teamSize) => {
  expect(matches.length).toBeLessThanOrEqual(courts);
  const playerIds = new Set();
  const courtIds = new Set();
  for (const match of matches) {
    expect(courtIds.has(match.court)).toBe(false);
    courtIds.add(match.court);
    const players = teamSize === 2
      ? [match.player1, match.player2]
      : [...match.team1, ...match.team2];
    expect(players).toHaveLength(teamSize);
    for (const player of players) {
      expect(player).toBeDefined();
      expect(playerIds.has(player.id)).toBe(false);
      playerIds.add(player.id);
    }
  }
  return playerIds;
};

describe('real tournament scheduling invariants', () => {
  test.each([
    [4, 1], [12, 3], [32, 8], [100, 16], [500, 24],
  ])('doubles: %i players, %i courts; no duplicate player or court', (count, courts) => {
    const players = roster(count);
    const stats = {};
    const matches = generateRoundRobinRound(players, courts, stats, 0, false);
    const used = assertRound(matches, courts, 4);
    expect(used.size).toBe(Math.min(Math.floor(count / 4), courts) * 4);
    expect(Object.keys(stats)).toHaveLength(count);
  });

  test.each([
    [2, 1], [12, 4], [100, 16], [500, 24],
  ])('singles: %i players, %i courts; no duplicate player or court', (count, courts) => {
    const players = roster(count);
    const stats = {};
    const matches = generateSinglesRound(players, courts, stats, 0);
    const used = assertRound(matches, courts, 2);
    expect(used.size).toBe(Math.min(Math.floor(count / 2), courts) * 2);
    expect(Object.keys(stats)).toHaveLength(count);
  });

  test('doubles stats survive a JSON session round-trip between rounds', () => {
    const players = roster(20);
    let stats = {};
    const previousRounds = [];
    for (let round = 0; round < 4; round++) {
      const matches = generateRoundRobinRound(players, 4, stats, round, false, 'single_match', false, 2, previousRounds);
      assertRound(matches, 4, 4);
      previousRounds.push(JSON.parse(JSON.stringify(matches)));
      stats = JSON.parse(JSON.stringify(stats));
    }
    expect(Object.values(stats).every(s => s.roundsPlayed + s.roundsSatOut === 4)).toBe(true);
  });

  test('singles stats survive a JSON session round-trip between rounds', () => {
    const players = roster(11);
    let stats = {};
    for (let round = 0; round < 4; round++) {
      const matches = generateSinglesRound(players, 3, stats, round);
      assertRound(matches, 3, 2);
      stats = JSON.parse(JSON.stringify(stats));
    }
    expect(Object.values(stats).every(s => s.roundsPlayed + s.roundsSatOut === 4)).toBe(true);
  });

  test('mixed doubles players never occupy two courts in one round', () => {
    const players = roster(24).map((p, i) => ({ ...p, gender: i % 2 ? 'female' : 'male' }));
    const stats = {};
    const matches = generateRoundRobinRound(players, 6, stats, 0, false, 'single_match', true);
    assertRound(matches, 6, 4);
  });

  test('skill-separated doubles never schedules a player twice', () => {
    const players = roster(32).map((p, i) => ({ ...p, rating: i < 16 ? 3.0 : 4.0 }));
    const stats = {};
    const matches = generateRoundRobinRound(players, 8, stats, 0, true);
    assertRound(matches, 8, 4);
  });
});
