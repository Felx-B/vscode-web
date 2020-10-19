var process = require("process")
var child_process = require("child_process")
var fs = require("fs")
var glob = require("glob")

const vscodeVersion = "1.50.1";

if(!fs.existsSync('vscode')){
    child_process.execSync('git clone https://github.com/microsoft/vscode.git', {stdio: 'inherit'});
}
process.chdir('vscode');

child_process.execSync(`git checkout -q ${vscodeVersion}`, {stdio: 'inherit'});
if(!fs.existsSync('node_modules')){
    child_process.execSync('yarn', {stdio: 'inherit'});
}
// Use simple workbench
fs.copyFileSync('../workbench.ts', 'src/vs/code/browser/workbench/workbench.ts')

// Adapt compilation to web
const gulpfilePath = './build/gulpfile.vscode.js';
let gulpfile = fs.readFileSync(gulpfilePath, {encoding:'utf8', flag:'r'});

gulpfile = gulpfile
    .replace(/vs\/workbench\/workbench.desktop.main/g, 'vs/workbench/workbench.web.api')
    .replace(/buildfile.workbenchDesktop/g, 'buildfile.workbenchWeb,buildfile.keyboardMaps');

fs.writeFileSync(gulpfilePath, gulpfile);

// Compile
child_process.execSync('yarn gulp compile-build', {stdio: 'inherit'});
child_process.execSync('yarn gulp optimize-vscode', {stdio: 'inherit'});
child_process.execSync('yarn compile-web', {stdio: 'inherit'});

// Remove maps
const mapFiles = glob.sync('out-vscode/**/*.js.map', {});
mapFiles.forEach(mapFile => {
    fs.unlinkSync(mapFile);
});

// Extract compiled files
if(fs.existsSync('../dist')){
    fs.rmdirSync('../dist', { recursive: true })
}
fs.mkdirSync('../dist')
fs.renameSync('out-vscode', '../dist/vscode');

const extensionNM = glob.sync('extensions/**/node_modules', {});
extensionNM.forEach(modules => {
    fs.rmdirSync(modules, {recursive: true});
});
console.log(extensionNM)
fs.renameSync('extensions', '../dist/extensions');