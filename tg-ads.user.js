// ==UserScript==
// @name         TG广告发布自动化脚本
// @namespace    https://klao258.github.io/
// @version      2025.05.24-23:42:02
// @description  Telegram ADS 自动发布辅助工具，支持结构注入、页面监听、数据联动等功能
// @author       You
// @match        https://ads.telegram.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=telegram.org
// @updateURL    https://klao258.github.io/JBADS/tg-ads.user.js
// @downloadURL  https://klao258.github.io/JBADS/tg-ads.user.js
// @require      https://klao258.github.io/JBADS/autoADSData.js
// @require      https://klao258.github.io/JBADS/autoADS.js
// @grant        GM_addStyle
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';
  
    console.log(`✅ TG广告脚本已加载，当前版本：${ GM_info.script.version }`);

    // ===== 🔄 检查远程是否有新版本 =====
    const CURRENT_VERSION = GM_info.script.version;
    const REMOTE_URL = "https://klao258.github.io/JBADS/tg-ads.user.js";

    (async function checkForUpdate() {
        try {
        const text = await (await fetch(REMOTE_URL + '?t=' + Date.now())).text();
        const match = text.match(/@version\s+([^\n]+)/);
        if (match && match[1] && match[1].trim() !== CURRENT_VERSION.trim()) {
            showUpdatePopup(match[1].trim());
        }
        } catch (e) {
        console.warn("🚫 检查版本更新失败：", e);
        }
    })();

    // ===== 💬 弹窗提示新版本 =====
    function showUpdatePopup(newVersion) {
        const div = document.createElement("div");
        div.innerHTML = `
        <div style="position:fixed;top:20px;right:20px;background:#222;color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 0 8px #000;">
            🔄 脚本有新版本：${newVersion}<br>
            <button id="update-script-btn" style="margin-top:8px;padding:6px 12px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer;">立即更新</button>
        </div>
        `;
        document.body.appendChild(div);
        document.getElementById("update-script-btn").onclick = () => {
        window.open(REMOTE_URL, "_blank");
        };
    }

    // 你的逻辑代码可以写在 autoADS.js / autoADSData.js / ZhaoShang.js 中
})();
  