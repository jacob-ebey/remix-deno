import * as entryModule from "./app/entry.server.tsx";
import * as route0 from "./app/routes/index.tsx"
import * as route1 from "./app/routes/second.tsx"
import * as route2 from "./app/root.tsx"
export const entry = { module: entryModule };
export const routes = {
  ["routes/index"]: {
    caseSensitive: undefined,
    id: "routes/index",
    index: true,
    parentId: "root",
    path: undefined,
    module: route0,
  },
  ["routes/second"]: {
    caseSensitive: undefined,
    id: "routes/second",
    index: undefined,
    parentId: "root",
    path: "second",
    module: route1,
  },
  ["root"]: {
    caseSensitive: undefined,
    id: "root",
    index: undefined,
    parentId: undefined,
    path: "",
    module: route2,
  }
};
