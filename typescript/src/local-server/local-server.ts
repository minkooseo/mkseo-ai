// A small web server on this machine only: it serves a page and JSON
// through routes the caller supplies, then shuts down when asked.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/** What a route sends back. */
export type Reply =
  | {
      readonly kind: "html";
      /** The whole page; e.g. '<!doctype html>...'. */
      readonly html: string;
    }
  | {
      readonly kind: "json";
      /** HTTP status; e.g. 200, or 400 for a request the caller refuses. */
      readonly status: number;
      /** Any value JSON can hold; e.g. { finished: false }. */
      readonly body: unknown;
    };

/** One address the server answers, and the caller's code for it. */
export interface Route {
  readonly method: "GET" | "POST";
  /** The exact path, without a query; e.g. '/choices'. */
  readonly path: string;
  /**
   * Answer one request. `body` is the parsed JSON body of a POST and null
   * for a GET. The caller checks its shape.
   */
  readonly handle: (body: unknown) => Promise<Reply>;
}

/** A running server. */
export interface LocalServer {
  /** Where the server answers, ending in '/'; e.g. 'http://127.0.0.1:5173/'. */
  readonly url: string;
  /**
   * Stop taking requests and resolve once the ones in progress have been
   * answered.
   */
  readonly close: () => Promise<void>;
}

/** Largest request body taken, in bytes; a page sends far less. */
const maxBodyBytes = 1_000_000;

/**
 * Start a server on 127.0.0.1 at a free port that answers `routes` and
 * refuses anything else with an error status. A POST body over 1 MB, or
 * one the client stops sending, gets no reply: its connection is closed.
 * When a route throws, the request gets 500 and the error goes to
 * `onError`.
 */
export async function startLocalServer({
  routes,
  onError,
}: {
  readonly routes: readonly Route[];
  readonly onError: (error: unknown) => void;
}): Promise<LocalServer> {
  let host = "";
  const server = createServer((request, response) => {
    handleRequest({ request, response, routes, host }).catch(
      (error: unknown) => {
        if (!response.headersSent) {
          sendJson(response, 500, { error: "Server error." });
        } else {
          response.destroy();
        }
        onError(error);
      },
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  host = `127.0.0.1:${portOf(server.address())}`;
  return {
    url: `http://${host}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function handleRequest({
  request,
  response,
  routes,
  host,
}: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly routes: readonly Route[];
  readonly host: string;
}): Promise<void> {
  // A page from another site could reach this port through a domain it
  // controls; checking the host turns those requests away.
  if (request.headers.host !== host) {
    sendJson(response, 403, { error: "Wrong host." });
    return;
  }
  const path = new URL(request.url ?? "/", `http://${host}`).pathname;
  const routesOnPath = routes.filter((route) => route.path === path);
  const route = routesOnPath.find((one) => one.method === request.method);
  if (route === undefined) {
    const [status, error] =
      routesOnPath.length === 0 ? [404, "Not found."] : [405, "Wrong method."];
    sendJson(response, status, { error });
    return;
  }
  let body: unknown = null;
  if (route.method === "POST") {
    const read = await readJsonBody(request);
    if (read.kind === "dropped") {
      response.destroy();
      return;
    }
    if (read.kind === "refused") {
      sendJson(response, read.status, { error: read.error });
      return;
    }
    body = read.body;
  }
  const reply = await route.handle(body);
  if (reply.kind === "html") {
    send(response, 200, "text/html; charset=utf-8", reply.html);
  } else {
    sendJson(response, reply.status, reply.body);
  }
}

type BodyResult =
  | { readonly kind: "read"; readonly body: unknown }
  | { readonly kind: "dropped" }
  | {
      readonly kind: "refused";
      readonly status: number;
      readonly error: string;
    };

async function readJsonBody(request: IncomingMessage): Promise<BodyResult> {
  // Requiring JSON also keeps plain cross-site form posts out, since a
  // browser must ask before sending JSON to another site.
  const type = request.headers["content-type"] ?? "";
  if (!type.startsWith("application/json")) {
    return { kind: "refused", status: 415, error: "Send JSON." };
  }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      const bytes = chunk as Buffer;
      size += bytes.length;
      // Leaving the loop destroys the request, so no reply can follow.
      if (size > maxBodyBytes) return { kind: "dropped" };
      chunks.push(bytes);
    }
  } catch {
    // The stream fails only when the client goes away mid-body.
    return { kind: "dropped" };
  }
  try {
    return {
      kind: "read",
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { kind: "refused", status: 400, error: "The body is not JSON." };
  }
}

function portOf(address: AddressInfo | string | null): number {
  // A server listening on a TCP port reports an AddressInfo.
  if (address === null || typeof address === "string") {
    throw new Error(`The server is not on a TCP port: ${String(address)}.`);
  }
  return address.port;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  send(response, status, "application/json", JSON.stringify(body));
}

function send(
  response: ServerResponse,
  status: number,
  contentType: string,
  text: string,
) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    // Each response ends its connection, so close() never waits on an
    // idle keep-alive connection.
    connection: "close",
  });
  response.end(text);
}
