import { readFile, writeFile } from "node:fs/promises";

const environmentPath = new URL("../src/environments/environment.prod.ts", import.meta.url);
const apiBaseUrl = process.env.VITE_API_BASE_URL;

if (apiBaseUrl) {
  const source = await readFile(environmentPath, "utf8");
  const updated = source.replace(
    '"API_BASE_URL_PLACEHOLDER"',
    JSON.stringify(apiBaseUrl)
  );
  await writeFile(environmentPath, updated, "utf8");
}
