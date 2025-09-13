import { d as defineComponent, r as ref, c as computed, a as createElementBlock, o as openBlock, b as createBaseVNode, e as createCommentVNode, f as createVNode, w as withCtx, g as createTextVNode, u as unref, B as Button, t as toDisplayString, I as Input, h as withDirectives, v as vModelCheckbox, F as Fragment, i as renderList, j as createBlock, C as Card, n as normalizeClass } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { i as importBilibiliToStore } from "./options-importutils.js";
const _hoisted_1 = { class: "space-y-8" };
const _hoisted_2 = { class: "bg-white shadow rounded-lg" };
const _hoisted_3 = { class: "p-6 space-y-4" };
const _hoisted_4 = { class: "space-y-4" };
const _hoisted_5 = { class: "flex items-center space-x-3" };
const _hoisted_6 = {
  key: 0,
  class: "text-sm text-blue-600"
};
const _hoisted_7 = { class: "flex items-center space-x-3" };
const _hoisted_8 = { class: "flex items-center space-x-3" };
const _hoisted_9 = { class: "mt-4 p-3 border rounded bg-gray-50" };
const _hoisted_10 = { class: "flex items-center space-x-3" };
const _hoisted_11 = { class: "flex items-center space-x-2" };
const _hoisted_12 = { class: "mt-3 flex items-center space-x-3" };
const _hoisted_13 = { class: "mt-3 text-sm text-gray-700" };
const _hoisted_14 = {
  key: 0,
  class: "mt-2 max-h-40 overflow-auto text-xs"
};
const _hoisted_15 = { class: "mt-3" };
const _hoisted_16 = {
  key: 0,
  class: "text-sm text-gray-500"
};
const _hoisted_17 = { key: 1 };
const _hoisted_18 = {
  key: 0,
  class: "text-sm text-gray-500"
};
const _hoisted_19 = {
  key: 1,
  class: "grid gap-2"
};
const _hoisted_20 = { class: "flex items-center justify-between" };
const _hoisted_21 = { class: "flex items-center space-x-3" };
const _hoisted_22 = ["checked", "onChange"];
const _hoisted_23 = { class: "font-medium" };
const _hoisted_24 = { class: "text-xs text-gray-500" };
const _hoisted_25 = ["src"];
const _hoisted_26 = {
  key: 0,
  class: "text-sm mt-1"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "BilibiliImport",
  setup(__props) {
    const fileInput = ref(null);
    const isImporting = ref(false);
    const importStatus = ref("");
    const importResults = ref(null);
    const query = ref("");
    const indexUrl = ref("/assets/bilibiliEmojiIndex.json");
    const packages = ref([]);
    const selected = ref({});
    const displayPackages = ref([]);
    const filteredPackages = computed(() => {
      const q = query.value.trim().toLowerCase();
      if (!q) return packages.value;
      return packages.value.filter((p) => {
        var _a;
        const name = String(p.text || p.label || p.id || "").toLowerCase();
        if (name.includes(q)) return true;
        if (Array.isArray(p.emote)) {
          for (const e of p.emote) {
            const alias = String(((_a = e == null ? void 0 : e.meta) == null ? void 0 : _a.alias) || (e == null ? void 0 : e.text) || "").toLowerCase();
            if (alias.includes(q)) return true;
          }
        }
        return false;
      });
    });
    const toggleSelect = (pkgId) => {
      selected.value[pkgId] = !selected.value[pkgId];
    };
    const selectedPackages = () => {
      const ids = Object.keys(selected.value).filter((k) => selected.value[k]);
      return packages.value.filter((p) => ids.includes(String(p.id)));
    };
    const applySearch = () => {
      displayPackages.value = filteredPackages.value;
    };
    const fetchIdStart = ref("");
    const consecutiveNullsToStop = ref("50");
    const isFetchingById = ref(false);
    const fetchStatus = ref("");
    const fetchProgress = ref([]);
    const importToStoreOnFetch = ref(false);
    async function fetchIdOnce(idNum) {
      const url = `https://api.bilibili.com/x/emote/package?ids=${idNum}&business=reply`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      try {
        return await res.json();
      } catch (err) {
        throw new Error("JSON 解析失败");
      }
    }
    async function fetchByIdLoop() {
      const start = Number(fetchIdStart.value);
      const stopThreshold = Number(consecutiveNullsToStop.value) || 50;
      if (!Number.isFinite(start) || start <= 0) {
        fetchStatus.value = "请输入合法的起始 ID（正整数）";
        return;
      }
      isFetchingById.value = true;
      fetchStatus.value = `开始从 ID ${start} 连续拉取，直到连续 ${stopThreshold} 次空响应为止`;
      fetchProgress.value = [];
      let consecutiveNulls = 0;
      let idCursor = start;
      try {
        while (consecutiveNulls < stopThreshold && isFetchingById.value) {
          try {
            const json = await fetchIdOnce(idCursor);
            if (json && json.data && json.data.packages) {
              const pkgs = Array.isArray(json.data.packages) ? json.data.packages : [];
              if (pkgs.length > 0) {
                for (const p of pkgs) packages.value.push(p);
                fetchProgress.value.push({ id: idCursor, msg: `获得 ${pkgs.length} 个包` });
                consecutiveNulls = 0;
                if (importToStoreOnFetch.value) {
                  try {
                    await importBilibiliToStore({ data: { packages: pkgs } });
                    fetchProgress.value.push({ id: idCursor, msg: "已导入到 Store" });
                  } catch (impErr) {
                    fetchProgress.value.push({
                      id: idCursor,
                      msg: `导入失败: ${impErr instanceof Error ? impErr.message : String(impErr)}`
                    });
                  }
                }
              } else {
                for (const p of pkgs) packages.value.push(p);
                fetchProgress.value.push({ id: idCursor, msg: "packages 为空" });
              }
            } else {
              consecutiveNulls++;
              fetchProgress.value.push({ id: idCursor, msg: "无有效 packages（空响应）" });
            }
          } catch (err) {
            consecutiveNulls++;
            fetchProgress.value.push({
              id: idCursor,
              msg: `请求/解析失败: ${err instanceof Error ? err.message : String(err)}`
            });
            await new Promise((r) => setTimeout(r, 300));
          }
          idCursor++;
          await new Promise((r) => setTimeout(r, 100));
        }
        fetchStatus.value = `停止：已连续 ${consecutiveNulls} 个空响应，最后检查 ID ${idCursor - 1}`;
      } finally {
        isFetchingById.value = false;
      }
    }
    const stopFetchingById = () => {
      isFetchingById.value = false;
      fetchStatus.value = "用户已停止拉取";
    };
    const fetchSingleId = async () => {
      const start = Number(fetchIdStart.value);
      if (!Number.isFinite(start) || start <= 0) {
        fetchStatus.value = "请输入合法的 ID（正整数）";
        return;
      }
      fetchStatus.value = `正在获取 ID ${start}...`;
      try {
        const json = await fetchIdOnce(start);
        if (json && json.data && json.data.packages && Array.isArray(json.data.packages) && json.data.packages.length > 0) {
          const pkgs = json.data.packages;
          for (const p of pkgs) packages.value.push(p);
          fetchStatus.value = `ID ${start} 获取到 ${pkgs.length} 个包`;
          if (importToStoreOnFetch.value) {
            await importBilibiliToStore({ data: { packages: pkgs } });
            fetchStatus.value += "，已导入到 Store";
          }
        } else {
          fetchStatus.value = `ID ${start} 无有效 packages`;
        }
      } catch (err) {
        fetchStatus.value = `ID ${start} 请求失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    };
    function normalizeBilibiliIndex(json) {
      if (!json) return null;
      if (typeof json === "object" && json !== null) {
        const obj = json;
        const pk = obj["packages"];
        if (Array.isArray(pk)) return pk;
      }
      if (Array.isArray(json)) {
        const out = [];
        for (const item of json) {
          if (!item) continue;
          if (typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "emote")) {
            out.push(item);
            continue;
          }
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            for (const [k, v] of Object.entries(item)) {
              if (v && typeof v === "object") {
                const emotes = [];
                for (const [name, url] of Object.entries(v)) {
                  emotes.push({ text: name, url: String(url) });
                }
                out.push({ id: k, text: k, emote: emotes });
              }
            }
            continue;
          }
        }
        if (out.length > 0) return out;
      }
      if (typeof json === "object" && json !== null && !Array.isArray(json)) {
        const out = [];
        for (const [k, v] of Object.entries(json)) {
          if (v && typeof v === "object") {
            const emotes = [];
            for (const [name, url] of Object.entries(v)) {
              emotes.push({ text: name, url: String(url) });
            }
            out.push({ id: k, text: k, emote: emotes });
          }
        }
        if (out.length > 0) return out;
      }
      return null;
    }
    function safeParseJson(text) {
      if (!text) return null;
      let t = text.trim();
      t = t.replace(/^\uFEFF/, "");
      t = t.replace(/\/\*[\s\S]*?\*\//g, "");
      t = t.replace(/(^|[^: "])(\/\/).*$/gm, "$1");
      t = t.replace(/,\s*(]|})/g, "$1");
      try {
        return JSON.parse(t);
      } catch (e) {
        const firstObj = t.indexOf("{");
        const lastObj = t.lastIndexOf("}");
        const firstArr = t.indexOf("[");
        const lastArr = t.lastIndexOf("]");
        if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
          const sub = t.slice(firstObj, lastObj + 1);
          try {
            return JSON.parse(sub);
          } catch (err) {
          }
        }
        if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
          const sub = t.slice(firstArr, lastArr + 1);
          try {
            return JSON.parse(sub);
          } catch (err) {
          }
        }
      }
      throw new Error("无法解析 JSON");
    }
    const loadIndexFromUrl = async (url) => {
      const u = (indexUrl.value || "").trim();
      if (!u) {
        importResults.value = { success: false, message: "请输入索引 URL 后再加载" };
        return;
      }
      isImporting.value = true;
      importStatus.value = "正在加载索引...";
      importResults.value = null;
      try {
        let json;
        const res = await fetch(u);
        if (!res.ok) throw new Error(`请求失败: ${res.status}`);
        const txt = await res.text();
        try {
          json = JSON.parse(txt);
        } catch (parseErr) {
          json = safeParseJson(txt);
        }
        const normalized = normalizeBilibiliIndex(json);
        if (!normalized || !Array.isArray(normalized)) {
          throw new Error("无效的索引格式");
        }
        packages.value = normalized;
        importResults.value = { success: true, message: `加载到 ${packages.value.length} 个包` };
      } catch (e) {
        importResults.value = {
          success: false,
          message: "加载索引失败",
          details: e instanceof Error ? e.message : String(e)
        };
      } finally {
        isImporting.value = false;
      }
    };
    const openFile = () => {
      var _a;
      return (_a = fileInput.value) == null ? void 0 : _a.click();
    };
    const handleFile = async (e) => {
      var _a;
      const target = e.target;
      const file = (_a = target.files) == null ? void 0 : _a[0];
      if (!file) return;
      isImporting.value = true;
      importStatus.value = "正在读取文件...";
      importResults.value = null;
      try {
        const text = await file.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          data = safeParseJson(text);
        }
        const asObj = data;
        if (asObj.data && typeof asObj.data === "object") {
          const inner = asObj.data;
          if (Array.isArray(inner.packages)) {
            importStatus.value = "正在导入 bilibili 数据...";
            await importBilibiliToStore(data);
            importResults.value = {
              success: true,
              message: "导入成功"
            };
            return;
          }
        }
        const normalized = normalizeBilibiliIndex(data);
        if (!normalized || !Array.isArray(normalized)) throw new Error("无效的索引格式");
        packages.value = normalized;
        importResults.value = { success: true, message: `加载到 ${packages.value.length} 个包` };
      } catch (err) {
        importResults.value = {
          success: false,
          message: "导入失败",
          details: err instanceof Error ? err.message : String(err)
        };
      } finally {
        isImporting.value = false;
      }
    };
    const importSelectedFromIndex = async () => {
      const pkgs = selectedPackages();
      if (!pkgs || pkgs.length === 0) {
        importResults.value = { success: false, message: "请先选择要导入的包" };
        return;
      }
      importStatus.value = "正在导入选中包...";
      importResults.value = null;
      isImporting.value = true;
      try {
        await importBilibiliToStore({ data: { packages: pkgs } });
        importResults.value = {
          success: true,
          message: `已导入 ${pkgs.length} 个包`
        };
      } catch (e) {
        importResults.value = {
          success: false,
          message: "导入失败",
          details: e instanceof Error ? e.message : String(e)
        };
      } finally {
        isImporting.value = false;
      }
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          _cache[16] || (_cache[16] = createBaseVNode("div", { class: "px-6 py-4 border-b border-gray-200" }, [
            createBaseVNode("h3", { class: "text-lg font-medium text-gray-900" }, "Bilibili 表情导入"),
            createBaseVNode("p", { class: "mt-1 text-sm text-gray-600" }, " 上传 bilibili 风格的 JSON 响应（包含 data.packages），导入为表情分组 ")
          ], -1)),
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              createBaseVNode("div", _hoisted_5, [
                createVNode(unref(Button), {
                  type: "primary",
                  onClick: openFile
                }, {
                  default: withCtx(() => _cache[7] || (_cache[7] = [
                    createTextVNode("选择 Bilibili JSON 文件", -1)
                  ])),
                  _: 1,
                  __: [7]
                }),
                createBaseVNode("input", {
                  ref_key: "fileInput",
                  ref: fileInput,
                  type: "file",
                  accept: ".json",
                  class: "hidden",
                  onChange: handleFile
                }, null, 544),
                isImporting.value ? (openBlock(), createElementBlock("span", _hoisted_6, toDisplayString(importStatus.value), 1)) : createCommentVNode("", true)
              ]),
              createBaseVNode("div", _hoisted_7, [
                createVNode(unref(Input), {
                  value: indexUrl.value,
                  "onUpdate:value": _cache[0] || (_cache[0] = ($event) => indexUrl.value = $event),
                  placeholder: "请输入索引 JSON 的 URL"
                }, null, 8, ["value"]),
                createVNode(unref(Button), {
                  onClick: _cache[1] || (_cache[1] = () => loadIndexFromUrl())
                }, {
                  default: withCtx(() => _cache[8] || (_cache[8] = [
                    createTextVNode("加载索引", -1)
                  ])),
                  _: 1,
                  __: [8]
                })
              ]),
              createBaseVNode("div", _hoisted_8, [
                createVNode(unref(Input), {
                  value: query.value,
                  "onUpdate:value": _cache[2] || (_cache[2] = ($event) => query.value = $event),
                  placeholder: "按包名或别名搜索"
                }, null, 8, ["value"]),
                createVNode(unref(Button), {
                  type: "primary",
                  onClick: applySearch
                }, {
                  default: withCtx(() => _cache[9] || (_cache[9] = [
                    createTextVNode("搜索", -1)
                  ])),
                  _: 1,
                  __: [9]
                }),
                createVNode(unref(Button), {
                  type: "default",
                  onClick: _cache[3] || (_cache[3] = ($event) => query.value = "")
                }, {
                  default: withCtx(() => _cache[10] || (_cache[10] = [
                    createTextVNode("清空", -1)
                  ])),
                  _: 1,
                  __: [10]
                }),
                createVNode(unref(Button), {
                  type: "primary",
                  onClick: importSelectedFromIndex
                }, {
                  default: withCtx(() => _cache[11] || (_cache[11] = [
                    createTextVNode("导入选中包", -1)
                  ])),
                  _: 1,
                  __: [11]
                })
              ]),
              createBaseVNode("div", _hoisted_9, [
                createBaseVNode("div", _hoisted_10, [
                  createVNode(unref(Input), {
                    value: fetchIdStart.value,
                    "onUpdate:value": _cache[4] || (_cache[4] = ($event) => fetchIdStart.value = $event),
                    placeholder: "起始 ID（例如 10600）"
                  }, null, 8, ["value"]),
                  createVNode(unref(Input), {
                    value: consecutiveNullsToStop.value,
                    "onUpdate:value": _cache[5] || (_cache[5] = ($event) => consecutiveNullsToStop.value = $event),
                    placeholder: "连续空响应阈值（默认 50）"
                  }, null, 8, ["value"]),
                  createBaseVNode("label", _hoisted_11, [
                    withDirectives(createBaseVNode("input", {
                      type: "checkbox",
                      "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => importToStoreOnFetch.value = $event)
                    }, null, 512), [
                      [vModelCheckbox, importToStoreOnFetch.value]
                    ]),
                    _cache[12] || (_cache[12] = createBaseVNode("span", { class: "text-sm" }, "自动导入到 Store", -1))
                  ])
                ]),
                createBaseVNode("div", _hoisted_12, [
                  createVNode(unref(Button), {
                    type: "primary",
                    onClick: fetchSingleId
                  }, {
                    default: withCtx(() => _cache[13] || (_cache[13] = [
                      createTextVNode("单次获取", -1)
                    ])),
                    _: 1,
                    __: [13]
                  }),
                  createVNode(unref(Button), {
                    type: "primary",
                    onClick: fetchByIdLoop,
                    disabled: isFetchingById.value
                  }, {
                    default: withCtx(() => _cache[14] || (_cache[14] = [
                      createTextVNode(" 开始连续拉取 ", -1)
                    ])),
                    _: 1,
                    __: [14]
                  }, 8, ["disabled"]),
                  createVNode(unref(Button), {
                    type: "default",
                    onClick: stopFetchingById,
                    disabled: !isFetchingById.value
                  }, {
                    default: withCtx(() => _cache[15] || (_cache[15] = [
                      createTextVNode(" 停止 ", -1)
                    ])),
                    _: 1,
                    __: [15]
                  }, 8, ["disabled"])
                ]),
                createBaseVNode("div", _hoisted_13, [
                  createBaseVNode("div", null, toDisplayString(fetchStatus.value), 1),
                  fetchProgress.value && fetchProgress.value.length ? (openBlock(), createElementBlock("div", _hoisted_14, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(fetchProgress.value, (p) => {
                      return openBlock(), createElementBlock("div", {
                        key: p.id
                      }, "ID " + toDisplayString(p.id) + " — " + toDisplayString(p.msg), 1);
                    }), 128))
                  ])) : createCommentVNode("", true)
                ])
              ]),
              createBaseVNode("div", _hoisted_15, [
                packages.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_16, "尚未加载任何索引包")) : (openBlock(), createElementBlock("div", _hoisted_17, [
                  displayPackages.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_18, " 请输入关键词并点击“搜索”以显示结果 ")) : (openBlock(), createElementBlock("div", _hoisted_19, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(displayPackages.value, (pkg) => {
                      return openBlock(), createBlock(unref(Card), {
                        key: pkg.id,
                        class: "p-2"
                      }, {
                        default: withCtx(() => [
                          createBaseVNode("div", _hoisted_20, [
                            createBaseVNode("div", _hoisted_21, [
                              createBaseVNode("input", {
                                type: "checkbox",
                                checked: selected.value[String(pkg.id)],
                                onChange: () => toggleSelect(String(pkg.id))
                              }, null, 40, _hoisted_22),
                              createBaseVNode("div", null, [
                                createBaseVNode("div", _hoisted_23, toDisplayString(pkg.text || pkg.label || pkg.id), 1),
                                createBaseVNode("div", _hoisted_24, toDisplayString(pkg.emote && pkg.emote.length || 0) + " 个表情 ", 1)
                              ])
                            ]),
                            createBaseVNode("div", null, [
                              pkg.emote && pkg.emote[0] && pkg.emote[0].url ? (openBlock(), createElementBlock("img", {
                                key: 0,
                                src: pkg.emote[0].url,
                                class: "h-8 w-8 object-contain"
                              }, null, 8, _hoisted_25)) : createCommentVNode("", true)
                            ])
                          ])
                        ]),
                        _: 2
                      }, 1024);
                    }), 128))
                  ]))
                ]))
              ])
            ]),
            importResults.value ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: normalizeClass(["p-3 rounded", importResults.value.success ? "bg-green-50" : "bg-red-50"])
            }, [
              createBaseVNode("p", {
                class: normalizeClass(["text-sm font-medium", importResults.value.success ? "text-green-700" : "text-red-700"])
              }, toDisplayString(importResults.value.message), 3),
              importResults.value.details ? (openBlock(), createElementBlock("p", _hoisted_26, toDisplayString(importResults.value.details), 1)) : createCommentVNode("", true)
            ], 2)) : createCommentVNode("", true)
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
