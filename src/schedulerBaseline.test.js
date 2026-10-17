import { canPlayTogether, getPlayerSkillLevel } from './schedulers/shared';

describe('Scheduler skill boundary regression', () => {
  test.each([
    [2.5, 'BEGINNER'],
    [3.0, 'ADVANCED_BEGINNER'],
    [3.5, 'INTERMEDIATE'],
    [4.0, 'ADVANCED_INTERMEDIATE'],
    [4.5, 'ADVANCED'],
    [5.0, 'EXPERT'],
    [5.5, 'EXPERT_PRO'],
  ])('rating %s belongs to %s', (rating, expected) => {
    expect(getPlayerSkillLevel(rating).key).toBe(expected);
  });

  test('allows adjacent skill groups', () => {
    expect(canPlayTogether({ rating: 3.4 }, { rating: 3.5 })).toBe(true);
  });

  test('rejects nonadjacent skill groups', () => {
    expect(canPlayTogether({ rating: 2.5 }, { rating: 4.5 })).toBe(false);
  });
});
