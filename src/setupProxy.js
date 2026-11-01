const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

function normalizeTarget(raw) {
  return String(raw || "").trim().replace(/\/$/, "");
}

function clearServerCache() {
  const marker = `${path.sep}server${path.sep}`;
  Object.keys(require.cache).forEach((id) => {
    if (id.includes(marker)) delete require.cache[id];
  });
}

module.exports = function setupProxy(app) {
  const target = normalizeTarget(
    process.env.REACT_APP_ALYSON_HR_API_BASE_URL || "https://alyson-client.vercel.app"
  );
  const timeDoctorTarget = normalizeTarget(
    process.env.REACT_APP_TIME_DOCTOR_API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL_TIMEDOCTOR ||
      "https://webapi.timedoctor.com/v1.1"
  );

  // Never use env-cmd-mangled inline JSON — reload server handlers on every request.
  app.use("/__alyson_analytics", (req, res) => {
    clearServerCache();
    const { handleAnalyticsRequest } = require("../server/alysonAnalyticsRoutes");
    handleAnalyticsRequest(req, res);
  });

  app.use("/__pulse_aws_costs", (req, res) => {
    clearServerCache();
    const { handleAwsCostQuery } = require("../server/awsCostQueryRoutes");
    handleAwsCostQuery(req, res);
  });

  app.use("/__session_api", (req, res) => {
    clearServerCache();
    const { handleSessionApiRequest } = require("../server/sessionApiRoutes");
    handleSessionApiRequest(req, res);
  });

  // eslint-disable-next-line no-console
  console.log("[setupProxy] Alyson analytics dev API mounted at /__alyson_analytics");
  // eslint-disable-next-line no-console
  console.log("[setupProxy] Pulse AWS cost query mounted at /__pulse_aws_costs");
  // eslint-disable-next-line no-console
  console.log("[setupProxy] Session Explorer API mounted at /__session_api");

  app.use(
    "/__alyson_proxy",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/__alyson_proxy": "" },
      logLevel: "silent",
    })
  );

  app.use(
    "/__timedoctor_proxy",
    createProxyMiddleware({
      target: timeDoctorTarget,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/__timedoctor_proxy": "" },
      logLevel: "silent",
    })
  );
};
