# VSCode Web

This project builds a web version of VSCode for Zorse.

## About This Fork

This fork changes vscode-web as follows:

- Patches contribution points so Auxillary Sidebar can also be contributed to.
- Removes restriction of native messaging between extensions and their host.
- Removes all sources that normally send a request to `vscode-cdn.net`.
- Removes all sourcemap and other metadata for performance / hosting.
- Minor changes here and there to support various Zorse features.
- Tweaked sandbox features suitable for single-host deployments.

This fork takes in a configuration parameter `window.VSCODE_WEB_PUBLIC_URL`. If this is set it is used instead of
`vscode-cdn.net` for all iframe and web worker requests.

The recommended value for `window.VSCODE_WEB_PUBLIC_URL` is:

```js
`${window.location.protocol}//${window.location.host}${window.location.pathname}/...`;
// example: http://localhost/.../out/vs/workbench/contrib/webview/browser/pre/
```
