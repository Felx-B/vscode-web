import { create } from 'vs/workbench/workbench.web.api';

(function () {
	// create workbench

	// TODO recup configuration async

	/* TODO comment recupérer la liste des extensions + packageJSON + extensions ?
	  compiler un fichier et le récupérer avant de lancer le create
	  
     */


	create(document.body, {});
})();