import type { esbuildTypes } from "../deps.ts";
import { path } from "../deps.ts";
// TODO: Mange these deps elsewhere
import {
  ImportMap,
  resolveImportMap,
  resolveModuleSpecifier,
  toFileUrl,
} from "https://deno.land/x/esbuild_deno_loader@0.6.0/deps.ts";
import { load as nativeLoad } from "https://deno.land/x/esbuild_deno_loader@0.6.0/src/native_loader.ts";
// import { load as portableLoad } from "https://deno.land/x/esbuild_deno_loader@0.6.0/src/portable_loader.ts";
import * as esbuildDenoLoader from "https://deno.land/x/esbuild_deno_loader@0.6.0/src/portable_loader.ts";
const portableLoad = esbuildDenoLoader.load;
import { ModuleEntry } from "https://deno.land/x/esbuild_deno_loader@0.6.0/src/deno.ts";

export interface DenoPluginOptions {
  /**
   * Specify the URL to an import map to use when resolving import specifiers.
   * The URL must be fetchable with `fetch`.
   */
  importMapURL?: URL;
  /**
   * Specify which loader to use. By default this will use the `native` loader,
   * unless `Deno.run` is not available.
   *
   * - `native`:     Shells out to the Deno execuatble under the hood to load
   *                 files. Requires --allow-read and --allow-run.
   * - `portable`:   Do module downloading and caching with only Web APIs.
   *                 Requires --allow-net.
   */
  loader?: "native" | "portable";
}

/** The default loader to use. */
export const DEFAULT_LOADER: "native" | "portable" =
  typeof Deno.run === "function" ? "native" : "portable";

export function denoPlugin(
  options: DenoPluginOptions = {}
): esbuildTypes.Plugin {
  const loader = options.loader ?? DEFAULT_LOADER;
  return {
    name: "deno",
    setup(build) {
      const infoCache = new Map<string, ModuleEntry>();
      let importMap: ImportMap | null = null;

      build.onStart(async function onStart() {
        if (options.importMapURL !== undefined) {
          const resp = await fetch(options.importMapURL.href);
          const txt = await resp.text();
          importMap = resolveImportMap(JSON.parse(txt), options.importMapURL);
        } else {
          importMap = null;
        }
      });

      build.onResolve(
        { filter: /.*/ },
        function onResolve(
          args: esbuildTypes.OnResolveArgs
        ): esbuildTypes.OnResolveResult | null | undefined {
          const resolveDir = args.resolveDir
            ? `${toFileUrl(args.resolveDir).href}/`
            : "";
          let referrer = args.importer || resolveDir;
          if (referrer.startsWith("/")) {
            referrer = path.toFileUrl(referrer).href;
          }
          let resolved: URL;
          if (importMap !== null) {
            const res = resolveModuleSpecifier(
              args.path,
              importMap,
              new URL(referrer) || undefined
            );
            resolved = new URL(res);
          } else {
            resolved = new URL(args.path, referrer);
          }
          return { path: resolved.href, namespace: "deno", sideEffects: false };
        }
      );

      build.onLoad(
        { filter: /.*/ },
        function onLoad(
          args: esbuildTypes.OnLoadArgs
        ): Promise<esbuildTypes.OnLoadResult | null> {
          let url;
          try {
            url = new URL(args.path);
          } catch {
            url = path.toFileUrl(args.path);
          }

          switch (loader) {
            case "native":
              return nativeLoad(infoCache, url, options);
            case "portable":
              return portableLoad(url, options);
          }
        }
      );
    },
  };
}
