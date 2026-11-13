import { runHumanEvalCli } from "@mkseo/ai/human-eval";
import { project } from "./note-summary-project.ts";

await runHumanEvalCli(project, process.argv.slice(2));
