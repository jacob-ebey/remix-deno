import { path } from "./deps.ts";

function getRouteSegments(name: string) {
  const routeSegments: string[] = [];
  let index = 0;
  let routeSegment = "";
  let state = "START";
  let subState = "NORMAL";

  const pushRouteSegment = (routeSegment: string) => {
    if (routeSegment) {
      routeSegments.push(routeSegment);
    }
  };

  while (index < name.length) {
    const char = name[index];
    switch (state) {
      case "START":
        // process existing segment
        pushRouteSegment(routeSegment);
        routeSegment = "";
        state = "PATH";
        continue; // restart without advancing index
      case "PATH":
        if (isPathSeparator(char) && subState === "NORMAL") {
          state = "START";
          break;
        } else if (char === "[") {
          subState = "ESCAPE";
          break;
        } else if (char === "]") {
          subState = "NORMAL";
          break;
        }
        routeSegment += char;
        break;
    }
    index++; // advance to next character
  }
  // process remaining segment
  pushRouteSegment(routeSegment);

  return routeSegments;
}

function isPathSeparator(char: string) {
  return char === "/" || char === path.win32.sep || char === ".";
}

const visitFiles: VisitFilesFunction = async (
  dir: string,
  visitor: (file: string) => void,
  baseDir = dir
) => {
  for await (const dirEntry of Deno.readDir(dir)) {
    const file = path.join(dir, dirEntry.name);

    if (dirEntry.isDirectory) {
      await visitFiles(file, visitor, baseDir);
    } else if (dirEntry.isFile) {
      visitor(path.relative(baseDir, file));
    }
  }
};

type RouteInfo = {
  path: string;
  file: string;
  name: string;
  parentId?: string; // first pass parent is undefined
  index?: boolean;
  caseSensitive?: boolean;
};
interface RouteManifest {
  [key: string]: RouteInfo;
}

type DefineRouteOptions = {
  caseSensitive?: boolean;
  index?: boolean;
};

type DefineRouteChildren = {
  (): void;
};

type DefineRouteFunction = (
  path: string | undefined,
  file: string,
  optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
  children?: DefineRouteChildren
) => void;

export type VisitFilesFunction = (
  dir: string,
  visitor: (file: string) => void,
  baseDir?: string
) => Promise<void>;

type FlatRoutesOptions = {
  basePath?: string;
  visitFiles?: VisitFilesFunction;
};

type ParentMapEntry = {
  routeInfo: RouteInfo;
  children: RouteInfo[];
};

export type DefineRoutesFunction = (
  callback: (route: DefineRouteFunction) => void
) => any;

export default async function flatRoutes(
  baseDir: string,
  defineRoutes: DefineRoutesFunction,
  options: FlatRoutesOptions = {}
): Promise<RouteManifest> {
  const routeMap = new Map<string, RouteInfo>();
  const parentMap = new Map<string, ParentMapEntry>();
  const visitor = options?.visitFiles || visitFiles;

  // initialize root route
  routeMap.set("root", {
    path: "",
    file: "root.tsx",
    name: "root",
    parentId: "",
    index: false,
  });
  await visitor(`app/${baseDir}`, (routeFile: string) => {
    const routeInfo = getRouteInfo(baseDir, routeFile, options.basePath);
    if (!routeInfo) return;
    routeMap.set(routeInfo.name, routeInfo);
  });
  const routes = defineRoutes((route) => {
    // setup parent map
    for (const [name, route] of routeMap) {
      if (name === "root") continue;
      const parentRoute = getParentRoute(routeMap, name);
      if (parentRoute) {
        let parent = parentMap.get(parentRoute);
        if (!parent) {
          parent = {
            routeInfo: routeMap.get(parentRoute)!,
            children: [],
          };
          parentMap.set(parentRoute, parent);
        }
        parent.children.push(route);
      }
    }
    // start with root
    getRoutes(parentMap, "root", route);
  });
  // don't return root since remix already provides it
  if (routes) {
    delete routes.root;
  }
  return routes;
}

function getParentRoute(
  routeMap: Map<string, RouteInfo>,
  name: string
): string | null {
  var parentName = name.substring(0, name.lastIndexOf("."));
  if (parentName === "") {
    return "root";
  }
  if (routeMap.has(parentName)) {
    return parentName;
  }
  return getParentRoute(routeMap, parentName);
}

function getRoutes(
  parentMap: Map<string, ParentMapEntry>,
  parent: string,
  route: DefineRouteFunction
) {
  const parentRoute = parentMap.get(parent);
  if (parentRoute && parentRoute.children) {
    const routeOptions: DefineRouteOptions = {
      caseSensitive: false,
      index: parentRoute!.routeInfo.index,
    };
    const routeChildren: DefineRouteChildren = () => {
      for (const child of parentRoute!.children) {
        getRoutes(parentMap, child.name, route);
        const path = child.path.substring(
          parentRoute!.routeInfo.path.length + 1
        );
        route(path, child.file, { index: child.index });
      }
    };
    route(
      parentRoute.routeInfo.path,
      parentRoute.routeInfo.file,
      routeOptions,
      routeChildren
    );
  }
}

export function getRouteInfo(
  baseDir: string,
  routeFile: string,
  basePath?: string
): RouteInfo | null {
  let url = basePath ?? "";
  // get extension
  const ext = path.extname(routeFile);
  // only process valid route files
  if (![".js", ".jsx", ".ts", ".tsx", ".md", ".mdx"].includes(ext)) {
    return null;
  }
  // remove extension from name and normalize path separators
  let name = routeFile
    .substring(0, routeFile.length - ext.length)
    .replace(path.win32.sep, "/");
  if (name.includes("/")) {
    // route flat-folder so only process index/layout routes
    if (
      ["/index", "/_index", "/_layout", "/_route", ".route"].every(
        (suffix) => !name.endsWith(suffix)
      )
    ) {
      // ignore non-index routes
      return null;
    }
    if (name.endsWith(".route")) {
      // convert docs/readme.route to docs.readme/_index
      name = name.replace(/[\/\\]/g, ".").replace(/\.route$/, "/_index");
    }
    name = path.dirname(name);
  }

  const routeSegments = getRouteSegments(name);
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    url = appendPathSegment(url, routeSegment);
  }
  return {
    path: url,
    file: path.join(baseDir, routeFile),
    name,
    //parent: parent will be calculated after all routes are defined,
    index:
      routeSegments.at(-1) === "index" || routeSegments.at(-1) === "_index",
  };
}

function appendPathSegment(url: string, segment: string) {
  if (segment) {
    if (["index", "_index"].some((name) => segment === name)) {
      // index routes don't affect the the path
      return url;
    }

    if (segment.startsWith("_")) {
      // handle pathless route (not included in url)
      return url;
    }
    if (segment.endsWith("_")) {
      // handle parent override
      segment = segment.substring(0, segment.length - 1);
    }
    if (segment.startsWith("$")) {
      // handle params
      segment = segment === "$" ? "*" : `:${segment.substring(1)}`;
    }
    url += "/" + segment;
  }
  return url;
}

export { flatRoutes };
export type {
  DefineRouteFunction,
  DefineRouteOptions,
  DefineRouteChildren,
  RouteManifest,
  RouteInfo,
};
