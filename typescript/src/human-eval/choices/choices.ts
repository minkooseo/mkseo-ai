// A choice is what the person picked for one item and why.
import { z } from "zod";

/** The side the person picked, or a tie; e.g. 'left'. */
export const pickedSchema = z.enum(["left", "right", "tie"]);

const choiceFieldsSchema = z.strictObject({
  /** The round item this is for, counted from 1; e.g. 3. */
  item: z.int().positive(),
  picked: pickedSchema,
  /**
   * Why, in the person's words, saved as written; e.g. 'Too stiff.'. Null
   * only on a tie left without a reason.
   */
  reason: z.string().nullable(),
});

export const choiceSchema = choiceFieldsSchema
  .refine((choice) => choice.reason !== null || choice.picked === "tie", {
    message: "Only a tie may have no reason.",
  })
  .refine((choice) => choice.reason === null || /\S/.test(choice.reason), {
    message: "A reason must not be blank.",
  });

/** What the person picked for one item, and why. */
export type Choice = z.infer<typeof choiceSchema>;

/**
 * A choice as the grading page sends it: the reason box's text, possibly
 * blank, before addChoice decides whether a blank reason is allowed.
 */
export const choiceRequestSchema = choiceFieldsSchema.extend({
  /** The reason box's text, possibly blank; e.g. 'Too stiff.'. */
  reason: z.string(),
});

export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;
