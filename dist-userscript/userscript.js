const PICKER_CLASS = "nacho-emoji-picker";
const BUTTON_CLASS = "nacho-emoji-picker-button";
function createEmojiButtonElement(opts = {}) {
	const { baseClasses = [
		"btn",
		"no-text",
		"btn-icon",
		"toolbar__button"
	], buttonClass = BUTTON_CLASS, title = "Nachoneko表情包", content = "🐈‍⬛" } = opts;
	const emojiButton = document.createElement("button");
	emojiButton.classList.add(...baseClasses);
	if (buttonClass) emojiButton.classList.add(buttonClass);
	emojiButton.title = title;
	emojiButton.type = "button";
	emojiButton.innerHTML = content;
	return emojiButton;
}
function startExternalButtonListenerLoop(opts) {
	const selectors = opts.selectors || [
		"#create-topic",
		".topic-drafts-menu-trigger",
		"button.post-action-menu__reply",
		"button.reply.create",
		"button.create.reply-to-post",
		".topic-footer-button"
	];
	const interval = opts.interval || 1e3;
	const removers = [];
	let stopped = false;
	function externalClickHandler(ev) {
		console.log("external listener triggered for", this);
		const btn = document.querySelector(`.${opts.emojiButtonClass}`);
		if (btn) setTimeout(() => btn.click(), 0);
		else {
			const ta = document.querySelector(opts.textAreaSelector);
			if (ta) ta.focus();
		}
	}
	function scanAndAttach() {
		if (stopped) return 0;
		let added = 0;
		try {
			selectors.forEach((sel) => {
				const nodes = Array.from(document.querySelectorAll(sel));
				nodes.forEach((n) => {
					if (!n.getAttribute("data-nacho-listener")) {
						n.addEventListener("click", externalClickHandler);
						n.setAttribute("data-nacho-listener", "1");
						removers.push(() => n.removeEventListener("click", externalClickHandler));
						added += 1;
					}
				});
			});
		} catch (err) {}
		return added;
	}
	const firstAdded = scanAndAttach();
	if (firstAdded > 0) return () => {
		stopped = true;
		removers.forEach((r) => {
			try {
				r();
			} catch (_) {}
		});
	};
	const id = window.setInterval(() => {
		const added = scanAndAttach();
		if (added > 0) {
			window.clearInterval(id);
			stopped = true;
		}
	}, interval);
	function stop() {
		stopped = true;
		window.clearInterval(id);
		removers.forEach((r) => {
			try {
				r();
			} catch (_) {}
		});
	}
	return stop;
}
const STORAGE_KEY = "bugcopilot_settings_v1";
function loadPayload() {
	if (typeof window === "undefined" || !window.localStorage) return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch (_) {
		return null;
	}
}
function savePayload(payload) {
	if (typeof window === "undefined" || !window.localStorage) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		try {
			window.localStorage.setItem("bugcopilot_flag_session_pending", "true");
		} catch (_) {}
		try {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) try {
				chrome.runtime.sendMessage({
					type: "payload-updated",
					payload
				}, (_resp) => {
					try {
						if (chrome.runtime && chrome.runtime.lastError) {}
					} catch (_) {}
				});
			} catch (_) {}
		} catch (_) {}
	} catch (_) {}
}
var storage_default = {
	loadPayload,
	savePayload
};
const defaults = {
	imageScale: 30,
	defaultEmojiGroupUUID: "00000000-0000-0000-0000-000000000000",
	gridColumns: 4,
	outputFormat: "markdown",
	MobileMode: false,
	sidebarCollapsed: false,
	lastModified: /* @__PURE__ */ new Date()
};
let current = { ...defaults };
const listeners = [];
function initFromPayload(p) {
	if (!p) return;
	current = {
		...defaults,
		...p.Settings || {}
	};
	if (current.lastModified && typeof current.lastModified === "string") current.lastModified = new Date(current.lastModified);
}
function getSettings$1() {
	return { ...current };
}
function setSettings(patch, groups) {
	current = {
		...current,
		...patch
	};
	save(groups);
}
function save(groups) {
	current.lastModified = /* @__PURE__ */ new Date();
	const existing = storage_default.loadPayload();
	const payload = {
		Settings: current,
		emojiGroups: groups || [],
		ungrouped: existing?.ungrouped || []
	};
	storage_default.savePayload(payload);
	listeners.forEach((l) => l(current));
}
function onChange(fn) {
	listeners.push(fn);
	return () => {
		const idx = listeners.indexOf(fn);
		if (idx >= 0) listeners.splice(idx, 1);
	};
}
initFromPayload(storage_default.loadPayload());
var settingsStore_default = {
	defaults,
	getSettings: getSettings$1,
	setSettings,
	save,
	onChange
};
let emojiGroups = [];
let ungrouped = [];
function initFromStorage() {
	const p = storage_default.loadPayload();
	emojiGroups = Array.isArray(p?.emojiGroups) ? p.emojiGroups : [];
	ungrouped = Array.isArray(p?.ungrouped) ? p.ungrouped : [];
}
function getEmojiGroups() {
	return emojiGroups.map((g) => ({
		...g,
		emojis: [...g.emojis]
	}));
}
function getUngrouped$1() {
	return ungrouped.map((e) => ({ ...e }));
}
function setEmojiGroups(gs) {
	emojiGroups = gs.map((g) => ({
		...g,
		emojis: [...g.emojis]
	}));
	settingsStore_default.save(emojiGroups);
}
function addUngrouped(emoji) {
	ungrouped.push(emoji);
	settingsStore_default.save(emojiGroups);
}
function removeUngroupedByUUID(uuid) {
	const idx = ungrouped.findIndex((e) => e.UUID === uuid);
	if (idx >= 0) {
		ungrouped.splice(idx, 1);
		settingsStore_default.save(emojiGroups);
		return true;
	}
	return false;
}
function recordUsageByUUID(uuid) {
	const found = findEmojiByUUID(uuid);
	if (found && found.emoji) {
		const e = found.emoji;
		const now = Date.now();
		if (!e.lastUsed) {
			e.usageCount = 1;
			e.lastUsed = now;
		} else {
			const days = Math.floor((now - (e.lastUsed || 0)) / (1440 * 60 * 1e3));
			if (days >= 1 && typeof e.usageCount === "number") e.usageCount = Math.floor(e.usageCount * Math.pow(.8, days));
			e.usageCount = (e.usageCount || 0) + 1;
			e.lastUsed = now;
		}
		settingsStore_default.save(emojiGroups);
		return true;
	}
	const ue = ungrouped.find((x) => x.UUID === uuid);
	if (ue) {
		const now = Date.now();
		if (!ue.lastUsed) {
			ue.usageCount = 1;
			ue.lastUsed = now;
		} else {
			const days = Math.floor((now - (ue.lastUsed || 0)) / (1440 * 60 * 1e3));
			if (days >= 1 && typeof ue.usageCount === "number") ue.usageCount = Math.floor(ue.usageCount * Math.pow(.8, days));
			ue.usageCount = (ue.usageCount || 0) + 1;
			ue.lastUsed = now;
		}
		settingsStore_default.save(emojiGroups);
		return true;
	}
	return false;
}
function findGroupByUUID(uuid) {
	return emojiGroups.find((g) => g.UUID === uuid) || null;
}
function findEmojiByUUID(uuid) {
	for (const g of emojiGroups) {
		const e = g.emojis.find((it) => it.UUID === uuid);
		if (e) return {
			group: g,
			emoji: e
		};
	}
	return null;
}
function addGroup(group) {
	emojiGroups.push({
		...group,
		emojis: [...group.emojis]
	});
	settingsStore_default.save(emojiGroups);
}
function removeGroup(uuid) {
	const idx = emojiGroups.findIndex((g) => g.UUID === uuid);
	if (idx >= 0) {
		emojiGroups.splice(idx, 1);
		settingsStore_default.save(emojiGroups);
		return true;
	}
	return false;
}
function addEmojiToGroup(groupUUID, emoji, position) {
	const g = emojiGroups.find((x) => x.UUID === groupUUID);
	if (!g) return false;
	if (typeof position === "number" && position >= 0 && position <= g.emojis.length) g.emojis.splice(position, 0, emoji);
	else g.emojis.push(emoji);
	settingsStore_default.save(emojiGroups);
	return true;
}
function removeEmojiFromGroup(groupUUID, emojiUUID) {
	const g = emojiGroups.find((x) => x.UUID === groupUUID);
	if (!g) return false;
	const idx = g.emojis.findIndex((e) => e.UUID === emojiUUID);
	if (idx >= 0) {
		g.emojis.splice(idx, 1);
		settingsStore_default.save(emojiGroups);
		return true;
	}
	return false;
}
function moveEmojiBetweenGroups(fromGroupUUID, toGroupUUID, emojiUUID, toIndex) {
	const from = emojiGroups.find((x) => x.UUID === fromGroupUUID);
	const to = emojiGroups.find((x) => x.UUID === toGroupUUID);
	if (!from || !to) return false;
	const idx = from.emojis.findIndex((e$1) => e$1.UUID === emojiUUID);
	if (idx < 0) return false;
	const [e] = from.emojis.splice(idx, 1);
	if (typeof toIndex === "number" && toIndex >= 0 && toIndex <= to.emojis.length) to.emojis.splice(toIndex, 0, e);
	else to.emojis.push(e);
	settingsStore_default.save(emojiGroups);
	return true;
}
function reorderEmojiInGroup$1(groupUUID, fromIndex, toIndex) {
	const g = emojiGroups.find((x) => x.UUID === groupUUID);
	if (!g) return false;
	if (fromIndex < 0 || fromIndex >= g.emojis.length) return false;
	const [e] = g.emojis.splice(fromIndex, 1);
	g.emojis.splice(Math.min(Math.max(0, toIndex), g.emojis.length), 0, e);
	settingsStore_default.save(emojiGroups);
	return true;
}
initFromStorage();
var emojiGroupsStore_default = {
	getEmojiGroups,
	getUngrouped: getUngrouped$1,
	setEmojiGroups,
	findGroupByUUID,
	findEmojiByUUID,
	addGroup,
	removeGroup,
	addEmojiToGroup,
	removeEmojiFromGroup,
	moveEmojiBetweenGroups,
	reorderEmojiInGroup: reorderEmojiInGroup$1,
	addUngrouped,
	removeUngroupedByUUID,
	recordUsageByUUID
};
var CommunicationService = class {
	constructor(context) {
		this.handlers = /* @__PURE__ */ new Map();
		this.context = context;
		this.init();
	}
	init() {
		try {
			if (typeof chrome !== "undefined" && chrome.runtime) chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
				if (request.type && request.from !== this.context) this.handleMessage(request);
				return true;
			});
		} catch (error) {
			console.warn("Failed to initialize chrome.runtime.onMessage:", error);
		}
		try {
			window.addEventListener("message", (event) => {
				if (event.data && event.data.type && event.data.from !== this.context) this.handleMessage(event.data);
			});
		} catch (error) {
			console.warn("Failed to initialize window message listener:", error);
		}
	}
	handleMessage(message) {
		const handlers = this.handlers.get(message.type);
		if (handlers) handlers.forEach((handler) => {
			try {
				handler(message);
			} catch (error) {
				console.error("Error in message handler:", error);
			}
		});
	}
	send(type, payload) {
		let clonedPayload = payload;
		if (payload) try {
			const plainPayload = payload && typeof payload === "object" ? { ...payload } : payload;
			clonedPayload = JSON.parse(JSON.stringify(plainPayload));
			console.log(`Communication: sending ${type} with payload:`, clonedPayload);
		} catch (error) {
			console.warn("Failed to clone payload:", error);
			try {
				clonedPayload = payload && typeof payload === "object" ? { ...payload } : payload;
			} catch (e) {
				console.warn("Failed to create object copy:", e);
				clonedPayload = payload;
			}
		}
		const message = {
			type,
			payload: clonedPayload,
			from: this.context,
			timestamp: Date.now()
		};
		try {
			if (typeof chrome !== "undefined" && chrome.runtime) chrome.runtime.sendMessage(message, (response) => {
				if (chrome.runtime.lastError) console.warn("Message sending failed:", chrome.runtime.lastError);
			});
		} catch (error) {
			console.warn("Failed to send message via chrome.runtime:", error);
		}
		try {
			window.postMessage(message, "*");
		} catch (error) {
			console.warn("Failed to send message via window.postMessage:", error);
		}
		try {
			window.dispatchEvent(new CustomEvent(type, { detail: message }));
		} catch (error) {
			console.warn("Failed to dispatch CustomEvent:", error);
		}
	}
	on(type, handler) {
		if (!this.handlers.has(type)) this.handlers.set(type, []);
		this.handlers.get(type).push(handler);
		try {
			window.addEventListener(type, ((event) => {
				try {
					if (event.detail && event.detail.from && event.detail.from !== this.context) handler(event.detail);
				} catch (e) {}
			}));
		} catch (error) {
			console.warn("Failed to add CustomEvent listener:", error);
		}
	}
	off(type, handler) {
		const handlers = this.handlers.get(type);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) handlers.splice(index, 1);
		}
	}
	sendSettingsChanged(settings) {
		this.send("app:settings-changed", settings);
	}
	sendGroupsChanged(groups) {
		this.send("app:groups-changed", groups);
	}
	sendUsageRecorded(uuid) {
		this.send("app:usage-recorded", {
			uuid,
			timestamp: Date.now()
		});
	}
	sendDataImported(data) {
		this.send("app:data-imported", data);
	}
	onSettingsChanged(handler) {
		this.on("app:settings-changed", (message) => {
			if (message && typeof message === "object") {
				const payload = message.payload !== void 0 ? message.payload : message;
				handler(payload);
			} else handler(message);
		});
	}
	onGroupsChanged(handler) {
		this.on("app:groups-changed", (message) => {
			if (message && typeof message === "object") {
				const payload = message.payload !== void 0 ? message.payload : message;
				handler(payload);
			} else handler(message);
		});
	}
	onUsageRecorded(handler) {
		this.on("app:usage-recorded", (message) => {
			if (message && typeof message === "object") {
				const payload = message.payload !== void 0 ? message.payload : message;
				handler(payload);
			} else handler(message);
		});
	}
	onDataImported(handler) {
		this.on("app:data-imported", (message) => {
			if (message && typeof message === "object") {
				const payload = message.payload !== void 0 ? message.payload : message;
				handler(payload);
			} else handler(message);
		});
	}
};
const createOptionsCommService = () => new CommunicationService("options");
function log(...args) {
	try {
		console.info("[data-store]", ...args);
	} catch (_) {}
}
function getSettings() {
	const s = settingsStore_default.getSettings();
	log("getSettings", s);
	return s;
}
function saveSettings(s) {
	log("saveSettings", s);
	settingsStore_default.setSettings(s, emojiGroupsStore_default.getEmojiGroups());
	try {
		if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("app:settings-changed", { detail: s }));
		if (typeof window !== "undefined" && window.location.pathname.includes("options.html")) try {
			const commService = createOptionsCommService();
			commService.sendSettingsChanged(s);
		} catch (error) {
			console.warn("Failed to send settings via communication service:", error);
		}
	} catch (_) {}
}
function getGroups() {
	const g = emojiGroupsStore_default.getEmojiGroups();
	log("getGroups", { count: g.length });
	return g;
}
function getUngrouped() {
	const ug = emojiGroupsStore_default.getUngrouped ? emojiGroupsStore_default.getUngrouped() : [];
	log("getUngrouped", { count: Array.isArray(ug) ? ug.length : 0 });
	return ug;
}
function getHot() {
	const all = [];
	for (const g of getGroups()) if (Array.isArray(g.emojis)) all.push(...g.emojis.map((e) => ({
		...e,
		groupUUID: g.UUID
	})));
	const withUsage = all.filter((e) => typeof e.usageCount === "number");
	withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
	const top = withUsage.slice(0, 50);
	log("getHot", { count: top.length });
	return top;
}
function recordUsage(uuid) {
	return emojiGroupsStore_default.recordUsageByUUID(uuid);
}
function exportPayload() {
	const payload = {
		Settings: getSettings(),
		emojiGroups: getGroups(),
		ungrouped: getUngrouped()
	};
	log("exportPayload");
	return JSON.stringify(payload, null, 2);
}
function importPayload(p) {
	if (!p) return false;
	log("importPayload", p && {
		hasSettings: !!p.Settings,
		groups: Array.isArray(p.emojiGroups) ? p.emojiGroups.length : 0,
		ungrouped: Array.isArray(p.ungrouped) ? p.ungrouped.length : 0
	});
	if (p.Settings) settingsStore_default.setSettings(p.Settings, p.emojiGroups || void 0);
	try {
		if (p.Settings && typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("app:settings-changed", { detail: p.Settings }));
		if (p.Settings && typeof window !== "undefined" && window.location.pathname.includes("options.html")) try {
			const commService = createOptionsCommService();
			commService.sendSettingsChanged(p.Settings);
		} catch (error) {
			console.warn("Failed to send settings via communication service:", error);
		}
	} catch (_) {}
	if (Array.isArray(p.emojiGroups)) {
		emojiGroupsStore_default.setEmojiGroups(p.emojiGroups);
		try {
			if (typeof window !== "undefined" && window.location.pathname.includes("options.html")) {
				const commService = createOptionsCommService();
				commService.sendGroupsChanged(p.emojiGroups);
			}
		} catch (error) {
			console.warn("Failed to send groups via communication service:", error);
		}
	}
	if (Array.isArray(p.ungrouped) && emojiGroupsStore_default.addUngrouped) {
		const existing = emojiGroupsStore_default.getUngrouped ? emojiGroupsStore_default.getUngrouped() : [];
		if (Array.isArray(existing)) existing.forEach((e) => {
			try {
				emojiGroupsStore_default.removeUngroupedByUUID(e.UUID);
			} catch (_) {}
		});
		p.ungrouped.forEach((e) => emojiGroupsStore_default.addUngrouped(e));
	}
	try {
		if (typeof window !== "undefined" && window.location.pathname.includes("options.html")) {
			const commService = createOptionsCommService();
			commService.sendDataImported(p);
		}
	} catch (error) {
		console.warn("Failed to send data import via communication service:", error);
	}
	return true;
}
function moveUngroupedToGroup(uuids, groupUUID) {
	if (!Array.isArray(uuids) || !groupUUID) return { moved: 0 };
	const existing = emojiGroupsStore_default.getUngrouped ? emojiGroupsStore_default.getUngrouped() : [];
	let moved = 0;
	for (const u of uuids) {
		const idx = existing.findIndex((e$1) => e$1.UUID === u);
		if (idx < 0) continue;
		const e = existing[idx];
		try {
			emojiGroupsStore_default.addEmojiToGroup(groupUUID, e);
			emojiGroupsStore_default.removeUngroupedByUUID(e.UUID);
			moved++;
		} catch (err) {}
	}
	log("moveUngroupedToGroup", {
		groupUUID,
		moved
	});
	return { moved };
}
function reorderEmojiInGroup(groupUUID, fromIndex, toIndex) {
	try {
		const ok = emojiGroupsStore_default.reorderEmojiInGroup(groupUUID, fromIndex, toIndex);
		log("reorderEmojiInGroup", {
			groupUUID,
			fromIndex,
			toIndex,
			ok
		});
		return ok;
	} catch (err) {
		log("reorderEmojiInGroup", "error", err);
		return false;
	}
}
var main_default$1 = {
	getSettings,
	saveSettings,
	getGroups,
	getUngrouped,
	getHot,
	exportPayload,
	importPayload,
	moveUngroupedToGroup,
	reorderEmojiInGroup
};
function injectNachonekoEmojiFeature(cfg) {
	const config = {
		toolbarSelector: cfg.toolbarSelector || ".d-editor-button-bar[role=\"toolbar\"], .d-editor-button-bar",
		emojiButtonClass: cfg.emojiButtonClass || BUTTON_CLASS,
		emojiPickerClass: cfg.emojiPickerClass || PICKER_CLASS,
		textAreaSelector: cfg.textAreaSelector || "textarea.d-editor-input",
		richEditorSelector: cfg.richEditorSelector || ".ProseMirror.d-editor-input",
		emojiContentGeneratorFn: cfg.emojiContentGeneratorFn,
		pollInterval: cfg.pollInterval || 2e3
	};
	if (typeof document === "undefined") return { stop: () => {} };
	let stopped = false;
	const listeners$1 = [];
	const createdNodes = [];
	const isMiniReply = () => {
		const replyEle = document.querySelector("#reply-control");
		return !!(replyEle && replyEle.className.includes("hide-preview") && window.innerWidth < 1600);
	};
	function attachPickerBehavior(emojiButton) {
		function handleClick(event) {
			event.stopPropagation();
			const existingPicker = document.querySelector(`.${config.emojiPickerClass}`);
			if (existingPicker) {
				existingPicker.remove();
				document.removeEventListener("click", handleClickOutside);
				return;
			}
			const container = document.createElement("div");
			container.innerHTML = config.emojiContentGeneratorFn().trim();
			const emojiPicker = container.firstElementChild;
			if (!emojiPicker) return;
			document.body.appendChild(emojiPicker);
			createdNodes.push(emojiPicker);
			const replyControl = document.querySelector("#reply-control");
			if (replyControl) {
				const replyRect = replyControl.getBoundingClientRect();
				emojiPicker.style.position = "fixed";
				emojiPicker.style.bottom = replyRect.top - 5 + "px";
				emojiPicker.style.left = replyRect.left + "px";
				const imagePanel = emojiPicker.querySelector("img");
				if (imagePanel) {
					imagePanel.style.width = "80px";
					imagePanel.style.height = "85px";
				}
			} else {
				const editorWrapper = document.querySelector(".d-editor-textarea-wrapper");
				if (editorWrapper) {
					const editorRect = editorWrapper.getBoundingClientRect();
					emojiPicker.style.position = "fixed";
					if (isMiniReply()) {
						emojiPicker.style.top = editorRect.top + "px";
						emojiPicker.style.left = editorRect.left + editorRect.width / 2 - emojiPicker.clientWidth / 2 + "px";
					} else {
						emojiPicker.style.top = editorRect.top + "px";
						emojiPicker.style.left = editorRect.right + 10 + "px";
					}
				}
			}
			function handleClickOutside(e) {
				if (emojiPicker && !emojiPicker.contains(e.target)) {
					emojiPicker.remove();
					document.removeEventListener("click", handleClickOutside);
				}
			}
			setTimeout(() => {
				document.addEventListener("click", handleClickOutside);
				listeners$1.push(() => document.removeEventListener("click", handleClickOutside));
			}, 0);
			emojiPicker.addEventListener("click", function(e) {
				const target = e.target;
				if (target && target.tagName === "IMG") {
					try {
						const idAttr = target.getAttribute("data-uuid") || target.getAttribute("data-UUID");
						if (idAttr) recordUsage(idAttr);
					} catch (_) {}
					const textArea = document.querySelector(config.textAreaSelector);
					const richEle = document.querySelector(config.richEditorSelector);
					if (!textArea && !richEle) {
						console.error("找不到输入框");
						return;
					}
					const imgElement = target;
					let width = imgElement.getAttribute("data-width") || "500";
					let height = imgElement.getAttribute("data-height") || "500";
					if (!imgElement.getAttribute("data-width") || !imgElement.getAttribute("data-height")) {
						const match = imgElement.src.match(/_(\d{3,})x(\d{3,})\./);
						if (match) {
							width = match[1];
							height = match[2];
						}
					}
					const settings = main_default$1.getSettings();
					const imageScale = settings.imageScale || 30;
					const outputFormat = settings.outputFormat || "markdown";
					if (textArea) {
						let emojiText = "";
						if (outputFormat === "html") emojiText = `<img src="${imgElement.src}" alt="${imgElement.alt}" width="${Math.round(parseInt(width) * imageScale / 100)}" height="${Math.round(parseInt(height) * imageScale / 100)}" />`;
						else emojiText = `![${imgElement.alt}|${width}x${height},${imageScale}%](${imgElement.src}) `;
						const startPos = textArea.selectionStart;
						const endPos = textArea.selectionEnd;
						textArea.value = textArea.value.substring(0, startPos) + emojiText + textArea.value.substring(endPos, textArea.value.length);
						textArea.selectionStart = textArea.selectionEnd = startPos + emojiText.length;
						textArea.focus();
						const event$1 = new Event("input", {
							bubbles: true,
							cancelable: true
						});
						textArea.dispatchEvent(event$1);
					} else if (richEle) {
						const scaledWidth = Math.round(parseInt(width) * imageScale / 100);
						const scaledHeight = Math.round(parseInt(height) * imageScale / 100);
						const imgTemplate = `<img src="${imgElement.src}" alt="${imgElement.alt}" width="${width}" height="${height}" data-scale="${imageScale}" style="width: ${scaledWidth}px; height: ${scaledHeight}px">`;
						try {
							const dt = new DataTransfer();
							dt.setData("text/html", imgTemplate);
							const evt = new ClipboardEvent("paste", {
								clipboardData: dt,
								bubbles: true
							});
							richEle.dispatchEvent(evt);
						} catch (_) {
							try {
								document.execCommand("insertHTML", false, imgTemplate);
							} catch (err) {
								console.error("无法向富文本编辑器中插入表情", err);
							}
						}
					}
					if (emojiPicker) emojiPicker.remove();
				}
			});
		}
		emojiButton.addEventListener("click", handleClick);
		listeners$1.push(() => emojiButton.removeEventListener("click", handleClick));
	}
	const processedToolbars = /* @__PURE__ */ new WeakSet();
	function checkAndInsert() {
		if (stopped) return;
		try {
			const toolbars = document.querySelectorAll(config.toolbarSelector);
			toolbars.forEach((toolbar) => {
				if (processedToolbars.has(toolbar)) return;
				const existingButton = toolbar.querySelector(`.${config.emojiButtonClass}`);
				if (existingButton) {
					processedToolbars.add(toolbar);
					return;
				}
				console.log("[nacho-inject] inserting emoji button into new toolbar", toolbar);
				const emojiButton = createEmojiButtonElement({ buttonClass: config.emojiButtonClass });
				toolbar.appendChild(emojiButton);
				createdNodes.push(emojiButton);
				attachPickerBehavior(emojiButton);
				processedToolbars.add(toolbar);
				console.log("[nacho-inject] emoji button appended");
			});
		} catch (err) {
			console.log("[nacho-inject] checkAndInsert error", err);
		}
	}
	checkAndInsert();
	const pollId = window.setInterval(() => {
		checkAndInsert();
	}, config.pollInterval);
	let observer = null;
	try {
		observer = new MutationObserver(() => {
			checkAndInsert();
			attachExternalButtonListeners();
		});
		if (document.body) observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	} catch (_) {
		observer = null;
	}
	const stopExternalLoop = startExternalButtonListenerLoop({
		selectors: void 0,
		emojiButtonClass: config.emojiButtonClass,
		textAreaSelector: config.textAreaSelector,
		interval: config.pollInterval
	});
	listeners$1.push(() => stopExternalLoop());
	const externalButtonSelectors = [
		"#create-topic",
		".topic-drafts-menu-trigger",
		"button.post-action-menu__reply",
		"button.reply.create",
		"button.create.reply-to-post",
		".topic-footer-button"
	];
	function externalClickHandler(ev) {
		const btn = document.querySelector(`.${config.emojiButtonClass}`);
		if (btn) setTimeout(() => btn.click(), 0);
		else {
			const ta = document.querySelector(config.textAreaSelector);
			if (ta) ta.focus();
		}
	}
	function attachExternalButtonListeners() {
		try {
			externalButtonSelectors.forEach((sel) => {
				const nodes = Array.from(document.querySelectorAll(sel));
				nodes.forEach((n) => {
					if (!n.getAttribute("data-nacho-listener")) {
						n.addEventListener("click", externalClickHandler);
						n.setAttribute("data-nacho-listener", "1");
						listeners$1.push(() => n.removeEventListener("click", externalClickHandler));
						createdNodes.push(n);
					}
				});
			});
		} catch (err) {}
	}
	function stop() {
		stopped = true;
		window.clearInterval(pollId);
		try {
			if (observer) observer.disconnect();
		} catch (_) {}
		listeners$1.forEach((fn) => {
			try {
				fn();
			} catch (_) {}
		});
		createdNodes.forEach((n) => n && n.parentNode && n.parentNode.removeChild(n));
	}
	return { stop };
}
var main_default = injectNachonekoEmojiFeature;
function installNachonekoPicker(emojis, opts) {
	const generator = () => {
		const images = emojis.map((e, idx) => {
			const nameEsc = String(e.name || "").replace(/"/g, "&quot;");
			const tabindex = idx === 0 ? "0" : "-1";
			const dataEmoji = nameEsc;
			return `<img width="32" height="32" class="emoji" src="${e.url}" tabindex="${tabindex}" data-emoji="${dataEmoji}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />`;
		}).join("\n");
		return `
<div class="fk-d-menu -animated -expanded" data-identifier="emoji-picker" data-content="" aria-expanded="true" role="dialog">
  <div class="fk-d-menu__inner-content">
    <div class="emoji-picker">
      <div class="emoji-picker__filter-container">
        <div class="emoji-picker__filter filter-input-container">
          <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
          <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#magnifying-glass"></use></svg>
        </div>
        <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button">
          <img width="20" height="20" src="${emojis[0]?.url || ""}" title="${emojis[0]?.name || ""}" alt="${emojis[0]?.name || ""}" class="emoji" />
        </button>
      </div>
      <div class="emoji-picker__content">
        <div class="emoji-picker__sections-nav">
          <button class="btn no-text btn-flat emoji-picker__section-btn active" tabindex="-1" data-section="favorites" type="button">
            <img width="20" height="20" src="/images/emoji/twemoji/star.png" title="star" alt="star" class="emoji" />
          </button>
        </div>
        <div class="emoji-picker__scrollable-content">
          <div class="emoji-picker__sections" role="button">
            <div class="emoji-picker__section" data-section="favorites" role="region" aria-label="常用">
              <div class="emoji-picker__section-title-container">
                <h2 class="emoji-picker__section-title">常用</h2>
                <button class="btn no-text btn-icon btn-transparent" type="button">
                  <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#trash-can"></use></svg>
                  <span aria-hidden="true">&ZeroWidthSpace;</span>
                </button>
              </div>
              <div class="emoji-picker__section-emojis">
                ${images}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    `;
	};
	const injector = main_default({
		toolbarSelector: opts?.toolbarSelector,
		emojiButtonClass: BUTTON_CLASS,
		textAreaSelector: opts?.textAreaSelector,
		richEditorSelector: opts?.richEditorSelector,
		emojiContentGeneratorFn: generator
	});
	return injector;
}
const defaultEmojis = [
	{
		packet: 1,
		name: "瞌睡",
		url: "https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg"
	},
	{
		packet: 2,
		name: "哭泣",
		url: "https://linux.do/uploads/default/optimized/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2_2_503x500.jpeg"
	},
	{
		packet: 3,
		name: "疑问",
		url: "https://linux.do/uploads/default/optimized/4X/f/a/a/faa5afe1749312bc4a326feff0eca6fb39355300_2_518x499.jpeg"
	}
];
function installDefaultNachonekoPicker() {
	return installNachonekoPicker(defaultEmojis);
}
var UserscriptStorage = class {
	async getItem(key) {
		try {
			const value = globalThis.GM_getValue?.(key);
			return value ? JSON.parse(value) : null;
		} catch (error) {
			console.error("Userscript storage getItem error:", error);
			return null;
		}
	}
	async setItem(key, value) {
		try {
			globalThis.GM_setValue?.(key, JSON.stringify(value));
		} catch (error) {
			console.error("Userscript storage setItem error:", error);
		}
	}
	async removeItem(key) {
		try {
			globalThis.GM_deleteValue?.(key);
		} catch (error) {
			console.error("Userscript storage removeItem error:", error);
		}
	}
	async clear() {
		try {
			const keys = globalThis.GM_listValues?.() || [];
			keys.forEach((key) => globalThis.GM_deleteValue?.(key));
		} catch (error) {
			console.error("Userscript storage clear error:", error);
		}
	}
	async keys() {
		try {
			return globalThis.GM_listValues?.() || [];
		} catch (error) {
			console.error("Userscript storage keys error:", error);
			return [];
		}
	}
};
const storage = new UserscriptStorage();
if (typeof window !== "undefined") window.__USERSCRIPT_STORAGE__ = storage;
function shouldInjectEmoji() {
	const discourseMetaTags = document.querySelectorAll("meta[name*=\"discourse\"], meta[content*=\"discourse\"], meta[property*=\"discourse\"]");
	if (discourseMetaTags.length > 0) {
		console.log("[Emoji Userscript] Discourse detected via meta tags");
		return true;
	}
	const generatorMeta = document.querySelector("meta[name=\"generator\"]");
	if (generatorMeta) {
		const content = generatorMeta.getAttribute("content")?.toLowerCase() || "";
		if (content.includes("discourse") || content.includes("flarum") || content.includes("phpbb")) {
			console.log("[Emoji Userscript] Forum platform detected via generator meta");
			return true;
		}
	}
	const hostname = window.location.hostname.toLowerCase();
	const allowedDomains = ["linux.do", "meta.discourse.org"];
	if (allowedDomains.some((domain) => hostname.includes(domain))) {
		console.log("[Emoji Userscript] Allowed domain detected:", hostname);
		return true;
	}
	const editors = document.querySelectorAll("textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea");
	if (editors.length > 0) {
		console.log("[Emoji Userscript] Discussion editor detected");
		return true;
	}
	console.log("[Emoji Userscript] No compatible platform detected");
	return false;
}
function initializeEmoji() {
	console.log("[Emoji Userscript] Initializing emoji feature...");
	try {
		const picker = installDefaultNachonekoPicker();
		if (picker && typeof picker.stop === "function") window.__EMOJI_CLEANUP__ = picker.stop;
		console.log("[Emoji Userscript] Emoji feature initialized successfully");
	} catch (error) {
		console.error("[Emoji Userscript] Failed to initialize emoji feature:", error);
	}
}
if (shouldInjectEmoji()) {
	console.log("[Emoji Userscript] Starting emoji injection...");
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeEmoji);
	else initializeEmoji();
	if (typeof globalThis.GM_notification !== "undefined") {
		const managementEntry = document.createElement("div");
		managementEntry.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      background: #007cba;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      opacity: 0.8;
      transition: opacity 0.3s;
    `;
		managementEntry.textContent = "表情管理";
		managementEntry.title = "点击打开表情包管理界面";
		managementEntry.addEventListener("click", () => {
			const managementUrl = "data:text/html;charset=utf-8," + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>表情包管理 - Userscript</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #007cba; color: white; padding: 20px; margin: -20px -20px 20px -20px; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .button { background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
            .button:hover { background: #005a8b; }
            .info { background: #f0f8ff; padding: 15px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Linux.do 表情包扩展 - Userscript 管理界面</h1>
            <p>用户脚本版本的表情包管理工具</p>
          </div>
          
          <div class="section">
            <h3>功能状态</h3>
            <div class="info">
              ✅ 表情包注入功能已启用<br>
              ✅ 用户脚本存储系统正常<br>
              ✅ 支持 Linux.do 和其他 Discourse 论坛
            </div>
          </div>
          
          <div class="section">
            <h3>管理操作</h3>
            <button class="button" onclick="clearStorage()">清除所有数据</button>
            <button class="button" onclick="exportData()">导出设置</button>
            <button class="button" onclick="importData()">导入设置</button>
            <button class="button" onclick="window.close()">关闭</button>
          </div>
          
          <div class="section">
            <h3>使用说明</h3>
            <ul>
              <li>表情包按钮会自动添加到编辑器工具栏</li>
              <li>点击表情包按钮可以选择和插入表情</li>
              <li>设置和数据通过用户脚本存储系统保存</li>
              <li>支持自定义表情包和分组管理</li>
            </ul>
          </div>
          
          <script>
            function clearStorage() {
              if (confirm('确定要清除所有表情包数据吗？此操作不可撤销。')) {
                alert('存储清除功能需要在用户脚本环境中实现')
              }
            }
            
            function exportData() {
              alert('导出功能需要在用户脚本环境中实现')
            }
            
            function importData() {
              alert('导入功能需要在用户脚本环境中实现')
            }
          <\/script>
        </body>
        </html>
      `);
			window.open(managementUrl, "_blank", "width=800,height=600");
		});
		managementEntry.addEventListener("mouseenter", () => {
			managementEntry.style.opacity = "1";
		});
		managementEntry.addEventListener("mouseleave", () => {
			managementEntry.style.opacity = "0.8";
		});
		document.body.appendChild(managementEntry);
		setTimeout(() => {
			managementEntry.style.display = "none";
		}, 5e3);
	}
} else console.log("[Emoji Userscript] Skipping injection - incompatible platform");
