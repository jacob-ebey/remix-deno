import { createRequestHandler } from "remix/server";

import { doBuild } from "./bundle.ts";
import { loadConfig } from "./config.ts";
import { serve } from "./serve.ts";

import * as build from "./remix.gen.ts";

try {
  const config = await loadConfig({ mode: "production" });

  const { assetsManifest, staticAssets } = await doBuild(config);

  const remixRequestHandler = createRequestHandler({
    build: {
      ...build,
      assets: {
        ...assetsManifest,
        url:
          config.publicPath +
          `manifest-${assetsManifest.version.toUpperCase()}.js`,
      },
    },
  });

  await serve({ staticAssets, remixRequestHandler });
} catch (error) {
  console.error(error);
}
