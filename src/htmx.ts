// Small wrapper to import htmx and expose globally
import htmx from 'htmx.org';

if (typeof window !== 'undefined') {
  (window as any).htmx = htmx;
}

export default htmx;
