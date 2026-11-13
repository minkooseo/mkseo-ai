// A session is a round plus the choices made so far: which page comes next
// and whether the saved choices fit the round.
import { sidePickNames, type Choice } from "../choices/choices.ts";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";

/** A round and the choices recorded so far. */
export interface Session {
  readonly round: Round;
  /** Choices in the order they were recorded. */
  readonly choices: readonly Choice[];
}

/** How many items one page shows: few enough to read in one go. */
const pageSizes: Readonly<Record<Round["kind"], number>> = {
  pair: 5,
  lineup: 1,
  guess: 5,
};

/** The item numbers of the next page: the first items with no choice yet. */
export function currentPage(session: Session): number[] {
  const chosen = new Set(session.choices.map((choice) => choice.item));
  return session.round.items
    .map((_, index) => index + 1)
    .filter((item) => !chosen.has(item))
    .slice(0, pageSizes[session.round.kind]);
}

/**
 * Throw unless every choice names a different item that exists, with a
 * pick that item allows. Run on sessions read from files.
 */
export function assertValidSession({ round, choices }: Session) {
  const seen = new Set<number>();
  for (const { item, picked } of choices) {
    if (seen.has(item)) {
      throw new UsageError(`choices.json has item ${item} twice.`);
    }
    if (item > round.items.length) {
      throw new UsageError(
        `choices.json has item ${item}, but the round has ` +
          `${round.items.length} items.`,
      );
    }
    seen.add(item);
    if (!allowedPicks(round, item).includes(picked)) {
      throw new UsageError(
        `Item ${item} has the pick "${picked}", which it does not allow.`,
      );
    }
  }
}

function allowedPicks(round: Round, item: number): readonly string[] {
  if (round.kind !== "guess") return sidePickNames;
  const guessItem = round.items[item - 1];
  if (guessItem === undefined) throw new Error(`There is no item ${item}.`);
  return guessItem.options;
}
