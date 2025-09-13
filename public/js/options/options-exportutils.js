function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportConfigurationFile(store) {
  const config = {
    version: "1.0",
    exportDate: (/* @__PURE__ */ new Date()).toISOString(),
    settings: store.settings,
    groups: store.groups
  };
  const filename = `emoji-config-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
  downloadJson(filename, config);
}
function exportGroupFile(group) {
  const emojis = (group.emojis || []).map((e) => ({
    id: e.id,
    packet: e.packet,
    name: e.name,
    url: e.url,
    width: e.width,
    height: e.height,
    groupId: group.name || group.id
  }));
  const filename = `emoji-group-${group.id}-${group.name || "group"}.json`;
  downloadJson(filename, emojis);
}
async function exportGroupZip(group, onProgress) {
  const emojis = group.emojis || [];
  if (!Array.isArray(emojis) || emojis.length === 0) {
    onProgress == null ? void 0 : onProgress(100);
    downloadJson(`emoji-group-${group.id}-${group.name || "group"}.json`, group.emojis || []);
    return;
  }
  onProgress == null ? void 0 : onProgress(0);
  const fetchAsBlob = async (url) => {
    if (!url) return null;
    if (url.startsWith("data:")) {
      const res = await fetch(url);
      return res.blob();
    }
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      return null;
    }
  };
  const blobToUint8 = async (b) => new Uint8Array(await b.arrayBuffer());
  const encoder = new TextEncoder();
  const pad = (s, len) => {
    const bytes = encoder.encode(s);
    if (bytes.length > len) return bytes.slice(0, len);
    const out = new Uint8Array(len);
    out.set(bytes);
    return out;
  };
  const numberToOctal = (num, length) => {
    const oct = num.toString(8);
    const padded = oct.padStart(length - 1, "0") + "\0";
    return encoder.encode(padded);
  };
  const computeChecksum = (header) => {
    const copy = new Uint8Array(header);
    for (let i = 148; i < 156; i++) copy[i] = 32;
    let sum = 0;
    for (let i = 0; i < copy.length; i++) sum += copy[i];
    const oct = sum.toString(8);
    const padded = oct.padStart(6, "0") + "\0 ";
    return encoder.encode(padded);
  };
  const parts = [];
  for (let idx = 0; idx < emojis.length; idx++) {
    const e = emojis[idx];
    const url = e.url || e.src || e.icon;
    const displayName = e.name || `emoji-${idx}`;
    const safeBase = displayName.split("/").join("_").split("\0").join("_");
    const extMatch = (url || "").match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/);
    const ext = extMatch ? extMatch[1] : "png";
    const extWithDot = `.${ext}`;
    const maxNameBytes = 100;
    const encoderLocal = encoder;
    let name = safeBase + extWithDot;
    if (encoderLocal.encode(name).length > maxNameBytes) {
      let out = "";
      for (const ch of safeBase) {
        const candidate = out + ch;
        if (encoderLocal.encode(candidate + extWithDot).length > maxNameBytes) break;
        out = candidate;
      }
      const baseFinal = out || `emoji-${idx}`;
      name = baseFinal + extWithDot;
    }
    const blob = await fetchAsBlob(url);
    if (!blob) continue;
    const content = await blobToUint8(blob);
    const size = content.byteLength;
    const header = new Uint8Array(512);
    header.set(pad(name, 100), 0);
    header.set(numberToOctal(420, 8), 100);
    header.set(numberToOctal(0, 8), 108);
    header.set(numberToOctal(0, 8), 116);
    header.set(numberToOctal(size, 12), 124);
    header.set(numberToOctal(Math.floor(Date.now() / 1e3), 12), 136);
    header.set(encoder.encode("        "), 148);
    header[156] = 48;
    header.set(encoder.encode("ustar"), 257);
    header.set(encoder.encode("00"), 263);
    const chksum = computeChecksum(header);
    header.set(chksum, 148);
    parts.push(header);
    parts.push(content);
    const remainder = size % 512;
    if (remainder !== 0) {
      parts.push(new Uint8Array(512 - remainder));
    }
    const fetchPct = Math.round((idx + 1) / emojis.length * 70);
    onProgress == null ? void 0 : onProgress(fetchPct);
  }
  parts.push(new Uint8Array(512));
  parts.push(new Uint8Array(512));
  onProgress == null ? void 0 : onProgress(75);
  const tarBlob = new Blob(parts, { type: "application/x-tar" });
  if (typeof window.CompressionStream === "function") {
    try {
      const cs = new CompressionStream("gzip");
      onProgress == null ? void 0 : onProgress(80);
      const compressedStream = tarBlob.stream().pipeThrough(cs);
      onProgress == null ? void 0 : onProgress(90);
      const compressedBlob = await new Response(compressedStream).blob();
      onProgress == null ? void 0 : onProgress(100);
      const url = URL.createObjectURL(compressedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emoji-group-${group.id}-${group.name || "group"}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    } catch (e) {
    }
  }
  downloadJson(`emoji-group-${group.id}-${group.name || "group"}.json`, group.emojis || []);
}
export {
  exportGroupZip as a,
  exportConfigurationFile as b,
  exportGroupFile as e
};
