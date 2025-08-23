(async function(){
  const ports = [5173,5174,5175,5176,5177,5178];
  const vitePaths = ['src/content/content.ts','js/content.js','src/content/content.js'];
  const devUrls = [];
  for (const p of ports) for (const pa of vitePaths) devUrls.push(`http://localhost:${p}/${pa}`);
  const status = { fetched: false };

  async function tryFetchAndRun() {
    // Try to inject Vue Devtools into the page context first (non-blocking)
    try {
      await injectVueDevtools();
    } catch (e) {
      // ignore
    }

    try {
      let code = null;
      for (const u of devUrls) {
        try {
          const res = await fetch(u, { cache: 'no-store', mode: 'cors' });
          if (res.ok) {
            code = await res.text();
            console.log('[content-dev] fetched from', u);
            break;
          }
        } catch (e) {
          // continue
        }
      }
      if (!code) throw new Error('non-ok');
      // Run as module via blob to preserve ES module semantics
      const blob = new Blob([code], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      try {
  await import(blobUrl + '#dev');
        status.fetched = true;
        console.log('[content-dev] loaded dev content from', devUrl);
      } finally {
        // release
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.warn('[content-dev] failed to load dev content:', e);
    }
  }

  // Inject Vue Devtools by adding a module script tag pointing to a CDN build
  async function injectVueDevtools() {
    const cdns = [
      'https://unpkg.com/@vue/devtools@latest/dist/devtools.js',
      'https://cdn.jsdelivr.net/npm/@vue/devtools@latest/dist/devtools.js'
    ];
    for (const url of cdns) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.type = 'module';
          s.src = url;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('load error'));
          // set a short timeout
          const t = setTimeout(() => reject(new Error('timeout')), 3000);
          s.onload = () => { clearTimeout(t); resolve(); };
          s.onerror = () => { clearTimeout(t); reject(new Error('load error')); };
          (document.head || document.documentElement).appendChild(s);
        });
        console.log('[content-dev] injected Vue Devtools from', url);
        return;
      } catch (e) {
        // try next
      }
    }
  }

  await tryFetchAndRun();
  if (!status.fetched) {
    // fallback to packaged content script
    try {
      const u = chrome.runtime.getURL('js/content.js');
      await import(u);
    } catch (e) {
      // As a last resort, inject a script tag that loads the content script into the page
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('js/content.js');
      s.type = 'module';
      (document.head||document.documentElement).appendChild(s);
    }
  }
})();
