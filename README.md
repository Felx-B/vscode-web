# VSCode Web

This project builds a web version of VSCode for Zorse.

## About This Fork

This fork changes vscode-web as follows:

- Patches contribution points so Auxillary Sidebar can also be contributed to.
- Removes restriction of native messaging between extensions and their host.
- Removes all sources that normally send a request to `vscode-cdn.net`.
- Removes all sourcemap and other metadata for performance / hosting.
- Minor changes here and there to support various Zorse features.

This fork takes in a configuration parameter `window.PUBLIC_URL`. If this is set
it is used instead of `vscode-cdn.net` for all iframe and web worker requests.

The recommended value for `window.PUBLIC_URL` is:

```js
`${window.location.protocol}//{{uuid}}.${window.location.host}${window.location.pathname}`;
// example: http://{{uuid}}.localhost/...
```

If everything is loaded from `example.com`, then `{{uuid}}.example.com/*` needs
to reverse-proxy the content at `example.com/*` without changing the URL. So a
typical HTTP forward will not work.
