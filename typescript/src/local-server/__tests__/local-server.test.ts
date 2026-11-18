import { request } from "node:http";
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startLocalServer, type LocalServer } from "../local-server.ts";

let server: LocalServer | null = null;
let errors: unknown[] = [];

afterEach(async () => {
  await server?.close();
  server = null;
  errors = [];
});

async function start(): Promise<LocalServer> {
  server = await startLocalServer({
    routes: [
      {
        method: "GET",
        path: "/",
        handle: () => Promise.resolve({ kind: "html", html: "<p>Hi</p>" }),
      },
      {
        method: "POST",
        path: "/echo",
        handle: (body) =>
          Promise.resolve({ kind: "json", status: 201, body: { got: body } }),
      },
      {
        method: "GET",
        path: "/broken",
        handle: () => Promise.reject(new Error("Broken route.")),
      },
    ],
    onError: (error) => errors.push(error),
  });
  return server;
}

describe("startLocalServer", () => {
  it("serves a page on 127.0.0.1", async () => {
    const { url } = await start();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const response = await fetch(url);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(await response.text()).toBe("<p>Hi</p>");
  });

  it("passes a POST's JSON body to its route", async () => {
    const { url } = await start();
    const response = await fetch(`${url}echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item: 1 }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ got: { item: 1 } });
  });

  it.each([
    {
      what: "an unknown path",
      path: "missing",
      init: {},
      status: 404,
      error: "Not found.",
    },
    {
      what: "a wrong method",
      path: "echo",
      init: {},
      status: 405,
      error: "Wrong method.",
    },
    {
      what: "a POST that is not JSON",
      path: "echo",
      init: { method: "POST", body: "item=1" },
      status: 415,
      error: "Send JSON.",
    },
    {
      what: "broken JSON",
      path: "echo",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      },
      status: 400,
      error: "The body is not JSON.",
    },
  ])("refuses $what", async ({ path, init, status, error }) => {
    const { url } = await start();
    const response = await fetch(`${url}${path}`, init);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("refuses a request that names another host", async () => {
    const { url } = await start();
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const sent = request(url, { headers: { host: "example.com" } }, (got) => {
        got.resume();
        resolve(got.statusCode);
      });
      sent.on("error", reject);
      sent.end();
    });
    expect(status).toBe(403);
  });

  it("answers 500 and reports a route that throws", async () => {
    const { url } = await start();
    const response = await fetch(`${url}broken`);
    expect(response.status).toBe(500);
    expect(errors).toEqual([new Error("Broken route.")]);
  });

  it("closes the connection on a body over 1 MB, silently", async () => {
    const { url } = await start();
    await expect(
      fetch(`${url}echo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(1_100_000) }),
      }),
    ).rejects.toThrow();
    expect(errors).toEqual([]);
    expect((await fetch(url)).status).toBe(200);
  });

  it("ignores a client that stops sending its body", async () => {
    const { url } = await start();
    const { port } = new URL(url);
    await new Promise<void>((resolve) => {
      const socket = connect(Number(port), "127.0.0.1", () => {
        socket.write(
          "POST /echo HTTP/1.1\r\n" +
            `Host: 127.0.0.1:${port}\r\n` +
            "Content-Type: application/json\r\n" +
            "Content-Length: 100\r\n\r\n" +
            '{"item":',
        );
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 50);
      });
    });
    // Give the server time to notice the dropped body.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errors).toEqual([]);
    expect((await fetch(url)).status).toBe(200);
  });

  it("stops answering once closed", async () => {
    const running = await start();
    await fetch(running.url);
    await running.close();
    server = null;
    await expect(fetch(running.url)).rejects.toThrow();
  });
});
