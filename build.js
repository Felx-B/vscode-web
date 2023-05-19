const fs = require("fs");
const path = require("path");
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

// Patch
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

const stripSourceMapComments = async (destPath) => {
  const stat = await fs.promises.stat(destPath);
  if (stat.isDirectory()) {
    for (const child of await fs.promises.readdir(destPath)) {
      await stripSourceMapComments(path.join(destPath, child));
    }
  }
  if (stat.isFile() && destPath.endsWith(".js")) {
    const content = await fs.promises.readFile(destPath, "utf8");
    const stripped = content.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, "");
    await fs.promises.writeFile(destPath, stripped, "utf8");
  }
};

stripSourceMapComments(path.join(__dirname, "dist"));
