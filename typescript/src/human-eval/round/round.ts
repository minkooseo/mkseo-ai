// The saved round: the items the person decides on, in the order shown.
import { z } from "zod";
import { labelsSchema } from "../outputs/output.ts";

const voiceOutputSchema = z.strictObject({
  /** Who wrote the output; e.g. 'formal'. */
  voice: z.string(),
  /** The output; e.g. 'Sorry the train was late.'. */
  text: z.string(),
});

/** One pair or lineup item: set A and set B shown as Left and Right. */
const itemSchema = z.strictObject({
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

/**
 * The items to show. Each item also notes which output set is on the
 * left; pages never print that.
 */
export const roundSchema = z.strictObject({
  /** 'pair' compares one voice; 'lineup' compares a group of voices. */
  kind: z.enum(["pair", "lineup"]),
  /** Folder of output set A, relative to the round; e.g. '../run-1'. */
  a: z.string(),
  /** Folder of output set B, relative to the round; e.g. '../run-2'. */
  b: z.string(),
  /** Items in the order the person sees them; item 1 comes first. */
  items: z.array(itemSchema).min(1),
});

export type Round = z.infer<typeof roundSchema>;
export type RoundItem = z.infer<typeof itemSchema>;
export type VoiceOutput = z.infer<typeof voiceOutputSchema>;
