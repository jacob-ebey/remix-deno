import { createRemixRequestHandler } from "../deps.ts";

import { doBuild } from "./bundle.ts";
import { loadConfig } from "./config.ts";
import { serve } from "./serve.ts";

export async function serveProd(remixGen: any) {
  const config = await loadConfig({ mode: "production" });
  for await (const item of await Deno.readDir(config.appDirectory)) {
    console.log(item);
  }

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

  await serve({ staticAssets, remixRequestHandler });
}
