import { serveProd } from "./mod.ts";
import * as remixGen from "./remix.gen.ts";

await serveProd(remixGen);
