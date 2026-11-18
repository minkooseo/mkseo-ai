// The exact sign test that says whether A and B really differ.
/**
 * The exact two-sided sign test p-value: the chance of a win split at least
 * this uneven if A and B were equally good. Below 0.05, the gap is unlikely
 * to be luck; with no wins at all it is 1.
 */
export function signTest({
  aWins,
  bWins,
}: {
  readonly aWins: number;
  readonly bWins: number;
}): number {
  for (const count of [aWins, bWins]) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Win counts must be whole numbers of zero or more.");
    }
  }
  const total = aWins + bWins;
  const fewer = Math.min(aWins, bWins);
  // Add up binomial(total, 1/2) chances of 0..fewer wins. Working with
  // logarithms keeps 0.5^total from rounding to zero for large totals.
  let logChance = total * Math.log(0.5);
  let tail = 0;
  for (let wins = 0; wins <= fewer; wins += 1) {
    tail += Math.exp(logChance);
    logChance += Math.log((total - wins) / (wins + 1));
  }
  return Math.min(1, 2 * tail);
}
