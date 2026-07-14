const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const staticDirectories = ["assets", "css", "icons"];
const staticFiles = ["_headers", "manifest.webmanifest", "service-worker.js"];

for (const directory of staticDirectories) {
  fs.cpSync(path.join(projectRoot, directory), path.join(outputDirectory, directory), {
    recursive: true,
  });
}

for (const file of staticFiles) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(outputDirectory, file));
}

fs.copyFileSync(
  path.join(outputDirectory, "index.html"),
  path.join(outputDirectory, "404.html"),
);

console.log("Static application resources copied to dist.");
