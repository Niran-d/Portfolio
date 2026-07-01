// Dev-only React island for interface-kit.
// Guarded by import.meta.env.DEV so the entire block (and its dynamic imports)
// is tree-shaken out of the production build. interface-kit must never ship.
if (import.meta.env.DEV) {
  (async () => {
    const { createRoot } = await import("react-dom/client");
    const React = await import("react");
    const { InterfaceKit } = await import("interface-kit/react");
    const el = document.getElementById("ik-root");
    if (el) createRoot(el).render(React.createElement(InterfaceKit));
  })();
}
