import { getState } from "../../store.js";
import {
  registerMount,
  invokeRenderer,
  clearMount,
} from "../../extensions.js";

// High scores / leaderboard view. The shell ships only the chrome and a
// mount point — the data-model module owns persistence and is responsible
// for registering a "scores" renderer that fills this in.
export function renderScoresView(mount) {
  mount.replaceChildren();

  const header = document.createElement("header");
  header.className = "view-header";
  header.innerHTML = `
    <div class="titles">
      <h2>High Scores</h2>
      <p class="subtitle">Your best runs, separated by mode.</p>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "view-body";

  const panel = document.createElement("section");
  panel.className = "panel";

  const scoresMount = document.createElement("div");
  scoresMount.className = "scores-mount";
  scoresMount.dataset.mount = "scores";
  panel.append(scoresMount);

  body.append(panel);
  mount.append(header, body);

  registerMount("scores", scoresMount);

  if (!invokeRenderer("scores", { state: getState() })) {
    clearMount("scores");
    const placeholder = document.createElement("div");
    placeholder.className = "scores-placeholder";
    placeholder.innerHTML = `
      <strong style="color:var(--color-text);">Scores appear here</strong><br/>
      Play a round to record your first score. The persistence module fills
      this list once it's connected.
    `;
    scoresMount.append(placeholder);
  }
}
