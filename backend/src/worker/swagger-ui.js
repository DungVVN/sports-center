import { env } from "cloudflare:workers";

const files = new Set(["swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js"]);
const init = 'window.onload = () => { window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui", presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: "StandaloneLayout" }); };';

async function serve(request, response, next) {
  const file = request.path.replace(/^\//, "");
  if (file === "swagger-ui-init.js") return response.type("application/javascript").send(init);
  if (!files.has(file)) return next();
  try {
    const url = new URL(`https://assets.invalid/${file}`);
    const asset = await env.ASSETS.fetch(new Request(url));
    if (!asset.ok) return response.sendStatus(404);
    response.type(asset.headers.get("Content-Type") || "application/octet-stream").send(Buffer.from(await asset.arrayBuffer()));
  } catch (error) { next(error); }
}

function setup() {
  return (_request, response) => response.type("html").send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sports Center API</title><link rel="stylesheet" href="/api-docs/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/api-docs/swagger-ui-bundle.js"></script><script src="/api-docs/swagger-ui-standalone-preset.js"></script><script src="/api-docs/swagger-ui-init.js"></script></body></html>');
}

export default { serve, setup };
