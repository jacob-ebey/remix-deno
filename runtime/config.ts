import { path, remixDefineRoutes } from "../deps.ts";
import { debug } from "../utils/debug.ts";
import { flatRoutes as remixFlatRoutes } from "./flat-routes.ts";

const ENTRY_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

type Dev = {
  port?: number;
  appServerPort?: number;
  remixRequestHandlerPath?: string;
  rebuildPollIntervalMs?: number;
};
export type VanillaExtractOptions = {
  cache?: boolean;
};

interface FutureConfig {
  unstable_cssModules: boolean;
  unstable_cssSideEffectImports: boolean;
  unstable_dev: boolean | Dev;
  /** @deprecated Use the `postcss` config option instead */
  unstable_postcss: boolean;
  /** @deprecated Use the `tailwind` config option instead */
  unstable_tailwind: boolean;
  unstable_vanillaExtract: boolean | VanillaExtractOptions;
  v2_errorBoundary: boolean;
  v2_meta: boolean;
  v2_normalizeFormMethod: boolean;
  v2_routeConvention: boolean;
}

export type RemixConfig = {
  appDirectory: string;
  assetsBuildDirectory: string;
  clientImportMap: string;
  entryClientFile: string;
  entryServerFile: string;
  mode: "development" | "production";
  publicPath: string;
  rootDirectory: string;
  routes: ReturnType<typeof remixDefineRoutes>;
  future: FutureConfig;
};

export async function loadConfig({
  mode,
}: {
  mode: "development" | "production";
}): Promise<RemixConfig> {
  mode = mode === "development" ? "development" : "production";
  const rootDirectory = Deno.cwd();
  const appDirectory = path.join(rootDirectory, "app");
  const assetsBuildDirectory = path.join(rootDirectory, "public/build");
  const entryClientFile = await findFile(
    appDirectory,
    "entry.client",
    ENTRY_EXTENSIONS,
  );
  // debug(entryClientFile);
  if (!entryClientFile) {
    throw new Error("Could not find client entry file");
  }
  const entryServerFile = await findFile(
    appDirectory,
    "entry.server",
    ENTRY_EXTENSIONS
  );
  if (!entryServerFile) {
    throw new Error("Could not find server entry file");
  }

  const rootRouteFile = await findFile(appDirectory, "root", ENTRY_EXTENSIONS);
  if (!rootRouteFile) {
    throw new Error("No root route file found");
  }
  let routes: ReturnType<typeof remixDefineRoutes> = (await remixFlatRoutes(
    path.join(appDirectory, "routes"),
    remixDefineRoutes
  )) as any;
  routes = Object.entries(routes).reduce(
    (acc, [routeId, route]) => ({
      ...acc,
      [routeId.replace(appDirectory + "/", "")]: {
        ...route,
        id: routeId.replace(appDirectory + "/", ""),
      },
    }),
    {}
  );
  routes.root = {
    path: "",
    id: "root",
    file: rootRouteFile,
  };

  const clientImportMap = await findFile(
    rootDirectory,
    "import_map.client",
    mode === "development" ? [".dev.json", ".json"] : [".json"]

  );
  if (!clientImportMap) {
    throw new Error("Could not find client import map");
  }
  
  const future: FutureConfig = {
    unstable_cssModules: true,
    unstable_cssSideEffectImports: true,
    unstable_dev: false,
    unstable_postcss: true,
    unstable_tailwind:true,
    unstable_vanillaExtract: false,
    v2_errorBoundary:true,
    v2_meta: true,
    v2_normalizeFormMethod:true,
    v2_routeConvention:true,
  };

  return {
    appDirectory,
    assetsBuildDirectory,
    entryClientFile,
    entryServerFile,
    clientImportMap,
    mode,
    publicPath: `${rootDirectory}/build/`,
    rootDirectory,
    routes,
    future,
  };
}

export async function findFile(
  searchDir: string,
  baseName: string,
  extensions: string[]
) {
  for (const extension of extensions) {
    const filePath = await path.join(searchDir, baseName + extension);
    if (
      await Deno.stat(filePath)
        .then((s) => s.isFile)
        .catch(() => false)
    ) {
      return filePath;
    }
  }
}
