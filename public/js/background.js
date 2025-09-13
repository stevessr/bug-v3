import { a2 as loadDefaultEmojiGroups, X as __vitePreload, Z as newStorageHelpers } from "./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const getChromeAPI = () => {
  try {
    return globalThis.chrome || self.chrome;
  } catch (e) {
    console.error("Chrome API not available:", e);
    return null;
  }
};
async function initializeDefaultData() {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2 || !chromeAPI2.storage) {
    console.error("Chrome storage API not available");
    return;
  }
  try {
    const existingData = await chromeAPI2.storage.local.get(["emojiGroups", "appSettings"]);
    if (!existingData.emojiGroups) {
      try {
        const runtime = await loadDefaultEmojiGroups();
        await chromeAPI2.storage.local.set({ emojiGroups: runtime && runtime.length ? runtime : [] });
      } catch (e) {
        await chromeAPI2.storage.local.set({ emojiGroups: [] });
      }
      console.log("Default emoji groups initialized");
    }
    if (!existingData.appSettings) {
      const defaultSettings = {
        imageScale: 100,
        defaultGroup: "nachoneko",
        showSearchBar: true,
        gridColumns: 4
      };
      await chromeAPI2.storage.local.set({ appSettings: defaultSettings });
      console.log("Default app settings initialized");
    }
  } catch (error) {
    console.error("Failed to initialize default data:", error);
  }
}
function setupOnInstalledListener() {
  const chromeAPI2 = getChromeAPI();
  if (chromeAPI2 && chromeAPI2.runtime && chromeAPI2.runtime.onInstalled) {
    chromeAPI2.runtime.onInstalled.addListener(async (details) => {
      console.log("Emoji extension installed/updated:", details.reason);
      if (details.reason === "install") {
        await initializeDefaultData();
      }
    });
  }
}
async function injectBridgeIntoTab(tabId) {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2 || !chromeAPI2.scripting) return;
  try {
    await chromeAPI2.scripting.executeScript({
      target: { tabId },
      files: ["js/content/bridge.js"]
    });
  } catch (e) {
    console.warn("[scripting] Failed to inject bridge into tab", tabId, e);
  }
}
async function injectContentForTab(tabId, pageType) {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2) return { success: false, error: "chrome API unavailable" };
  const canUseScripting = !!(chromeAPI2.scripting && typeof chromeAPI2.scripting.executeScript === "function");
  const mapping = {
    // Prefer the built content paths under js/content first (Vite outputs there),
    // but keep legacy root-level js/<site>.js as fallback for older builds.
    bilibili: ["js/content/bilibili.js", "js/bilibili.js"],
    pixiv: ["js/content/pixiv.js", "js/pixiv.js"],
    discourse: ["js/content/discourse.js", "js/discourse.js"],
    x: ["js/content/x.js", "js/x.js"],
    generic: ["js/content/autodetect.js"]
  };
  const files = mapping[pageType] || mapping.generic;
  try {
    if (canUseScripting) {
      const injected = [];
      for (const f of files) {
        try {
          await chromeAPI2.scripting.executeScript({ target: { tabId }, files: [f] });
          injected.push(f);
        } catch (e) {
          console.warn("[scripting] Failed to inject file, trying next candidate", f, e);
        }
      }
      if (injected.length === 0) {
        return { success: false, error: `Could not inject any of: ${files.join(", ")}` };
      }
      try {
        await injectBridgeIntoTab(tabId);
      } catch (e) {
        console.warn("[scripting] injectBridgeIntoTab failed after content injection", e);
      }
      return { success: true, message: `Injected ${injected.join(", ")}` };
    }
    if (chromeAPI2.tabs && typeof chromeAPI2.tabs.executeScript === "function") {
      const injected = [];
      for (const f of files) {
        try {
          await new Promise((resolve, reject) => {
            try {
              chromeAPI2.tabs.executeScript(tabId, { file: f }, (_) => {
                const err = chromeAPI2.runtime && chromeAPI2.runtime.lastError;
                if (err) reject(err);
                else resolve();
              });
            } catch (e) {
              reject(e);
            }
          });
          injected.push(f);
        } catch (e) {
          console.warn("[scripting] tabs.executeScript failed for file, trying next candidate", f, e);
        }
      }
      if (injected.length === 0) {
        return { success: false, error: `Could not inject any of: ${files.join(", ")}` };
      }
      try {
        await new Promise((resolve, reject) => {
          try {
            chromeAPI2.tabs.executeScript(tabId, { file: "js/content/bridge.js" }, (_) => {
              const err = chromeAPI2.runtime && chromeAPI2.runtime.lastError;
              if (err) reject(err);
              else resolve();
            });
          } catch (e) {
            reject(e);
          }
        });
      } catch (e) {
        console.warn("[scripting] tabs.executeScript bridge injection failed", e);
      }
      return { success: true, message: `Injected (tabs) ${injected.join(", ")}` };
    }
    return { success: false, error: "scripting and tabs.executeScript are unavailable" };
  } catch (e) {
    console.warn("[scripting] injectContentForTab failed", e);
    return { success: false, error: String(e) };
  }
}
const defaultProxyConfig = {
  enabled: false,
  url: "",
  password: ""
};
async function handleDownloadAndSendToDiscourse(payload, sendResponse) {
  try {
    if (!payload || !payload.url) {
      sendResponse({ success: false, error: "missing payload.url" });
      return;
    }
    const url = payload.url;
    const discourseBase = payload.discourseBase;
    const defaultHeaders = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "Cache-Control": "max-age=0",
      // sec-ch-ua and related client hints — may be ignored by fetch/runtime but included to approximate the curl
      "sec-ch-ua": '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Upgrade-Insecure-Requests": "1"
    };
    const headers = Object.assign({}, defaultHeaders, payload.headers || {});
    const resp = await fetch(url, {
      method: "GET",
      headers,
      // set referrer to pixiv to emulate the browser Referer header
      referrer: payload.referrer || "https://www.pixiv.net/",
      referrerPolicy: payload.referrerPolicy || "no-referrer-when-downgrade",
      cache: "no-cache",
      redirect: "follow"
    });
    if (!resp.ok) {
      sendResponse({ success: false, error: `failed to download image: ${resp.status}` });
      return;
    }
    const arrayBuffer = await resp.arrayBuffer();
    const chromeAPI2 = getChromeAPI();
    const tabs = await (chromeAPI2.tabs && chromeAPI2.tabs.query ? chromeAPI2.tabs.query({}) : []);
    let sent = 0;
    for (const tab of tabs) {
      try {
        if (discourseBase && tab.url && !String(tab.url).startsWith(discourseBase)) continue;
        await chromeAPI2.tabs.sendMessage(tab.id, {
          action: "uploadBlobToDiscourse",
          filename: payload.filename || "image.jpg",
          mimeType: payload.mimeType || "image/jpeg",
          arrayBuffer,
          discourseBase
        });
        sent++;
      } catch (e) {
        void e;
      }
    }
    if (sent === 0) {
      sendResponse({ success: false, error: "no discourse tab found to receive upload" });
      return;
    }
    sendResponse({ success: true, message: `sent to ${sent} tab(s)` });
  } catch (error) {
    console.error("[Background] downloadAndSendToDiscourse failed", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
async function handleDownloadForUser(payload, sendResponse) {
  try {
    if (!payload || !payload.url) {
      console.error("[Background] handleDownloadForUser missing payload.url");
      sendResponse({ success: false, error: "missing payload.url" });
      return;
    }
    const url = payload.url;
    if (payload.directDownload) {
      let proxy = payload.proxy || defaultProxyConfig;
      if (payload.useStorageProxy) {
        try {
          const chromeAPI2 = getChromeAPI();
          const readStorageProxy = () => new Promise((resolve) => {
            try {
              if (chromeAPI2.storage && chromeAPI2.storage.sync && chromeAPI2.storage.sync.get) {
                chromeAPI2.storage.sync.get(["proxy"], (res) => resolve((res == null ? void 0 : res.proxy) || null));
              } else if (chromeAPI2.storage && chromeAPI2.storage.local && chromeAPI2.storage.local.get) {
                chromeAPI2.storage.local.get(["proxy"], (res) => resolve((res == null ? void 0 : res.proxy) || null));
              } else resolve(null);
            } catch (_e) {
              resolve(null);
            }
          });
          const stored = await readStorageProxy();
          if (stored && stored.enabled && stored.url) proxy = stored;
        } catch (e) {
          console.error("[Background] failed to read proxy from storage", e);
        }
      }
      if (proxy && proxy.enabled && proxy.url) {
        try {
          console.log("[Background] attempting proxy download", { proxy: proxy.url, url });
          const proxyUrl = new URL(proxy.url);
          proxyUrl.searchParams.set("url", url);
          if (proxy.password) proxyUrl.searchParams.set("pw", proxy.password);
          const proxyResp = await fetch(proxyUrl.toString(), { method: "GET" });
          if (proxyResp.ok) {
            const arrayBuffer2 = await proxyResp.arrayBuffer();
            const contentType2 = proxyResp.headers.get("content-type") || "application/octet-stream";
            const blob = new Blob([new Uint8Array(arrayBuffer2)], { type: contentType2 });
            const objectUrl = URL.createObjectURL(blob);
            const chromeAPI2 = getChromeAPI();
            if (chromeAPI2 && chromeAPI2.downloads && chromeAPI2.downloads.download) {
              const filename2 = payload.filename || (() => {
                try {
                  const u = new URL(url);
                  return (u.pathname.split("/").pop() || "image").replace(/\?.*$/, "");
                } catch (_e) {
                  return "image";
                }
              })();
              try {
                const downloadId = await new Promise((resolve, reject) => {
                  try {
                    chromeAPI2.downloads.download({ url: objectUrl, filename: filename2 }, (id) => {
                      if (chromeAPI2.runtime && chromeAPI2.runtime.lastError)
                        reject(chromeAPI2.runtime.lastError);
                      else resolve(id);
                    });
                  } catch (e) {
                    reject(e);
                  }
                });
                setTimeout(() => URL.revokeObjectURL(objectUrl), 5e3);
                sendResponse({ success: true, downloadId, via: "proxy" });
                return;
              } catch (e) {
                void e;
              }
            } else {
              sendResponse({
                success: true,
                fallback: true,
                arrayBuffer: arrayBuffer2,
                mimeType: contentType2,
                filename: payload.filename || "image"
              });
              return;
            }
          } else {
            console.error("[Background] proxy fetch failed", { status: proxyResp.status });
          }
        } catch (e) {
          console.error("[Background] proxy attempt error", e);
        }
      }
      try {
        const chromeAPI2 = getChromeAPI();
        if (chromeAPI2 && chromeAPI2.downloads && chromeAPI2.downloads.download) {
          const filename2 = payload.filename || (() => {
            try {
              const u = new URL(url);
              return (u.pathname.split("/").pop() || "image").replace(/\?.*$/, "");
            } catch (_e) {
              return "image";
            }
          })();
          console.log("[Background] attempting directDownload", { url, filename: filename2 });
          const downloadId = await new Promise((resolve, reject) => {
            try {
              chromeAPI2.downloads.download({ url, filename: filename2 }, (id) => {
                const le = chromeAPI2.runtime && chromeAPI2.runtime.lastError;
                if (le) {
                  reject(le);
                } else resolve(id);
              });
            } catch (e) {
              reject(e);
            }
          });
          console.log("[Background] directDownload started", { downloadId, url });
          sendResponse({ success: true, downloadId });
          return;
        }
      } catch (e) {
        console.error(
          "[Background] directDownload attempt failed, will fallback to fetch",
          e && e.message ? e.message : e
        );
      }
    }
    const defaultHeaders = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "Cache-Control": "max-age=0"
    };
    const headers = Object.assign({}, defaultHeaders, payload.headers || {});
    const resp = await fetch(url, {
      method: "GET",
      headers,
      referrer: payload.referrer || "https://www.pixiv.net/",
      referrerPolicy: payload.referrerPolicy || "no-referrer-when-downgrade",
      cache: "no-cache",
      redirect: "follow"
    });
    if (!resp.ok) {
      sendResponse({ success: false, error: `failed to download image: ${resp.status}` });
      return;
    }
    const arrayBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    let filename = payload.filename || "";
    const cd = resp.headers.get("content-disposition") || "";
    const m = /filename\*=UTF-8''([^;\n]+)/i.exec(cd) || /filename="?([^";\n]+)"?/i.exec(cd);
    if (m && m[1]) filename = decodeURIComponent(m[1]);
    if (!filename) {
      try {
        const u = new URL(url);
        filename = (u.pathname.split("/").pop() || "image").replace(/\?.*$/, "");
      } catch (_e) {
        filename = payload.filename || "image";
      }
    }
    try {
      const blob = new Blob([new Uint8Array(arrayBuffer)], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      const chromeAPI2 = getChromeAPI();
      let downloadId = void 0;
      if (chromeAPI2 && chromeAPI2.downloads && chromeAPI2.downloads.download) {
        downloadId = await new Promise((resolve, reject) => {
          try {
            chromeAPI2.downloads.download({ url: objectUrl, filename }, (id) => {
              if (chromeAPI2.runtime.lastError) reject(chromeAPI2.runtime.lastError);
              else resolve(id);
            });
          } catch (e) {
            reject(e);
          }
        });
      } else {
        sendResponse({
          success: true,
          fallback: true,
          arrayBuffer,
          mimeType: contentType,
          filename
        });
        return;
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5e3);
      sendResponse({ success: true, downloadId });
      return;
    } catch (e) {
      void e;
      sendResponse({ success: true, fallback: true, arrayBuffer, mimeType: contentType, filename });
      return;
    }
  } catch (error) {
    console.error("[Background] handleDownloadForUser failed", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
async function downloadAndUploadDirect(url, filename, opts) {
  const { discourseBase, cookie, csrf } = opts;
  const defaultHeaders = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "Cache-Control": "max-age=0"
  };
  const resp = await fetch(url, {
    method: "GET",
    headers: defaultHeaders,
    referrer: "https://www.pixiv.net/",
    referrerPolicy: "no-referrer-when-downgrade",
    cache: "no-cache",
    redirect: "follow"
  });
  if (!resp.ok) throw new Error(`failed to download image: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  const blob = new Blob([new Uint8Array(arrayBuffer)], { type: "image/png" });
  const form = new FormData();
  form.append("upload_type", "composer");
  form.append("relativePath", "null");
  form.append("name", filename);
  form.append("type", blob.type);
  form.append("file", blob, filename);
  const uploadUrl = `${discourseBase.replace(/\/$/, "")}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`;
  const headers = {};
  if (csrf) headers["X-Csrf-Token"] = csrf;
  if (cookie) headers["Cookie"] = cookie;
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body: form,
    credentials: "include"
  });
  if (!uploadResp.ok) {
    const data2 = await uploadResp.json().catch(() => null);
    const err = new Error("upload failed");
    err.details = data2;
    throw err;
  }
  const data = await uploadResp.json();
  return data;
}
async function handleUploadAndAddEmoji(payload, sendResponse) {
  try {
    if (!payload) {
      sendResponse({ success: false, error: "missing payload" });
      return;
    }
    try {
      console.log("[UploadAndAddEmoji] Received payload keys:", Object.keys(payload));
    } catch (_e) {
      void _e;
    }
    if (!payload.arrayData) {
      console.warn("[UploadAndAddEmoji] payload.arrayData missing; keys:", Object.keys(payload));
      sendResponse({ success: false, error: "missing arrayData" });
      return;
    }
    const arrayData = payload.arrayData;
    const arrayBuffer = new Uint8Array(arrayData).buffer;
    try {
      const abType = Object.prototype.toString.call(arrayBuffer);
      const byteLen = arrayBuffer.byteLength;
      console.log("[UploadAndAddEmoji] converted arrayData to arrayBuffer:", {
        arrayDataLength: arrayData.length,
        arrayBufferType: abType,
        byteLength: byteLen
      });
    } catch (_e) {
      void _e;
    }
    const filename = payload.filename || "image";
    const mimeType = payload.mimeType || "application/octet-stream";
    const name = payload.name || filename;
    console.log(
      "[UploadAndAddEmoji] Processing file:",
      filename,
      "size:",
      arrayBuffer.byteLength,
      "type:",
      mimeType
    );
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType });
    console.log("[UploadAndAddEmoji] Created blob size:", blob.size, "type:", blob.type);
    const formData = new FormData();
    formData.append("upload_type", "composer");
    formData.append("relativePath", "null");
    formData.append("name", filename);
    formData.append("type", blob.type);
    formData.append("file", blob, filename);
    const chromeAPI2 = getChromeAPI();
    let authResp = { success: false, csrfToken: "", cookies: "" };
    try {
      if (chromeAPI2 && chromeAPI2.cookies) {
        const cookies = await chromeAPI2.cookies.getAll({ domain: "linux.do" });
        const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
        let csrfToken = "";
        try {
          if (chromeAPI2.tabs) {
            const tabs = await chromeAPI2.tabs.query({ url: "https://linux.do/*" });
            if (tabs.length > 0 && tabs[0].id) {
              try {
                const response = await chromeAPI2.tabs.sendMessage(tabs[0].id, {
                  type: "GET_CSRF_TOKEN"
                });
                if (response && response.csrfToken) {
                  csrfToken = response.csrfToken;
                }
              } catch (sendMessageError) {
                for (let i = 1; i < tabs.length; i++) {
                  if (tabs[i].id) {
                    try {
                      const response = await chromeAPI2.tabs.sendMessage(tabs[i].id, {
                        type: "GET_CSRF_TOKEN"
                      });
                      if (response && response.csrfToken) {
                        csrfToken = response.csrfToken;
                        break;
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
                if (!csrfToken) {
                  console.warn("Failed to get CSRF token from any linux.do tab:", sendMessageError);
                }
              }
            } else {
              console.warn("No linux.do tabs found");
            }
          }
        } catch (e) {
          console.warn("Failed to get CSRF token from linux.do tab:", e);
        }
        authResp = {
          success: true,
          csrfToken,
          cookies: cookieString
        };
      }
    } catch (_e) {
      console.error("Failed to get auth info:", _e);
    }
    const headers = {};
    if (authResp && authResp.csrfToken) headers["X-Csrf-Token"] = authResp.csrfToken;
    if (authResp && authResp.cookies) headers["Cookie"] = authResp.cookies;
    const uploadUrl = `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`;
    const resp = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include"
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => null);
      sendResponse({ success: false, error: "upload failed", details: errData });
      return;
    }
    const data = await resp.json();
    const uploadedUrl = data && data.url ? data.url : null;
    if (!uploadedUrl) {
      sendResponse({ success: false, error: "no url returned from upload", details: data });
      return;
    }
    try {
      const { newStorageHelpers: newStorageHelpers2 } = await __vitePreload(async () => {
        const { newStorageHelpers: newStorageHelpers3 } = await import("./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js").then((n) => n.a3);
        return { newStorageHelpers: newStorageHelpers3 };
      }, true ? [] : void 0);
      const groups = await newStorageHelpers2.getAllEmojiGroups();
      let ungroupedGroup = groups.find((g) => g.id === "ungrouped");
      if (!ungroupedGroup) {
        ungroupedGroup = { id: "ungrouped", name: "未分组", icon: "📦", order: 999, emojis: [] };
        groups.push(ungroupedGroup);
      }
      const finalUrl = uploadedUrl;
      const newEmoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name,
        url: finalUrl,
        groupId: "ungrouped",
        addedAt: Date.now()
      };
      ungroupedGroup.emojis.push(newEmoji);
      await newStorageHelpers2.setAllEmojiGroups(groups);
      sendResponse({ success: true, url: finalUrl, added: true });
      return;
    } catch (e) {
      sendResponse({ success: true, url: uploadedUrl, added: false, error: String(e) });
      return;
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
async function handleDownloadAndUploadEmoji(payload, sendResponse) {
  try {
    if (!payload || !payload.url) {
      sendResponse({ success: false, error: "missing url" });
      return;
    }
    const imageUrl = payload.url;
    const filename = payload.filename || "image";
    const name = payload.name || filename;
    console.log("[DownloadAndUploadEmoji] Processing image:", filename, "from:", imageUrl);
    const defaultHeaders = {
      Accept: "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cache-Control": "max-age=0",
      "sec-ch-ua": '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };
    if (imageUrl.includes("pximg.net")) {
      defaultHeaders.Referer = "https://www.pixiv.net/";
    }
    const imageResp = await fetch(imageUrl, {
      method: "GET",
      headers: defaultHeaders,
      credentials: "omit"
    });
    if (!imageResp.ok) {
      sendResponse({
        success: false,
        error: `Failed to download image: ${imageResp.status}`,
        details: imageResp.statusText
      });
      return;
    }
    const imageBlob = await imageResp.blob();
    console.log("[DownloadAndUploadEmoji] Image downloaded:", imageBlob.size, "bytes");
    const chromeAPI2 = getChromeAPI();
    let authResp = { success: false, csrfToken: "", cookies: "" };
    try {
      if (chromeAPI2 && chromeAPI2.cookies) {
        const cookies = await chromeAPI2.cookies.getAll({ domain: "linux.do" });
        const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
        let csrfToken = "";
        try {
          if (chromeAPI2.tabs) {
            const tabs = await chromeAPI2.tabs.query({ url: "https://linux.do/*" });
            if (tabs.length > 0 && tabs[0].id) {
              try {
                const response = await chromeAPI2.tabs.sendMessage(tabs[0].id, {
                  type: "GET_CSRF_TOKEN"
                });
                if (response && response.csrfToken) {
                  csrfToken = response.csrfToken;
                }
              } catch (sendMessageError) {
                for (let i = 1; i < tabs.length; i++) {
                  if (tabs[i].id) {
                    try {
                      const response = await chromeAPI2.tabs.sendMessage(tabs[i].id, {
                        type: "GET_CSRF_TOKEN"
                      });
                      if (response && response.csrfToken) {
                        csrfToken = response.csrfToken;
                        break;
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
                if (!csrfToken) {
                  console.warn("Failed to get CSRF token from any linux.do tab:", sendMessageError);
                }
              }
            } else {
              console.warn("No linux.do tabs found");
            }
          }
        } catch (e) {
          console.warn("Failed to get CSRF token from linux.do tab:", e);
        }
        authResp = {
          success: true,
          csrfToken,
          cookies: cookieString
        };
      }
    } catch (_e) {
      console.error("Failed to get auth info:", _e);
    }
    const formData = new FormData();
    formData.append("upload_type", "composer");
    formData.append("relativePath", "null");
    formData.append("name", filename);
    formData.append("type", imageBlob.type);
    formData.append("file", imageBlob, filename);
    const headers = {};
    if (authResp.csrfToken) headers["X-Csrf-Token"] = authResp.csrfToken;
    if (authResp.cookies) headers["Cookie"] = authResp.cookies;
    const uploadUrl = `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`;
    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include"
    });
    if (!uploadResp.ok) {
      const errData = await uploadResp.json().catch(() => null);
      sendResponse({ success: false, error: "upload failed", details: errData });
      return;
    }
    const uploadData = await uploadResp.json();
    const uploadedUrl = uploadData && uploadData.url ? uploadData.url : null;
    if (!uploadedUrl) {
      sendResponse({ success: false, error: "no url returned from upload", details: uploadData });
      return;
    }
    try {
      const { newStorageHelpers: newStorageHelpers2 } = await __vitePreload(async () => {
        const { newStorageHelpers: newStorageHelpers3 } = await import("./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js").then((n) => n.a3);
        return { newStorageHelpers: newStorageHelpers3 };
      }, true ? [] : void 0);
      const groups = await newStorageHelpers2.getAllEmojiGroups();
      let ungroupedGroup = groups.find((g) => g.id === "ungrouped");
      if (!ungroupedGroup) {
        ungroupedGroup = { id: "ungrouped", name: "未分组", icon: "📦", order: 999, emojis: [] };
        groups.push(ungroupedGroup);
      }
      const newEmoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name,
        url: uploadedUrl,
        groupId: "ungrouped",
        addedAt: Date.now()
      };
      ungroupedGroup.emojis.push(newEmoji);
      await newStorageHelpers2.setAllEmojiGroups(groups);
      sendResponse({ success: true, url: uploadedUrl, added: true });
      return;
    } catch (e) {
      sendResponse({ success: true, url: uploadedUrl, added: false, error: String(e) });
      return;
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
async function handleAddEmojiFromWeb(emojiData, sendResponse) {
  try {
    const groups = await newStorageHelpers.getAllEmojiGroups();
    let ungroupedGroup = groups.find((g) => g.id === "ungrouped");
    if (!ungroupedGroup) {
      ungroupedGroup = {
        id: "ungrouped",
        name: "未分组",
        icon: "📦",
        order: 999,
        emojis: []
      };
      groups.push(ungroupedGroup);
    }
    const existingEmoji = ungroupedGroup.emojis.find((e) => e.url === emojiData.url);
    if (existingEmoji) {
      sendResponse({ success: false, error: "此表情已存在于未分组中" });
      return;
    }
    let finalUrl = emojiData.url;
    try {
      if (finalUrl && finalUrl.includes("i.pximg.net")) {
        const chromeAPI2 = getChromeAPI();
        let stored = null;
        if (chromeAPI2 && chromeAPI2.storage && chromeAPI2.storage.local) {
          stored = await new Promise((resolve) => {
            chromeAPI2.storage.local.get(["lastDiscourse"], (res) => resolve(res));
          });
        }
        const last = stored && stored.lastDiscourse ? stored.lastDiscourse : null;
        if (last && last.base) {
          try {
            const uploadResult = await downloadAndUploadDirect(
              finalUrl,
              emojiData.name || "image.png",
              {
                discourseBase: last.base,
                cookie: last.cookie,
                csrf: last.csrf,
                mimeType: void 0
              }
            );
            if (uploadResult && uploadResult.url) finalUrl = uploadResult.url;
          } catch (e) {
            void e;
          }
        }
      }
    } catch (_e) {
      void _e;
    }
    const newEmoji = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: emojiData.name,
      url: finalUrl,
      groupId: "ungrouped",
      addedAt: Date.now()
    };
    ungroupedGroup.emojis.push(newEmoji);
    await newStorageHelpers.setAllEmojiGroups(groups);
    console.log("[Background] 成功添加表情到未分组:", newEmoji.name);
    sendResponse({ success: true, message: "表情已添加到未分组" });
  } catch (error) {
    console.error("[Background] 添加表情失败:", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : "添加失败" });
  }
}
function setupMessageListener() {
  const chromeAPI2 = getChromeAPI();
  if (chromeAPI2 && chromeAPI2.runtime && chromeAPI2.runtime.onMessage) {
    chromeAPI2.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log("Background received message:", message);
      if (message.type) {
        switch (message.type) {
          case "GET_EMOJI_DATA":
            handleGetEmojiData(sendResponse);
            return true;
          case "SAVE_EMOJI_DATA":
            handleSaveEmojiData(message.data, sendResponse);
            return true;
          case "SYNC_SETTINGS":
            handleSyncSettings(message.settings, sendResponse);
            return true;
          case "REQUEST_LINUX_DO_AUTH":
            handleLinuxDoAuthRequest(sendResponse);
            return true;
          default:
            console.log("Unknown message type:", message.type);
            void message.type;
            sendResponse({ success: false, error: "Unknown message type" });
            return false;
        }
      }
      if (message.action) {
        switch (message.action) {
          case "addToFavorites":
            handleAddToFavorites(message.emoji, sendResponse);
            return true;
          case "addEmojiFromWeb":
            handleAddEmojiFromWeb(message.emojiData, sendResponse);
            return true;
          case "requestInject": {
            (async () => {
              try {
                const senderTabId = _sender && _sender.tab && _sender.tab.id ? _sender.tab.id : void 0;
                let tabId = senderTabId;
                const chromeAPI22 = getChromeAPI();
                if (!tabId && chromeAPI22 && chromeAPI22.tabs) {
                  try {
                    const tabs = await chromeAPI22.tabs.query({ active: true, currentWindow: true });
                    if (tabs && tabs[0] && tabs[0].id) tabId = tabs[0].id;
                  } catch (_e) {
                    void _e;
                  }
                }
                if (!tabId) {
                  sendResponse({ success: false, error: "No tabId available" });
                  return;
                }
                const result = await injectContentForTab(tabId, message.pageType || "generic");
                sendResponse(result);
              } catch (e) {
                sendResponse({ success: false, error: String(e) });
              }
            })();
            return true;
          }
          case "downloadAndSendToDiscourse":
            handleDownloadAndSendToDiscourse(message.payload, sendResponse);
            return true;
          case "downloadForUser":
            handleDownloadForUser(message.payload, sendResponse);
            return true;
          case "uploadAndAddEmoji":
            handleUploadAndAddEmoji(message.payload, sendResponse);
            return true;
          case "downloadAndUploadEmoji":
            handleDownloadAndUploadEmoji(message.payload, sendResponse);
            return true;
          case "saveLastDiscourse":
            handleSaveLastDiscourse(message.payload, sendResponse);
            return true;
          default:
            console.log("Unknown action:", message.action);
            void message.action;
            sendResponse({ success: false, error: "Unknown action" });
            return false;
        }
      }
      console.log("Message has no type or action:", message);
      sendResponse({ success: false, error: "Message has no type or action" });
    });
  }
}
async function handleAddToFavorites(emoji, sendResponse) {
  try {
    const groups = await newStorageHelpers.getAllEmojiGroups();
    const favoritesGroup = groups.find((g) => g.id === "favorites");
    if (!favoritesGroup) {
      console.warn("Favorites group not found - creating one");
      const newFavorites = { id: "favorites", name: "Favorites", icon: "⭐", order: 0, emojis: [] };
      groups.unshift(newFavorites);
    }
    const finalGroups = groups;
    const favGroup = finalGroups.find((g) => g.id === "favorites");
    const now = Date.now();
    const existingEmojiIndex = favGroup.emojis.findIndex((e) => e.url === emoji.url);
    if (existingEmojiIndex !== -1) {
      const existingEmoji = favGroup.emojis[existingEmojiIndex];
      const lastUsed = existingEmoji.lastUsed || 0;
      const timeDiff = now - lastUsed;
      const twelveHours = 12 * 60 * 60 * 1e3;
      if (timeDiff < twelveHours) {
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1;
      } else {
        const currentCount = existingEmoji.usageCount || 1;
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1;
        existingEmoji.lastUsed = now;
      }
    } else {
      const favoriteEmoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: "favorites",
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      };
      favGroup.emojis.push(favoriteEmoji);
    }
    favGroup.emojis.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    await newStorageHelpers.setAllEmojiGroups(finalGroups);
    const chromeAPI2 = getChromeAPI();
    if (chromeAPI2 && chromeAPI2.storage && chromeAPI2.storage.local) {
      try {
        await new Promise((resolve, reject) => {
          chromeAPI2.storage.local.set({ emojiGroups: finalGroups }, () => {
            if (chromeAPI2.runtime.lastError) reject(chromeAPI2.runtime.lastError);
            else resolve();
          });
        });
      } catch (_e) {
        void _e;
      }
    }
    sendResponse({ success: true, message: "Added to favorites" });
  } catch (error) {
    console.error("Failed to add emoji to favorites:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleGetEmojiData(_sendResponse) {
  try {
    const groups = await newStorageHelpers.getAllEmojiGroups();
    const settings = await newStorageHelpers.getSettings();
    const favorites = await newStorageHelpers.getFavorites();
    _sendResponse({
      success: true,
      data: {
        groups: groups || [],
        settings: settings || {},
        favorites: favorites || []
      }
    });
  } catch (error) {
    console.error("Failed to get emoji data via newStorageHelpers:", error);
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleSaveEmojiData(data, _sendResponse) {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2 || !chromeAPI2.storage) {
    _sendResponse({ success: false, error: "Chrome storage API not available" });
    return;
  }
  try {
    await chromeAPI2.storage.local.set(data);
    _sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to save emoji data:", error);
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleSyncSettings(settings, _sendResponse) {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2 || !chromeAPI2.storage || !chromeAPI2.tabs) {
    _sendResponse({ success: false, error: "Chrome API not available" });
    return;
  }
  try {
    const timestamp = Date.now();
    const appSettingsData = {
      data: { ...settings, lastModified: timestamp },
      timestamp
    };
    await chromeAPI2.storage.local.set({ appSettings: appSettingsData });
    const tabs = await chromeAPI2.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chromeAPI2.tabs.sendMessage(tab.id, {
          type: "SETTINGS_UPDATED",
          settings
        }).catch(() => {
        });
      }
    }
    _sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to sync settings:", error);
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleLinuxDoAuthRequest(_sendResponse) {
  const chromeAPI2 = getChromeAPI();
  if (!chromeAPI2 || !chromeAPI2.tabs || !chromeAPI2.cookies) {
    _sendResponse({ success: false, error: "Chrome API not available" });
    return;
  }
  try {
    const cookies = await chromeAPI2.cookies.getAll({ domain: "linux.do" });
    const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    let csrfToken = "";
    try {
      const tabs = await chromeAPI2.tabs.query({ url: "https://linux.do/*" });
      if (tabs.length > 0 && tabs[0].id) {
        try {
          const response = await chromeAPI2.tabs.sendMessage(tabs[0].id, {
            type: "GET_CSRF_TOKEN"
          });
          if (response && response.csrfToken) {
            csrfToken = response.csrfToken;
          }
        } catch (sendMessageError) {
          for (let i = 1; i < tabs.length; i++) {
            if (tabs[i].id) {
              try {
                const response = await chromeAPI2.tabs.sendMessage(tabs[i].id, {
                  type: "GET_CSRF_TOKEN"
                });
                if (response && response.csrfToken) {
                  csrfToken = response.csrfToken;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
          if (!csrfToken) {
            console.warn("Failed to get CSRF token from any linux.do tab:", sendMessageError);
          }
        }
      } else {
        console.warn("No linux.do tabs found");
      }
    } catch (e) {
      console.warn("Failed to get CSRF token from linux.do tab:", e);
    }
    _sendResponse({
      success: true,
      csrfToken,
      cookies: cookieString
    });
  } catch (error) {
    console.error("Failed to get linux.do auth info:", error);
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleSaveLastDiscourse(payload, sendResponse) {
  try {
    const chromeAPI2 = getChromeAPI();
    if (!chromeAPI2 || !chromeAPI2.storage || !chromeAPI2.storage.local) {
      sendResponse({ success: false, error: "chrome storage not available" });
      return;
    }
    await new Promise((resolve, reject) => {
      try {
        chromeAPI2.storage.local.set({ lastDiscourse: payload }, () => {
          if (chromeAPI2.runtime.lastError) reject(chromeAPI2.runtime.lastError);
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to save lastDiscourse", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
function setupStorageChangeListener() {
  const chromeAPI2 = getChromeAPI();
  if (chromeAPI2 && chromeAPI2.storage && chromeAPI2.storage.onChanged) {
    chromeAPI2.storage.onChanged.addListener((changes, namespace) => {
      console.log("Storage changed:", changes, namespace);
    });
  }
}
function setupContextMenu() {
  const chromeAPI2 = getChromeAPI();
  if (chromeAPI2 && chromeAPI2.runtime && chromeAPI2.runtime.onInstalled && chromeAPI2.contextMenus) {
    chromeAPI2.runtime.onInstalled.addListener(() => {
      chrome.storage.local.get("appSettings", (result) => {
        let forceMobileMode = false;
        if (result.appSettings) {
          if (result.appSettings.data && typeof result.appSettings.data === "object") {
            forceMobileMode = result.appSettings.data.forceMobileMode || false;
          } else if (typeof result.appSettings === "object") {
            forceMobileMode = result.appSettings.forceMobileMode || false;
          }
        }
        if (chromeAPI2.contextMenus && chromeAPI2.contextMenus.create) {
          chromeAPI2.contextMenus.create({
            id: "open-emoji-options",
            title: "表情管理",
            contexts: ["page"]
          });
          chromeAPI2.contextMenus.create({
            id: "force-mobile-mode",
            title: "强制使用移动模式",
            type: "checkbox",
            checked: forceMobileMode,
            contexts: ["page"]
          });
        }
      });
    });
    if (chromeAPI2.contextMenus.onClicked) {
      chromeAPI2.contextMenus.onClicked.addListener((info, _tab) => {
        if (info.menuItemId === "open-emoji-options" && chromeAPI2.runtime && chromeAPI2.runtime.openOptionsPage) {
          chromeAPI2.runtime.openOptionsPage();
        } else if (info.menuItemId === "force-mobile-mode") {
          const newCheckedState = info.checked;
          chrome.storage.local.get("appSettings", (result) => {
            let currentSettings = {};
            if (result.appSettings) {
              if (result.appSettings.data && typeof result.appSettings.data === "object") {
                currentSettings = result.appSettings.data;
              } else if (typeof result.appSettings === "object") {
                currentSettings = result.appSettings;
              }
            }
            const timestamp = Date.now();
            const updatedSettings = {
              ...currentSettings,
              forceMobileMode: newCheckedState,
              lastModified: timestamp
            };
            const appSettingsData = {
              data: updatedSettings,
              timestamp
            };
            chrome.storage.local.set({ appSettings: appSettingsData });
          });
        }
      });
    }
  }
}
function setupPeriodicCleanup() {
  setInterval(
    async () => {
      const chromeAPI2 = getChromeAPI();
      if (!chromeAPI2 || !chromeAPI2.storage) return;
      try {
        const data = await chromeAPI2.storage.local.get(["emojiGroups"]);
        if (data.emojiGroups) {
          console.log("Storage cleanup check completed");
        }
      } catch (error) {
        console.error("Storage cleanup error:", error);
      }
    },
    24 * 60 * 60 * 1e3
  );
}
console.log("Emoji Extension Background script loaded.");
setupOnInstalledListener();
setupMessageListener();
setupStorageChangeListener();
setupContextMenu();
setupPeriodicCleanup();
const chromeAPI = getChromeAPI();
if (chromeAPI && chromeAPI.tabs && chromeAPI.tabs.onUpdated) {
  chromeAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    var _a;
    try {
      if (changeInfo.status === "complete" && tab && !((_a = tab.url) == null ? void 0 : _a.startsWith("chrome://"))) {
        injectBridgeIntoTab(tabId).catch(() => {
        });
      }
    } catch (e) {
    }
  });
}
