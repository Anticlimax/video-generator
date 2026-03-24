import { resolveRuntimeConfig } from "../../../../src/core/config/runtime-config.js";
import { createRandomizeThemeStyleApiHandlers } from "../../../../src/core/jobs/randomize-api.js";

const api = createRandomizeThemeStyleApiHandlers({
  runtimeConfig: resolveRuntimeConfig(process.env)
});

export async function POST() {
  return api.post();
}
