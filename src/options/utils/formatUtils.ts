// Utility function for formatting data previews in logs
export function formatPreview(d: any) {
  try {
    const s = JSON.stringify(d);
    const size = s.length;
    if (size > 2000) {
      return { preview: s.slice(0, 500) + '... (truncated)', size };
    }
    return { preview: JSON.parse(s), size };
  } catch {
    try {
      return { preview: String(d) };
    } catch {
      return { preview: '[unserializable data]' };
    }
  }
}
