(function(){
  // No-op htmx loader to satisfy extension CSP (script-src 'self').
  // htmx should be bundled into the app build (vendor bundle). Avoid loading from CDN.
  if (typeof window !== 'undefined' && window.htmx) return;
  // If htmx is truly missing at runtime, we can't fetch remote resources due to CSP.
  // Log a warning for developers to notice during debugging.
  try { console.warn('[htmx loader] htmx not found globally; ensure build bundles htmx.'); } catch (e) {}
})();
