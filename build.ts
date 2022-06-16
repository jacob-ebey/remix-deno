import { loadConfig, writeRemixGen } from "./mod.ts";

const config = await loadConfig({ mode: "production" });
await writeRemixGen(config);
