// Calls between services: timeout, retry rules, 4xx passed on, 503/504 mapping, trace headers.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ServiceClient, auditContext } from "../dist/index.js";

let server, base;
const seen = [];
let flaky = 0;
before(async () => {
  server = createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, headers: req.headers });
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url.endsWith("/ok"))
      return send(200, { success: true, data: { n: 1 } });
    if (req.url.endsWith("/conflict"))
      return send(409, { code: "INVALID_TRANSITION", status: 409 });
    if (req.url.endsWith("/boom")) return send(500, { code: "INTERNAL_ERROR" });
    if (req.url.endsWith("/flaky"))
      return ++flaky < 3
        ? send(503, {})
        : send(200, { success: true, data: "late" });
    if (req.url.endsWith("/slow")) return setTimeout(() => send(200, {}), 500);
    send(404, { code: "NOT_FOUND" });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});
const count = (suffix) => seen.filter((s) => s.url.endsWith(suffix)).length;

test("a 2xx answer returns the envelope's data and forwards token and request id", async () => {
  const client = new ServiceClient("demo", base);
  const data = await auditContext.run({ requestId: "req-1" }, () =>
    client.get("/ok", { token: "t0k" }),
  );
  assert.deepEqual(data, { n: 1 });
  const last = seen.at(-1);
  assert.equal(last.url, "/api/v1/ok");
  assert.equal(last.headers.authorization, "Bearer t0k");
  assert.equal(last.headers["x-request-id"], "req-1");
});

test("a business 4xx comes back unchanged and is never retried", async () => {
  const client = new ServiceClient("demo", base, { retries: 3 });
  await assert.rejects(client.get("/conflict"), (e) => {
    assert.equal(e.getStatus(), 409);
    assert.equal(e.message, "INVALID_TRANSITION");
    return true;
  });
  assert.equal(count("/conflict"), 1);
});

test("idempotent calls retry infrastructure failures, POST does not", async () => {
  const client = new ServiceClient("demo", base);
  assert.equal(await client.get("/flaky"), "late");
  assert.equal(count("/flaky"), 3);
  await assert.rejects(client.post("/boom", { body: {} }), (e) => {
    assert.equal(e.getStatus(), 502);
    assert.equal(e.message, "UPSTREAM_ERROR:demo");
    return true;
  });
  assert.equal(count("/boom"), 1);
});

test("slow targets give 504, unreachable ones 503, missing config 503", async () => {
  await assert.rejects(
    new ServiceClient("demo", base).get("/slow", {
      timeoutMs: 100,
      retries: 0,
    }),
    (e) => e.getStatus() === 504 && e.message === "UPSTREAM_TIMEOUT:demo",
  );
  await assert.rejects(
    new ServiceClient("gone", "http://127.0.0.1:1").get("/x", { retries: 0 }),
    (e) => e.getStatus() === 503 && e.message === "UPSTREAM_UNAVAILABLE:gone",
  );
  delete process.env.NOWHERE_URL;
  await assert.rejects(
    ServiceClient.fromEnv("nowhere").get("/x"),
    (e) =>
      e.getStatus() === 503 && e.message === "UPSTREAM_NOT_CONFIGURED:nowhere",
  );
});
