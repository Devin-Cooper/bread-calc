// Apply the persisted theme so /learn matches the user's choice.
import { applyTheme } from "./components/settings-drawer.js";
applyTheme();

// Preserve the calculator's recipe hash on the "Back to calculator" link.
const back = document.querySelector<HTMLAnchorElement>("#back-to-calc");
if (back) {
  // Try to read autosave to forward the current state into the link.
  // The hash itself is owned by the calculator page; if a hash exists in
  // referer or document.referrer, we can use it; otherwise fall back to "/".
  try {
    const refUrl = document.referrer ? new URL(document.referrer) : null;
    if (refUrl && refUrl.origin === location.origin && refUrl.hash.startsWith("#r=")) {
      back.href = `/${refUrl.hash}`;
    }
  } catch { /* ignore */ }
}
