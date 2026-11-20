// Entry of @mkseo/ai/human-eval: a web page where a person compares the
// outputs of two versions of a prompt, without knowing which is which, and
// picks the better one. The caller makes the outputs and chooses what to
// show; this package only runs the page and reports the picks.
export { gradeRound } from "./grading.ts";
export type {
  Description,
  DescriptionField,
  DescriptionSection,
  ItemVerdict,
  Round,
  RoundItem,
  SpeakerOutputs,
  SpeakerVerdict,
  Winner,
} from "./round.ts";
