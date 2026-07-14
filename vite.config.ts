import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

function git(command: string[]): string | null {
  try {
    return execFileSync("git", command, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export default defineConfig(() => {
  const fullCommit =
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.COMMIT_SHA ??
    git(["rev-parse", "HEAD"]) ??
    "unknown";
  const dirty = process.env.CI ? false : Boolean(git(["status", "--porcelain"]));
  const buildInfo = {
    fullCommit,
    shortCommit: fullCommit === "unknown" ? fullCommit : fullCommit.slice(0, 7),
    dirty,
    builtAt: new Date().toISOString(),
  };

  return {
    base: process.env.PUBLIC_BASE ?? "/",
    plugins: [react()],
    define: {
      __BUILD_INFO__: JSON.stringify(buildInfo),
    },
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          entryFileNames: "react/app.js",
          chunkFileNames: "react/[name].js",
          assetFileNames: "react/[name][extname]",
        },
      },
    },
  };
});
