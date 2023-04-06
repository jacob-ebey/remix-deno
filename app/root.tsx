/** @jsx React.createElement */
import * as React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "remix/react";
import type { MetaFunction, LinksFunction } from "remix/server";
// deno doesn't understand css modules yet
// todo: deno errors out here
// import classes  from "./styles/tailwind.module.css";

//todo: convert meta to v2
export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

// todo: Fix link function which failing to import tailwindcss
// export const links: LinksFunction = () => {
//   return [{rel: "stylesheet", href:classes}]
// };
export default function App() {
  return (
    <html lang="en">
      <head>
        {/* <Meta /> */}
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
