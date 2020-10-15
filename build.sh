
vscodeVersion='1.49.0'

# git clone https://github.com/microsoft/vscode.git

cd vscode
git checkout -q $vscodeVersion
yarn

# Use simple workbench
cp ../workbench.ts src/vs/code/browser/workbench/workbench.ts

# Adapt compilation to web
gulpfile='./build/gulpfile.vscode.js'

text1ToReplace='vs\/workbench\/workbench.desktop.main';
text1='vs\/workbench\/workbench.web.api';

text2ToReplace='buildfile.workbenchDesktop';
text2='buildfile.workbenchWeb,buildfile.keyboardMaps';

sed -i -e "s/$text1ToReplace/$text1/g" $gulpfile
sed -i -e "s/$text2ToReplace/$text2/g" $gulpfile

# Compile
yarn gulp compile-build
yarn gulp optimize-vscode
yarn compile-web

# Minify
#yarn gulp minify-vscode

# Remove maps
find out-vscode -type f -name '*.js.map' -delete

# Extract compiled files
rsync -av out-vscode ../dist
rsync -av extensions ../dist --exclude 'extensions/**/node_modules'



