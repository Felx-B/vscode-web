import { create, IWorkbenchConstructionOptions, IWorkspaceProvider } from 'vs/workbench/workbench.web.api';
import { URI, UriComponents} from 'vs/base/common/uri';

(async function () {
	// create workbench
	const result = await fetch('product.json');
	let config: IWorkbenchConstructionOptions & { folderUri?: UriComponents, workspaceUri?: UriComponents }  = await result.json();


	if (Array.isArray(config.staticExtensions)) {
		config.staticExtensions.forEach(extension => {
			extension.extensionLocation = URI.revive(extension.extensionLocation);
		});
	}

	let workspace;
	if (config.folderUri) {
		workspace = { folderUri: URI.revive(config.folderUri) };
	} else if (config.workspaceUri) {
		workspace = { workspaceUri: URI.revive(config.workspaceUri) };
	} else {
		workspace = undefined;
	}

	if(workspace){
		const workspaceProvider: IWorkspaceProvider = { workspace, open: async () => {} }
		config = { ...config, workspaceProvider };
	}

	create(document.body, config);
})();