/** @jsx React.createElement */
/// <reference lib="dom" />
import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { RemixBrowser } from "remix/react";

React.startTransition(() => {
    hydrateRoot(
      document,
      <React.StrictMode>
        <RemixBrowser />
      </React.StrictMode>,
    );
  });
  
