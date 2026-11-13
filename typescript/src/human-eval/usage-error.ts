/**
 * A problem the person running a command can fix, such as a bad option,
 * a folder that is not empty, or a bad reply. The command line prints only
 * its message; any other error is a bug and keeps its stack trace.
 */
export class UsageError extends Error {}
