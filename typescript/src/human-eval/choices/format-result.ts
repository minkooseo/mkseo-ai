// Write a round's result as plain text for the terminal.
import type {
  GuessResult,
  HumanEvalResult,
  SideResult,
  WinCounts,
} from "./result.ts";

/** Describe a result in plain words for the terminal. */
export function formatResult(result: HumanEvalResult): string {
  return result.kind === "guess"
    ? formatGuessResult(result)
    : formatSideResult(result);
}

function formatSideResult(result: SideResult): string {
  const counts = (wins: WinCounts) =>
    `${wins.aWins} / ${wins.bWins} / ${wins.ties}`;
  const tags = sortedEntries(result.byTag).map(
    ([tag, wins]) => `  ${tag}: ${counts(wins)}`,
  );
  const labels = sortedEntries(result.byLabel).flatMap(([name, values]) =>
    sortedEntries(values).map(
      ([value, wins]) => `  ${name}=${value}: ${counts(wins)}`,
    ),
  );
  const kind = result.kind === "pair" ? "Pair" : "Lineup";
  return [
    `${kind} round, ${result.choices} choices`,
    `  A: ${result.a}`,
    `  B: ${result.b}`,
    `A won ${result.aWins}, B won ${result.bWins}, ties ${result.ties}.`,
    `Sign test p-value (ties left out): ${formatPValue(result.pValue)}`,
    "A p-value of at most 0.05 means the gap is unlikely to be luck.",
    ...(tags.length > 0 ? ["", "Tags (A wins / B wins / ties):", ...tags] : []),
    "",
    "By label (A wins / B wins / ties):",
    ...(labels.length > 0 ? labels : ["  none"]),
  ].join("\n");
}

function formatGuessResult(result: GuessResult): string {
  const rows = sortedEntries(result.confusion).map(([voice, guesses]) => {
    const counts = sortedEntries(guesses).map(
      ([guess, count]) => `${guess} ${count}`,
    );
    return `  ${voice}: ${counts.join(", ")}`;
  });
  return [
    `Guess round, ${result.choices} choices on ${result.outputs}`,
    `Right ${result.correct} times (${percent(result.accuracy)}).`,
    "",
    "Guesses for each real voice (real voice: guessed voice count):",
    ...rows,
  ].join("\n");
}

function sortedEntries<T>(record: Readonly<Record<string, T>>): [string, T][] {
  return Object.entries(record).sort(([x], [y]) => (x < y ? -1 : 1));
}

function formatPValue(pValue: number): string {
  return pValue < 0.001 ? "below 0.001" : pValue.toFixed(3);
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
