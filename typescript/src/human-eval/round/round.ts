// The saved round: the items the person decides on, in the order shown.
import { z } from "zod";
import { labelsSchema } from "../outputs/output.ts";

const voiceOutputSchema = z.strictObject({
  /** Who wrote the output; e.g. 'formal'. */
  voice: z.string(),
  /** The output; e.g. 'Sorry the train was late.'. */
  text: z.string(),
});

/**
 * One pair or lineup item: set A and set B shown as Left and Right. "Side"
 * in names below means this kind.
 */
const sideItemSchema = z.strictObject({
  /** The case shown; e.g. 'late-train'. */
  caseId: z.string(),
  /** The sample number shown on both sides; e.g. 1. */
  sample: z.int().positive(),
  /** What the person reads to grasp the case; e.g. the user's message. */
  context: z.string(),
  /** Labels all outputs in the item share; e.g. { task: 'reply' }. */
  labels: labelsSchema,
  /** The output set shown on the left; never printed; e.g. 'b'. */
  leftSet: z.enum(["a", "b"]),
  /** Outputs on the left, one per voice, in voice name order. */
  left: z.array(voiceOutputSchema).min(1),
  /** The same voices' outputs from the other output set. */
  right: z.array(voiceOutputSchema).min(1),
});

/** One guess item: a single output and the voices to pick from. */
const guessItemSchema = z.strictObject({
  /** The case shown; e.g. 'late-train'. */
  caseId: z.string(),
  /** The output's sample number; e.g. 1. */
  sample: z.int().positive(),
  /** What the person reads to grasp the case; e.g. the user's message. */
  context: z.string(),
  /** The output, shown with no name; e.g. 'Sorry the train was late.'. */
  text: z.string(),
  /** The voice that really wrote it; never printed; e.g. 'formal'. */
  voice: z.string(),
  /** Voices to pick from, in name order; e.g. ['casual', 'formal']. */
  options: z.array(z.string()).min(2),
});

const sideRoundSchema = z.strictObject({
  /** 'pair' compares one voice; 'lineup' compares a group of voices. */
  kind: z.enum(["pair", "lineup"]),
  /** Folder of output set A, relative to the round; e.g. '../run-1'. */
  a: z.string(),
  /** Folder of output set B, relative to the round; e.g. '../run-2'. */
  b: z.string(),
  /** Items in the order the person sees them; item 1 comes first. */
  items: z.array(sideItemSchema).min(1),
});

const guessRoundSchema = z.strictObject({
  kind: z.literal("guess"),
  /** Folder of the output set, relative to the round; e.g. '../run-1'. */
  outputs: z.string(),
  /** Items in the order the person sees them; item 1 comes first. */
  items: z.array(guessItemSchema).min(1),
});

/**
 * The items to show. Each item also notes which output set is on the
 * left, or which voice wrote a guess output; pages never print that.
 */
export const roundSchema = z.discriminatedUnion("kind", [
  sideRoundSchema,
  guessRoundSchema,
]);

export type Round = z.infer<typeof roundSchema>;
export type SideItem = z.infer<typeof sideItemSchema>;
export type GuessItem = z.infer<typeof guessItemSchema>;
export type VoiceOutput = z.infer<typeof voiceOutputSchema>;
