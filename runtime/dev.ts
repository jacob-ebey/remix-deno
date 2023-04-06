import { createRemixRequestHandler, path, server } from "../deps.ts";

import { doBuild } from "./bundle.ts";
import type { RemixConfig } from "./config.ts";
import { loadConfig } from "./config.ts";
import { createRequestHandler } from "./serve.ts";
import { debug } from '../utils/debug.ts';

export async function writeRemixGen(config: RemixConfig) {
  // debug(config)
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
        "." + routeConfig.file.replace(config.rootDirectory, "")
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
}

async function prepareRequestHandlerOptions(
  doImport: (mod: string) => Promise<any>
  ) {
    const config = await loadConfig({ mode: "development" });
    // debug( config);
  
  await writeRemixGen(config);
  const { assetsManifest, staticAssets } = await doBuild(config);

  const routeModules = Object.fromEntries(
    await Promise.all(
      Object.entries(config.routes).map(async ([routeId, route]) => [
        routeId,
        await doImport(path.toFileUrl(route.file).href),
      ])
    )
  );

  const remixRequestHandler = createRemixRequestHandler({
    build: {
      entry: {
        module: await doImport(config.entryServerFile),

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
      assetsBuildDirectory: config.assetsBuildDirectory,
      publicPath: config.publicPath,
      future: config.future,
    },


  });

  return { staticAssets, remixRequestHandler };
}

export async function serveDev(doImport: (mod: string) => Promise<any>) {
  
  const requestHandler = createRequestHandler(
    prepareRequestHandlerOptions(doImport)
  );

  const port = Number(Deno.env.get("PORT") || "8000");
  console.log(`✅ Remix Deno TailwindCSS app is running`);
  await server.serve(requestHandler, { port });
}