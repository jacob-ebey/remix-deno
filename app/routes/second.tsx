/** @jsx React.createElement */
import * as React from "react";
import { Link, useLoaderData } from "remix/react";
import type { LoaderFunction } from "remix/server";
import { deferred } from "@remix-run/server-runtime";

import { InlineDeferred } from "../utils.tsx";

export const loader: LoaderFunction = () => {
  return deferred({
    message: "Second",
    extraMessage: new Promise((resolve) =>
      setTimeout(() => resolve("Extra message :D"), 1000)
    ),
  });
};

export default function Index() {
  const { message, extraMessage } = useLoaderData();
  return (
    <main>
      <h1>{message}</h1>
      <p>
        <Link to="/">Home</Link>
      </p>
      <InlineDeferred<string> data={extraMessage} fallback={<p>Loading....</p>}>
        {(extraMessage) => <p>{extraMessage}</p>}
      </InlineDeferred>
    </main>
  );
}
