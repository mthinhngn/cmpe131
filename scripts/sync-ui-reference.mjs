import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const referenceRoot = path.join(projectRoot, ".references", "shadcn-ui");
const upstream = "https://github.com/shadcn-ui/ui.git";
const sourceDirectories = ["apps/v4/registry", "apps/v4/content", "apps/v4/lib"];

function git(args, cwd = projectRoot, capture = false) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(capture ? result.stderr.trim() : `git ${args[0]} failed (${result.status}).`);
  }
  return capture ? result.stdout.trim() : "";
}

try {
  const update = process.argv.includes("--update");
  if (!existsSync(referenceRoot)) {
    mkdirSync(path.dirname(referenceRoot), { recursive: true });
    git(["clone", "--depth", "1", "--filter=blob:none", "--sparse", upstream, referenceRoot]);
  } else {
    if (!existsSync(path.join(referenceRoot, ".git"))) {
      throw new Error(`${referenceRoot} exists but is not the reference checkout.`);
    }
    if (git(["remote", "get-url", "origin"], referenceRoot, true) !== upstream) {
      throw new Error("Reference origin does not match shadcn-ui/ui; inspect it manually.");
    }
    if (git(["status", "--porcelain"], referenceRoot, true)) {
      throw new Error("Reference checkout has local changes. Preserve them before syncing.");
    }
    if (update) {
      git(["fetch", "--depth", "1", "origin", "main"], referenceRoot);
      git(["switch", "--detach", "FETCH_HEAD"], referenceRoot);
    }
  }
  git(["sparse-checkout", "set", ...sourceDirectories], referenceRoot);
  console.log(`shadcn/ui reference ready: ${referenceRoot}`);
  console.log(`Revision: ${git(["rev-parse", "HEAD"], referenceRoot, true)}`);
  console.log("Source only. Follow docs/UI_COMPONENTS.md when adopting a component.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
