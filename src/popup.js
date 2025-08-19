// Native popup entry: import popup logic module to wire up behaviors
import('./popup.ts').then(mod => {
	// popup.ts exports refs and functions; Popup.html includes DOM elements that popup.ts can query/use
}).catch(e => console.error('[Nachoneko] popup init failed', e));
// ensure htmx is available
import('./htmx.ts');
