// Send a command line to the command it names.
import { runGenerate } from "../outputs/generate.ts";
import type { HumanEvalCase, HumanEvalProject } from "../project.ts";
import { runChoose, runNewRound, runShow } from "../session/commands.ts";
import { UsageError } from "../usage-error.ts";
import {
  parseChoose,
  parseGenerate,
  parseGuess,
  parseJudge,
  parseShow,
  usage,
} from "./options.ts";

/**
 * Run one human evaluation command for a project. `argv` is the command
 * and its options without the program name; e.g. process.argv.slice(2). A
 * problem the person can fix prints one line to stderr and sets a failing
 * exit code; anything else is thrown.
 */
export async function runHumanEvalCli<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  argv: readonly string[],
): Promise<void> {
  try {
    await runCommand(project, argv);
  } catch (error) {
    if (!isUsageProblem(error)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}

function isUsageProblem(error: unknown): error is Error {
  // node:util parseArgs reports bad flags with ERR_PARSE_ARGS_* codes.
  const badFlag =
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("ERR_PARSE_ARGS_");
  return error instanceof UsageError || badFlag;
}

async function runCommand<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  argv: readonly string[],
): Promise<void> {
  const [command, ...args] = argv;
  switch (command) {
    case "generate":
      return runGenerate(project, parseGenerate(args));
    case "judge":
      return runNewRound(parseJudge(args), project.groupLabel);
    case "guess":
      return runNewRound(parseGuess(args), project.groupLabel);
    case "show":
      return runShow(parseShow(args));
    case "choose":
      return runChoose(parseChoose(args));
    default:
      throw new UsageError(
        command === undefined
          ? `No command given.\n${usage}`
          : `Unknown command "${command}".\n${usage}`,
      );
  }
}
