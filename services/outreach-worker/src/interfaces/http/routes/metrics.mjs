import { safeEqualText } from "../../../infrastructure/crypto-box.mjs";
import { HttpError } from "../http-error.mjs";

export function registerMetricsRoute(server, { config, metrics }) {
  server.get("/metrics", async (request, reply) => {
    const authorization = request.headers.authorization;
    const suppliedToken = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!suppliedToken || !safeEqualText(suppliedToken, config.metricsToken)) {
      metrics.increment("outreach_http_authentication_failures_total", { endpoint: "metrics" });
      reply.header("www-authenticate", "Bearer");
      throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
    }
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(metrics.render());
  });
}
