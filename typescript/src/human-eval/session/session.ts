// A session is a round plus the choices made so far.
import type { Choice } from "../choices/choices.ts";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";

/** A round and the choices recorded so far. */
export interface Session {
  readonly round: Round;
  /** Choices in the order they were recorded. */
  readonly choices: readonly Choice[];
}

/**
 * The session with one more choice. Throws a one-line message when the item
 * is not in the round, already has a choice, or the reason is blank.
 */
export function addChoice(session: Session, choice: Choice): Session {
  const { round, choices } = session;
  if (choice.item > round.items.length) {
    throw new UsageError(
      `There is no item ${choice.item}; the round has ` +
        `${round.items.length} items.`,
    );
  }
  if (choices.some((saved) => saved.item === choice.item)) {
    throw new UsageError(`Item ${choice.item} already has a choice.`);
  }
  if (choice.reason.trim() === "") {
    throw new UsageError("Write a reason for the pick.");
  }
  return { round, choices: [...choices, choice] };
}

/** True once every item of the round has a choice. */
export function isFinished({ round, choices }: Session): boolean {
  return choices.length === round.items.length;
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
