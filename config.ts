import { path, remixDefineRoutes } from "./deps.ts";
import { flatRoutes as remixFlatRoutes } from "./flat-routes.ts";

const ENTRY_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

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
    ENTRY_EXTENSIONS
  );
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
  const routes: ReturnType<typeof remixDefineRoutes> = (await remixFlatRoutes(
    "routes",
    remixDefineRoutes
  )) as any;
  routes.root = {
    path: "",
    id: "root",
    file: path.relative(appDirectory, rootRouteFile),
  };

  const clientImportMap = await findFile(
    rootDirectory,
    "import_map.client",
    mode === "development" ? [".dev.json", ".json"] : [".json"]
  );
  if (!clientImportMap) {
    throw new Error("Could not find client import map");
  }

  return {
    appDirectory,
    assetsBuildDirectory,
    entryClientFile,
    entryServerFile,
    clientImportMap,
    mode,
    publicPath: "/build/",
    rootDirectory,
    routes,
  };
}

export async function findFile(
  searchDir: string,
  baseName: string,
  extensions: string[]
) {
  for (const extension of extensions) {
    const filePath = path.join(searchDir, baseName + extension);
    if (
      await Deno.stat(filePath)
        .then((s) => s.isFile)
        .catch(() => false)
    ) {
      return filePath;
    }
  }
}
