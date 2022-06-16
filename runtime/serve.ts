import { brotliCompress, mediaTypeLookup, server } from "../deps.ts";

export async function serve({
  staticAssets,
  remixRequestHandler,
}: {
  staticAssets: Map<string, string | Uint8Array>;
  remixRequestHandler: (request: Request) => Promise<Response>;
}) {
  const encoder = new TextEncoder();
  for (let [key, asset] of staticAssets) {
    if (typeof asset === "string") {
      asset = encoder.encode(asset);
    }
    staticAssets.set(key, brotliCompress(asset));
  }
  async function requestHandler(
    request: Request
    // connectionInfo: server.ConnInfo
  ) {
    const url = new URL(request.url);
    const staticAsset = staticAssets.get(url.pathname);
    if (typeof staticAsset !== "undefined") {
      const headers = new Headers();
      const contentType = mediaTypeLookup(url.pathname);
      contentType && headers.set("Content-Type", contentType);
      headers.set("Content-Encoding", "br");
      return new Response(staticAsset, { headers });
    }

    try {
      return await remixRequestHandler(request);
    } catch (error) {
      return new Response(String(error), { status: 500 });
    }
  }

  console.log(`Starting server at http://localhost:8000`);
  await server.serve(requestHandler, { port: 8000 });
}
