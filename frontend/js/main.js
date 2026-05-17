import { renderLayout } from "./shell/layout.js";
import { installNavigation, syncHashFromState } from "./shell/navigation.js";
import { setConversations, subscribe } from "./store.js";
import { sampleConversations } from "./data/sampleConversations.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root element");
}

renderLayout(root);

// Seed with sample data so the shell is browsable on its own. The messaging
// runtime module overwrites this by calling setConversations() with live data.
setConversations(sampleConversations);

installNavigation();

// Keep the URL hash in sync with the selected conversation so reloads + back
// button work without a router framework.
subscribe(syncHashFromState);
syncHashFromState();
