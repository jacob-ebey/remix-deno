// -- std libs --
import * as path from "https://deno.land/std@0.182.0/path/mod.ts";
export { path };
export * as server from "https://deno.land/std@0.182.0/http/server.ts";

// -- media types --
import { contentType }from "https://deno.land/std@0.182.0/media_types/mod.ts";
export const mediaTypeLookup = contentType;

// -- esbuild --
// @deno-types="https://deno.land/x/esbuild@v0.17.15/mod.d.ts"
import esbuildWasm from "https://esm.sh/esbuild-wasm@0.17.15/lib/browser.js?pin=v86&target=deno";
import * as esbuildNative from "https://deno.land/x/esbuild@v0.17.15/mod.js";
// @ts-ignore trust me
const esbuild: typeof esbuildWasm =
  Deno.run === undefined ? esbuildWasm : esbuildNative;
export { esbuild, esbuildWasm as esbuildTypes };
// export { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.5.0/mod.ts";
// export { cache as esbuildCache } from "https://deno.land/x/esbuild_plugin_cache/mod.ts";
// export { cache as esbuildCache } from "https://esm.sh/esbuild-plugin-cache@0.2.9?pin=v86&target=deno";
// export * as importMaps from "https://esm.sh/esbuild-plugin-import-map@2.1.0?pin=v86&target=deno";

// -- @remix-run/xxx --
import { defineRoutes as remixDefineRoutes } from "https://esm.sh/@remix-run/dev@1.6.0/config/routes?pin=v86&deps=esbuild@v0.17.15&target=deno";
export { remixDefineRoutes };
export { createRequestHandler as createRemixRequestHandler } from "https://esm.sh/@remix-run/deno@1.15.0/index.ts?pin=v86&target=deno&deps=react@18.2.0";
export type { AppLoadContext } from "https://esm.sh/@remix-run/deno@1.15.0/index.ts?pin=v86&target=deno&deps=react@18.2.0";

// -- remix-flat-routes --
// export { default as remixFlatRoutes } from "https://esm.sh/remix-flat-routes@0.4.3?pin=v86&target=deno";
