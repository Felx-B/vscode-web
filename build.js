const fs = require("fs");
const path = require("path");
const assert = require("assert");
const child_process = require("child_process");
const { version } = require("./package.json");

const VSCODE_VERSION = version.split("-")[0];

for (const tool of ["yarn", "git"]) {
  try {
    child_process.execSync(`${tool} --version`, { stdio: "ignore" });
  } catch (e) {
    console.error(`"${tool}" is not available.`);
    process.exit(1);
  }
}

if (!fs.existsSync("vscode")) {
  child_process.execSync(`git clone --depth 1 https://github.com/microsoft/vscode.git -b ${VSCODE_VERSION}`, {
    stdio: "inherit",
  });
}

process.chdir("vscode");

if (!fs.existsSync("node_modules")) {
  child_process.execSync("yarn", { stdio: "inherit" });
}

// Patch source
child_process.execSync("git apply ../vscode.patch", { stdio: "inherit" });

// Use simple workbench
fs.copyFileSync("../workbench.ts", "src/vs/code/browser/workbench/workbench.ts");

// Compile
child_process.execSync("yarn gulp vscode-web-min", { stdio: "inherit" });

// Extract compiled files
if (fs.existsSync("../dist")) {
  fs.rmdirSync("../dist", { recursive: true });
}

fs.mkdirSync("../dist");
fs.cpSync("../vscode-web", "../dist", { recursive: true, force: true });

// Patch output
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
      console.log(`Stripped sourcemaps from ${destPath}`);
      await fs.promises.writeFile(destPath, stripped, "utf8");
      hasStripped = true;
    }
    const matches = re.exec(stripped);
    if (matches && matches.length === 4) {
      const [_, e, n, t] = matches;
      const patched = stripped.replace(
        re,
        `${_}if(${n}&&${n}.startsWith("://")){try{let o=globalThis.origin.split("://");${e}=o[0];${t}=o[1];${n}=${n}.replace("://","/")}catch(_){}};`
      );
      console.log(`Patched ${destPath} for vscode-uri`);
      await fs.promises.writeFile(destPath, patched, "utf8");
      hasPatched = true;
    }
  }
  return hasStripped && hasPatched;
};

assert(patchOutput(path.join(__dirname, "dist")), "Failed to patch output.");
