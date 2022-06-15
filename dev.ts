import { createRequestHandler } from "remix/server";

import { buildClient } from "./bundle.ts";
import { loadConfig } from "./config.ts";
import { mediaTypeLookup, path, server } from "./deps.ts";

const config = await loadConfig({ mode: "development" });

const routeModules = Object.fromEntries(
  await Promise.all(
    Object.entries(config.routes).map(async ([routeId, route]) => [
      routeId,
      await import(path.resolve(config.appDirectory, route.file)),
    ])
  )
);

const {
  buildResult,
  assetsManifest: { url: assetsManifestUrl, ...assetsManifest },
} = await buildClient(config);

const staticAssets = new Map(
  buildResult.outputFiles.map((file) => [
    config.publicPath +
      path
        .relative(config.assetsBuildDirectory, file.path)
        .replaceAll(path.SEP, "/"),
    file.text,
  ])
);
staticAssets.set(
  assetsManifestUrl,
  `window.__remixManifest=${JSON.stringify(assetsManifest)};`
);

const remixRequestHandler = createRequestHandler({
  build: {
    entry: {
      module: await import(config.entryServerFile),
    },
    routes: Object.entries(config.routes).reduce(
      (acc, [routeId, routeConfig]) => {
        return Object.assign(acc, {
          [routeId]: {
            caseSensitive: routeConfig.caseSensitive,
            id: routeConfig.id,
            index: routeConfig.index,
            parentId: routeConfig.parentId,
            path: routeConfig.path,
            module: routeModules[routeId],
          },
        });
      },
      {}
    ),
    assets: {
      ...assetsManifest,
      url:
        config.publicPath +
        `manifest-${assetsManifest.version.toUpperCase()}.js`,
    },
  },
});

async function requestHandler(
  request: Request
  // connectionInfo: server.ConnInfo
) {
  const url = new URL(request.url);
  const staticAsset = staticAssets.get(url.pathname);
  if (staticAsset) {
    const headers = new Headers();
    const contentType = mediaTypeLookup(url.pathname);
    contentType && headers.set("Content-Type", contentType);
    return new Response(staticAsset, { headers });
  }

  try {
    return await remixRequestHandler(request);
  } catch (error) {
    return new Response(String(error), { status: 500 });
  }
}

console.log("Starting server at http://localhost:3000");
await server.serve(requestHandler, { port: 3000 });
