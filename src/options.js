// Native options entry. Import the logic module to ensure data initialization.
import('./options.ts').then(mod => {
	if (mod && typeof mod.initOptions === 'function') mod.initOptions();
}).catch(e => console.error('[Nachoneko] options init failed', e));
// ensure htmx is available
import('./htmx.ts');