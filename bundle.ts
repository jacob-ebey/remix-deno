import { esbuild, path } from "./deps.ts";
import type { esbuildTypes } from "./deps.ts";
import { denoPlugin } from "./deno-plugin.ts";
import type { RemixConfig } from "./config.ts";

let esbuildInitialized: boolean | Promise<void> = false;
async function ensureEsbuildInitialized() {
  if (esbuildInitialized === false) {
    if (Deno.run === undefined) {
      esbuildInitialized = esbuild.initialize({
        wasmURL: "https://unpkg.com/esbuild-wasm@0.14.43/esbuild.wasm",
        worker: false,
      });
    } else {
      esbuild.initialize({});
    }
    await esbuildInitialized;
    esbuildInitialized = true;
  } else if (esbuildInitialized instanceof Promise) {
    await esbuildInitialized;
  }
}

export async function doBuild(config: RemixConfig) {
  await ensureEsbuildInitialized();

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

  return { assetsManifest, staticAssets };
}

async function buildClient(config: RemixConfig) {
  const routeExports = await getRouteExports(config);

  const entryPoints: esbuildTypes.BuildOptions["entryPoints"] = {
    "entry.client": path.relative(config.rootDirectory, config.entryClientFile),
  };
  for (const id of Object.keys(config.routes)) {
    // All route entry points are virtual modules that will be loaded by the
    // browserEntryPointsPlugin. This allows us to tree-shake server-only code
    // that we don't want to run in the browser (i.e. action & loader).
    entryPoints[id] =
      (await Deno.realPath(
        path.join(config.appDirectory, config.routes[id].file)
      )) + ".browser-route";
  }

  const buildResult = await esbuild.build({
    absWorkingDir: config.rootDirectory,
    entryPoints,
    outdir: config.assetsBuildDirectory,
    platform: "browser",
    format: "esm",
    metafile: true,
    bundle: true,
    splitting: true,
    mainFields: ["browser", "module", "main"],
    minify: config.mode === "production",
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "_shared/[name]-[hash]",
    assetNames: "_assets/[name]-[hash]",
    publicPath: config.publicPath,
    logLevel: "error",
    define: {
      "process.env.NODE_ENV": JSON.stringify(config.mode),
      "process.env.REMIX_DEV_SERVER_WS_PORT": "null",
    },
    plugins: [
      browserRouteModulesPlugin(config, routeExports, /\.browser-route$/),
      denoPlugin({
        importMapURL: new URL(path.toFileUrl(config.clientImportMap)),
      }),
      // {
      //   name: "deno-read-file",
      //   setup(build) {
      //     build.onLoad({ filter: /.*/ }, async (args) => {
      //       const ext = args.path.split(".").pop() as esbuildTypes.Loader;
      //       const loader = ext?.match(/"j|tsx?$/) ? ext : "ts";
      //       return {
      //         contents: await Deno.readTextFile(args.path),
      //         loader,
      //       };
      //     });
      //   },
      // },
    ],
    write: false,
  });

  return {
    assetsManifest: await generateAssetsManifest(
      config,
      buildResult.metafile!,
      routeExports
    ),
    buildResult,
  };
}

type Route = RemixConfig["routes"][string];

const browserSafeRouteExports: { [name: string]: boolean } = {
  CatchBoundary: true,
  ErrorBoundary: true,
  default: true,
  handle: true,
  links: true,
  meta: true,
  unstable_shouldReload: true,
};

/**
 * This plugin loads route modules for the browser build, using module shims
 * that re-export only the route module exports that are safe for the browser.
 */
function browserRouteModulesPlugin(
  config: RemixConfig,
  routeExports: Record<string, Set<string>>,
  suffixMatcher: RegExp
): esbuildTypes.Plugin {
  return {
    name: "browser-route-modules",
    async setup(build) {
      const routesByFile: Map<string, Route> = new Map();
      for (const key in routeExports) {
        const route = config.routes[key];
        routesByFile.set(
          await Deno.realPath(path.join(config.appDirectory, route.file)),
          route
        );
      }

      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: args.path,
          namespace: "browser-route-module",
          sideEffects: false,
        };
      });

      build.onLoad(
        { filter: suffixMatcher, namespace: "browser-route-module" },
        (args) => {
          let theExports;
          const file = args.path.replace(suffixMatcher, "");
          const route = routesByFile.get(file);

          try {
            if (!route) {
              throw new Error(`Cannot get route by path: ${args.path}`);
            }

            theExports = [...routeExports[route.id]].filter(
              (ex) => !!browserSafeRouteExports[ex]
            );
          } catch (error) {
            return {
              errors: [
                {
                  text: error.message,
                  pluginName: "browser-route-module",
                },
              ],
            };
          }

          let contents = "module.exports = {};";
          if (theExports.length !== 0) {
            const spec = `{ ${theExports.join(", ")} }`;
            contents = `export ${spec} from ${JSON.stringify(
              "./" + path.basename(file)
            )};`;
          }

          return {
            contents,
            resolveDir: path.dirname(file),
            loader: "js",
          };
        }
      );
    },
  };
}

async function getRouteExports(config: RemixConfig) {
  const entryPointsSet = new Set();
  const entryPoints: string[] = [];
  for (const route of Object.values(config.routes)) {
    const entry = await Deno.realPath(
      path.join(config.appDirectory, route.file)
    );
    entryPointsSet.add(entry);
    entryPoints.push(entry);
  }

  const esbuildResult = await esbuild.build({
    sourceRoot: config.appDirectory,
    entryPoints,
    target: "esnext",
    format: "esm",
    bundle: false,
    metafile: true,
    write: false,
    outdir: config.assetsBuildDirectory,
    plugins: [
      {
        name: "all-externals",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (entryPointsSet.has(args.path)) {
              return undefined;
            }

            return {
              path: args.path,
              namespace: "all-externals",
              external: true,
              sideEffects: false,
            };
          });
        },
      },
      // {
      //   name: "deno-read-file",
      //   setup(build) {
      //     build.onLoad({ filter: /.*/ }, async (args) => {
      //       const ext = args.path.split(".").pop() as esbuildTypes.Loader;
      //       const loader = ext?.match(/"j|tsx?$/) ? ext : "ts";
      //       return {
      //         contents: await Deno.readTextFile(args.path),
      //         loader,
      //       };
      //     });
      //   },
      // },
    ],
  });

  if (esbuildResult.errors?.length > 0) {
    throw new Error(
      await (
        await esbuild.formatMessages(esbuildResult.errors, { kind: "error" })
      ).join("\n")
    );
  }

  const exportsMap = Object.values(esbuildResult.metafile!.outputs).reduce(
    (acc, output) => {
      const entrypoint = output.entryPoint
        ?.replace(/^app\//, "")
        .replace(/\.[jt]sx?$/, "");
      if (entrypoint) {
        acc[entrypoint] = new Set(output.exports);
      }
      return acc;
    },
    {} as Record<string, Set<string>>
  );

  return exportsMap;
}

async function generateAssetsManifest(
  config: RemixConfig,
  metafile: esbuildTypes.Metafile,
  routeExports: Record<string, Set<string>>
): Promise<any> {
  const assetsManifest = await createAssetsManifest(
    config,
    metafile,
    routeExports
  );
  const filename = `manifest-${assetsManifest.version.toUpperCase()}.js`;

  assetsManifest.url = config.publicPath + filename;

  return assetsManifest;
}

function createUrl(publicPath: string, file: string): string {
  return publicPath + file.split(path.win32.sep).join("/");
}

async function createAssetsManifest(
  config: RemixConfig,
  metafile: esbuildTypes.Metafile,
  routeExports: Record<string, Set<string>>
): Promise<any> {
  function resolveUrl(outputPath: string): string {
    return createUrl(
      config.publicPath,
      path.relative(config.assetsBuildDirectory, outputPath)
    );
  }

  function resolveImports(
    imports: esbuildTypes.Metafile["outputs"][string]["imports"]
  ): string[] {
    return imports
      .filter((im) => im.kind === "import-statement")
      .map((im) => resolveUrl(im.path));
  }

  const entryClientFile = config.entryClientFile;
  const routesByFile: Map<string, Route> = new Map();
  for (const key in config.routes) {
    const route = config.routes[key];
    routesByFile.set(
      await Deno.realPath(path.join(config.appDirectory, route.file)),
      route
    );
  }

  let entry: any; //AssetsManifest["entry"] | undefined;
  const routes: any = {}; //AssetsManifest["routes"] = {};

  for (const key of Object.keys(metafile.outputs).sort()) {
    const output = metafile.outputs[key];
    if (!output.entryPoint) continue;

    const entryPointFile = output.entryPoint.replace(
      /(^deno:file:\/\/|^browser-route-module:|\.browser-route$)/g,
      ""
    );
    if (entryPointFile === entryClientFile) {
      entry = {
        module: resolveUrl(key),
        imports: resolveImports(output.imports),
      };
      // Only parse routes otherwise dynamic imports can fall into here and fail the build
    } else if (output.entryPoint.startsWith("browser-route-module:")) {
      const route = routesByFile.get(entryPointFile);
      if (!route) {
        throw new Error(
          `Cannot get route for entry point ${output.entryPoint}`
        );
      }
      const sourceExports = routeExports[route.id];
      routes[route.id] = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        module: resolveUrl(key),
        imports: resolveImports(output.imports),
        hasAction: sourceExports.has("action"),
        hasLoader: sourceExports.has("loader"),
        hasCatchBoundary: sourceExports.has("CatchBoundary"),
        hasErrorBoundary: sourceExports.has("ErrorBoundary"),
      };
    }
  }

  if (!entry) {
    throw new Error(`Missing output for entry point`);
  }

  optimizeRoutes(routes, entry.imports);

  const version = hex(
    await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(JSON.stringify({ entry, routes }))
    )
  ).slice(0, 8);

  return { version, entry, routes };
}

function optimizeRoutes(routes: any, entryImports: string[]): void {
  // This cache is an optimization that allows us to avoid pruning the same
  // route's imports more than once.
  const importsCache: any = Object.create(null);

  for (const key in routes) {
    optimizeRouteImports(key, routes, entryImports, importsCache);
  }
}

function optimizeRouteImports(
  routeId: string,
  routes: any,
  parentImports: string[],
  importsCache: any
): string[] {
  if (importsCache[routeId]) return importsCache[routeId];

  const route = routes[routeId];

  if (route.parentId) {
    parentImports = parentImports.concat(
      optimizeRouteImports(route.parentId, routes, parentImports, importsCache)
    );
  }

  const routeImports = (route.imports || []).filter(
    (url: any) => !parentImports.includes(url)
  );

  // Setting `route.imports = undefined` prevents `imports: []` from showing up
  // in the manifest JSON when there are no imports.
  route.imports = routeImports.length > 0 ? routeImports : undefined;

  // Cache so the next lookup for this route is faster.
  importsCache[routeId] = routeImports;

  return routeImports;
}

function hex(buffer: ArrayBuffer) {
  const hexCodes = [];
  const view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    const value = view.getUint32(i);
    // toString(16) will give the hex representation of the number without padding
    const stringValue = value.toString(16);
    // We use concatenation and slice for padding
    const padding = "00000000";
    const paddedValue = (padding + stringValue).slice(-padding.length);
    hexCodes.push(paddedValue);
  }
  // Join all the hex strings into one

  return hexCodes.join("");
}
