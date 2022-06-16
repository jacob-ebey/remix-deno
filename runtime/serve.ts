import { mediaTypeLookup, server } from "../deps.ts";

export async function serve({
  staticAssets,
  remixRequestHandler,
}: {
  staticAssets: Map<string, string>;
  remixRequestHandler: (request: Request) => Promise<Response>;
}) {
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
