const process = require("process");
const child_process = require("child_process");
const fs = require("fs");
const fse = require("fs-extra");

const vscodeVersion = "1.64.0";

if (!fs.existsSync("vscode")) {
  child_process.execSync(`git clone --depth 1 https://github.com/microsoft/vscode.git -b ${vscodeVersion}`, {
    stdio: "inherit",
  });
}
process.chdir("vscode");

if (!fs.existsSync("node_modules")) {
  child_process.execSync("yarn", { stdio: "inherit" });
}
// Use simple workbench
fs.copyFileSync(
  "../workbench.ts",
  "src/vs/code/browser/workbench/workbench.ts"
);

// Compile
child_process.execSync("yarn gulp vscode-web-min", { stdio: "inherit" });

// Extract compiled files
if (fs.existsSync("../dist")) {
  fs.rmdirSync("../dist", { recursive: true });
}
fs.mkdirSync("../dist");
fse.copySync("../vscode-web", "../dist");


