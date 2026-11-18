// A choice is what the person picked for one item and why.
import { z } from "zod";

export const choiceSchema = z.strictObject({
  /** The round item this is for, counted from 1; e.g. 3. */
  item: z.int().positive(),
  /** The side the person picked, or a tie; e.g. 'left'. */
  picked: z.enum(["left", "right", "tie"]),
  /** Why, in the person's words, saved as written; e.g. 'Too stiff.'. */
  reason: z.string().regex(/\S/),
});

/** What the person picked for one item, and why. */
export type Choice = z.infer<typeof choiceSchema>;
