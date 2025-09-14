(function() {
	var __defProp = Object.defineProperty;
	var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
	var __export = (all) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		return target;
	};
	function isImageUrl(value) {
		if (!value) return false;
		let v = value.trim();
		if (/^url\(/i.test(v)) {
			const inner = v.replace(/^url\(/i, "").replace(/\)$/, "").trim();
			if (inner.startsWith("\"") && inner.endsWith("\"") || inner.startsWith("'") && inner.endsWith("'")) v = inner.slice(1, -1).trim();
			else v = inner;
		}
		if (v.startsWith("data:image/")) return true;
		if (v.startsWith("blob:")) return true;
		if (v.startsWith("//")) v = "https:" + v;
		if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(v)) return true;
		try {
			const url = new URL(v);
			const protocol = url.protocol;
			if (protocol === "http:" || protocol === "https:" || protocol.endsWith(":")) {
				if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(url.pathname)) return true;
				if (/format=|ext=|type=image|image_type=/i.test(url.search)) return true;
			}
		} catch {}
		return false;
	}
	async function fetchPackagedJSON() {
		try {
			if (typeof fetch === "undefined") return null;
			const res = await fetch("/assets/defaultEmojiGroups.json", { cache: "no-cache" });
			if (!res.ok) return null;
			return await res.json();
		} catch (err) {
			return null;
		}
	}
	async function loadDefaultEmojiGroups() {
		const packaged = await fetchPackagedJSON();
		if (packaged && Array.isArray(packaged.groups)) return packaged.groups;
		return [];
	}
	var STORAGE_KEY = "emoji_extension_userscript_data";
	var SETTINGS_KEY = "emoji_extension_userscript_settings";
	function loadDataFromLocalStorage() {
		try {
			const groupsData = localStorage.getItem(STORAGE_KEY);
			let emojiGroups = [];
			if (groupsData) try {
				const parsed = JSON.parse(groupsData);
				if (Array.isArray(parsed) && parsed.length > 0) emojiGroups = parsed;
			} catch (e) {
				console.warn("[Userscript] Failed to parse stored emoji groups:", e);
			}
			if (emojiGroups.length === 0) emojiGroups = [];
			const settingsData = localStorage.getItem(SETTINGS_KEY);
			let settings = {
				imageScale: 30,
				gridColumns: 4,
				outputFormat: "markdown",
				forceMobileMode: false,
				defaultGroup: "nachoneko",
				showSearchBar: true
			};
			if (settingsData) try {
				const parsed = JSON.parse(settingsData);
				if (parsed && typeof parsed === "object") settings = {
					...settings,
					...parsed
				};
			} catch (e) {
				console.warn("[Userscript] Failed to parse stored settings:", e);
			}
			emojiGroups = emojiGroups.filter((g) => g.id !== "favorites");
			console.log("[Userscript] Loaded data from localStorage:", {
				groupsCount: emojiGroups.length,
				emojisCount: emojiGroups.reduce((acc, g) => acc + (g.emojis?.length || 0), 0),
				settings
			});
			return {
				emojiGroups,
				settings
			};
		} catch (error) {
			console.error("[Userscript] Failed to load from localStorage:", error);
			console.error("[Userscript] Failed to load from localStorage:", error);
			return {
				emojiGroups: [],
				settings: {
					imageScale: 30,
					gridColumns: 4,
					outputFormat: "markdown",
					forceMobileMode: false,
					defaultGroup: "nachoneko",
					showSearchBar: true
				}
			};
		}
	}
	async function loadDataFromLocalStorageAsync() {
		try {
			const local = loadDataFromLocalStorage();
			if (local.emojiGroups && local.emojiGroups.length > 0) return local;
			const remoteUrl = localStorage.getItem("emoji_extension_remote_config_url");
			if (remoteUrl && typeof remoteUrl === "string" && remoteUrl.trim().length > 0) try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 5e3);
				const res = await fetch(remoteUrl, { signal: controller.signal });
				clearTimeout(timeout);
				if (res && res.ok) {
					const json = await res.json();
					const groups = Array.isArray(json.emojiGroups) ? json.emojiGroups : Array.isArray(json.groups) ? json.groups : null;
					const settings = json.settings && typeof json.settings === "object" ? json.settings : local.settings;
					if (groups && groups.length > 0) {
						try {
							localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
						} catch (e) {
							console.warn("[Userscript] Failed to persist fetched remote groups to localStorage", e);
						}
						return {
							emojiGroups: groups.filter((g) => g.id !== "favorites"),
							settings
						};
					}
				}
			} catch (err) {
				console.warn("[Userscript] Failed to fetch remote default config:", err);
			}
			try {
				const runtime = await loadDefaultEmojiGroups();
				const source = runtime && runtime.length ? runtime : [];
				const filtered = JSON.parse(JSON.stringify(source)).filter((g) => g.id !== "favorites");
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
				} catch (e) {}
				return {
					emojiGroups: filtered,
					settings: local.settings
				};
			} catch (e) {
				console.error("[Userscript] Failed to load default groups in async fallback:", e);
				return {
					emojiGroups: [],
					settings: local.settings
				};
			}
		} catch (error) {
			console.error("[Userscript] loadDataFromLocalStorageAsync failed:", error);
			return {
				emojiGroups: [],
				settings: {
					imageScale: 30,
					gridColumns: 4,
					outputFormat: "markdown",
					forceMobileMode: false,
					defaultGroup: "nachoneko",
					showSearchBar: true
				}
			};
		}
	}
	function saveDataToLocalStorage(data) {
		try {
			if (data.emojiGroups) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.emojiGroups));
			if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
		} catch (error) {
			console.error("[Userscript] Failed to save to localStorage:", error);
		}
	}
	function addEmojiToUserscript(emojiData) {
		try {
			const data = loadDataFromLocalStorage();
			let userGroup = data.emojiGroups.find((g) => g.id === "user_added");
			if (!userGroup) {
				userGroup = {
					id: "user_added",
					name: "用户添加",
					icon: "⭐",
					order: 999,
					emojis: []
				};
				data.emojiGroups.push(userGroup);
			}
			if (!userGroup.emojis.some((e) => e.url === emojiData.url || e.name === emojiData.name)) {
				userGroup.emojis.push({
					packet: Date.now(),
					name: emojiData.name,
					url: emojiData.url
				});
				saveDataToLocalStorage({ emojiGroups: data.emojiGroups });
				console.log("[Userscript] Added emoji to user group:", emojiData.name);
			} else console.log("[Userscript] Emoji already exists:", emojiData.name);
		} catch (error) {
			console.error("[Userscript] Failed to add emoji:", error);
		}
	}
	function exportUserscriptData() {
		try {
			const data = loadDataFromLocalStorage();
			return JSON.stringify(data, null, 2);
		} catch (error) {
			console.error("[Userscript] Failed to export data:", error);
			return "";
		}
	}
	function importUserscriptData(jsonData) {
		try {
			const data = JSON.parse(jsonData);
			if (data.emojiGroups && Array.isArray(data.emojiGroups)) saveDataToLocalStorage({ emojiGroups: data.emojiGroups });
			if (data.settings && typeof data.settings === "object") saveDataToLocalStorage({ settings: data.settings });
			console.log("[Userscript] Data imported successfully");
			return true;
		} catch (error) {
			console.error("[Userscript] Failed to import data:", error);
			return false;
		}
	}
	function syncFromManager() {
		try {
			const managerGroups = localStorage.getItem("emoji_extension_manager_groups");
			const managerSettings = localStorage.getItem("emoji_extension_manager_settings");
			let updated = false;
			if (managerGroups) {
				const groups = JSON.parse(managerGroups);
				if (Array.isArray(groups)) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
					updated = true;
				}
			}
			if (managerSettings) {
				const settings = JSON.parse(managerSettings);
				if (typeof settings === "object") {
					localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
					updated = true;
				}
			}
			if (updated) console.log("[Userscript] Synced data from manager");
			return updated;
		} catch (error) {
			console.error("[Userscript] Failed to sync from manager:", error);
			return false;
		}
	}
	const userscriptState = {
		emojiGroups: [],
		settings: {
			imageScale: 30,
			gridColumns: 4,
			outputFormat: "markdown",
			forceMobileMode: false,
			defaultGroup: "nachoneko",
			showSearchBar: true
		}
	};
	function insertIntoEditor(text) {
		const textArea = document.querySelector("textarea.d-editor-input");
		const richEle = document.querySelector(".ProseMirror.d-editor-input");
		if (!textArea && !richEle) {
			console.error("找不到输入框");
			return;
		}
		if (textArea) {
			const start = textArea.selectionStart;
			const end = textArea.selectionEnd;
			const value = textArea.value;
			textArea.value = value.substring(0, start) + text + value.substring(end);
			textArea.setSelectionRange(start + text.length, start + text.length);
			textArea.focus();
			const event = new Event("input", { bubbles: true });
			textArea.dispatchEvent(event);
		} else if (richEle) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const textNode = document.createTextNode(text);
				range.insertNode(textNode);
				range.setStartAfter(textNode);
				range.setEndAfter(textNode);
				selection.removeAllRanges();
				selection.addRange(range);
			}
			richEle.focus();
		}
	}
	var ImageUploader = class {
		waitingQueue = [];
		uploadingQueue = [];
		failedQueue = [];
		successQueue = [];
		isProcessing = false;
		maxRetries = 2;
		progressDialog = null;
		async uploadImage(file) {
			return new Promise((resolve, reject) => {
				const item = {
					id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					file,
					resolve,
					reject,
					retryCount: 0,
					status: "waiting",
					timestamp: Date.now()
				};
				this.waitingQueue.push(item);
				this.updateProgressDialog();
				this.processQueue();
			});
		}
		moveToQueue(item, targetStatus) {
			this.waitingQueue = this.waitingQueue.filter((i) => i.id !== item.id);
			this.uploadingQueue = this.uploadingQueue.filter((i) => i.id !== item.id);
			this.failedQueue = this.failedQueue.filter((i) => i.id !== item.id);
			this.successQueue = this.successQueue.filter((i) => i.id !== item.id);
			item.status = targetStatus;
			switch (targetStatus) {
				case "waiting":
					this.waitingQueue.push(item);
					break;
				case "uploading":
					this.uploadingQueue.push(item);
					break;
				case "failed":
					this.failedQueue.push(item);
					break;
				case "success":
					this.successQueue.push(item);
					break;
			}
			this.updateProgressDialog();
		}
		async processQueue() {
			if (this.isProcessing || this.waitingQueue.length === 0) return;
			this.isProcessing = true;
			while (this.waitingQueue.length > 0) {
				const item = this.waitingQueue.shift();
				if (!item) continue;
				this.moveToQueue(item, "uploading");
				try {
					const result = await this.performUpload(item.file);
					item.result = result;
					this.moveToQueue(item, "success");
					item.resolve(result);
					const markdown = `![${result.original_filename}](${result.url})`;
					insertIntoEditor(markdown);
				} catch (error) {
					item.error = error;
					if (this.shouldRetry(error, item)) {
						item.retryCount++;
						if (error.error_type === "rate_limit" && error.extras?.wait_seconds) await this.sleep(error.extras.wait_seconds * 1e3);
						else await this.sleep(Math.pow(2, item.retryCount) * 1e3);
						this.moveToQueue(item, "waiting");
					} else {
						this.moveToQueue(item, "failed");
						item.reject(error);
					}
				}
			}
			this.isProcessing = false;
		}
		shouldRetry(error, item) {
			if (item.retryCount >= this.maxRetries) return false;
			return error.error_type === "rate_limit";
		}
		retryFailedItem(itemId) {
			const item = this.failedQueue.find((i) => i.id === itemId);
			if (item && item.retryCount < this.maxRetries) {
				item.retryCount++;
				this.moveToQueue(item, "waiting");
				this.processQueue();
			}
		}
		showProgressDialog() {
			if (this.progressDialog) return;
			this.progressDialog = this.createProgressDialog();
			document.body.appendChild(this.progressDialog);
		}
		hideProgressDialog() {
			if (this.progressDialog) {
				this.progressDialog.remove();
				this.progressDialog = null;
			}
		}
		updateProgressDialog() {
			if (!this.progressDialog) return;
			const allItems = [
				...this.waitingQueue,
				...this.uploadingQueue,
				...this.failedQueue,
				...this.successQueue
			];
			this.renderQueueItems(this.progressDialog, allItems);
		}
		async sleep(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}
		createProgressDialog() {
			const dialog = document.createElement("div");
			dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    `;
			const header = document.createElement("div");
			header.style.cssText = `
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
			header.textContent = "图片上传队列";
			const closeButton = document.createElement("button");
			closeButton.innerHTML = "✕";
			closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `;
			closeButton.addEventListener("click", () => {
				this.hideProgressDialog();
			});
			closeButton.addEventListener("mouseenter", () => {
				closeButton.style.backgroundColor = "#e5e7eb";
			});
			closeButton.addEventListener("mouseleave", () => {
				closeButton.style.backgroundColor = "transparent";
			});
			header.appendChild(closeButton);
			const content = document.createElement("div");
			content.className = "upload-queue-content";
			content.style.cssText = `
      max-height: 320px;
      overflow-y: auto;
      padding: 12px;
    `;
			dialog.appendChild(header);
			dialog.appendChild(content);
			return dialog;
		}
		renderQueueItems(dialog, allItems) {
			const content = dialog.querySelector(".upload-queue-content");
			if (!content) return;
			content.innerHTML = "";
			if (allItems.length === 0) {
				const emptyState = document.createElement("div");
				emptyState.style.cssText = `
        text-align: center;
        color: #6b7280;
        font-size: 14px;
        padding: 20px;
      `;
				emptyState.textContent = "暂无上传任务";
				content.appendChild(emptyState);
				return;
			}
			allItems.forEach((item) => {
				const itemEl = document.createElement("div");
				itemEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin-bottom: 8px;
        background: #f9fafb;
        border-radius: 6px;
        border-left: 4px solid ${this.getStatusColor(item.status)};
      `;
				const leftSide = document.createElement("div");
				leftSide.style.cssText = `
        flex: 1;
        min-width: 0;
      `;
				const fileName = document.createElement("div");
				fileName.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
				fileName.textContent = item.file.name;
				const status = document.createElement("div");
				status.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `;
				status.textContent = this.getStatusText(item);
				leftSide.appendChild(fileName);
				leftSide.appendChild(status);
				const rightSide = document.createElement("div");
				rightSide.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;
				if (item.status === "failed" && item.retryCount < this.maxRetries) {
					const retryButton = document.createElement("button");
					retryButton.innerHTML = "🔄";
					retryButton.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        `;
					retryButton.title = "重试上传";
					retryButton.addEventListener("click", () => {
						this.retryFailedItem(item.id);
					});
					retryButton.addEventListener("mouseenter", () => {
						retryButton.style.backgroundColor = "#e5e7eb";
					});
					retryButton.addEventListener("mouseleave", () => {
						retryButton.style.backgroundColor = "transparent";
					});
					rightSide.appendChild(retryButton);
				}
				const statusIcon = document.createElement("div");
				statusIcon.style.cssText = `
        font-size: 16px;
      `;
				statusIcon.textContent = this.getStatusIcon(item.status);
				rightSide.appendChild(statusIcon);
				itemEl.appendChild(leftSide);
				itemEl.appendChild(rightSide);
				content.appendChild(itemEl);
			});
		}
		getStatusColor(status) {
			switch (status) {
				case "waiting": return "#f59e0b";
				case "uploading": return "#3b82f6";
				case "success": return "#10b981";
				case "failed": return "#ef4444";
				default: return "#6b7280";
			}
		}
		getStatusText(item) {
			switch (item.status) {
				case "waiting": return "等待上传";
				case "uploading": return "正在上传...";
				case "success": return "上传成功";
				case "failed":
					if (item.error?.error_type === "rate_limit") return `上传失败 - 请求过于频繁 (重试 ${item.retryCount}/${this.maxRetries})`;
					return `上传失败 (重试 ${item.retryCount}/${this.maxRetries})`;
				default: return "未知状态";
			}
		}
		getStatusIcon(status) {
			switch (status) {
				case "waiting": return "⏳";
				case "uploading": return "📤";
				case "success": return "✅";
				case "failed": return "❌";
				default: return "❓";
			}
		}
		async performUpload(file) {
			const sha1 = await this.calculateSHA1(file);
			const formData = new FormData();
			formData.append("upload_type", "composer");
			formData.append("relativePath", "null");
			formData.append("name", file.name);
			formData.append("type", file.type);
			formData.append("sha1_checksum", sha1);
			formData.append("file", file, file.name);
			const csrfToken = this.getCSRFToken();
			const headers = { "X-Csrf-Token": csrfToken };
			if (document.cookie) headers["Cookie"] = document.cookie;
			const response = await fetch(`https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`, {
				method: "POST",
				headers,
				body: formData
			});
			if (!response.ok) throw await response.json();
			return await response.json();
		}
		getCSRFToken() {
			const metaToken = document.querySelector("meta[name=\"csrf-token\"]");
			if (metaToken) return metaToken.content;
			const match = document.cookie.match(/csrf_token=([^;]+)/);
			if (match) return decodeURIComponent(match[1]);
			const hiddenInput = document.querySelector("input[name=\"authenticity_token\"]");
			if (hiddenInput) return hiddenInput.value;
			console.warn("[Image Uploader] No CSRF token found");
			return "";
		}
		async calculateSHA1(file) {
			const text = `${file.name}-${file.size}-${file.lastModified}`;
			const data = new TextEncoder().encode(text);
			if (crypto.subtle) try {
				const hashBuffer = await crypto.subtle.digest("SHA-1", data);
				return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
			} catch (e) {
				console.warn("[Image Uploader] Could not calculate SHA1, using fallback");
			}
			let hash = 0;
			for (let i = 0; i < text.length; i++) {
				const char = text.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash;
			}
			return Math.abs(hash).toString(16).padStart(40, "0");
		}
	};
	var uploader = new ImageUploader();
	var __managerStylesInjected = false;
	function injectManagerStyles() {
		if (__managerStylesInjected) return;
		__managerStylesInjected = true;
		const css = `
    .emoji-manager-wrapper { display:flex; flex-direction:column; height:100%; width:100%; overflow:hidden; }
    /* Fullscreen modal: panel fills the viewport */
    .emoji-manager-panel { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display:grid; grid-template-columns: 300px 1fr; gap:12px; align-items:start; padding:12px; box-sizing:border-box; background: rgba(0,0,0,0.8); }
    .emoji-manager-left { overflow:auto; padding-right:8px; box-sizing:border-box; background: #fff; border-right:1px solid #eee; }
    .emoji-manager-left .emoji-manager-addgroup-row { display:flex; gap:8px; padding:8px; }
    .emoji-manager-groups-list > div { padding:6px; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
    .emoji-manager-groups-list > div:focus { outline: none; box-shadow: inset 0 0 0 2px #e6f2ff; }
    .emoji-manager-right { display:flex; flex-direction:column; }
    .emoji-manager-right-header { display:flex; align-items:center; gap:8px; padding-bottom:6px; border-bottom:1px solid #eee; }
    .emoji-manager-right-main { flex:1 1 auto; overflow:auto; display:flex; flex-direction:column; gap:8px; box-sizing:border-box; padding-left:8px; }
    .emoji-manager-emojis { display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:8px; align-content:start; padding:6px; box-sizing:border-box; }
    .emoji-manager-card { display:flex; flex-direction:column; gap:6px; align-items:center; padding:8px; background:#fff; border:1px solid #eee; border-radius:8px; }
    .emoji-manager-card-img { width:96px; height:96px; object-fit:contain; border-radius:6px; background:#fafafa; }
    .emoji-manager-card-name { font-size:12px; color:#333; text-align:center; width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .emoji-manager-card-actions { display:flex; gap:6px; }
    .emoji-manager-footer { display:flex; gap:8px; justify-content:flex-end; padding:8px 12px; border-top:1px solid #eee; }
    /* Note: responsive stacking disabled - always two columns */
  `;
		const style = document.createElement("style");
		style.setAttribute("data-emoji-manager-styles", "1");
		style.textContent = css;
		document.head.appendChild(style);
	}
	const __vitePreload = function preload(baseModule, deps, importerUrl) {
		let promise = Promise.resolve();
		function handlePreloadError(err$2) {
			const e$1 = new Event("vite:preloadError", { cancelable: true });
			e$1.payload = err$2;
			window.dispatchEvent(e$1);
			if (!e$1.defaultPrevented) throw err$2;
		}
		return promise.then((res) => {
			for (const item of res || []) {
				if (item.status !== "rejected") continue;
				handlePreloadError(item.reason);
			}
			return baseModule().catch(handlePreloadError);
		});
	};
	var confirmService_exports = __export({
		clearConfirmHandler: () => clearConfirmHandler,
		requestConfirmation: () => requestConfirmation,
		setConfirmHandler: () => setConfirmHandler
	});
	function setConfirmHandler(h) {
		handler = h;
	}
	function clearConfirmHandler() {
		handler = null;
	}
	function requestConfirmation(title, message) {
		if (handler) return handler(title, message);
		try {
			return Promise.resolve(window.confirm(message || title || "确定要继续吗？"));
		} catch {
			return Promise.resolve(false);
		}
	}
	var handler;
	var init_confirmService = __esmMin((() => {
		handler = null;
	}));
	async function initializeUserscriptData() {
		const data = await loadDataFromLocalStorageAsync().catch((err) => {
			console.warn("[Userscript] loadDataFromLocalStorageAsync failed, falling back to sync loader", err);
			return loadDataFromLocalStorage();
		});
		userscriptState.emojiGroups = data.emojiGroups || [];
		userscriptState.settings = data.settings || userscriptState.settings;
	}
	function shouldInjectEmoji() {
		if (document.querySelectorAll("meta[name*=\"discourse\"], meta[content*=\"discourse\"], meta[property*=\"discourse\"]").length > 0) {
			console.log("[Emoji Extension Userscript] Discourse detected via meta tags");
			return true;
		}
		const generatorMeta = document.querySelector("meta[name=\"generator\"]");
		if (generatorMeta) {
			const content = generatorMeta.getAttribute("content")?.toLowerCase() || "";
			if (content.includes("discourse") || content.includes("flarum") || content.includes("phpbb")) {
				console.log("[Emoji Extension Userscript] Forum platform detected via generator meta");
				return true;
			}
		}
		const hostname = window.location.hostname.toLowerCase();
		if ([
			"linux.do",
			"meta.discourse.org",
			"pixiv.net"
		].some((domain) => hostname.includes(domain))) {
			console.log("[Emoji Extension Userscript] Allowed domain detected:", hostname);
			return true;
		}
		if (document.querySelectorAll("textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea").length > 0) {
			console.log("[Emoji Extension Userscript] Discussion editor detected");
			return true;
		}
		console.log("[Emoji Extension Userscript] No compatible platform detected");
		return false;
	}
	function insertEmojiIntoEditor(emoji) {
		console.log("[Emoji Extension Userscript] Inserting emoji:", emoji);
		const textarea = document.querySelector("textarea.d-editor-input");
		const proseMirror = document.querySelector(".ProseMirror.d-editor-input");
		if (!textarea && !proseMirror) {
			console.error("找不到输入框");
			return;
		}
		const dimensionMatch = emoji.url?.match(/_(\d{3,})x(\d{3,})\./);
		let width = "500";
		let height = "500";
		if (dimensionMatch) {
			width = dimensionMatch[1];
			height = dimensionMatch[2];
		} else if (emoji.width && emoji.height) {
			width = emoji.width.toString();
			height = emoji.height.toString();
		}
		const scale = userscriptState.settings?.imageScale || 30;
		const outputFormat = userscriptState.settings?.outputFormat || "markdown";
		if (textarea) {
			let insertText = "";
			if (outputFormat === "html") {
				const scaledWidth = Math.max(1, Math.round(Number(width) * (scale / 100)));
				const scaledHeight = Math.max(1, Math.round(Number(height) * (scale / 100)));
				insertText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};"> `;
			} else insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `;
			const selectionStart = textarea.selectionStart;
			const selectionEnd = textarea.selectionEnd;
			textarea.value = textarea.value.substring(0, selectionStart) + insertText + textarea.value.substring(selectionEnd, textarea.value.length);
			textarea.selectionStart = textarea.selectionEnd = selectionStart + insertText.length;
			textarea.focus();
			const inputEvent = new Event("input", {
				bubbles: true,
				cancelable: true
			});
			textarea.dispatchEvent(inputEvent);
		} else if (proseMirror) {
			const imgWidth = Number(width) || 500;
			const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)));
			const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px">`;
			try {
				const dataTransfer = new DataTransfer();
				dataTransfer.setData("text/html", htmlContent);
				const pasteEvent = new ClipboardEvent("paste", {
					clipboardData: dataTransfer,
					bubbles: true
				});
				proseMirror.dispatchEvent(pasteEvent);
			} catch (error) {
				try {
					document.execCommand("insertHTML", false, htmlContent);
				} catch (fallbackError) {
					console.error("无法向富文本编辑器中插入表情", fallbackError);
				}
			}
		}
	}
	var toolbarSelectors = [".d-editor-button-bar[role=\"toolbar\"]", ".chat-composer__inner-container"];
	function findAllToolbars() {
		const toolbars = [];
		for (const selector of toolbarSelectors) {
			const elements = document.querySelectorAll(selector);
			toolbars.push(...Array.from(elements));
		}
		return toolbars;
	}
	function isMobileView() {
		try {
			return !!(userscriptState && userscriptState.settings && userscriptState.settings.forceMobileMode);
		} catch (e) {
			return false;
		}
	}
	async function createEmojiPicker() {
		const groups = userscriptState.emojiGroups;
		if (isMobileView()) {
			const modal = document.createElement("div");
			modal.className = "modal d-modal fk-d-menu-modal emoji-picker-content";
			modal.setAttribute("data-keyboard", "false");
			modal.setAttribute("aria-modal", "true");
			modal.setAttribute("role", "dialog");
			modal.setAttribute("data-identifier", "emoji-picker");
			const modalContainerDiv = document.createElement("div");
			modalContainerDiv.className = "d-modal__container";
			const modalBody = document.createElement("div");
			modalBody.className = "d-modal__body";
			modalBody.tabIndex = -1;
			const emojiPickerDiv$1 = document.createElement("div");
			emojiPickerDiv$1.className = "emoji-picker";
			const filterContainer$1 = document.createElement("div");
			filterContainer$1.className = "emoji-picker__filter-container";
			const filterInputContainer = document.createElement("div");
			filterInputContainer.className = "emoji-picker__filter filter-input-container";
			const filterInput = document.createElement("input");
			filterInput.className = "filter-input";
			filterInput.placeholder = "按表情符号名称搜索…";
			filterInput.type = "text";
			filterInputContainer.appendChild(filterInput);
			const closeButton = document.createElement("button");
			closeButton.className = "btn no-text btn-icon btn-transparent emoji-picker__close-btn";
			closeButton.type = "button";
			closeButton.innerHTML = `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`;
			closeButton.addEventListener("click", () => {
				const container = modal.closest(".modal-container") || modal;
				if (container) container.remove();
			});
			filterContainer$1.appendChild(filterInputContainer);
			filterContainer$1.appendChild(closeButton);
			const content$1 = document.createElement("div");
			content$1.className = "emoji-picker__content";
			const sectionsNav$1 = document.createElement("div");
			sectionsNav$1.className = "emoji-picker__sections-nav";
			const managementButton$1 = document.createElement("button");
			managementButton$1.className = "btn no-text btn-flat emoji-picker__section-btn management-btn";
			managementButton$1.setAttribute("tabindex", "-1");
			managementButton$1.type = "button";
			managementButton$1.innerHTML = "⚙️";
			managementButton$1.title = "管理表情 - 点击打开完整管理界面";
			managementButton$1.style.borderRight = "1px solid #ddd";
			managementButton$1.addEventListener("click", () => {
				openManagementInterface();
			});
			sectionsNav$1.appendChild(managementButton$1);
			const settingsButton$1 = document.createElement("button");
			settingsButton$1.className = "btn no-text btn-flat emoji-picker__section-btn settings-btn";
			settingsButton$1.setAttribute("tabindex", "-1");
			settingsButton$1.type = "button";
			settingsButton$1.innerHTML = "🔧";
			settingsButton$1.title = "设置";
			settingsButton$1.style.borderRight = "1px solid #ddd";
			settingsButton$1.addEventListener("click", () => {
				showSettingsModal();
			});
			sectionsNav$1.appendChild(settingsButton$1);
			const scrollableContent$1 = document.createElement("div");
			scrollableContent$1.className = "emoji-picker__scrollable-content";
			const sections$1 = document.createElement("div");
			sections$1.className = "emoji-picker__sections";
			sections$1.setAttribute("role", "button");
			groups.forEach((group, index) => {
				if (!group?.emojis?.length) return;
				const navButton = document.createElement("button");
				navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? "active" : ""}`;
				navButton.setAttribute("tabindex", "-1");
				navButton.setAttribute("data-section", group.id);
				navButton.type = "button";
				const iconVal = group.icon || "📁";
				if (isImageUrl(iconVal)) {
					const img = document.createElement("img");
					img.src = iconVal;
					img.alt = group.name || "";
					img.className = "emoji";
					img.style.width = "18px";
					img.style.height = "18px";
					img.style.objectFit = "contain";
					navButton.appendChild(img);
				} else navButton.textContent = String(iconVal);
				navButton.title = group.name;
				navButton.addEventListener("click", () => {
					sectionsNav$1.querySelectorAll(".emoji-picker__section-btn").forEach((btn) => btn.classList.remove("active"));
					navButton.classList.add("active");
					const target = sections$1.querySelector(`[data-section="${group.id}"]`);
					if (target) target.scrollIntoView({
						behavior: "smooth",
						block: "start"
					});
				});
				sectionsNav$1.appendChild(navButton);
				const section = document.createElement("div");
				section.className = "emoji-picker__section";
				section.setAttribute("data-section", group.id);
				section.setAttribute("role", "region");
				section.setAttribute("aria-label", group.name);
				const titleContainer = document.createElement("div");
				titleContainer.className = "emoji-picker__section-title-container";
				const title = document.createElement("h2");
				title.className = "emoji-picker__section-title";
				title.textContent = group.name;
				titleContainer.appendChild(title);
				const sectionEmojis = document.createElement("div");
				sectionEmojis.className = "emoji-picker__section-emojis";
				group.emojis.forEach((emoji) => {
					if (!emoji || typeof emoji !== "object" || !emoji.url || !emoji.name) return;
					const img = document.createElement("img");
					img.width = 32;
					img.height = 32;
					img.className = "emoji";
					img.src = emoji.url;
					img.tabIndex = 0;
					img.dataset.emoji = emoji.name;
					img.alt = emoji.name;
					img.title = `:${emoji.name}:`;
					img.loading = "lazy";
					img.addEventListener("click", () => {
						insertEmojiIntoEditor(emoji);
						const modalContainer = modal.closest(".modal-container");
						if (modalContainer) modalContainer.remove();
						else modal.remove();
					});
					img.addEventListener("keydown", (e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							insertEmojiIntoEditor(emoji);
							const modalContainer = modal.closest(".modal-container");
							if (modalContainer) modalContainer.remove();
							else modal.remove();
						}
					});
					sectionEmojis.appendChild(img);
				});
				section.appendChild(titleContainer);
				section.appendChild(sectionEmojis);
				sections$1.appendChild(section);
			});
			filterInput.addEventListener("input", (e) => {
				const q = (e.target.value || "").toLowerCase();
				sections$1.querySelectorAll("img").forEach((img) => {
					const emojiName = (img.dataset.emoji || "").toLowerCase();
					img.style.display = q === "" || emojiName.includes(q) ? "" : "none";
				});
				sections$1.querySelectorAll(".emoji-picker__section").forEach((section) => {
					const visibleEmojis = section.querySelectorAll("img:not([style*=\"display: none\"])");
					section.style.display = visibleEmojis.length > 0 ? "" : "none";
				});
			});
			scrollableContent$1.appendChild(sections$1);
			content$1.appendChild(sectionsNav$1);
			content$1.appendChild(scrollableContent$1);
			emojiPickerDiv$1.appendChild(filterContainer$1);
			emojiPickerDiv$1.appendChild(content$1);
			modalBody.appendChild(emojiPickerDiv$1);
			modalContainerDiv.appendChild(modalBody);
			modal.appendChild(modalContainerDiv);
			return modal;
		}
		const picker = document.createElement("div");
		picker.className = "fk-d-menu -animated -expanded";
		picker.setAttribute("data-identifier", "emoji-picker");
		picker.setAttribute("role", "dialog");
		picker.style.cssText = "max-width: 400px; visibility: visible; z-index: 999999;";
		const innerContent = document.createElement("div");
		innerContent.className = "fk-d-menu__inner-content";
		const emojiPickerDiv = document.createElement("div");
		emojiPickerDiv.className = "emoji-picker";
		const filterContainer = document.createElement("div");
		filterContainer.className = "emoji-picker__filter-container";
		const filterDiv = document.createElement("div");
		filterDiv.className = "emoji-picker__filter filter-input-container";
		const searchInput = document.createElement("input");
		searchInput.className = "filter-input";
		searchInput.placeholder = "按表情符号名称搜索…";
		searchInput.type = "text";
		filterDiv.appendChild(searchInput);
		filterContainer.appendChild(filterDiv);
		const content = document.createElement("div");
		content.className = "emoji-picker__content";
		const sectionsNav = document.createElement("div");
		sectionsNav.className = "emoji-picker__sections-nav";
		const managementButton = document.createElement("button");
		managementButton.className = "btn no-text btn-flat emoji-picker__section-btn management-btn";
		managementButton.setAttribute("tabindex", "-1");
		managementButton.type = "button";
		managementButton.innerHTML = "⚙️";
		managementButton.title = "管理表情 - 点击打开完整管理界面";
		managementButton.style.borderRight = "1px solid #ddd";
		managementButton.addEventListener("click", () => {
			openManagementInterface();
		});
		sectionsNav.appendChild(managementButton);
		const settingsButton = document.createElement("button");
		settingsButton.className = "btn no-text btn-flat emoji-picker__section-btn settings-btn";
		settingsButton.setAttribute("tabindex", "-1");
		settingsButton.type = "button";
		settingsButton.innerHTML = "🔧";
		settingsButton.title = "设置";
		settingsButton.style.borderRight = "1px solid #ddd";
		settingsButton.addEventListener("click", () => {
			showSettingsModal();
		});
		sectionsNav.appendChild(settingsButton);
		const scrollableContent = document.createElement("div");
		scrollableContent.className = "emoji-picker__scrollable-content";
		const sections = document.createElement("div");
		sections.className = "emoji-picker__sections";
		sections.setAttribute("role", "button");
		groups.forEach((group, index) => {
			if (!group?.emojis?.length) return;
			const navButton = document.createElement("button");
			navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? "active" : ""}`;
			navButton.setAttribute("tabindex", "-1");
			navButton.setAttribute("data-section", group.id);
			navButton.type = "button";
			const iconVal = group.icon || "📁";
			if (isImageUrl(iconVal)) {
				const img = document.createElement("img");
				img.src = iconVal;
				img.alt = group.name || "";
				img.className = "emoji-group-icon";
				img.style.width = "18px";
				img.style.height = "18px";
				img.style.objectFit = "contain";
				navButton.appendChild(img);
			} else navButton.textContent = String(iconVal);
			navButton.title = group.name;
			navButton.addEventListener("click", () => {
				sectionsNav.querySelectorAll(".emoji-picker__section-btn").forEach((btn) => btn.classList.remove("active"));
				navButton.classList.add("active");
				const target = sections.querySelector(`[data-section="${group.id}"]`);
				if (target) target.scrollIntoView({
					behavior: "smooth",
					block: "start"
				});
			});
			sectionsNav.appendChild(navButton);
			const section = document.createElement("div");
			section.className = "emoji-picker__section";
			section.setAttribute("data-section", group.id);
			section.setAttribute("role", "region");
			section.setAttribute("aria-label", group.name);
			const titleContainer = document.createElement("div");
			titleContainer.className = "emoji-picker__section-title-container";
			const title = document.createElement("h2");
			title.className = "emoji-picker__section-title";
			title.textContent = group.name;
			titleContainer.appendChild(title);
			const sectionEmojis = document.createElement("div");
			sectionEmojis.className = "emoji-picker__section-emojis";
			let added = 0;
			group.emojis.forEach((emoji) => {
				if (!emoji || typeof emoji !== "object" || !emoji.url || !emoji.name) return;
				const img = document.createElement("img");
				img.width = 32;
				img.height = 32;
				img.className = "emoji";
				img.src = emoji.url;
				img.setAttribute("tabindex", "0");
				img.setAttribute("data-emoji", emoji.name);
				img.alt = emoji.name;
				img.title = `:${emoji.name}:`;
				img.loading = "lazy";
				img.addEventListener("click", () => {
					insertEmojiIntoEditor(emoji);
					picker.remove();
				});
				img.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						insertEmojiIntoEditor(emoji);
						picker.remove();
					}
				});
				sectionEmojis.appendChild(img);
				added++;
			});
			if (added === 0) {
				const msg = document.createElement("div");
				msg.textContent = `${group.name} 组暂无有效表情`;
				msg.style.cssText = "padding: 20px; text-align: center; color: #999;";
				sectionEmojis.appendChild(msg);
			}
			section.appendChild(titleContainer);
			section.appendChild(sectionEmojis);
			sections.appendChild(section);
		});
		searchInput.addEventListener("input", (e) => {
			const q = (e.target.value || "").toLowerCase();
			sections.querySelectorAll("img").forEach((img) => {
				const emojiName = img.getAttribute("data-emoji")?.toLowerCase() || "";
				img.style.display = q === "" || emojiName.includes(q) ? "" : "none";
			});
			sections.querySelectorAll(".emoji-picker__section").forEach((section) => {
				const visibleEmojis = section.querySelectorAll("img:not([style*=\"none\"])");
				const titleContainer = section.querySelector(".emoji-picker__section-title-container");
				if (titleContainer) titleContainer.style.display = visibleEmojis.length > 0 ? "" : "none";
			});
		});
		scrollableContent.appendChild(sections);
		content.appendChild(sectionsNav);
		content.appendChild(scrollableContent);
		emojiPickerDiv.appendChild(filterContainer);
		emojiPickerDiv.appendChild(content);
		innerContent.appendChild(emojiPickerDiv);
		picker.appendChild(innerContent);
		return picker;
	}
	function openManagementInterface() {
		injectManagerStyles();
		const modal = document.createElement("div");
		modal.className = "modal d-modal";
		modal.setAttribute("role", "dialog");
		modal.setAttribute("aria-modal", "true");
		const panel = document.createElement("div");
		panel.className = "d-modal__container emoji-manager-panel";
		const left = document.createElement("div");
		left.className = "emoji-manager-left";
		const leftHeader = document.createElement("div");
		leftHeader.className = "emoji-manager-left-header";
		const title = document.createElement("h3");
		title.textContent = "表情管理器";
		title.style.cssText = "margin:0; flex:1;";
		const closeBtn = document.createElement("button");
		closeBtn.textContent = "×";
		closeBtn.style.cssText = "font-size:20px; background:none; border:none; cursor:pointer;";
		leftHeader.appendChild(title);
		leftHeader.appendChild(closeBtn);
		left.appendChild(leftHeader);
		const addGroupRow = document.createElement("div");
		addGroupRow.className = "emoji-manager-addgroup-row";
		const addGroupInput = document.createElement("input");
		addGroupInput.placeholder = "新分组 id";
		addGroupInput.className = "form-control";
		const addGroupBtn = document.createElement("button");
		addGroupBtn.textContent = "添加";
		addGroupBtn.className = "btn";
		addGroupRow.appendChild(addGroupInput);
		addGroupRow.appendChild(addGroupBtn);
		left.appendChild(addGroupRow);
		const groupsList = document.createElement("div");
		groupsList.className = "emoji-manager-groups-list";
		left.appendChild(groupsList);
		const right = document.createElement("div");
		right.className = "emoji-manager-right";
		const rightHeader = document.createElement("div");
		rightHeader.className = "emoji-manager-right-header";
		const groupTitle = document.createElement("h4");
		groupTitle.textContent = "";
		groupTitle.style.cssText = "margin:0; flex:1;";
		const deleteGroupBtn = document.createElement("button");
		deleteGroupBtn.textContent = "删除分组";
		deleteGroupBtn.style.cssText = "padding:6px 8px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;";
		rightHeader.appendChild(groupTitle);
		rightHeader.appendChild(deleteGroupBtn);
		right.appendChild(rightHeader);
		const managerRightMain = document.createElement("div");
		managerRightMain.className = "emoji-manager-right-main";
		const emojisContainer = document.createElement("div");
		emojisContainer.className = "emoji-manager-emojis";
		managerRightMain.appendChild(emojisContainer);
		right.appendChild(managerRightMain);
		const editorPanel = document.createElement("div");
		editorPanel.className = "emoji-manager-editor-panel";
		editorPanel.style.display = "none";
		const editorPreview = document.createElement("img");
		editorPreview.className = "emoji-manager-editor-preview";
		const editorNameInput = document.createElement("input");
		editorNameInput.className = "form-control";
		editorNameInput.placeholder = "名称 (alias)";
		const editorUrlInput = document.createElement("input");
		editorUrlInput.className = "form-control";
		editorUrlInput.placeholder = "表情图片 URL";
		const editorSaveBtn = document.createElement("button");
		editorSaveBtn.textContent = "保存修改";
		editorSaveBtn.className = "btn btn-primary";
		const editorCancelBtn = document.createElement("button");
		editorCancelBtn.textContent = "取消";
		editorCancelBtn.className = "btn";
		editorPanel.appendChild(editorPreview);
		editorPanel.appendChild(editorNameInput);
		editorPanel.appendChild(editorUrlInput);
		editorPanel.appendChild(editorSaveBtn);
		editorPanel.appendChild(editorCancelBtn);
		right.appendChild(editorPanel);
		const addEmojiForm = document.createElement("div");
		addEmojiForm.className = "emoji-manager-add-emoji-form";
		const emojiUrlInput = document.createElement("input");
		emojiUrlInput.placeholder = "表情图片 URL";
		emojiUrlInput.className = "form-control";
		const emojiNameInput = document.createElement("input");
		emojiNameInput.placeholder = "名称 (alias)";
		emojiNameInput.className = "form-control";
		const addEmojiBtn = document.createElement("button");
		addEmojiBtn.textContent = "添加表情";
		addEmojiBtn.className = "btn";
		addEmojiForm.appendChild(emojiUrlInput);
		addEmojiForm.appendChild(emojiNameInput);
		addEmojiForm.appendChild(addEmojiBtn);
		right.appendChild(addEmojiForm);
		const footer = document.createElement("div");
		footer.className = "emoji-manager-footer";
		const exportBtn = document.createElement("button");
		exportBtn.textContent = "导出";
		exportBtn.className = "btn";
		const importBtn = document.createElement("button");
		importBtn.textContent = "导入";
		importBtn.className = "btn";
		const exitBtn = document.createElement("button");
		exitBtn.textContent = "退出";
		exitBtn.className = "btn";
		exitBtn.addEventListener("click", () => modal.remove());
		const saveBtn = document.createElement("button");
		saveBtn.textContent = "保存";
		saveBtn.className = "btn btn-primary";
		const syncBtn = document.createElement("button");
		syncBtn.textContent = "同步管理器";
		syncBtn.className = "btn";
		footer.appendChild(syncBtn);
		footer.appendChild(exportBtn);
		footer.appendChild(importBtn);
		footer.appendChild(exitBtn);
		footer.appendChild(saveBtn);
		panel.appendChild(left);
		panel.appendChild(right);
		const wrapper = document.createElement("div");
		wrapper.className = "emoji-manager-wrapper";
		wrapper.appendChild(panel);
		wrapper.appendChild(footer);
		modal.appendChild(wrapper);
		document.body.appendChild(modal);
		let selectedGroupId = null;
		function renderGroups() {
			groupsList.innerHTML = "";
			if (!selectedGroupId && userscriptState.emojiGroups.length > 0) selectedGroupId = userscriptState.emojiGroups[0].id;
			userscriptState.emojiGroups.forEach((g) => {
				const row = document.createElement("div");
				row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:6px; border-radius:4px; cursor:pointer;";
				row.tabIndex = 0;
				row.textContent = `${g.name || g.id} (${(g.emojis || []).length})`;
				row.dataset.groupId = g.id;
				const selectGroup = () => {
					selectedGroupId = g.id;
					renderGroups();
					renderSelectedGroup();
				};
				row.addEventListener("click", selectGroup);
				row.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						selectGroup();
					}
				});
				if (selectedGroupId === g.id) row.style.background = "#f0f8ff";
				groupsList.appendChild(row);
			});
		}
		let editingContext = null;
		function showEditorFor(groupId, index) {
			const group = userscriptState.emojiGroups.find((g) => g.id === groupId);
			if (!group) return;
			const emo = group.emojis[index];
			if (!emo) return;
			editingContext = {
				groupId,
				index
			};
			editorPreview.src = emo.url;
			editorNameInput.value = emo.name || "";
			editorUrlInput.value = emo.url || "";
			editorPanel.style.display = "";
		}
		editorCancelBtn.addEventListener("click", () => {
			editingContext = null;
			editorPanel.style.display = "none";
		});
		editorSaveBtn.addEventListener("click", () => {
			if (!editingContext) return;
			const group = userscriptState.emojiGroups.find((g) => g.id === editingContext.groupId);
			if (!group) return;
			const emo = group.emojis[editingContext.index];
			if (!emo) return;
			const newName = (editorNameInput.value || "").trim();
			const newUrl = (editorUrlInput.value || "").trim();
			if (!newName || !newUrl) return alert("名称和 URL 均不能为空");
			emo.name = newName;
			emo.url = newUrl;
			editorPreview.src = newUrl;
			renderGroups();
			renderSelectedGroup();
			editingContext = null;
			editorPanel.style.display = "none";
		});
		function renderSelectedGroup() {
			const group = userscriptState.emojiGroups.find((g) => g.id === selectedGroupId) || null;
			groupTitle.textContent = group ? group.name || group.id : "";
			emojisContainer.innerHTML = "";
			if (!group) return;
			(Array.isArray(group.emojis) ? group.emojis : []).forEach((emo, idx) => {
				const card = document.createElement("div");
				card.className = "emoji-manager-card";
				card.classList.add("emoji-manager-card");
				const img = document.createElement("img");
				img.src = emo.url;
				img.alt = emo.name;
				img.className = "emoji-manager-card-img";
				const name = document.createElement("div");
				name.textContent = emo.name;
				name.className = "emoji-manager-card-name";
				const actions = document.createElement("div");
				actions.className = "emoji-manager-card-actions";
				const edit = document.createElement("button");
				edit.textContent = "编辑";
				edit.className = "btn btn-sm";
				edit.addEventListener("click", () => {
					showEditorFor(group.id, idx);
				});
				const del = document.createElement("button");
				del.textContent = "删除";
				del.className = "btn btn-sm";
				del.addEventListener("click", () => {
					group.emojis.splice(idx, 1);
					renderGroups();
					renderSelectedGroup();
				});
				actions.appendChild(edit);
				actions.appendChild(del);
				card.appendChild(img);
				card.appendChild(name);
				card.appendChild(actions);
				emojisContainer.appendChild(card);
			});
		}
		addGroupBtn.addEventListener("click", () => {
			const id = (addGroupInput.value || "").trim();
			if (!id) return alert("请输入分组 id");
			if (userscriptState.emojiGroups.find((g) => g.id === id)) return alert("分组已存在");
			userscriptState.emojiGroups.push({
				id,
				name: id,
				emojis: []
			});
			addGroupInput.value = "";
			const newIdx = userscriptState.emojiGroups.findIndex((g) => g.id === id);
			if (newIdx >= 0) selectedGroupId = userscriptState.emojiGroups[newIdx].id;
			renderGroups();
			renderSelectedGroup();
		});
		addEmojiBtn.addEventListener("click", () => {
			if (!selectedGroupId) return alert("请先选择分组");
			const url = (emojiUrlInput.value || "").trim();
			const name = (emojiNameInput.value || "").trim();
			if (!url || !name) return alert("请输入 url 和 名称");
			const group = userscriptState.emojiGroups.find((g) => g.id === selectedGroupId);
			if (!group) return;
			group.emojis = group.emojis || [];
			group.emojis.push({
				url,
				name
			});
			emojiUrlInput.value = "";
			emojiNameInput.value = "";
			renderGroups();
			renderSelectedGroup();
		});
		deleteGroupBtn.addEventListener("click", () => {
			if (!selectedGroupId) return alert("请先选择分组");
			const idx = userscriptState.emojiGroups.findIndex((g) => g.id === selectedGroupId);
			if (idx >= 0) {
				if (!confirm("确认删除该分组？该操作不可撤销")) return;
				userscriptState.emojiGroups.splice(idx, 1);
				if (userscriptState.emojiGroups.length > 0) selectedGroupId = userscriptState.emojiGroups[Math.min(idx, userscriptState.emojiGroups.length - 1)].id;
				else selectedGroupId = null;
				renderGroups();
				renderSelectedGroup();
			}
		});
		exportBtn.addEventListener("click", () => {
			const data = exportUserscriptData();
			navigator.clipboard.writeText(data).then(() => alert("已复制到剪贴板")).catch(() => {
				const ta = document.createElement("textarea");
				ta.value = data;
				document.body.appendChild(ta);
				ta.select();
			});
		});
		importBtn.addEventListener("click", () => {
			const ta = document.createElement("textarea");
			ta.placeholder = "粘贴 JSON 后点击确认";
			ta.style.cssText = "width:100%;height:200px;margin-top:8px;";
			const ok = document.createElement("button");
			ok.textContent = "确认导入";
			ok.style.cssText = "padding:6px 8px;margin-top:6px;";
			const container = document.createElement("div");
			container.appendChild(ta);
			container.appendChild(ok);
			const importModal = document.createElement("div");
			importModal.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000001;";
			const box = document.createElement("div");
			box.style.cssText = "background:#fff;padding:12px;border-radius:6px;width:90%;max-width:700px;";
			box.appendChild(container);
			importModal.appendChild(box);
			document.body.appendChild(importModal);
			ok.addEventListener("click", () => {
				try {
					const json = ta.value.trim();
					if (!json) return;
					if (importUserscriptData(json)) {
						alert("导入成功，请保存以持久化");
						initializeUserscriptData();
						renderGroups();
						renderSelectedGroup();
					} else alert("导入失败：格式错误");
				} catch (e) {
					alert("导入异常：" + e);
				}
				importModal.remove();
			});
		});
		saveBtn.addEventListener("click", () => {
			try {
				saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups });
				alert("已保存");
			} catch (e) {
				alert("保存失败：" + e);
			}
		});
		syncBtn.addEventListener("click", () => {
			try {
				if (syncFromManager()) {
					alert("同步成功，已导入管理器数据");
					initializeUserscriptData();
					renderGroups();
					renderSelectedGroup();
				} else alert("同步未成功，未检测到管理器数据");
			} catch (e) {
				alert("同步异常：" + e);
			}
		});
		closeBtn.addEventListener("click", () => modal.remove());
		modal.addEventListener("click", (e) => {
			if (e.target === modal) modal.remove();
		});
		renderGroups();
		if (userscriptState.emojiGroups.length > 0) {
			selectedGroupId = userscriptState.emojiGroups[0].id;
			const first = groupsList.firstChild;
			if (first) first.style.background = "#f0f8ff";
			renderSelectedGroup();
		}
	}
	function showSettingsModal() {
		const modal = document.createElement("div");
		modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
		const content = document.createElement("div");
		content.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  `;
		content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #333;">设置</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">图片缩放比例: <span id="scaleValue">${userscriptState.settings.imageScale}%</span></label>
      <input type="range" id="scaleSlider" min="5" max="150" step="5" value="${userscriptState.settings.imageScale}" 
             style="width: 100%; margin-bottom: 8px;">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">输出格式:</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="markdown" ${userscriptState.settings.outputFormat === "markdown" ? "checked" : ""} style="margin-right: 4px;">
          Markdown
        </label>
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="html" ${userscriptState.settings.outputFormat === "html" ? "checked" : ""} style="margin-right: 4px;">
          HTML
        </label>
      </div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="showSearchBar" ${userscriptState.settings.showSearchBar ? "checked" : ""} style="margin-right: 8px;">
        显示搜索栏
      </label>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="forceMobileMode" ${userscriptState.settings.forceMobileMode ? "checked" : ""} style="margin-right: 8px;">
        强制移动模式 (在不兼容检测时也注入移动版布局)
      </label>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="resetSettings" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">重置</button>
      <button id="saveSettings" style="padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
    </div>
  `;
		modal.appendChild(content);
		document.body.appendChild(modal);
		const scaleSlider = content.querySelector("#scaleSlider");
		const scaleValue = content.querySelector("#scaleValue");
		scaleSlider?.addEventListener("input", () => {
			if (scaleValue) scaleValue.textContent = scaleSlider.value + "%";
		});
		content.querySelector("#closeModal")?.addEventListener("click", () => {
			modal.remove();
		});
		content.querySelector("#resetSettings")?.addEventListener("click", () => {
			(async () => {
				const { requestConfirmation: requestConfirmation$1 } = await __vitePreload(async () => {
					const { requestConfirmation: requestConfirmation$2 } = await Promise.resolve().then(() => (init_confirmService(), confirmService_exports));
					return { requestConfirmation: requestConfirmation$2 };
				}, void 0);
				if (await requestConfirmation$1("重置设置", "确定要重置所有设置吗？")) {
					userscriptState.settings = {
						imageScale: 30,
						gridColumns: 4,
						outputFormat: "markdown",
						forceMobileMode: false,
						defaultGroup: "nachoneko",
						showSearchBar: true
					};
					modal.remove();
				}
			})();
		});
		content.querySelector("#saveSettings")?.addEventListener("click", () => {
			userscriptState.settings.imageScale = parseInt(scaleSlider?.value || "30");
			const outputFormat = content.querySelector("input[name=\"outputFormat\"]:checked");
			if (outputFormat) userscriptState.settings.outputFormat = outputFormat.value;
			const showSearchBar = content.querySelector("#showSearchBar");
			if (showSearchBar) userscriptState.settings.showSearchBar = showSearchBar.checked;
			const forceMobileEl = content.querySelector("#forceMobileMode");
			if (forceMobileEl) userscriptState.settings.forceMobileMode = !!forceMobileEl.checked;
			saveDataToLocalStorage({ settings: userscriptState.settings });
			try {
				const remoteInput = content.querySelector("#remoteConfigUrl");
				if (remoteInput && remoteInput.value.trim()) localStorage.setItem("emoji_extension_remote_config_url", remoteInput.value.trim());
			} catch (e) {}
			alert("设置已保存");
			modal.remove();
		});
		modal.addEventListener("click", (e) => {
			if (e.target === modal) modal.remove();
		});
	}
	var currentPicker = null;
	function closeCurrentPicker() {
		if (currentPicker) {
			currentPicker.remove();
			currentPicker = null;
		}
	}
	function injectEmojiButton(toolbar) {
		if (toolbar.querySelector(".emoji-extension-button")) return;
		const isChatComposer = toolbar.classList.contains("chat-composer__inner-container");
		const button = document.createElement("button");
		button.classList.add("btn", "no-text", "btn-icon", "toolbar__button", "nacho-emoji-picker-button", "emoji-extension-button");
		if (isChatComposer) {
			button.classList.add("fk-d-menu__trigger", "emoji-picker-trigger", "chat-composer-button", "btn-transparent", "-emoji");
			button.setAttribute("aria-expanded", "false");
			button.setAttribute("data-identifier", "emoji-picker");
			button.setAttribute("data-trigger", "");
		}
		button.title = "表情包";
		button.type = "button";
		button.innerHTML = "🐈‍⬛";
		button.addEventListener("click", async (e) => {
			e.stopPropagation();
			if (currentPicker) {
				closeCurrentPicker();
				return;
			}
			currentPicker = await createEmojiPicker();
			if (!currentPicker) return;
			document.body.appendChild(currentPicker);
			const buttonRect = button.getBoundingClientRect();
			if (currentPicker.classList.contains("modal") || currentPicker.className.includes("d-modal")) {
				currentPicker.style.position = "fixed";
				currentPicker.style.top = "0";
				currentPicker.style.left = "0";
				currentPicker.style.right = "0";
				currentPicker.style.bottom = "0";
				currentPicker.style.zIndex = "999999";
			} else {
				currentPicker.style.position = "fixed";
				const margin = 8;
				const vpWidth = window.innerWidth;
				const vpHeight = window.innerHeight;
				currentPicker.style.top = buttonRect.bottom + margin + "px";
				currentPicker.style.left = buttonRect.left + "px";
				const pickerRect = currentPicker.getBoundingClientRect();
				const spaceBelow = vpHeight - buttonRect.bottom;
				const neededHeight = pickerRect.height + margin;
				let top = buttonRect.bottom + margin;
				if (spaceBelow < neededHeight) top = Math.max(margin, buttonRect.top - pickerRect.height - margin);
				let left = buttonRect.left;
				if (left + pickerRect.width + margin > vpWidth) left = Math.max(margin, vpWidth - pickerRect.width - margin);
				if (left < margin) left = margin;
				currentPicker.style.top = top + "px";
				currentPicker.style.left = left + "px";
			}
			setTimeout(() => {
				const handleClick = (e$1) => {
					if (currentPicker && !currentPicker.contains(e$1.target) && e$1.target !== button) {
						closeCurrentPicker();
						document.removeEventListener("click", handleClick);
					}
				};
				document.addEventListener("click", handleClick);
			}, 100);
		});
		try {
			if (isChatComposer) {
				const existingEmojiTrigger = toolbar.querySelector(".emoji-picker-trigger:not(.emoji-extension-button)");
				if (existingEmojiTrigger) toolbar.insertBefore(button, existingEmojiTrigger);
				else toolbar.appendChild(button);
			} else toolbar.appendChild(button);
		} catch (error) {
			console.error("[Emoji Extension Userscript] Failed to inject button:", error);
		}
	}
	function initOneClickAdd() {
		console.log("[Emoji Extension Userscript] Initializing one-click add functionality");
		function extractEmojiFromImage(img, titleElement) {
			const url = img.src;
			if (!url || !url.startsWith("http")) return null;
			let name = "";
			const parts = (titleElement.textContent || "").split("·");
			if (parts.length > 0) name = parts[0].trim();
			if (!name || name.length < 2) name = img.alt || img.title || extractNameFromUrl(url);
			name = name.trim();
			if (name.length === 0) name = "表情";
			return {
				name,
				url
			};
		}
		function extractNameFromUrl(url) {
			try {
				const nameWithoutExt = (new URL(url).pathname.split("/").pop() || "").replace(/\.[^/.]+$/, "");
				const decoded = decodeURIComponent(nameWithoutExt);
				if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) return "表情";
				return decoded || "表情";
			} catch {
				return "表情";
			}
		}
		function createAddButton(emojiData) {
			const link = document.createElement("a");
			link.className = "image-source-link emoji-add-link";
			link.style.cssText = `
      color: #ffffff;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      font-size: inherit;
      font-family: inherit;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: 2px solid #ffffff;
      border-radius: 6px;
      padding: 4px 8px;
      margin: 0 2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      font-weight: 600;
    `;
			link.addEventListener("mouseenter", () => {
				if (!link.innerHTML.includes("已添加") && !link.innerHTML.includes("失败")) {
					link.style.background = "linear-gradient(135deg, #3730a3, #5b21b6)";
					link.style.transform = "scale(1.05)";
					link.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";
				}
			});
			link.addEventListener("mouseleave", () => {
				if (!link.innerHTML.includes("已添加") && !link.innerHTML.includes("失败")) {
					link.style.background = "linear-gradient(135deg, #4f46e5, #7c3aed)";
					link.style.transform = "scale(1)";
					link.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
				}
			});
			link.innerHTML = `
      <svg class="fa d-icon d-icon-plus svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
        <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>
      </svg>添加表情
    `;
			link.title = "添加到用户表情";
			link.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();
				const originalHTML = link.innerHTML;
				const originalStyle = link.style.cssText;
				try {
					addEmojiToUserscript(emojiData);
					try {
						uploader.showProgressDialog();
					} catch (e$1) {
						console.warn("[Userscript] uploader.showProgressDialog failed:", e$1);
					}
					link.innerHTML = `
          <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>已添加
        `;
					link.style.background = "linear-gradient(135deg, #10b981, #059669)";
					link.style.color = "#ffffff";
					link.style.border = "2px solid #ffffff";
					link.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.3)";
					setTimeout(() => {
						link.innerHTML = originalHTML;
						link.style.cssText = originalStyle;
					}, 2e3);
				} catch (error) {
					console.error("[Emoji Extension Userscript] Failed to add emoji:", error);
					link.innerHTML = `
          <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>失败
        `;
					link.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
					link.style.color = "#ffffff";
					link.style.border = "2px solid #ffffff";
					link.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.3)";
					setTimeout(() => {
						link.innerHTML = originalHTML;
						link.style.cssText = originalStyle;
					}, 2e3);
				}
			});
			return link;
		}
		function processLightbox(lightbox) {
			if (lightbox.querySelector(".emoji-add-link")) return;
			const img = lightbox.querySelector(".mfp-img");
			const title = lightbox.querySelector(".mfp-title");
			if (!img || !title) return;
			const emojiData = extractEmojiFromImage(img, title);
			if (!emojiData) return;
			const addButton = createAddButton(emojiData);
			const sourceLink = title.querySelector("a.image-source-link");
			if (sourceLink) {
				const separator = document.createTextNode(" · ");
				title.insertBefore(separator, sourceLink);
				title.insertBefore(addButton, sourceLink);
			} else {
				title.appendChild(document.createTextNode(" · "));
				title.appendChild(addButton);
			}
		}
		function processAllLightboxes() {
			document.querySelectorAll(".mfp-wrap.mfp-gallery").forEach((lightbox) => {
				if (lightbox.classList.contains("mfp-wrap") && lightbox.classList.contains("mfp-gallery") && lightbox.querySelector(".mfp-img")) processLightbox(lightbox);
			});
		}
		setTimeout(processAllLightboxes, 500);
		new MutationObserver((mutations) => {
			let hasNewLightbox = false;
			mutations.forEach((mutation) => {
				if (mutation.type === "childList") mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node;
						if (element.classList && element.classList.contains("mfp-wrap")) hasNewLightbox = true;
					}
				});
			});
			if (hasNewLightbox) setTimeout(processAllLightboxes, 100);
		}).observe(document.body, {
			childList: true,
			subtree: true
		});
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) setTimeout(processAllLightboxes, 200);
		});
	}
	async function initializeEmojiFeature(maxAttempts = 10, delay = 1e3) {
		console.log("[Emoji Extension Userscript] Initializing...");
		initializeUserscriptData();
		initOneClickAdd();
		let attempts = 0;
		function attemptInjection() {
			attempts++;
			const toolbars = findAllToolbars();
			let injectedCount = 0;
			toolbars.forEach((toolbar) => {
				if (!toolbar.querySelector(".emoji-extension-button")) {
					console.log("[Emoji Extension Userscript] Toolbar found, injecting button.");
					injectEmojiButton(toolbar);
					injectedCount++;
				}
			});
			if (injectedCount > 0 || toolbars.length > 0) return;
			if (attempts < maxAttempts) {
				console.log(`[Emoji Extension Userscript] Toolbar not found, attempt ${attempts}/${maxAttempts}. Retrying in ${delay / 1e3}s.`);
				setTimeout(attemptInjection, delay);
			} else console.error("[Emoji Extension Userscript] Failed to find toolbar after multiple attempts.");
		}
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attemptInjection);
		else attemptInjection();
		setInterval(() => {
			findAllToolbars().forEach((toolbar) => {
				if (!toolbar.querySelector(".emoji-extension-button")) {
					console.log("[Emoji Extension Userscript] New toolbar found, injecting button.");
					injectEmojiButton(toolbar);
				}
			});
		}, 3e4);
	}
	if (shouldInjectEmoji()) {
		console.log("[Emoji Extension Userscript] Initializing emoji feature");
		initializeEmojiFeature();
	} else console.log("[Emoji Extension Userscript] Skipping injection - incompatible platform");
})();
