/** @jsx React.createElement */
import * as React from "react";
import * as ReactDOM from "react-dom/server";
import { RemixServer } from "remix/react";
import type { EntryContext } from "remix/server";
import isbot from "isbot";

export default async function handleDocumentRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const body = await ReactDOM.renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  const userAgent = request.headers.get("User-Agent");
  if (userAgent && isbot(userAgent)) {
    await body.allReady;
  }

  const headers = new Headers(responseHeaders);
  headers.set("Content-Type", "text/html");
  headers.set("Content-Encoding", "chunked");

  return new Response(body, {
    headers,
    status: responseStatusCode,
  });
}
