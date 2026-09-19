#!/usr/bin/env node
// The cold-install test: what --selfcheck cannot see.
//
// --selfcheck runs the working tree (`node trailstone.mjs`). It never proves that the PUBLISHED
// artifact installs and runs. Every one of the day's worst bugs lived in that gap: the version
// string drift (0.2.0 announced itself as 0.1.0), a GUI-launched hook that could not find `node`,
// a fresh user getting no Cursor hooks. A working setup hides exactly what a stranger hits first.
//
// So this packs the real tarball, installs it globally into a THROWAWAY home (never your own),
// and drives the installed `trailstone` binary through the whole loop, asserting exit codes.
// Run it before every release; CI runs it on every push. No deps, no framework.
//
//   node scripts/cold-install.mjs
//
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ok  " : "  ✗   "}${msg}`); if (!cond) failed++; };

// A sandbox HOME so we never touch the developer's ~/.claude, ~/.cursor, or global npm.
const sand = mkdtempSync(join(tmpdir(), "trailstone-cold-"));
const HOME = join(sand, "home"), PREFIX = join(HOME, ".npm"), WORK = join(sand, "work");
mkdirSync(HOME, { recursive: true }); mkdirSync(WORK, { recursive: true });
const BIN = join(PREFIX, platform() === "win32" ? "" : "bin");
const env = { ...process.env, HOME, USERPROFILE: HOME, PATH: `${BIN}${platform() === "win32" ? ";" : ":"}${process.env.PATH}` };

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: "utf8", env, cwd: opts.cwd || WORK, ...opts });
const ts = (args, opts) => run(platform() === "win32" ? "trailstone.cmd" : "trailstone", args, opts);
const git = (args, cwd) => execFileSync("git", args, { cwd, env, encoding: "utf8" });

try {
  // 1. pack the exact bytes we would publish, and install them globally into the sandbox.
  console.log("packing + installing the tarball into a throwaway HOME…");
  const tgz = execFileSync("npm", ["pack", "--silent"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  const tgzPath = join(ROOT, tgz);
  execFileSync("npm", ["i", "-g", tgzPath, "--prefix", PREFIX], { env, encoding: "utf8", stdio: "ignore" });
  rmSync(tgzPath, { force: true });

  // 2. the binary exists and reports the RIGHT version (the 0.2.0→0.2.1 drift bug).
  const ver = ts(["--version"]);
  ok(ver.status === 0 && ver.stdout.trim() === PKG_VERSION, `installed \`trailstone --version\` == ${PKG_VERSION} (got ${ver.stdout.trim()})`);

  // 3. --help answers OUTSIDE a repo, where a fresh install is first run.
  const help = ts(["--help"], { cwd: sand });
  ok(help.status === 0 && !/not a git repos/.test(help.stderr || ""), "`trailstone --help` works outside a git repo");

  // 4. a real repo: install must wire the pre-push guard, not silently skip it.
  const repo = join(WORK, "app"); mkdirSync(join(repo, "src"), { recursive: true });
  git(["init", "-q"], repo); git(["config", "user.email", "t@t"], repo); git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "src", "auth.ts"), "export const s = 1;\n");
  execFileSync("git", ["add", "-A"], { cwd: repo, env });
  execFileSync("git", ["commit", "-qm", "init", "--date", "2020-01-01T00:00:00Z"],
    { cwd: repo, env: { ...env, GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z" } });
  ts(["install"], { cwd: repo });
  ok(existsSync(join(repo, ".git", "hooks", "pre-push")), "install wires the pre-push guard inside a repo");

  // 5. the hook command names an ABSOLUTE node (a GUI editor inherits no shell PATH).
  const settings = JSON.parse(readFileSync(join(HOME, ".claude", "settings.json"), "utf8"));
  const cmds = Object.values(settings.hooks || {}).flat().flatMap((g) => g.hooks || []).map((h) => h.command || "");
  ok(cmds.length && cmds.every((c) => /^"[^"]+node[^"]*"/.test(c)), "hook commands use an absolute node path, not bare `node`");

  // 6. the whole loop: decide → reverse → stale → push BLOCKED → validate clears.
  ts(["init", "--goal", "cold"], { cwd: repo });
  const dec = ts(["decide", "JWT header, not cookies", "--why", "w", "--scope", "src/auth.ts"], { cwd: repo });
  const id = (dec.stdout.match(/d_[a-f0-9]+/) || [])[0];
  ok(!!id, `decide records a decision (${id})`);
  ts(["reverse", id, "cookies, not JWT", "--why", "w"], { cwd: repo });
  execFileSync("git", ["add", "-A"], { cwd: repo, env });
  execFileSync("git", ["commit", "-qm", "rev"], { cwd: repo });

  const bare = join(WORK, "remote.git"); git(["init", "-q", "--bare", bare], WORK);
  git(["remote", "add", "origin", bare], repo);
  const branch = git(["branch", "--show-current"], repo).trim();
  const push = spawnSync("git", ["push", "origin", branch], { cwd: repo, env, encoding: "utf8" });
  ok(push.status !== 0 && /STALE/.test(push.stderr || ""), "git push is BLOCKED while a file is stale");

  const val = ts(["validate", id, "--scope", "src/auth.ts"], { cwd: repo });
  ok(/cleared 1 stale flag/.test(val.stdout || ""), "validate clears the stale flag");
  const push2 = spawnSync("git", ["push", "origin", branch], { cwd: repo, env, encoding: "utf8" });
  ok(push2.status === 0, "git push succeeds once the flag is cleared");

  // 7. doctor is honest about a watched repo.
  const doc = ts(["doctor"], { cwd: repo });
  ok(doc.status === 0 && /Trailstone is watching/.test(doc.stdout || ""), "doctor confirms it is watching");
} finally {
  rmSync(sand, { recursive: true, force: true });
}

console.log(failed ? `\ncold-install: ${failed} FAILED` : "\ncold-install: OK");
process.exit(failed ? 1 : 0);
