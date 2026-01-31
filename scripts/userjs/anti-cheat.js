// ==UserScript==
// @name         Custom Discourse Watermark
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Change the invisible watermark text on Discourse sites
// @author       You
// @match        *://linux.do/*
// @match        *://*.discourse.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CUSTOM_TEXT = "Hello World"; // 修改这里

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const pixelRatio = window.devicePixelRatio || 1;
        // 130 是源码中的 density 设置
        if (this.width === this.height && Math.abs(this.width - (130 * pixelRatio)) < 5) {
            
            const ctx = this.getContext('2d');
            const originalColor = ctx.fillStyle;
            const originalFont = ctx.font;
            const w = this.width;
            const h = this.height;

            // 清空并重置
            this.width = w; 

            // 重绘
            ctx.fillStyle = originalColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = originalFont; // 使用原网页字体设置，保持风格一致

            ctx.translate(w / 2, h / 2);
            ctx.rotate(-25 * Math.PI / 180); 
            ctx.fillText(CUSTOM_TEXT, 0, 0);

            return originalToDataURL.call(this, type, quality);
        }
        return originalToDataURL.apply(this, arguments);
    };
})();


// ==UserScript==
// @name         Disable Invisible Watermark
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Remove the canvas-based invisible watermark from Discourse sites
// @author       You
// @match        *://linux.do/*
// @match        *://*.discourse.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // 1. 劫持 Shadow DOM 创建 (防止水印初始化)
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
        if (init && init.mode === 'closed') {
            const root = originalAttachShadow.call(this, { ...init, mode: 'open' });
            const style = document.createElement('style');
            style.textContent = 'div { opacity: 0 !important; visibility: hidden !important; }';
            root.appendChild(style);
            return root;
        }
        return originalAttachShadow.apply(this, arguments);
    };

    // 2. 劫持 Canvas 生成 (清理已存在的水印)
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
        if (this.width === this.height && Math.abs(this.width - (130 * (window.devicePixelRatio||1))) < 5) {
            return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }
        return originalToDataURL.apply(this, arguments);
    };
})();