// The saved round: the items the person decides on, in the order shown.
import { z } from "zod";
import { labelsSchema } from "../outputs/output.ts";

const speakerOutputSchema = z.strictObject({
  /** Who wrote the output; e.g. 'formal'. */
  speaker: z.string(),
  /** The output; e.g. 'Sorry the train was late.'. */
  text: z.string(),
});

/** One pair or lineup item: set A and set B shown as Left and Right. */
const itemSchema = z.strictObject({
  /** The case shown; e.g. 'late-train'. */
  caseId: z.string(),
  /** The sample number shown on both sides; e.g. 1. */
  sample: z.int().positive(),
  /** What the person reads to grasp the case; e.g. 'I lost my keys.'. */
  context: z.string(),
  /** Labels all outputs in the item share; e.g. { task: 'reply' }. */
  labels: labelsSchema,
  /**
   * What a pair item's speaker is meant to sound like; null on a lineup
   * item or without descriptions; e.g. 'Formal. Short sentences.'.
   */
  speakerDescription: z.string().nullable(),
  /** The output set shown on the left, never shown to the person; e.g. 'b'. */
  leftSet: z.enum(["a", "b"]),
  /** Outputs on the left, one per speaker, in speaker name order. */
  left: z.array(speakerOutputSchema).min(1),
  /** The same speakers' outputs from the other output set. */
  right: z.array(speakerOutputSchema).min(1),
});

/** A saved round: the items to show, in order, and the sets compared. */
export const roundSchema = z.strictObject({
  /** 'pair' shows one speaker per side; 'lineup' shows every speaker. */
  kind: z.enum(["pair", "lineup"]),
  /** What the grader answers on every item; e.g. 'Which reply is kinder?'. */
  question: z.string().min(1),
  /** Folder of output set A, relative to the round; e.g. '../run-1'. */
  a: z.string(),
  /** Folder of output set B, relative to the round; e.g. '../run-2'. */
  b: z.string(),
  /** Items in the order the person sees them; item 1 comes first. */
  items: z.array(itemSchema).min(1),
});

export type Round = z.infer<typeof roundSchema>;
export type RoundItem = z.infer<typeof itemSchema>;
export type SpeakerOutput = z.infer<typeof speakerOutputSchema>;
