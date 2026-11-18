// Entry of @mkseo/ai/human-eval: the command line runner and the types a
// project fills in.
export { runHumanEvalCli } from "./cli/cli.ts";
export type {
  Output,
  HumanEvalCase,
  HumanEvalProject,
  Labels,
  Speaker,
} from "./project.ts";
