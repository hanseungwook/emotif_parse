import { renderLayout } from "./shell/layout.js";
import { installNavigation, syncHashFromState } from "./shell/navigation.js";
import { subscribe } from "./store.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root element");
}

renderLayout(root);
installNavigation();

// Keep the URL hash in sync with the active view so reload + back/forward
// land in the right place. The data-model module is expected to subscribe
// separately to hydrate selectedSkinId / obstacleMode from local storage.
subscribe(syncHashFromState);
syncHashFromState();
