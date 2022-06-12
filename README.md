# VSCode Web
This project is aimed to build a web version of VSCode, this is not a fork, simply a web compilation of the VSCode project.

Here is a StackBlitz sample 
https://stackblitz.com/edit/vscode-web


A similar compilation is used to generate [VSCode Web](https://vscode.dev) and [Github Dev](https://github.dev)
## Update
Microsoft recently open sourced VSCode web compilation, so I simplified the build process to use the official compilation (no more tweak needed).
Some modification have been made in the `index.html` file.

## Use case
This project can be used to build a strong web file editor/reader. You need to implement your own [`FileSystemProvider`](https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider) through extension. 
Additional you can also use [proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api) to implement a `TextSearchProvider` and `FileSearchProvider`.

## Sample project
This project is aimed to be used through npm package to avoid consumer to recompile whole solution.

Sample project can be found in this repository to illustate vscode-web usage. This sample is not fully functional as it misses a `FileSystemProvider` extension.

To run sample project 
```sh
cd ./sample
yarn
yarn sample
```

## Extension Gallery
Based on VS MarketPlace rules, you are not allowed to consume VSCode Marketplace from your own VSCode Web
But [Open VSX Registry](https://open-vsx.org/) is here to provide an alternate marketplace.

See the [product.json](sample/product.json) file in `sample` folder to configure it.


## Build from source

To build from source, you need same prerequisites as vscode : 
[VSCode Prerequisites](https://github.com/microsoft/vscode/wiki/How-to-Contribute#prerequisites)

Then simply run following commands

```
yarn
yarn build
```

## Run demo

To run the demo you need to build from source, then run following commands

```
yarn prepare-demo
yarn demo
```
