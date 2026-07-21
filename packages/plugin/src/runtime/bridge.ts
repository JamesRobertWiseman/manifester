import { MANAGER_ADDRESS } from "./local-address.ts";

export const bridgeCss = `
#manifester-generation {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  display: grid !important;
  place-items: center !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: none !important;
  background: rgba(255, 255, 255, 0.94) !important;
  color: #111 !important;
  font: 500 16px/1.4 system-ui, sans-serif !important;
}
#manifester-generation > div {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  text-align: center !important;
}
#manifester-generation p,
#manifester-generation button,
#manifester-generation a {
  visibility: visible !important;
  opacity: 1 !important;
}
#manifester-generation button { display: inline-block !important; font: inherit !important; }
#manifester-generation button + button { margin-inline-start: 8px; }
#manifester-generation a { display: block !important; margin-block-start: 12px; color: inherit !important; }
.manifester-loading-dots { display: inline-flex; gap: 0.08em; margin-inline-start: 0.08em; }
.manifester-loading-dot { display: inline-block; animation: manifester-loading-dot 1.2s ease-in-out infinite; opacity: 0.25; }
.manifester-loading-dot:nth-child(2) { animation-delay: 0.15s; }
.manifester-loading-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes manifester-loading-dot {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-0.12em); }
}
@media (prefers-reduced-motion: reduce) {
  .manifester-loading-dot { animation: none; opacity: 1; }
}
`.trim();

export const bridgeJavaScript = String.raw`
(() => {
  let active = null;

  function state() {
    const encoded = document.querySelector('meta[name="manifester-route"]')?.content || "";
    if (!encoded) return { params: {}, actions: {}, contexts: {} };
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  }

  function context(trigger) {
    const raw = trigger.getAttribute("data-manifester-context") || "{}";
    const current = state();
    const values = { ...(current.params || {}), ...JSON.parse(raw) };
    const actionId = trigger.getAttribute("data-manifester-action");
    const allowed = current.contexts?.[actionId] || [];
    return Object.fromEntries(allowed.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]));
  }

  function fill(template, values) {
    return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name) => {
      const value = values[name];
      if (value === undefined || value === null || value === "") throw new Error("missing value");
      return encodeURIComponent(String(value));
    });
  }

  function setDisabled(disabled) {
    document.querySelectorAll("[data-manifester-action]").forEach((element) => {
      element.setAttribute("aria-disabled", String(disabled));
      if ("disabled" in element) element.disabled = disabled;
    });
  }

  function removeOverlay() {
    document.getElementById("manifester-generation")?.remove();
  }

  function overlay(messageText = "The next move is taking shape...") {
    removeOverlay();
    const element = document.createElement("div");
    element.id = "manifester-generation";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    const content = document.createElement("div");
    const message = document.createElement("p");
    const dots = document.createElement("span");
    dots.className = "manifester-loading-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.append(...Array.from({ length: 3 }, () => {
      const dot = document.createElement("span");
      dot.className = "manifester-loading-dot";
      dot.textContent = ".";
      return dot;
    }));
    message.textContent = messageText.replace(/\.\.\.$/, "");
    message.append(dots);
    const manager = document.createElement("a");
    manager.href = "${MANAGER_ADDRESS}";
    manager.target = "_blank";
    manager.rel = "noopener";
    manager.textContent = "Watch the magic in Manifester";
    content.append(message, manager);
    element.append(content);
    document.body.append(element);
  }

  function failure(retryGeneration) {
    removeOverlay();
    const element = document.createElement("div");
    element.id = "manifester-generation";
    element.setAttribute("role", "alert");
    const content = document.createElement("div");
    const message = document.createElement("p");
    message.textContent = "This view could not be generated.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", retryGeneration);
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back";
    back.addEventListener("click", () => removeOverlay());
    content.append(message, retry, back);
    element.append(content);
    document.body.append(element);
  }

  async function generate(trigger) {
    const actionId = trigger.getAttribute("data-manifester-action");
    if (active) return active;
    try {
      const values = context(trigger);
      const target = state().actions?.[actionId];
      if (target) {
        location.assign(fill(target, values));
        return;
      }
    } catch {
      failure(() => generate(trigger));
      return;
    }
    overlay();
    setDisabled(true);
    active = (async () => {
      try {
        const response = await fetch("/__manifester/actions/" + encodeURIComponent(actionId), {
          method: "POST",
          headers: { "content-type": "application/json", "accept": "application/json" },
          body: JSON.stringify({ path: location.pathname, context: context(trigger) })
        });
        if (!response.ok) throw new Error("generation failed");
        const result = await response.json();
        removeOverlay();
        location.assign(result.path);
      } catch {
        failure(() => generate(trigger));
      } finally {
        active = null;
        setDisabled(false);
      }
    })();
    return active;
  }

  async function generateRoute(path) {
    if (active) return active;
    overlay("The next scene is taking shape...");
    setDisabled(true);
    active = (async () => {
      try {
        const response = await fetch("/__manifester/routes", {
          method: "POST",
          headers: { "content-type": "application/json", "accept": "application/json" },
          body: JSON.stringify({ path })
        });
        if (!response.ok) throw new Error("generation failed");
        const result = await response.json();
        removeOverlay();
        location.replace(result.path);
      } catch {
        failure(() => generateRoute(path));
      } finally {
        active = null;
        setDisabled(false);
      }
    })();
    return active;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest("[data-manifester-action]")
      : null;
    if (!trigger) return;
    event.preventDefault();
    void generate(trigger);
  });

  const requestedPath = state().requestedPath;
  if (requestedPath) void generateRoute(requestedPath);
})();
`;
