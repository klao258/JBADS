// ==UserScript==
// @name         TG广告发布自动化脚本
// @namespace    https://klao258.github.io/
// @version      0.0.0   // ← 此字段将由 GitHub Actions 自动覆盖
// @description  Telegram ADS 自动发布辅助工具，支持结构注入、页面监听、数据联动等功能
// @author       You
// @match        https://ads.telegram.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=telegram.org
// @updateURL    https://klao258.github.io/JBADS/tg-ads.user.js
// @downloadURL  https://klao258.github.io/JBADS/tg-ads.user.js
// @grant        GM_addStyle
// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
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

    // 等待 jQuery 加载完成
    async function waitForJQuery(maxTries = 50, interval = 100) {
        for (let i = 0; i < maxTries; i++) {
          if (typeof window.$ === 'function') {
            console.log('✅ jQuery 已加载');
            return true;
          }
          await new Promise(res => setTimeout(res, interval));
        }
        console.warn('❌ 等待 jQuery 超时');
        return false;
    }
          

    /**
     * 加载多个脚本，并等待多个变量全部定义完成
     * @param {string[]} urls - 要加载的多个脚本链接
     * @param {string[]} waitVars - 要检测的全局变量（如 ['window.adminData', 'window.config']）
     * @param {number} maxTries - 最大轮询次数（默认50）
     * @param {number} interval - 每次轮询间隔 ms（默认100）
     * @returns {Promise<boolean>} 是否全部加载成功并变量可用
     */
    async function loadMultipleScriptsAndWaitForAll(urls, waitVars, maxTries = 50, interval = 100) {
        // 1. 并行加载所有脚本
        const loadScript = (url) =>
        new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = `${url}?t=${Date.now()}`;
            script.async = true;
            script.onload = () => {
            console.log(`✅ 加载成功：${url}`);
            resolve(true);
            };
            script.onerror = () => {
            console.error(`❌ 加载失败：${url}`);
            resolve(false);
            };
            document.head.appendChild(script);
        });
    
        const results = await Promise.all(urls.map(loadScript));
        if (!results.every(r => r)) return false;
    
        // 2. 所有脚本加载完成后开始轮询变量
        for (let i = 0; i < maxTries; i++) {
        let allReady = true;
        for (let varName of waitVars) {
            try {
            if (!eval(varName)) {
                allReady = false;
                break;
            }
            } catch {
            allReady = false;
            break;
            }
        }
        if (allReady) {
            // console.log(`✅ 所有变量就绪：${waitVars.join(", ")}`);
            return true;
        }
        await new Promise((res) => setTimeout(res, interval));
        }
    
        // console.warn(`⚠️ 超时，未检测到所有变量：${waitVars.join(", ")}`);
        return false;
    }

    /**
     * 拦截目标 script 执行前的所有脚本，先运行自定义 callback，再恢复后续脚本。
     * @param {string} targetUrl - 截断点 script 的 URL 片段，例如 'widget-frame.js'
     * @param {Function} callback - 自定义 async 函数，执行完后再继续加载后续脚本
     */
    const interceptBeforeScript = async (targetUrl, callback) => {
        return new Promise((resolve, reject) => {
            const SCRIPT_QUEUE = [];
            let hit = false;

            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.tagName === "SCRIPT") {
                            const scriptTag = node;
                            const src = scriptTag.src || "";

                            if (!hit && src.includes(targetUrl)) {
                                hit = true;
                                SCRIPT_QUEUE.push(scriptTag.cloneNode(true));
                                scriptTag.remove();
                                // console.log("⏸ 拦截目标 script:", src);
                            } else if (hit) {
                                SCRIPT_QUEUE.push(scriptTag.cloneNode(true));
                                scriptTag.remove();
                                // console.log("⏸ 拦截后续 script:", src || "inline");
                            }
                        }
                    }
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });

            window.addEventListener("load", async () => {
                // console.log("✅ 页面加载完成，开始执行自定义逻辑");

                if (typeof callback === "function") {
                    await callback();
                }
                // console.log("✅ 自定义逻辑执行完毕，恢复脚本加载");

                for (const script of SCRIPT_QUEUE) {
                    document.head.appendChild(script);
                    // console.log("▶️ 恢复脚本:", script.src || "inline");
                }

                observer.disconnect();
                resolve(true);
            });
        });
    };

    // 自定义所有方法
    await interceptBeforeScript("tgsticker.js?31", () => {
        return new Promise(async (resolve) => {
            const loadCSS = (url) => {
                let link = document.createElement("link");
                link.rel = "stylesheet";
                link.type = "text/css";
                link.href = url;
                document.head.appendChild(link);
            };
            loadCSS("https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css");

            // 等待 jQuery 加载完成
            await waitForJQuery();

            let user =  $(".pr-header-account-name").text()
            const scripts = [
                "https://cdn.jsdelivr.net/npm/sweetalert2@11",
                "https://klao258.github.io/JBADS/autoADSData.js",
            ];

            // 加载 autoADSData
            const ready = await loadMultipleScriptsAndWaitForAll(scripts, ['autoADSData']);

            // 加载 postData
            const expectedVars = [
                "window.ajInit",
                "window.OwnerAds",
                "window.postData"
            ];
            await loadMultipleScriptsAndWaitForAll([`https://klao258.github.io/JBADS/adsData/${ autoADSData?.['accountObj']?.[user] }.js`], expectedVars);
            
            // 加载主逻辑
            window.postID = [];
            if (ready) {
                console.log("✅ 所有脚本加载成功");

                window.postID = Object.keys(window.postData || {}); // 对应账号所有ads标识
            } else {
                console.warn("❌ 加载失败或变量未就绪");
                window.postData = {}
                window.postID = []
            }

            await loadMultipleScriptsAndWaitForAll(['https://klao258.github.io/JBADS/autoADS.js'], []);

            resolve(true);
        });
    });
})();
  