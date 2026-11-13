// A choice is what the person picked for one item; this file reads them
// from the person's reply.
import { z } from "zod";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";

export const choiceSchema = z.strictObject({
  /** The round item this is for, counted from 1; e.g. 3. */
  item: z.int().positive(),
  /**
   * For pair and lineup: 'left', 'right', or 'tie'. For guess: the voice
   * the person picked; e.g. 'formal'.
   */
  picked: z.string(),
  /** Free words the person added about the item; e.g. ['stiff']. */
  tags: z.array(z.string().min(1)),
});

/** What the person picked for one item. */
export type Choice = z.infer<typeof choiceSchema>;

/**
 * Read the person's reply to a page of items. Each choice is on its own
 * line or after a comma: the item number, the pick, then, for pair and
 * lineup only, any tags; e.g. '3 l stiff, 4 t'. Picks are l, r, or t for
 * pair and lineup, and a voice number for guess. Letters may be any case.
 * Throws a one-line message naming the first bad part, so nothing from a
 * bad reply is recorded.
 */
export function parseReply({
  reply,
  round,
  page,
}: {
  readonly reply: string;
  readonly round: Round;
  /** Item numbers on the page the person replied to; e.g. [3, 4, 5]. */
  readonly page: readonly number[];
}): Choice[] {
  const parts = reply
    .toLowerCase()
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0) throw new UsageError("The reply has no choices.");
  const choices = parts.map((part) => parsePart({ part, round, page }));
  const items = choices.map((choice) => choice.item);
  const repeated = items.find((item, index) => items.indexOf(item) !== index);
  if (repeated !== undefined) {
    throw new UsageError(
      `Item ${repeated} appears more than once in the reply.`,
    );
  }
  return choices;
}

/** What the person can pick on a pair or lineup item. */
type SidePick = "left" | "right" | "tie";

// A Map, not an object, so words such as "constructor" are not found.
const sidePicks: ReadonlyMap<string, SidePick> = new Map([
  ["l", "left"],
  ["r", "right"],
  ["t", "tie"],
]);

/** Every side pick, for checking saved choices. */
export const sidePickNames: readonly string[] = [...sidePicks.values()];

function parsePart({
  part,
  round,
  page,
}: {
  readonly part: string;
  readonly round: Round;
  readonly page: readonly number[];
}): Choice {
  const [itemText, pickText, ...tags] = part.split(/\s+/);
  const item =
    itemText !== undefined && /^\d+$/.test(itemText) ? Number(itemText) : NaN;
  if (!page.includes(item)) {
    throw new UsageError(
      `"${part}" does not start with an item on this page ` +
        `(items ${page.join(", ")}).`,
    );
  }
  if (pickText === undefined) {
    throw new UsageError(`"${part}" does not say what was picked.`);
  }
  if (round.kind !== "guess") {
    const picked = sidePicks.get(pickText);
    if (picked === undefined) {
      throw new UsageError(`"${part}": pick l, r, or t.`);
    }
    // A tag that looks like an item number or a pick means two choices
    // were written together, such as '1 l 2 r'.
    if (tags.some((tag) => /^\d+$/.test(tag) || sidePicks.has(tag))) {
      throw new UsageError(
        `"${part}": put each choice on its own line or after a comma.`,
      );
    }
    return { item, picked, tags: [...new Set(tags)] };
  }
  const guessItem = round.items[item - 1];
  if (guessItem === undefined) throw new Error(`There is no item ${item}.`);
  const { options } = guessItem;
  const picked = options[Number(pickText) - 1];
  if (!/^\d+$/.test(pickText) || picked === undefined) {
    throw new UsageError(
      `"${part}": pick a voice number from 1 to ${options.length}.`,
    );
  }
  if (tags.length > 0) {
    throw new UsageError(
      `"${part}": a guess takes no tags; put each choice on its own line ` +
        "or after a comma.",
    );
  }
  return { item, picked, tags: [] };
}
