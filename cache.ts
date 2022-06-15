import * as Cache from "https://deno.land/x/cache@0.2.13/mod.ts";
import { resolve } from "https://deno.land/x/importmap@0.1.4/mod.ts";
import { join } from "https://deno.land/std@0.97.0/path/mod.ts";
import type { esbuildTypes } from "./deps.ts";

//prettier-ignore
type Loader = 'js' | 'jsx' | 'ts' | 'tsx' | 'css' | 'json' | 'text' | 'base64' | 'file' | 'dataurl' | 'binary' | 'default';

interface Config {
  importmap: { imports: { [key: string]: string } };
  directory: string;
}

export function cache({
  importmap = { imports: {} },
  directory,
}: Config): esbuildTypes.Plugin {
  Cache.configure({ directory });
  return {
    name: "deno-cache",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const resolvedPath = resolve(args.path, importmap);
        if (resolvedPath.startsWith("http")) {
          return {
            path: resolvedPath,
            namespace: "deno-cache",
          };
        }
        if (args.namespace === "deno-cache") {
          return {
            path: new URL(resolvedPath, args.importer).toString(),
            namespace: "deno-cache",
            sideEffects: false,
          };
        }
        return {
          path: join(args.resolveDir, resolvedPath),
          sideEffects: false,
        };
      });
      build.onLoad({ filter: /.*/, namespace: "deno-cache" }, async (args) => {
        const file = await Cache.cache(args.path, undefined, "deps");
        const contents = await Deno.readTextFile(file.path);
        const ext = file.meta.url.split(".").pop() as Loader;
        const loader = ext.match(/"j|tsx?$/) ? ext : "ts";
        return { contents, loader };
      });
    },
  };
}
