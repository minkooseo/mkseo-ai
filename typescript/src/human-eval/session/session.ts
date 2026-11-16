// A session is a round plus the choices made so far: which page comes next
// and whether the saved choices fit the round.
import type { Choice } from "../choices/choices.ts";
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
 * Throw unless every choice names a different item that exists. Run on
 * sessions read from files.
 */
export function assertValidSession({ round, choices }: Session) {
  const seen = new Set<number>();
  for (const { item } of choices) {
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
  }
}
