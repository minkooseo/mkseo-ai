// Write a round's result as plain text for the terminal.
import type { HumanEvalResult, WinCounts } from "./result.ts";

/** Describe a result in plain words for the terminal. */
export function formatResult(result: HumanEvalResult): string {
  const counts = (wins: WinCounts) =>
    `${wins.aWins} / ${wins.bWins} / ${wins.ties}`;
  const labels = sortedEntries(result.byLabel).flatMap(([name, values]) =>
    sortedEntries(values).map(
      ([value, wins]) => `  ${name}=${value}: ${counts(wins)}`,
    ),
  );
  const kind = result.kind === "pair" ? "Pair" : "Lineup";
  return [
    `${kind} round, ${result.choiceCount} choices`,
    `  A: ${result.a}`,
    `  B: ${result.b}`,
    `A won ${result.aWins}, B won ${result.bWins}, ties ${result.ties}.`,
    winnerLine(result.winner),
    "",
    "By label (A wins / B wins / ties):",
    ...(labels.length > 0 ? labels : ["  none"]),
  ].join("\n");
}

function sortedEntries<T>(record: Readonly<Record<string, T>>): [string, T][] {
  return Object.entries(record).sort(([x], [y]) => (x < y ? -1 : 1));
}

function winnerLine(winner: HumanEvalResult["winner"]): string {
  switch (winner) {
    case "a":
      return "A wins: it has more wins than B.";
    case "b":
      return "B wins: it has more wins than A.";
    case null:
      return "No winner: A and B have as many wins.";
  }
}
