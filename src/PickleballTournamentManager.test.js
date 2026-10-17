// Historical ghost-match regression scenario retained as an explicit test gap.
// The previous test imported a deleted APIContext module and could not execute.
// Do not interpret this skipped test as evidence the ghost-match issue is fixed.
// Rebuild this as an isolated integration test using current tournament context,
// a deterministic roster, and assertions that players on occupied/cleaning courts
// cannot be assigned to another court.
describe.skip('Tournament manager ghost-match regression (needs current UI harness)', () => {
  test('players assigned to a cleaning court cannot be assigned to another court', () => {
    throw new Error('Pending isolated tournament manager integration test');
  });
});
