// Write a page of round items as Markdown for the person to read in a chat.
import type { Round, RoundItem, VoiceOutput } from "./round.ts";

/**
 * A page of round items as Markdown, ready to paste into a chat
 * unchanged. `page` lists the item numbers to show, counted from 1. It
 * never says which output set an output came from. `page` must not be
 * empty.
 */
export function formatPage({
  round,
  page,
}: {
  readonly round: Round;
  readonly page: readonly number[];
}): string {
  const total = round.items.length;
  const [first] = page;
  if (first === undefined) throw new Error("A page needs at least one item.");
  const blocks = page.map((item) => {
    const body = itemBlock(itemAt(round.items, item));
    return [`### Item ${item} of ${total}`, ...body].join("\n\n");
  });
  return [...blocks, replyLine(round.kind, first)].join("\n\n");
}

function itemBlock(item: RoundItem): string[] {
  return [
    "Case:",
    quote(item.context),
    "**Left**",
    ...item.left.flatMap(voiceOutputLines),
    "**Right**",
    ...item.right.flatMap(voiceOutputLines),
  ];
}

function replyLine(kind: Round["kind"], first: number): string {
  switch (kind) {
    case "pair":
      return (
        "Reply with one line per item: the item number, then l (left is " +
        "better), r (right is better), or t (tie), then any words about " +
        `it. Example: ${first} l stiff`
      );
    case "lineup":
      return (
        "Reply with the item number, then l or r for the side that sounds " +
        "more like different people, or t (tie), then any words about it. " +
        `Example: ${first} r`
      );
  }
}

function voiceOutputLines(output: VoiceOutput): string[] {
  return [`*${output.voice}*`, quote(output.text)];
}

function quote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function itemAt<T>(items: readonly T[], item: number): T {
  const found = items[item - 1];
  if (found === undefined) throw new Error(`There is no item ${item}.`);
  return found;
}
