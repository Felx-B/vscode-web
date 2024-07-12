const fs = require("fs");
const path = require("path");
const assert = require("assert");
const child_process = require("child_process");
const { version } = require("./package.json");

const VSCODE_VERSION = version.split("-")[0];

function error(msg) {
  console.info("\x1b[31merror %s\x1b[0m", msg)
}
function ok(msg) {
  console.info("\x1b[32m%s\x1b[0m", msg)
}
function note(msg) {
  console.info("\x1b[90m%s\x1b[0m", msg)
}
function exec(cmd, opts) {
  console.info("\x1b[36m%s\x1b[0m", cmd)
  return child_process.execSync(cmd, opts);
}

const requiredTools = ["node", "yarn", "git", "python"];
note(`required tools ${JSON.stringify(requiredTools)}`)
for (const tool of requiredTools) {
  try {
    child_process.execSync(`${tool} --version`, { stdio: "ignore" });
  } catch (e) {
    error(`"${tool}" is not available.`);
    process.exit(1);
  }
}
ok("required tools installed")

const node_version_out = child_process.execSync(`node -v`);
const node_version = node_version_out.toString().trim()
if (node_version < "v20.0") {
  error(`Want node > 20. Got "${node_version}"`);
  process.exit(1);
}

if (!fs.existsSync("vscode")) {
  note("cloning vscode")
  exec(`git clone --depth 1 https://github.com/microsoft/vscode.git -b ${VSCODE_VERSION}`, {
    stdio: "inherit",
  });
} else {
  ok("vscodium already installed")
  note("delete vscodium folder to clone again")
}

note("changing directory to vscode")
process.chdir("vscode");

if (!fs.existsSync("node_modules")) {
  exec("yarn", { stdio: "inherit" });
} else {
  ok("node_modules exists. Skipping yarn")
}

// Use simple workbench
note("copying workbench file")
fs.copyFileSync("../workbench.ts", "src/vs/code/browser/workbench/workbench.ts");

// Compile
note("starting compile")
exec("yarn gulp vscode-web-min", { stdio: "inherit" });
ok("compile completed")

// Extract compiled files
if (fs.existsSync("../dist")) {
  note("cleaning ../dist")
  fs.rmSync("../dist", { recursive: true, force: true });
} else {
  ok("../dist did not exist. No need to clean")
}

fs.mkdirSync("../dist");
fs.cpSync("../vscode-web", "../dist", { recursive: true, force: true });
ok("copied ../vscode-web to ../dist")

// Patch output
note("beginning complex patches for networking")
const distWorkbenchPath = "../dist/out/vs/workbench/workbench.web.main.js";
const workbench = fs.readFileSync(distWorkbenchPath, "utf8");
const workbenchPatched = workbench.replace(/("https:\/\/{{uuid}}[^"]+")/g, "(globalThis.VSCODE_WEB_PUBLIC_URL||$1)");
fs.writeFileSync(distWorkbenchPath, workbenchPatched, "utf8");

// Strip sourcemaps and patch vscode-uri for "://" URIs
const re = /.=function\(\)\{function .\((.),.,(.),.,(.),.\)\{/g;
const patchOutput = async (destPath) => {
  let hasPatched = false;
  let hasStripped = false;
  const stat = await fs.promises.stat(destPath);
  if (stat.isDirectory()) {
    for (const child of await fs.promises.readdir(destPath)) {
      hasStripped |= await patchOutput(path.join(destPath, child));
    }
  }
  if (stat.isFile() && destPath.endsWith(".js")) {
    const content = await fs.promises.readFile(destPath, "utf8");
    const stripped = content.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, "");
    if (stripped !== content) {
      note(`Stripped sourcemaps from ${destPath}`);
      await fs.promises.writeFile(destPath, stripped, "utf8");
      hasStripped = true;
    }
    if (destPath.includes("jsonServer")) {
      const matches = re.exec(stripped);
      if (matches && matches.length === 4) {
        const [_, e, n, t] = matches;
        const patched = stripped.replace(
          re,
          `${_}if(${n}&&${n}.startsWith("://")){try{let o=globalThis.origin.split("://");${e}=o[0];${t}=o[1];${n}=${n}.replace("://","/")}catch(_){}};`
        );
        ok(`Patched ${destPath} for vscode-uri`);
        await fs.promises.writeFile(destPath, patched, "utf8");
        hasPatched = true;
      }
    }
  }
  return hasStripped && hasPatched;
};

assert(patchOutput(path.join(__dirname, "dist")), "Failed to patch output.");