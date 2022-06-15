import { createRequestHandler } from "remix/server";

import { doBuild } from "./bundle.ts";
import { loadConfig } from "./config.ts";
import { path } from "./deps.ts";
import { serve } from "./serve.ts";

const config = await loadConfig({ mode: "development" });

const { assetsManifest, staticAssets } = await doBuild(config);

const routeEntries = Object.values(config.routes);
await Deno.writeTextFile(
  path.join(config.rootDirectory, "remix.gen.ts"),
  `import * as entryModule from ${JSON.stringify(
    "./" + path.relative(config.rootDirectory, config.entryServerFile)
  )};
${routeEntries
  .map(
    (routeConfig, index) =>
      `import * as route${index} from ${JSON.stringify(
        "./" +
          path.relative(
            config.rootDirectory,
            path.join(config.appDirectory, routeConfig.file)
          )
      )}`
  )
  .join("\n")}
export const entry = { module: entryModule };
export const routes = {
  ${routeEntries
    .map((routeConfig, index) =>
      `
  [${JSON.stringify(routeConfig.id)}]: {
    caseSensitive: ${JSON.stringify(routeConfig.caseSensitive)},
    id: ${JSON.stringify(routeConfig.id)},
    index: ${JSON.stringify(routeConfig.index)},
    parentId: ${JSON.stringify(routeConfig.parentId)},
    path: ${JSON.stringify(routeConfig.path)},
    module: route${index},
  }
    `.trim()
    )
    .join(",\n  ")}
};
`
);

const routeModules = Object.fromEntries(
  await Promise.all(
    Object.entries(config.routes).map(async ([routeId, route]) => [
      routeId,
      await import(path.join(config.appDirectory, route.file)),
    ])
  )
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

await serve({ staticAssets, remixRequestHandler });
