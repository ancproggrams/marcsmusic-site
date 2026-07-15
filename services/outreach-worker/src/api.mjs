import { buildServer } from "./interfaces/http/build-server.mjs";

export { buildServer };

export async function startApi(options) {
  const { config, signal, host = "0.0.0.0" } = options;
  const server = await buildServer(options);
  const closeOnAbort = () => {
    server.close().catch((error) => server.log.error({ err: error }, "api_shutdown_failed"));
  };

  if (signal?.aborted) {
    await server.close();
    throw signal.reason ?? new Error("API startup aborted");
  }
  signal?.addEventListener("abort", closeOnAbort, { once: true });

  try {
    await server.listen({ port: config.port, host });
    server.log.info({ host, port: config.port }, "api_listening");
    return server;
  } catch (error) {
    signal?.removeEventListener("abort", closeOnAbort);
    await server.close().catch(() => {});
    throw error;
  }
}
