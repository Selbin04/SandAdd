import path from "path";
import { pathToFileURL } from "url";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 5000;
const isEntrypoint = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isEntrypoint) {
  createApp({ allowMemory: true })
    .then((app) => {
      app.listen(PORT, () => {
        console.log(`Hourglass API running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Could not start Hourglass API", error);
      process.exitCode = 1;
    });
}
