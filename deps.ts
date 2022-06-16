// -- std libs --
import * as path from "https://deno.land/std@0.143.0/path/mod.ts";
export { path };
export * as server from "https://deno.land/std@0.143.0/http/server.ts";

// -- media types --
export { lookup as mediaTypeLookup } from "https://deno.land/x/media_types@v2.10.2/mod.ts";
export { compress as brotliCompress } from "https://deno.land/x/brotli@v0.1.4/mod.ts";

// -- esbuild --
// @deno-types="https://deno.land/x/esbuild@v0.14.39/mod.d.ts"
import esbuildWasm from "https://esm.sh/esbuild-wasm@0.14.39/lib/browser.js?pin=v86&target=deno";
import * as esbuildNative from "https://deno.land/x/esbuild@v0.14.39/mod.js";
// @ts-ignore trust me
const esbuild: typeof esbuildWasm =
  Deno.run === undefined ? esbuildWasm : esbuildNative;
export { esbuild, esbuildWasm as esbuildTypes };
// export { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.5.0/mod.ts";
// export { cache as esbuildCache } from "https://deno.land/x/esbuild_plugin_cache/mod.ts";
// export { cache as esbuildCache } from "https://esm.sh/esbuild-plugin-cache@0.2.9?pin=v86&target=deno";
// export * as importMaps from "https://esm.sh/esbuild-plugin-import-map@2.1.0?pin=v86&target=deno";

// -- @remix-run/xxx --
export { defineRoutes as remixDefineRoutes } from "https://esm.sh/@remix-run/dev@1.6.0/config/routes?pin=v86&deps=esbuild@0.14.39&target=deno";
export { createRequestHandler as createRemixRequestHandler } from "https://esm.sh/@remix-run/deno@1.6.0/index.ts?pin=v86&target=deno&deps=react@18.2.0";

// -- remix-flat-routes --
// export { default as remixFlatRoutes } from "https://esm.sh/remix-flat-routes@0.4.3?pin=v86&target=deno";
