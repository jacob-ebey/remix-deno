import { serveDev } from "./mod.ts";

await serveDev((mod) => import(mod));
