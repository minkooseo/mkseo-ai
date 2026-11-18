// Open an address in the person's default browser, on macOS.
import { spawn } from "node:child_process";

/**
 * Ask macOS to open `url` in the default browser and return at once.
 * Throws on any other system. Opening is a convenience: when the `open`
 * command fails, a one-line note goes to stderr, so the caller should also
 * print the address.
 */
export function openBrowser(url: string): void {
  if (process.platform !== "darwin") {
    throw new Error(
      `Opening a browser needs macOS, not ${process.platform}. ` +
        `Open ${url} yourself.`,
    );
  }
  const child = spawn("open", [url], { stdio: "ignore", detached: true });
  child.on("error", (error) => {
    console.error(`Could not open a browser (${error.message}).`);
  });
  child.unref();
}
