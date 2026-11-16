// A choice is what the person picked for one item; this file reads them
// from the person's reply.
import { z } from "zod";
import { UsageError } from "../usage-error.ts";

export const choiceSchema = z.strictObject({
  /** The round item this is for, counted from 1; e.g. 3. */
  item: z.int().positive(),
  /** The side the person picked, or a tie; e.g. 'left'. */
  picked: z.enum(["left", "right", "tie"]),
  /** Free words the person added about the item; e.g. ['stiff']. */
  tags: z.array(z.string().min(1)),
});

/** What the person picked for one item. */
export type Choice = z.infer<typeof choiceSchema>;

/**
 * Read the person's reply to a page of items. Each choice is on its own
 * line or after a comma: the item number, the pick (l, r, or t), then any
 * tags; e.g. '3 l stiff, 4 t'. Letters may be any case. Throws a one-line
 * message naming the first bad part, so nothing from a bad reply is
 * recorded.
 */
export function parseReply({
  reply,
  page,
}: {
  readonly reply: string;
  /** Item numbers on the page the person replied to; e.g. [3, 4, 5]. */
  readonly page: readonly number[];
}): Choice[] {
  const parts = reply
    .toLowerCase()
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0) throw new UsageError("The reply has no choices.");
  const choices = parts.map((part) => parsePart({ part, page }));
  const items = choices.map((choice) => choice.item);
  const repeated = items.find((item, index) => items.indexOf(item) !== index);
  if (repeated !== undefined) {
    throw new UsageError(
      `Item ${repeated} appears more than once in the reply.`,
    );
  }
  return choices;
}

// A Map, not an object, so words such as "constructor" are not found.
const picks: ReadonlyMap<string, Choice["picked"]> = new Map([
  ["l", "left"],
  ["r", "right"],
  ["t", "tie"],
]);

function parsePart({
  part,
  page,
}: {
  readonly part: string;
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
  const picked = picks.get(pickText);
  if (picked === undefined) {
    throw new UsageError(`"${part}": pick l, r, or t.`);
  }
  // A tag that looks like an item number or a pick means two choices were
  // written together, such as '1 l 2 r'.
  if (tags.some((tag) => /^\d+$/.test(tag) || picks.has(tag))) {
    throw new UsageError(
      `"${part}": put each choice on its own line or after a comma.`,
    );
  }
  return { item, picked, tags: [...new Set(tags)] };
}
