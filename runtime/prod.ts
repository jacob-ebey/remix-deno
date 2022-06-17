import { createRemixRequestHandler, server } from "../deps.ts";

import { doBuild } from "./bundle.ts";
import { loadConfig } from "./config.ts";
import { createRequestHandler } from "./serve.ts";

async function prepareRequestHandlerOptions(remixGen: any) {
  const config = await loadConfig({ mode: "production" });

  const { assetsManifest, staticAssets } = await doBuild(config);

  const remixRequestHandler = createRemixRequestHandler({
    build: {
      ...remixGen,
      assets: {
        ...assetsManifest,
        url:
          config.publicPath +
          `manifest-${assetsManifest.version.toUpperCase()}.js`,
      },
    },
  });

  return { staticAssets, remixRequestHandler };
}

export async function serveProd(remixGen: any) {
  const requestHandler = createRequestHandler(
    prepareRequestHandlerOptions(remixGen)
  );

  const port = Number(Deno.env.get("PORT") || "8000");
  await server.serve(requestHandler, { port });
}
