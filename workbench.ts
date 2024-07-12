import {
  create
} from "vs/workbench/workbench.web.main";
import { URI, UriComponents } from "vs/base/common/uri";
import { IWorkbenchConstructionOptions, IWorkspace, IWorkspaceProvider } from "vs/workbench/browser/web.api";
declare const window: any;

(async function () {
  // create workbench
  let config: IWorkbenchConstructionOptions & {
    folderUri?: UriComponents;
    workspaceUri?: UriComponents;
    domElementId?: string;
  } = {};

  if (window.product) {
    config = window.product;
  } else {
    const result = await fetch("product.json");
    config = await result.json();
  }

  if (Array.isArray(config.additionalBuiltinExtensions)) {
    const tempConfig = { ...config };

    tempConfig.additionalBuiltinExtensions =
      config.additionalBuiltinExtensions.map((ext) => URI.revive(ext));
    config = tempConfig;
  }

  let workspace;
  if (config.folderUri) {
    workspace = { folderUri: URI.revive(config.folderUri) };
  } else if (config.workspaceUri) {
    workspace = { workspaceUri: URI.revive(config.workspaceUri) };
  } else {
    workspace = undefined;
  }

  if (workspace) {
    const workspaceProvider: IWorkspaceProvider = {
      workspace,
      open: async (
        workspace: IWorkspace,
        options?: { reuse?: boolean; payload?: object }
      ) => true,
      trusted: true,
    };
    config = { ...config, workspaceProvider };
  }

  const domElement = !!config.domElementId
    && document.getElementById(config.domElementId)
    || document.body;

  create(domElement, config);
})();