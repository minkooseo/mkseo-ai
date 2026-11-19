// A session is a round plus the choices made so far.
import type { Choice, ChoiceRequest } from "../choices/choices.ts";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";

/** A round and the choices recorded so far. */
export interface Session {
  readonly round: Round;
  /** Choices in the order they were recorded. */
  readonly choices: readonly Choice[];
}

/**
 * The session with one more choice. A tie with a blank reason is saved
 * with no reason; any other reason is saved as written. Throws a one-line
 * message when the item is not in the round, already has a choice, or a
 * left or right pick has a blank reason.
 */
export function addChoice(session: Session, request: ChoiceRequest): Session {
  const { round, choices } = session;
  const { item, picked } = request;
  if (item > round.items.length) {
    throw new UsageError(
      `There is no item ${item}; the round has ${round.items.length} items.`,
    );
  }
  if (choices.some((saved) => saved.item === item)) {
    throw new UsageError(`Item ${item} already has a choice.`);
  }
  const blank = request.reason.trim() === "";
  if (blank && picked !== "tie") {
    throw new UsageError("Write a reason for the pick.");
  }
  const choice: Choice = {
    item,
    picked,
    reason: blank ? null : request.reason,
  };
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
