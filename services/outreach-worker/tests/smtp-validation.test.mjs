import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import {
  HttpEmailValidationProvider,
  SmtpMxEmailValidationProvider,
  isPublicDestination
} from "../src/infrastructure/email-validation-provider.mjs";

test("SMTP/MX validation classifies exact recipient and catch-all responses without DATA", async (t) => {
  for (const scenario of [
    { name: "exact 250 plus catch-all 5xx is Valid", target: 250, catchAll: 550, expected: "Valid" },
    { name: "recipient 5xx is Invalid", target: 550, expected: "Invalid" },
    { name: "recipient 4xx is Unknown", target: 450, expected: "Unknown" },
    { name: "catch-all 250 is Risky", target: 250, catchAll: 250, expected: "Risky" },
    { name: "catch-all 4xx is Risky", target: 250, catchAll: 451, expected: "Risky" },
    { name: "non-exact 2xx is Unknown", target: 251, expected: "Unknown" }
  ]) {
    await t.test(scenario.name, async () => {
      const smtp = await startSmtpServer(scenario);
      try {
        const provider = smtpProvider({ port: smtp.port });
        const result = await provider.validate("dj@example.test");
        assert.equal(result.status, scenario.expected);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(smtp.commands.some((command) => command === "DATA" || command.startsWith("DATA ")), false);
        assert.equal(smtp.commands.some((command) => command.startsWith("RCPT TO:<dj@example.test>")), true);
      } finally {
        await smtp.close();
      }
    });
  }
});

test("SMTP/MX validation maps greeting timeout to Unknown and remains bounded", async () => {
  const smtp = await startSmtpServer({ silent: true });
  try {
    const startedAt = Date.now();
    const result = await smtpProvider({ port: smtp.port, commandTimeoutMs: 40, totalTimeoutMs: 120 })
      .validate("dj@example.test");
    assert.equal(result.status, "Unknown");
    assert.ok(Date.now() - startedAt < 1_000);
  } finally {
    await smtp.close();
  }
});

test("SMTP/MX validation rejects private and reserved MX destinations before connecting", async () => {
  let connectionAttempts = 0;
  const provider = smtpProvider({
    resolveMx: async () => [{ exchange: "mx.private.example", priority: 10 }],
    lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    createConnection: () => {
      connectionAttempts += 1;
      throw new Error("must not connect");
    }
  });
  const result = await provider.validate("dj@example.test");
  assert.equal(result.status, "Unknown");
  assert.equal(connectionAttempts, 0);
  assert.equal(isPublicDestination("127.0.0.1"), false);
  assert.equal(isPublicDestination("10.0.0.1"), false);
  assert.equal(isPublicDestination("203.0.113.10"), false);
  assert.equal(isPublicDestination("8.8.8.8"), true);
  assert.equal(isPublicDestination("2001:db8::1"), false);
  assert.equal(isPublicDestination("2606:4700:4700::1111"), true);
});

test("HTTP email validator cancels a response that exceeds its byte bound", async () => {
  let cancelled = false;
  let chunks = 0;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(40_000));
      chunks += 1;
      if (chunks > 2) controller.close();
    },
    cancel() {
      cancelled = true;
    }
  });
  const provider = new HttpEmailValidationProvider({
    url: "https://validator.example/v1/check",
    token: "validator-token",
    timeoutMs: 1_000
  }, {
    fetch: async () => new Response(body, { status: 200 })
  });
  await assert.rejects(
    () => provider.validate("dj@example.test", "idem"),
    (error) => error.code === "EMAIL_VALIDATION_RESPONSE_TOO_LARGE"
  );
  assert.equal(cancelled, true);
});

test("email validation providers abort promptly when worker shutdown starts", async (t) => {
  await t.test("HTTP", async () => {
    const controller = new AbortController();
    const provider = new HttpEmailValidationProvider({
      url: "https://validator.example/v1/check",
      token: "validator-token",
      timeoutMs: 10_000
    }, {
      signal: controller.signal,
      fetch: async (_url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      })
    });
    const startedAt = Date.now();
    const validation = provider.validate("dj@example.test", "idem-abort");
    controller.abort(new Error("worker shutdown"));
    await assert.rejects(validation, (error) => error.code === "EMAIL_VALIDATION_ABORTED" && error.retryable === true);
    assert.ok(Date.now() - startedAt < 500);
  });

  await t.test("SMTP DNS", async () => {
    const controller = new AbortController();
    const provider = smtpProvider({
      signal: controller.signal,
      totalTimeoutMs: 10_000,
      commandTimeoutMs: 10_000,
      resolveMx: async () => new Promise(() => {})
    });
    const startedAt = Date.now();
    const validation = provider.validate("dj@example.test");
    controller.abort(new Error("worker shutdown"));
    await assert.rejects(validation, (error) => error.code === "EMAIL_VALIDATION_ABORTED" && error.retryable === true);
    assert.ok(Date.now() - startedAt < 500);
  });
});

function smtpProvider(options = {}) {
  return new SmtpMxEmailValidationProvider({
    heloDomain: "outreach.example",
    connectTimeoutMs: options.connectTimeoutMs ?? 100,
    commandTimeoutMs: options.commandTimeoutMs ?? 100,
    totalTimeoutMs: options.totalTimeoutMs ?? 800,
    maxMxHosts: 1
  }, {
    resolveMx: options.resolveMx ?? (async () => [{ exchange: "mx.public.example", priority: 10 }]),
    lookup: options.lookup ?? (async () => [{ address: "127.0.0.1", family: 4 }]),
    createConnection: options.createConnection,
    port: options.port ?? 25,
    allowPrivateAddresses: options.allowPrivateAddresses ?? Boolean(options.port),
    randomBytes: () => Buffer.alloc(12, 7),
    signal: options.signal
  });
}

async function startSmtpServer(scenario) {
  const commands = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    if (!scenario.silent) socket.write("220 mx.public.example ESMTP\r\n");
    let buffer = "";
    let recipient = 0;
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (buffer.includes("\r\n")) {
        const index = buffer.indexOf("\r\n");
        const command = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        commands.push(command);
        if (scenario.silent) continue;
        if (command.startsWith("EHLO ")) socket.write("250-mx.public.example\r\n250 PIPELINING\r\n");
        else if (command === "MAIL FROM:<>") socket.write("250 2.1.0 Sender accepted\r\n");
        else if (command.startsWith("RCPT TO:")) {
          recipient += 1;
          const code = recipient === 1 ? scenario.target : scenario.catchAll;
          socket.write(`${code} ${code >= 500 ? "5.1.1 Rejected" : code >= 400 ? "4.2.0 Temporary" : "2.1.5 Accepted"}\r\n`);
        } else if (command === "RSET") socket.write("250 2.0.0 Reset\r\n");
        else if (command === "QUIT") {
          socket.end("221 2.0.0 Bye\r\n");
        } else socket.write("500 5.5.2 Command rejected\r\n");
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    commands,
    port: address.port,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
