"use strict";


console.log("------ githup 脚本注入开始执行, 自动更新版本号, 自动化部署更新. --------");

const {accountObj, FTChannel, JBChannel, DBChannel, ADSChannels, promoteOpts, GQText, copyText, guid, getRNum, copy, sleep, date, timestampToDate, inStr} = autoADSData

window.isLoad = false;
var timerID = null;
var host = "https://ads.telegram.org";

var maxWidth = "100%";
var loadADSFlag = false;
var user = '';

let postID = []
try {
    postID = Object.keys(postData || {}); // 对应账号所有ads标识
} catch (error) {
    var postData = {}
    postID = []
}

let db;
const cpms_store = "cpms";  // 记录单价
const pviews_store = "pviews"; // 记录展示量
const request = indexedDB.open("myDatabase", 5);
request.onerror = (event) => {
    console.error("数据库打开失败:", event.target.errorCode);
};
request.onsuccess = (event) => {
    db = event.target.result;
    console.log("数据库打开成功");
};
request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains(cpms_store)) {
        const objectStore = db.createObjectStore("cpms", {
            autoIncrement: true,
        });
        objectStore.createIndex("ad_id", "ad_id", { unique: false });
        objectStore.createIndex("ads", "ads", { unique: false });
        objectStore.createIndex("cpm", "cpm", { unique: false });
        objectStore.createIndex("float", "float", { unique: false });
        objectStore.createIndex("views", "views", { unique: false });
        objectStore.createIndex("clicks", "clicks", { unique: false });
        objectStore.createIndex("joins", "joins", { unique: false });
        objectStore.createIndex("pays", "pays", { unique: false });
        objectStore.createIndex("money", "money", { unique: false });
        objectStore.createIndex("createDate", "createDate", { unique: false });
    }
    if (!db.objectStoreNames.contains(pviews_store)) {
        const objectStore = db.createObjectStore("pviews", {
            keyPath: 'ads_date' 
        });
        objectStore.createIndex("ads_date", "ads_date", { unique: false });
        objectStore.createIndex("ad_id", "ad_id", { unique: false });
        objectStore.createIndex("cpm", "cpm", { unique: false });
        objectStore.createIndex("views", "views", { unique: false });
        objectStore.createIndex("clicks", "clicks", { unique: false });
        objectStore.createIndex("joins", "joins", { unique: false });
        objectStore.createIndex("pays", "pays", { unique: false });
        objectStore.createIndex("money", "money", { unique: false });
    }
};

// 获取DB数据 返回obj
const getDB = (field, val, store_name = cpms_store) => {
    return new Promise((resolve, reject) => {
        if (typeof db === "undefined" || !db) {
            console.log("全局数据库实例 db 未定义或未初始化");
            resolve(false);
            return;
        }

        const transaction = db.transaction(store_name, "readonly");
        const store = transaction.objectStore(store_name);
        const index = store.index(field);
        const request = index.get(val);

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.log(event.target.error);
            resolve(false);
        };
    });
};

// 获取符合条件的DB数据
const filterDB = (callback, store_name = cpms_store) => {
    return new Promise((resolve, reject) => {
        if (typeof db === "undefined" || !db) {
            console.log("全局数据库实例 db 未定义或未初始化");
            resolve(false);
            return;
        }
        const transaction = db?.transaction([store_name], "readonly");
        const store = transaction?.objectStore(store_name);
        const result = [];
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (callback(cursor.value)) {
                    result.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(result); // 遍历完返回数组
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// 获取DB所有数据
const getAllData = (store_name = cpms_store) => {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.log("全局数据库实例 db 未定义或未初始化");
            resolve(false);
            return;
        }
        const transaction = db.transaction(store_name, "readonly");
        const store = transaction.objectStore(store_name);

        // 如果浏览器支持 getAll，优先使用
        if ("getAll" in store) {
            const request = store.getAll();
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => resolve(false);
        } else {
            // 不支持 getAll 时用游标遍历
            const results = [];
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = (event) => resolve(false);
        }
    });
};

// 设置DB数据
const setDB = (data, store_name = cpms_store) => {
    return new Promise((resolve, reject) => {
        if (typeof db === "undefined" || !db) {
            console.log("全局数据库实例 db 未定义或未初始化");
            resolve(false);
            return;
        }

        const transaction = db.transaction(store_name, "readwrite");
        const store = transaction.objectStore(store_name);
        const request = store.put(data); // put 自动新增或覆盖

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = (event) => {
            console.log(event.target.error);
            resolve(false);
        };
    });
};

/**
 * 权重得分 = 归一化注册 × 1.5 + 归一化付款人数 × 2.5 + 归一化付款金额 × 5
 * 分数区间	质量评级	文字描述
 *  8.5 ~ 10.0	🌟🌟🌟🌟🌟 极优广告	吸引力非常强，转化率与充值金额均属上乘，大概率为优质素材或投放点，值得放大。
 *  6.5 ~ 8.5	🌟🌟🌟🌟 优秀广告	付款转化表现稳定，ROI 可观，注册和活跃质量也不错，可继续投放或微调提升。
 *  4.5 ~ 6.5	🌟🌟🌟 中规中矩	有人注册也有转化，但金额一般，说明引流还行但没有打到大户，可调整策略。
 *  2.0 ~ 4.5	🌟🌟 待优化广告	可能只有注册或偶尔付费，质量低或素材问题，建议暂停优化方向。
 *  0.0 ~ 2.0	🌟 极低质量广告	几乎无效的投放，建议立刻停掉，别浪费预算。
 */
const weight = { regs: 1.5, pays: 2.5, money: 5 }; // 权重设置：ROI 优先
const normalize = (val, min, max) => (val - min) / (max - min || 1); // 归一化函数
const getWeightedScore = (ad, stats, weight) => {
    const regScore = normalize(ad.regs, stats.minRegs, stats.maxRegs);
    const paysScore = normalize(ad.pays, stats.minPays, stats.maxPays);
    const moneyScore = normalize(ad.money, stats.minMoney, stats.maxMoney);

    return (
        regScore * weight.regs + paysScore * weight.pays + moneyScore * weight.money
    );
};
const values = Object.values(postData || {}).map((str) => {
    const [regs, pays, money] = str.split("-").map(Number);
    return { regs, pays, money };
});
const stats = {
    minRegs: 0, //  Math.min(...values.map(v => v.regs)),
    maxRegs: Math.max(...values.map((v) => v.regs)),
    minPays: 0, //  Math.min(...values.map(v => v.pays)),
    maxPays: Math.max(...values.map((v) => v.pays)),
    minMoney: 0, //  Math.min(...values.map(v => v.money)),
    maxMoney: Math.max(...values.map((v) => v.money)),
};

// 获取html
const getHTML = (url, key, isParse = true) => {
    return new Promise((relove, reject) => {
        $.get(url, (data) => {
            let html = isParse
                ? new DOMParser().parseFromString(data[key], "text/html")
                : data;
            relove($(html));
        }).fail((err) => {
            relove(false);
        });
    });
};

// 获取月总消耗
const getMonthTotal = async () => {
    let html = await getHTML("https://ads.telegram.org/account/stats", "h");
    let M = new Date().getMonth() + 1;
    let mAmount = html.find("tbody").last().find("td").last().text();
    const $target = $(".pr-header-text");
    const text = `${M}月总消耗: ${mAmount}`;
    let $existing = $target.find(".mAmount");
    $existing.length > 0
        ? $existing.text(text)
        : $target.append(
            `<span class="mAmount" style="margin-left: 10px; color: red;">${text}</span>`
        );
};

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
        let loadSwal = async () => {
            if (typeof Swal !== "undefined") {
                console.log("SweetAlert2 已加载");
                return Swal;
            }
        
            return new Promise((resolve, reject) => {
                let script = document.createElement("script");
                script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
                script.onload = () => {
                    console.log("SweetAlert2 加载完成");
                    resolve(Swal);
                };
                script.onerror = () => reject(new Error("SweetAlert2 加载失败"));
                document.head.appendChild(script);
            });
        };
        
        const loadCSS = (url) => {
            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = url;
            document.head.appendChild(link);
        };
        
        // 加载 Toastify.js 的 CSS
        loadCSS("https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css");
        await loadSwal();
        
        user =  $(".pr-header-account-name").text()

        // 功能界面
        const createView = () => {
            const $toggleBtn = $("<button>", {
                text: "收起 ▲",
                class: "toggle-btn",
                click: function () {
                    const isCollapsed = $container.data("collapsed");
                    if (isCollapsed) {
                        // 展开
                        $container.children().not(".toggle-btn").show();
                        $(this).text("收起 ▲");
                        $container.data("collapsed", false);
                    } else {
                        // 收起
                        $container.children().not(".toggle-btn").hide();
                        $(this).text("展开 ▼");
                        $container.data("collapsed", true);
                    }
                }
            }).css({
                width: "100%",
                marginBottom: "5px",
                padding: "5px",
                fontSize: "12px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "5px",
                cursor: "pointer"
            });

            // 创建容器
            const $container = $("<div>", {
                id: "buttonContainer",
            }).css({
                position: "fixed",
                top: "0",
                right: "0",
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 5px",
                width: "140px",
                zIndex: 1,
                background: "#fff",
                padding: "5px",
                borderRadius: "5px",
                boxShadow: "0 0 10px rgba(0,0,0,0.2)",
            });

            $container.data("collapsed", false); // 默认展开状态
            $container.append($toggleBtn); // 添加按钮到容器顶部

            // 创建文本域
            let $textArea = $("<textarea>", {
                class: "urls",
            })
                .attr("placeholder", "请输入频道/机器人链接, 多个链接需要换行")
                .css({
                    width: "100%",
                    height: "100px",
                    border: "1px solid #ccc",
                    padding: "5px",
                    borderRadius: "5px",
                    fontSize: "14px",
                    resize: "none",
                });

            // 创建推广链接下拉框
            const $select = $("<select>", {
                class: "select",
            }).css({
                flex: 1,
                padding: "5px",
                borderRadius: "5px",
                fontSize: "14px",
            });

            // 添加选项（可根据需要修改）
            promoteOpts.forEach((opt) => {
                if (FTChannel.includes(user)) {
                    if (![ "JB6666_BOT", "jbpc28", "jbft", "jbyll", "jbtg001", "jbtg002", "jbtg003", "jbtg004", "jbtg005", "jbft100", "JBFT101", "jbtg102", "jbtg103", "jbtg105", "jbtg106", "qnzx8", "cflm88", "cflr8"].includes(opt.value)) return false;
                } else if (JBChannel.includes(user)) {
                    if (!inStr(opt.value, ["JBYL_bot", "jb123_com"])) return false;
                } else if (DBChannel.includes(user)) {
                    if (!inStr(opt.value, ["jbgq", "jbgx", "jbdb", "jbjt"])) return false;
                } else {
                    if (!inStr(opt.value, 'JB6666_BOT')) return false;
                }

                $select.append($(`<option value="${opt.value}">${opt.label}</option>`));
            });

            // 创建行业下拉框
            const $GQSelet = $("<select>", {
                class: "GQClassify",
            }).css({
                flex: 1,
                padding: "5px",
                borderRadius: "5px",
                fontSize: "14px",
            });
            
            Object.keys(GQText).map(v => $GQSelet.append($(`<option value="${v}">${v}</option>`)))

            // 创建输入框容器
            let $priceInputs = $(`
                <div id="priceContainer">
                    <label class="rangeLabel" style="font-weight: 400; font-size: 12px; margin-bottom: 0;">单价：</label>
                    <input type="number" id="minPrice" class="price-input" style="flex: 1; border: 1px solid #ccc; width: 40px;" value="3" min="0.1" max="50" step="0.1">
                    <label> - </label>
                    <input type="number" id="maxPrice" class="price-input" style="flex: 1; border: 1px solid #ccc; width: 40px;" value="5" min="0.1" max="50" step="0.1">
                </div>
            `).css({
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "160px",
                background: "rgba(255, 255, 255, 0.9)",
                // padding: "2px 5px",
                // border: "1px solid rgb(204, 204, 204)",
                // borderRadius: "5px",
            });

            // 创建总预算输入框
            let $budgetInputs = $(`
                        <div id="budgetContainer">
                            <label class="rangeLabel" style="font-weight: 400; font-size: 12px; margin-bottom: 0;">预算：</label>
                            <input type="number" id="minBudget" class="budget-input" style="flex: 1; border: 1px solid #ccc; width: 40px;" value="1" min="1" max="50" step="1">
                            <label> - </label>
                            <input type="number" id="maxBudget" class="budget-input" style="flex: 1; border: 1px solid #ccc; width: 40px;" value="1" min="1" max="50" step="1">
                        </div>
                    `).css({
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "180px",
                background: "rgba(255, 255, 255, 0.9)",
                // padding: "2px 5px",
                // border: "1px solid rgb(204, 204, 204)",
                // borderRadius: "5px",
            });

            // 所有按钮封装函数
            const createButton = (text, className, clickFn) => {
                if (
                    [...FTChannel, ...JBChannel, ...DBChannel].includes(user) &&
                    ["textTeviewBtn"].includes(className)
                ) {
                    return null;
                } else if (
                    ![...FTChannel, ...JBChannel, ...DBChannel].includes(user) &&
                    ["searchADSBtn"].includes(className)
                ) {
                    return null;
                } else {
                    return $("<button>", {
                        text,
                        class: className,
                        click: clickFn,
                    }).css({
                        padding: "4px 6px",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        flex: 1,
                    });
                }
            };

            // 添加按钮
            const buttons = [
                createButton("单链发布", "newADBtn", () => sendChannel()),
                createButton("多链发布", "sendMoreUrl", () => sendMoreChannel()),
                createButton("搜索广告", "searchADSBtn", () => onSearchADS()),
                createButton("一键重审", "reviewBtn", async () => onReview()),
                // createButton("跑动提价", "addPrice", async () => addPriceActiveFn()),
                // createButton("未跑动提价", "addPrice", async () => addPriceFn()),
                createButton("加预算", "addMount", async () => addMountFn()),
                createButton("文案替换", "textTeviewBtn", async () => onReplace()),
                // createButton("删除15天无浏览量", "delBtn", async () => onDelsViews()),
                createButton("删除0评分审核失败", "delBtn", async () => onDels()),
                createButton("提价", "proPrice", async () => onProPrice()),
                createButton("刷新页面", "refreshBtn", async () => onRefresh()),
            ];

            // 添加元素到容器
            $container.append(
                $textArea,
                $select,
                DBChannel.includes(user) ? $GQSelet : null,
                $priceInputs,
                $budgetInputs,
                ...buttons
            );

            // 添加到页面
            $("body").append($container);
        };
        createView();


        window.ajInit = (options) => {
            if (!window.history || !history.pushState) {
                return false;
            }

            var nav_url = location.href;
            var short_url = layerUrlToShort(nav_url);
            if (options.layer && !short_url) {
                nav_url = layerUrlToNav(nav_url, options.layerUnderUrl);
            }
            if (!history.state) {
                history.replaceState({ i: 0, u: nav_url }, null, short_url);
            } else if (!history.state.u) {
                history.replaceState(
                    { i: history.state.i, u: nav_url },
                    null,
                    short_url
                );
            } else if (short_url && location.href != short_url) {
                history.replaceState(history.state, null, short_url);
            }

            var $progress = $("#aj_progress"),
                progressBoxShadow = "inset 0 2px 0 var(--accent-color, #39ade7)",
                progressNoBoxShadow = "inset 0 0 0 var(--accent-color, #39ade7)",
                progressTransition = "width .3s linear, box-shadow .2s ease",
                progressTo,
                progressVal = 0;
            $progress.css({
                width: 0,
                transition: progressTransition,
                position: "fixed",
                zIndex: 1000,
                top: 0,
                height: 3,
            });

            var skipPopState = false;
            var curHistoryState = history.state;
            var curLocation = loc(curHistoryState.u);
            var layerCloseLocation = layerCloseLoc(curHistoryState.u);
            var underLayerTitle = document.title;
            var curOnLoad = [],
                curOnUnload = [];
            var curOnLayerLoad = [],
                curOnLayerUnload = [];
            var curBeforeUnload = false,
                curBeforeLayerUnload = false;
            var ajContainer = $("#aj_content");

            // console.log('history init', 'curState =', curHistoryState);

            window.Aj = {
                apiUrl: options.apiUrl,
                version: options.version,
                unauth: options.unauth || false,
                onLoad: onLoad,
                onUnload: onUnload,
                onLayerLoad: onLayerLoad,
                onLayerUnload: onLayerUnload,
                pageLoaded: pageLoaded,
                layerLoaded: layerLoaded,
                showProgress: showProgress,
                hideProgress: hideProgress,
                onBeforeUnload: onBeforeUnload,
                onBeforeLayerUnload: onBeforeLayerUnload,
                linkHandler: linkHandler,
                location: _location,
                layerLocation: layerLocation,
                setLocation: setLocation,
                setLayerLocation: setLayerLocation,
                reload: reload,
                apiRequest: apiRequest,
                uploadRequest: uploadRequest,
                needAuth: needAuth,
                ajContainer: ajContainer,
                state: options.state || {},
                layerState: {},
                globalState: {},
                layer: false,
            };

            if (options.layer) {
                Aj.layer = $("#layer-popup-container");
                Aj.layerState = options.layerState || {};
                if (options.layerTitle) {
                    document.title = options.layerTitle;
                }
            }

            function showProgress() {
                clearTimeout(progressTo);
                if (!progressVal) {
                    $progress.css({ width: 0, transition: "none" });
                    progressTo = setTimeout(function () {
                        $progress.css({ transition: progressTransition });
                        showProgress();
                    }, 50);
                } else {
                    progressTo = setTimeout(showProgress, 300);
                }
                $progress.css({
                    width: progressVal + "%",
                    boxShadow: progressBoxShadow,
                });
                progressVal = progressVal + (99 - progressVal) / 4;
            }

            function hideProgress(cancel) {
                clearTimeout(progressTo);
                progressTo = false;
                progressVal = 0;
                $progress.css({ width: cancel ? "0%" : "100%" });
                setTimeout(function () {
                    $progress.css({ boxShadow: progressNoBoxShadow });
                }, 300);
            }

            function apiRequest(method, data, onSuccess) {
                return $.ajax(Aj.apiUrl, {
                    type: "POST",
                    data: $.extend(data, { method: method }),
                    dataType: "json",
                    xhrFields: {
                        withCredentials: true,
                    },
                    success: function (result) {
                        if (result._dlog) {
                            $("#dlog").append(result._dlog);
                        }
                        onSuccess && onSuccess(result);
                    },
                    error: function (xhr) {
                        if (!xhr.readyState && !xhr.status) {
                            // was aborted
                        } else if (xhr.status == 401) {
                            location.href = "/auth";
                        } else if (xhr.readyState > 0) {
                            location.reload();
                        }
                    },
                });
            }

            function uploadRequest(method, file, params, onSuccess, onProgress) {
                var data = new FormData();
                data.append("file", file, file.name);
                data.append("method", method);
                for (var key in params) {
                    data.append(key, params[key]);
                }
                return $.ajax(Aj.apiUrl, {
                    type: "POST",
                    data: data,
                    cache: false,
                    dataType: "json",
                    processData: false,
                    contentType: false,
                    xhrFields: {
                        withCredentials: true,
                    },
                    xhr: function () {
                        var xhr = new XMLHttpRequest();
                        xhr.upload.addEventListener("progress", function (event) {
                            if (event.lengthComputable) {
                                onProgress && onProgress(event.loaded, event.total);
                            }
                        });
                        return xhr;
                    },
                    beforeSend: function (xhr) {
                        onProgress && onProgress(0, 1);
                    },
                    success: function (result) {
                        if (result._dlog) {
                            $("#dlog").append(result._dlog);
                        }
                        onSuccess && onSuccess(result);
                    },
                    error: function (xhr) {
                        if (xhr.status == 401) {
                            location.href = "/auth";
                        } else if (xhr.readyState > 0) {
                            onSuccess && onSuccess({ error: "Network error" });
                        }
                    },
                });
            }

            function loc(href) {
                var url = document.createElement("a");
                url.href = href;
                return url;
            }

            function layerHref(href) {
                var url = document.createElement("a");
                url.href = href;
                var search = url.search;
                if (search.substr(0, 1) == "?") {
                    search = search.substr(1);
                }
                var params = search.split("&");
                for (var i = 0; i < params.length; i++) {
                    var kv = params[i].split("=");
                    if (kv[0] == "l") {
                        return decodeURIComponent(kv[1] || "");
                    }
                }
                return null;
            }

            function layerOpenHref(href, l) {
                var url = document.createElement("a");
                url.href = href;
                url.search = url.search.replace(/&l=[^&]*/g, "", url.search);
                url.search = url.search.replace(
                    /(\?)l=[^&]*&|\?l=[^&]*$/g,
                    "$1",
                    url.search
                );
                url.search += (url.search ? "&" : "?") + "l=" + encodeURIComponent(l);
                return url.href;
            }

            function layerCloseLoc(href) {
                var url = document.createElement("a");
                url.href = href;
                url.search = url.search.replace(/&l=[^&]*/g, "", url.search);
                url.search = url.search.replace(
                    /(\?)l=[^&]*&|\?l=[^&]*$/g,
                    "$1",
                    url.search
                );
                return url;
            }

            function layerUrlToShort(href) {
                var url = document.createElement("a");
                url.href = href;
                var match = url.search.match(/(\?|&)l=([^&]*)/);
                if (match) {
                    return "/" + decodeURIComponent(match[2]);
                }
                return null;
            }

            function layerUrlToNav(href, cur_loc) {
                if (layerUrlToShort(href)) {
                    return href;
                }
                var url = document.createElement("a");
                url.href = href;
                var layer_url = url.pathname.replace(/^\/+|\/+$/g, "");
                return layerOpenHref(cur_loc || "/", layer_url);
            }

            function changeLocation(url, push_state) {
                if (push_state) {
                    location.href = url;
                } else {
                    location.replace(url);
                }
            }

            function scrollToEl(elem) {
                $(window).scrollTop($(elem).offset().top);
            }

            function scrollToHash(hash) {
                hash = hash || curLocation.hash;
                if (hash[0] == "#") hash = hash.substr(1);
                if (!hash) return;
                var elem = document.getElementById(hash);
                if (elem) {
                    return scrollToEl(elem);
                }
                elem = $("a[name]")
                    .filter(function () {
                        return $(this).attr("name") == hash;
                    })
                    .eq(0);
                if (elem.length) {
                    scrollToEl(elem);
                }
            }

            function onLoad(func) {
                // console.log('added to onLoad');
                curOnLoad.push(func);
            }

            function onUnload(func) {
                // console.log('added to onUnload');
                curOnUnload.push(func);
            }

            function onLayerLoad(func) {
                // console.log('added to onLayerLoad');
                curOnLayerLoad.push(func);
            }

            function onLayerUnload(func) {
                // console.log('added to onLayerUnload');
                curOnLayerUnload.push(func);
            }

            function onBeforeUnload(func) {
                curBeforeUnload = func;
            }

            function onBeforeLayerUnload(func) {
                curBeforeLayerUnload = func;
            }

            function pageLoaded() {
                if (curOnLoad.length) {
                    for (var i = 0; i < curOnLoad.length; i++) {
                        // console.log('onLoad', i);
                        curOnLoad[i](Aj.state);
                    }
                }
                onUnload(function () {
                    $(ajContainer).off(".curPage");
                    $(document).off(".curPage");
                });
                $(ajContainer).trigger("page:load");
                if (Aj.layer) {
                    layerLoaded();
                }
            }

            function layerLoaded() {
                if (curOnLayerLoad.length) {
                    for (var i = 0; i < curOnLayerLoad.length; i++) {
                        // console.log('onLayerLoad', i);
                        curOnLayerLoad[i](Aj.layerState);
                    }
                }
                onLayerUnload(function () {
                    Aj.layer.off(".curLayer");
                });
                Aj.layer.one("popup:close", function () {
                    if (curOnLayerUnload.length) {
                        for (var i = 0; i < curOnLayerUnload.length; i++) {
                            // console.log('onLayerUnload', i);
                            curOnLayerUnload[i](Aj.layerState);
                        }
                    }
                    Aj.layer.remove();
                    if (underLayerTitle) {
                        document.title = underLayerTitle;
                    }
                    if (layerCloseLocation) {
                        setLocation(layerCloseLocation.href);
                        layerCloseLocation = false;
                    }
                    Aj.layer = false;
                    Aj.layerState = {};
                    curOnLayerLoad = [];
                    curOnLayerUnload = [];
                });
                Aj.layer.on("click.curLayer", "a[data-layer-close]", function (e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    closePopup(Aj.layer);
                });
                openPopup(Aj.layer, {
                    closeByClickOutside: ".popup-no-close",
                    onBeforeClose: function ($popup) {
                        var unloaded = checkBeforeUnload(function () {
                            var options = $popup.data("options");
                            options.onBeforeClose = null;
                            closePopup($popup);
                        });
                        return unloaded;
                    },
                });
                $(ajContainer).trigger("layer:load");
            }

            function onResult(url, http_code, result, push_state) {
                hideProgress();
                if (
                    http_code != 200 ||
                    !result ||
                    !result.v ||
                    result.v != Aj.version
                ) {
                    changeLocation(url, push_state);
                    return;
                }
                var url_hash = loc(url).hash;
                if (result.r) {
                    var redirect_url = result.r;
                    if (url_hash) {
                        redirect_url = redirect_url.split("#")[0] + url_hash;
                    }
                    if (result.hr || !loadPage(loc(redirect_url), push_state)) {
                        changeLocation(redirect_url, push_state);
                    }
                    return;
                }
                var saved_ult = underLayerTitle;
                var saved_lcl = !Aj.layer || !push_state ? layerCloseLocation : false;
                underLayerTitle = false;
                layerCloseLocation = false;
                closeAllPopups();
                underLayerTitle = saved_ult;
                layerCloseLocation = saved_lcl;

                if (result.h) {
                    if (curOnUnload.length) {
                        for (var i = 0; i < curOnUnload.length; i++) {
                            // console.log('onUnload', i);
                            curOnUnload[i](Aj.state);
                        }
                    }
                    if (push_state) {
                        if (result.l) {
                            url = layerUrlToNav(url);
                        }
                        setLocation(url);
                    }
                    Aj.state = {};
                    curOnLoad = [];
                    curOnUnload = [];
                    if (result.t) {
                        document.title = result.t;
                        underLayerTitle = document.title;
                    }
                    if (result.h) {
                        ajContainer.html(result.h);
                    }
                    if (result.s) {
                        $.extend(Aj.state, result.s);
                    }
                    document.documentElement.className = result.rc || "";
                    if (result._dlog) {
                        $("#dlog").html(result._dlog);
                    }
                    if (push_state || !Aj._useScrollHack) {
                        $(window).scrollTop(0);
                    }
                    unfreezeBody();
                    if (url_hash) {
                        scrollToHash();
                    }
                    if (result.l) {
                        Aj.layer = $(
                            '<div class="popup-container hide" id="layer-popup-container"></div>'
                        );
                        Aj.layerState = {};
                        curOnLayerLoad = [];
                        curOnLayerUnload = [];
                        if (result.lt) {
                            document.title = result.lt;
                        }
                        if (result.ls) {
                            $.extend(Aj.layerState, result.ls);
                        }
                        Aj.layer.html(result.l).appendTo(document.body);
                    }
                    if (result.j) {
                        window.execScript ? window.execScript(result.j) : eval(result.j);
                    }
                    pageLoaded();
                    return;
                } else if (result.l) {
                    if (push_state) {
                        url = layerUrlToNav(url);
                        setLocation(url);
                    }
                    if (result.s) {
                        $.extend(Aj.state, result.s);
                    }
                    if (result._dlog) {
                        $("#dlog").html(result._dlog);
                    }
                    Aj.layer = $(
                        '<div class="popup-container hide" id="layer-popup-container"></div>'
                    );
                    Aj.layerState = {};
                    curOnLayerLoad = [];
                    curOnLayerUnload = [];
                    if (result.lt) {
                        document.title = result.lt;
                    }
                    if (result.ls) {
                        $.extend(Aj.layerState, result.ls);
                    }
                    Aj.layer.html(result.l).appendTo(document.body);
                    if (result.j) {
                        window.execScript ? window.execScript(result.j) : eval(result.j);
                    }
                    layerLoaded();
                    return;
                }
                return changeLocation(url, push_state);
            }

            function loadPage(link, push_state, state_go) {
                var url = link.href;
                var cur_url = curLocation.href;
                var cur_ref =
                    curLocation.origin + curLocation.pathname + curLocation.search;
                if (link.origin != curLocation.origin) {
                    return false;
                }
                if (
                    link.pathname == curLocation.pathname &&
                    link.search == curLocation.search &&
                    link.hash != curLocation.hash
                ) {
                    return false;
                }
                if (url == cur_url) {
                    push_state = false;
                }
                var load_fn,
                    interrupted = false;
                load_fn = function () {
                    if (!push_state) {
                        if (interrupted) {
                            historyJump(state_go);
                        }
                        curLocation = loc(url);
                        layerCloseLocation = layerCloseLoc(url);
                    }
                    if (interrupted && Aj.layer) {
                        var options = Aj.layer.data("options");
                        options.onBeforeClose = null;
                    }
                    showProgress();
                    $.ajax(url, {
                        dataType: "json",
                        xhrFields: { withCredentials: true },
                        headers: { "X-Aj-Referer": cur_ref },
                        success: function (result, t, xhr) {
                            onResult(url, xhr.status, result, push_state);
                        },
                        error: function (xhr) {
                            onResult(url, xhr.status, false, push_state);
                        },
                    });
                };
                interrupted = !checkBeforeUnload(load_fn);
                if (interrupted && !push_state) {
                    historyJump(-state_go);
                }
                return true;
            }

            function _location(href, replace) {
                if (typeof href !== "undefined") {
                    var url = loc(href);
                    var push_state = !replace;
                    if (!loadPage(url, push_state)) {
                        changeLocation(url, push_state);
                    }
                } else {
                    return loc(curLocation.href);
                }
            }

            function layerLocation(layer_url) {
                if (typeof layer_url !== "undefined") {
                    var layer_href = layerOpenHref(curLocation, layer_url);
                    loadPage(loc(layer_href), true);
                } else {
                    return layerHref(curLocation.href);
                }
            }

            function setLocation(href, replace = false) {
                var url = loc(href).href;
                var short_url = layerUrlToShort(url) || url;
                if (replace) {
                    history.replaceState(
                        { i: curHistoryState.i, u: url },
                        null,
                        short_url
                    );
                    // console.log('history replace', 'oldState =', curHistoryState, 'newState =', history.state);
                } else {
                    history.pushState(
                        { i: curHistoryState.i + 1, u: url },
                        null,
                        short_url
                    );
                    // console.log('history push', 'oldState =', curHistoryState, 'newState =', history.state);
                }
                curHistoryState = history.state;
                curLocation = loc(curHistoryState.u);
                layerCloseLocation = layerCloseLoc(curHistoryState.u);
            }

            function setLayerLocation(layer_url) {
                layer_url = layer_url.toString().replace(/^\/+|\/+$/g, "");
                var layer_href = layerOpenHref(curLocation, layer_url);
                var url = loc(layer_href).href;
                var short_url = layerUrlToShort(url) || url;
                history.pushState(
                    { i: curHistoryState.i + 1, u: url },
                    null,
                    short_url
                );
                // console.log('history push', 'oldState =', curHistoryState, 'newState =', history.state);
                curHistoryState = history.state;
                curLocation = loc(curHistoryState.u);
            }

            function reload() {
                _location(_location(), true);
            }

            function historyJump(delta) {
                if (delta) {
                    skipPopState = true;
                    history.go(delta);
                }
            }

            function needAuth() {
                if (Aj.unauth) {
                    openPopup("#login-popup-container");
                    return true;
                }
                return false;
            }

            function linkHandler(e) {
                if (e.metaKey || e.ctrlKey) return true;
                var href = this.href;
                if (this.hasAttribute("data-unsafe") && href != $(this).text()) {
                    var $confirm = showConfirm(
                        l(
                            "WEB_OPEN_LINK_CONFIRM",
                            { url: cleanHTML(href) },
                            "Do you want to open <b>{url}</b>?"
                        ),
                        null,
                        l("WEB_OPEN_LINK", "Open")
                    );
                    $(".popup-primary-btn", $confirm).attr({
                        href: href,
                        target: $(this).attr("target"),
                        rel: $(this).attr("rel"),
                    });
                    return false;
                }
                if ($(this).attr("target") == "_blank") return true;
                if (this.hasAttribute("data-layer")) {
                    href = layerUrlToNav(href, curLocation);
                }
                if (
                    ($(this).hasClass("need-auth") && needAuth()) ||
                    loadPage(loc(href), true)
                ) {
                    e.preventDefault();
                }
            }

            function beforeUnloadHandler(e) {
                var message = null;
                if (Aj.layer && curBeforeLayerUnload) {
                    message = curBeforeLayerUnload();
                }
                if (!message && curBeforeUnload) {
                    message = curBeforeUnload();
                }
                if (message) {
                    if (typeof e === "undefined") e = window.e;
                    if (e) e.returnValue = message;
                    return message;
                }
            }
            function checkBeforeUnload(load_fn) {
                var message = null;
                if (Aj.layer && curBeforeLayerUnload) {
                    message = curBeforeLayerUnload();
                }
                if (!message && curBeforeUnload) {
                    message = curBeforeUnload();
                }
                var load_func = function () {
                    curBeforeLayerUnload = false;
                    curBeforeUnload = false;
                    load_fn();
                };
                if (message) {
                    var message_html = $("<div>").text(message).html();
                    showConfirm(message_html, load_func, l("WEB_LEAVE_PAGE", "Leave"));
                    return false;
                } else {
                    load_func();
                    return true;
                }
            }

            $(document).on("click", "a[href]", linkHandler);
            $(document.body).removeClass("no-transition");

            $(window).on("popstate", function (e) {
                var popstate = e.originalEvent.state;
                var state_go = popstate ? popstate.i - curHistoryState.i : 0;
                if (!popstate) {
                    popstate = { i: 0, u: location.href };
                } else if (!popstate.u) {
                    popstate.u = location.href;
                }
                // console.log('history popstate', 'oldState =', curHistoryState, 'newState =', popstate, 'go(' + state_go + ')');
                curHistoryState = popstate;
                if (skipPopState) {
                    skipPopState = false;
                    return;
                }
                if (Aj._useScrollHack) {
                    freezeBody();
                }
                var link = loc(curHistoryState.u);
                var loaded = loadPage(link, false, state_go);
                if (!loaded && Aj._useScrollHack) {
                    unfreezeBody();
                }
            });
            window.onbeforeunload = beforeUnloadHandler;
        };

        window.OwnerAds = {
            init: function() {
              var cont = Aj.ajContainer;
              Aj.onLoad(function(state) {
                state.$searchField = $('.pr-search-input');
                state.$adsListTable = $('.pr-table');
                state.$searchResults = $('.pr-table tbody');
                Ads.fieldInit(state.$searchField);
                cont.on('click.curPage', '.pr-cell-sort', OwnerAds.eSortList);
                cont.on('click.curPage', '.pr-table-settings', OwnerAds.eSettingsOpen);
                cont.on('click.curPage', '.js-clone-ad-btn', EditAd.eCloneAd);
                cont.on('click.curPage', '.delete-ad-btn', EditAd.deleteAd);
                state.$tableColumnsPopup = $('.js-table-columns-popup');
                state.$tableColumnsForm = $('.js-table-columns-form');
                state.$tableColumnsForm.on('change.curPage', 'input.checkbox', OwnerAds.eColumnChange);
                state.$tableColumnsForm.on('submit.curPage', preventDefault);
          
                state.$searchField.initSearch({
                  $results: state.$searchResults,
                  emptyQueryEnabled: true,
                  updateOnInit: true,
                  resultsNotScrollable: true,
                  itemTagName: 'tr',
                  enterEnabled: function() {
                    return false;
                  },
                  
                  renderItem: function(item, query) {
                    var status_attrs = ' href="' + item.base_url + item.status_url + '" ' + (item.status_attrs || 'data-layer');
                    var title_class = 'pr-trg-type-' + item.trg_type;
                    if (item.tme_path) {
                      var promote_url = 'https://t.me/' + item.tme_path;
                      var promote_url_text = 't.me/' + item.tme_path;
                      var promote_link = '<a href="' + promote_url + '" target="_blank">' + promote_url_text + '</a>';
                    } else if (item.promote_url) {
                      var promote_url = item.promote_url;
                      var promote_url_text = promote_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                      var promote_link = '<a href="' + promote_url + '" target="_blank">' + promote_url_text + '</a>';
                    } else {
                      var promote_url = '#';
                      var promote_url_text = l('WEB_ADS_NO_TME_LINK');
                      var promote_link = '<span class="pr-no-tme-link">' + promote_url_text + '</span>';
                    }
                    var joins = item.joins !== false ? formatNumber(item.joins) : '–';
                    var actions = item.actions !== false ? formatNumber(item.actions) : '–';
                    var opens = item.opens !== false ? formatNumber(item.opens) : '–';
                    var clicks = item.clicks !== false ? formatNumber(item.clicks) : '–';
                    var ctr = item.ctr !== false ? item.ctr + '%' : '–';
                    var cpc = item.cpc !== false ? Ads.wrapAmount(item.cpc) : '–';
                    var cps = item.cps !== false ? Ads.wrapAmount(item.cps) : '–';
                    var cpa = item.cpa !== false ? Ads.wrapAmount(item.cpa) : '–';
                    var daily_spent  = item.daily_spent !== false ? '<small><br>' + Ads.wrapAmount(item.daily_spent)+'</small>' : '';
                    var daily_budget = item.daily_budget !== false ? '<small><br><a href="' + item.base_url + '/edit_daily_budget" data-layer>' + Ads.wrapAmount(item.daily_budget)+'</a></small>' : '';
                    return `<td>
                                <div class="pr-cell pr-cell-title ${title_class}">
                                    <a href="${item.base_url}" class="pr-link">${item.title}</a>
                                    <small style="display:var(--coldp-url,inline)"><br>${ promote_link}</small>
                                </div>
                            </td>

                            ${!ADSChannels.includes(user) ? `
                                <td><div class="pr-cell score">${ item.score || '' }</div></td>
                                <td><div class="pr-cell regs">${ item.regs || '' }</div></td>
                                <td><div class="pr-cell pays">${ item.pays || '' }</div></td>
                                <td><div class="pr-cell money">${ item.money || '' }</div></td>
                                ` : ''}
                            
                            <td><div class="pr-cell qviews" style="color: ${+item?.qviews < 500 ? 'green' : ''};">${ formatNumber(item?.qviews) || '' }</div></td>
                            <td><div class="pr-cell pviews">${ Ads.wrapAmount(item?.qspent) }</div></td>
                            <td><div class="pr-cell pviews" style="color: ${ +item?.pviews < +item?.qviews ? 'red' : '' };">${ formatNumber(item?.pviews) || '' }</div></td>
                            <td><div class="pr-cell pviews">${ Ads.wrapAmount(item?.pspent) }</div></td>

                            <td style="display:var(--coldp-views,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${formatNumber(item.views)}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-opens,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${opens}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-clicks,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${clicks}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-joins,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${actions}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-ctr,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${ctr}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-cpm,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/edit_cpm" data-layer>${Ads.wrapAmount(item.cpm)}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-cpc,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${cpc}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-cpa,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${cpa}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-spent,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/stats" class="pr-link">${Ads.wrapAmount(item.spent) + daily_spent}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-budget,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}/edit_budget" data-layer>${Ads.wrapAmount(item.budget)}</a>
                                    ${daily_budget}
                                </div>
                            </td>
                            <td style="display:var(--coldp-target,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}" class="pr-link">${item.target}</a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-status,table-cell)">
                                <div class="pr-cell">
                                    <a ${status_attrs}>
                                    ${ 
                                        [
                                            {status: 'Active', label: '通过'},
                                            {status: 'In Review', label: '审核中'},
                                            {status: 'Declined', label: '拒绝'},
                                            {status: 'On Hold', label: '暂停'},
                                            {status: 'Stopped', label: '预算不足'},
                                        ].find(v => v.status === item.status)?.label || item.status }
                                    </a>
                                </div>
                            </td>
                            <td style="display:var(--coldp-date,table-cell)">
                                <div class="pr-cell">
                                    <a href="${item.base_url}" class="pr-link">${date.formatCustomDate(item.date)}</a>
                                </div>
                            </td>
                            <td>
                                <div class="pr-actions-cell">
                                    ${Aj.state.adsDropdownTpl.replace(/\{ad_id\}/g, item.ad_id).replace(/\{promote_url\}/g, promote_url).replace(/\{promote_url_text\}/g, promote_url_text).replace(/\{ad_text\}/g, item.text)}
                                </div>
                            </td>`
                  },
                //   renderItem: function(item, query) {
                //     var status_attrs = ' href="' + item.base_url + item.status_url + '" ' + (item.status_attrs || 'data-layer');
                //     var title_class = 'pr-trg-type-' + item.trg_type;
                //     if (item.tme_path) {
                //       var promote_url = 'https://t.me/' + item.tme_path;
                //       var promote_url_text = 't.me/' + item.tme_path;
                //       var promote_link = '<a href="' + promote_url + '" target="_blank">' + promote_url_text + '</a>';
                //     } else if (item.promote_url) {
                //       var promote_url = item.promote_url;
                //       var promote_url_text = promote_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                //       var promote_link = '<a href="' + promote_url + '" target="_blank">' + promote_url_text + '</a>';
                //     } else {
                //       var promote_url = '#';
                //       var promote_url_text = l('WEB_ADS_NO_TME_LINK');
                //       var promote_link = '<span class="pr-no-tme-link">' + promote_url_text + '</span>';
                //     }
                //     var opens = item.opens !== false ? formatNumber(item.opens) : '–';
                //     var clicks = item.clicks !== false ? formatNumber(item.clicks) : '–';
                //     var actions = item.actions !== false ? formatNumber(item.actions) : '–';
                //     var action = item.action !== false ? '<br>' + item.action : '';
                //     var ctr = item.ctr !== false ? item.ctr + '%' : '–';
                //     var cvr = item.cvr !== false ? item.cvr + '%' : '–';
                //     var cpc = item.cpc !== false ? Ads.wrapAmount(item.cpc) : '–';
                //     var cpa = item.cpa !== false ? Ads.wrapAmount(item.cpa) : '–';
                //     var daily_spent  = item.daily_spent !== false ? '<small><br>' + Ads.wrapAmount(item.daily_spent)+'</small>' : '';
                //     var daily_budget = item.daily_budget !== false ? '<small><br><a href="' + item.base_url + '/edit_daily_budget" data-layer>' + Ads.wrapAmount(item.daily_budget)+'</a></small>' : '';
                //     return '<td><div class="pr-cell pr-cell-title ' + title_class + '"><a href="' + item.base_url + '"class="pr-link">' + item.title + '</a><small style="display:var(--coldp-url,inline)"><br>' + promote_link + '</small></div></td><td><div class="pr-cell">' + (item.score || '') + '</div></td><td><div class="pr-cell">' + (item.regs || '') + '</div></td><td><div class="pr-cell">' + (item.pays || '') + '</div></td><td><div class="pr-cell">' + (item.money || '') + '</div></td><td><div class="pr-cell" style="color:' + (+item?.pviews < 500 ? 'green' : '') + ';>' + (formatNumber(item?.qviews) || '') + '</div></td><td><div class="pr-cell" style="color: red;">' + (formatNumber(item?.pviews) || '') + '</div></td><td style="display:var(--coldp-views,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + formatNumber(item.views) + '</a></div></td><td style="display:var(--coldp-opens,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + opens + '</a></div></td><td style="display:var(--coldp-clicks,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + clicks + '</a></div></td><td style="display:var(--coldp-actions,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + actions + '</a><small style="display:var(--coldp-action,inline)">' + action + '</small></div></td><td style="display:var(--coldp-ctr,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + ctr + '</a></div></td><td style="display:var(--coldp-cvr,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + cvr + '</a></div></td><td style="display:var(--coldp-cpm,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/edit_cpm" data-layer>' + Ads.wrapAmount(item.cpm) + '</a></div></td><td style="display:var(--coldp-cpc,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + cpc + '</a></div></td><td style="display:var(--coldp-cpa,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + cpa + '</a></div></td><td style="display:var(--coldp-spent,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/stats" class="pr-link">' + Ads.wrapAmount(item.spent) + daily_spent + '</a></div></td><td style="display:var(--coldp-budget,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '/edit_budget" data-layer>' + Ads.wrapAmount(item.budget) + '</a>' + daily_budget + '</div></td><td style="display:var(--coldp-target,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '" class="pr-link">' + item.target + '</a></div></td><td style="display:var(--coldp-status,table-cell)"><div class="pr-cell"><a' + status_attrs + '>' + item.status + '</a></div></td><td style="display:var(--coldp-date,table-cell)"><div class="pr-cell"><a href="' + item.base_url + '" class="pr-link">' + Ads.formatTableDate(item.date) + '</a></div></td><td><div class="pr-actions-cell">' + Aj.state.adsDropdownTpl.replace(/\{ad_id\}/g, item.ad_id).replace(/\{promote_url\}/g, promote_url).replace(/\{promote_url_text\}/g, promote_url_text).replace(/\{ad_text\}/g, item.text) + '</div></td>';    
                  
                //   },
                  renderLoading: function() {
                    return '<tr><td colspan="100" class="pr-cell-empty"><div class="pr-cell">' + l('WEB_OWNER_ADS_LOADING') + '</div></td></tr>';
                  },
                  renderNoItems: function(query) {
                    if (Aj.state.adsListIsLoading) {
                      return '<tr><td colspan="100" class="pr-cell-empty-full"><div class="pr-cell">' + l('WEB_OWNER_ADS_LOADING') + '</div></td></tr>';
                    }
                    return '<tr><td colspan="100" class="pr-cell-empty-full"><div class="pr-cell">' + l('WEB_OWNER_NO_ADS') + '</div></td></tr>';
                  },
                  appendToItems: function(query, result_count) {
                    if (Aj.state.adsListIsLoading && result_count > 0) {
                      return '<tr><td colspan="100" class="pr-cell-empty"><div class="pr-cell">' + l('WEB_OWNER_ADS_LOADING') + '</div></td></tr>';
                    }
                    return '';
                  },
                  getData: function() {
                    return OwnerAds.getAdsList();
                  }
                });
              });
              Aj.onUnload(function(state) {
                Ads.fieldDestroy(state.$searchField);
                state.$searchField.destroySearch();
                state.$tableColumnsForm.off('.curPage');
              });
            },
            eSortList: function(e) {
              var $sortEl = $(this);
              var sortBy  = $sortEl.attr('data-sort-by');
              var sortAsc = $sortEl.hasClass('sort-asc');
              if (sortBy == Aj.state.adsListSortBy) {
                Aj.state.adsListSortAsc = !sortAsc;
              } else {
                Aj.state.adsListSortBy = sortBy;
                Aj.state.adsListSortAsc = false;
              }
              OwnerAds.updateAdsList();
              Aj.state.$searchField.trigger('datachange');
            },
            eSettingsOpen: function() {
              openPopup(Aj.state.$tableColumnsPopup, {
                closeByClickOutside: '.popup-no-close',
              });
            },
            eColumnChange: function() {
              var column = $(this).prop('name');
              var checked = $(this).prop('checked');
              Aj.state.$adsListTable.cssProp('--coldp-' + column, checked ? '' : 'none');
              OwnerAds.submitColumns();
            },
            submitColumns: function() {
              var $form = Aj.state.$tableColumnsForm;
              var active_columns = [];
              for (var i = 0; i < Aj.state.adsListAllColumns.length; i++) {
                var column = Aj.state.adsListAllColumns[i];
                if ($form.field(column).prop('checked')) {
                  active_columns.push(column);
                }
              }
              Aj.apiRequest('saveAdsColumns', {
                columns: active_columns.join(';')
              });
              return false;
            },
            updateAdsList: function() {
              if (Aj.state.adsList) {
                var sortBy  = Aj.state.adsListSortBy;
                var sortAsc = Aj.state.adsListSortAsc;
                $('.pr-cell-sort').each(function() {
                  var $sortEl = $(this);
                  var curSortBy  = $sortEl.attr('data-sort-by');
                  $sortEl.toggleClass('sort-active', sortBy == curSortBy);
                  $sortEl.toggleClass('sort-asc', sortAsc && sortBy == curSortBy);
                });
                Aj.state.adsList.sort(function(ad1, ad2) {
                  var v1 = sortAsc ? ad1 : ad2;
                  var v2 = sortAsc ? ad2 : ad1;
                  return (v1[sortBy] - v2[sortBy]) || (v1.date - v2.date);
                });
              }
            },
            processAdsList: async function (result, opts) {
                if(!$('.table > thead > tr .pviews')?.length){
                    $('.table > thead > tr > th:first').after(`
                        ${!ADSChannels.includes(user) 
                            ? `
                            <th width="65" style="display:var(--coldp-score,table-cell)">
                                <div class="score pr-cell pr-cell-sort" data-sort-by="score">评分<span class="pr-sort-marker"></span></div>
                            </th>
                            <th width="65" style="display:var(--coldp-res,table-cell)">
                                <div class="regs pr-cell pr-cell-sort" data-sort-by="regs">注册<span class="pr-sort-marker"></span></div>
                            </th>
                            <th width="65" style="display:var(--coldp-pays,table-cell)">
                                <div class="pays pr-cell pr-cell-sort" data-sort-by="pays">付款<span class="pr-sort-marker"></span></div>
                            </th>
                            <th width="65" style="display:var(--coldp-money,table-cell)">
                                <div class="money pr-cell pr-cell-sort" data-sort-by="money">总充值<span class="pr-sort-marker"></span></div>
                            </th>
                            ` : ''}
                            
                        <th width="65" style="display:var(--coldp-qviews,table-cell)">
                            <div class="pr-cell pr-cell-sort" data-sort-by="qviews">昨日展示<span class="pr-sort-marker"></span></div>
                        </th>
                        <th width="65" style="display:var(--coldp-qspent,table-cell)">
                            <div class="pr-cell pr-cell-sort" data-sort-by="qspent">昨日消耗<span class="pr-sort-marker"></span></div>
                        </th>
                        <th width="65" style="display:var(--coldp-pviews,table-cell)">
                            <div class="pviews pr-cell pr-cell-sort" data-sort-by="pviews">当天展示<span class="pr-sort-marker"></span></div>
                        </th>
                        <th width="65" style="display:var(--coldp-pspent,table-cell)">
                            <div class="pr-cell pr-cell-sort" data-sort-by="pspent">当天消耗<span class="pr-sort-marker"></span></div>
                        </th>
                    `)
                }

                // 获取昨天所有数据
                let yesday = date.getBeijingDateOnly(-1)
                let qianday = date.getBeijingDateOnly(-2)
                console.log('昨天', yesday, '前天', qianday);

                let yesData = await filterDB((row) => (row['ads_date']?.indexOf(yesday) !== -1 || row['ads_date']?.indexOf(qianday) !== -1), pviews_store)

                opts = opts || {};
                if (result.items) {
                    if (!Aj.state.adsList) {
                        Aj.state.adsList = [];
                    }
                    let list = [];
                    for (var i = 0; i < result.items.length; i++) {
                        var item = result.items[i];
                        let tmp = item?.tme_path?.split("_") || [];
                        let adsKey = tmp[tmp.length - 1] || "";
                        
                        let prow = yesData?.find?.(row => row['ads_date'] === `${yesday}_${item.ad_id}`)
                        let qrow = yesData?.find?.(row => row['ads_date'] === `${qianday}_${item.ad_id}`)

                        let tviews = item?.views || 0  // 当前总浏览量
                        let pviews = prow?.['views'] || 0 // 昨日总浏览量
                        let qviews = qrow?.['views'] || 0 // 前日总浏览量
                        let pspent =  ((tviews -  pviews) * (item?.cpm / 1000)).toFixed(2)   // 当日花费
                        let qspent = ((pviews - qviews) * (prow?.cpm / 1000)).toFixed(2)     // 昨日花费

                        if (postID.includes(adsKey)) {
                            if (!loadADSFlag) {
                                loadADSFlag = true;
                                $(".pr-logo-title").text(
                                    `Telegram Ads 已加载分析数据${postID.length}条`
                                );
                            }
                            let obj = postData[adsKey]?.split("-") || [];
                            item["pviews"] = (tviews -  pviews) || 0;
                            item["pspent"] = pspent || 0
                            item["qviews"] = (pviews - qviews) || 0;
                            item["qspent"] = qspent || 0
                            item["regs"] = +obj[0] || 0;
                            item["pays"] = +obj[1] || 0;
                            item["money"] = +obj[2] || 0;
                            item["score"] = getWeightedScore(item, stats, weight)?.toFixed(2) || 0;
                            item["_title"] = item.title;
                            // item.title = `权重：${item["score"]} &nbsp;|&nbsp; 注册：${obj[0]} &nbsp;|&nbsp; 付款：${obj[1]} &nbsp;|&nbsp; 总充值：${obj[2]} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${item.title}`;
                        } else {
                            item["pviews"] = (tviews -  pviews) || 0;
                            item["pspent"] = pspent || 0
                            item["qviews"] = (pviews - qviews) || 0;
                            item["qspent"] = qspent || 0
                            item["regs"] = 0;
                            item["pays"] = 0;
                            item["money"] = 0;
                            item["score"] = 0;
                            item["_title"] = item.title;
                        }
    
                        item.base_url = "/account/ad/" + item.ad_id;
                        item._values = [
                            item.title.toLowerCase(),
                            item.tme_path.toLowerCase(),
                        ];
                        list.push(item);
                        //Aj.state.adsList.push(item);
                    }
                    Aj.state.adsList = [...Aj.state.adsList, ...list];
    
                    // OwnerAds.updateAdsList();
                    Aj.state.adsList.sort((a, b) => {
                        const aScore = a?.score || 0;
                        const bScore = b?.score || 0;
    
                        if (aScore > 0 && bScore <= 0) return -1;
                        if (bScore > 0 && aScore <= 0) return 1;
    
                        if (aScore > 0 && bScore > 0) {
                            return bScore - aScore; // 分数高的在前
                        }
    
                        // 分数都为0，用 pays 字段排序（升序）
                        const aJonins = a?.joins || 0;
                        const bJonins = b?.joins || 0;
    
                        return bJonins - aJonins;
    
                        // (b.score - a.score) || (b.pays - a.pays))
                    });
    
                    // console.log('监听 + 排序后', copy(Aj.state.adsList))
    
                    Aj.state.$searchField.trigger("contentchange");
                }
                if (result.next_offset_id) {
                    opts.offset = result.next_offset_id;
                    OwnerAds.loadAdsList(opts);
                    window.isLoad = false;
                    loadADSFlag = false;
                } else {
                    Aj.state.adsListIsLoading = false;
                    Aj.state.$searchField.trigger("dataready");
                    await getMonthTotal();
                    $("#aj_content").css({
                        width: "89%"
                    })
                    $(".pr-container").css({
                        "max-width": maxWidth,
                        margin: "0 20px",
                    });
                    window.isLoad = true;
                }
            },
            loadAdsList: function(opts) {
              opts = opts || {};
              Aj.apiRequest('getAdsList', {
                owner_id: Aj.state.ownerId,
                offset_id: opts.offset
              }, function(result) {
                if (result.error) {
                  if (!opts.retry) opts.retry = 1;
                  else opts.retry++;
                  setTimeout(function(){ OwnerAds.loadAdsList(opts); }, opts.retry * 1000);
                } else {
                  if (opts.retry) {
                    opts.retry = 0;
                  }
                  OwnerAds.processAdsList(result, opts);
                }
              });
            },
            getAdsList: function() {
              var _data = Aj.state.adsList;
              if (_data === false) {
                return false;
              } else if (_data) {
                return _data;
              }
              Aj.state.adsList = false;
              Aj.state.adsListIsLoading = true;
              if (Aj.state.initialAdsList) {
                setTimeout(function() {
                  OwnerAds.processAdsList(Aj.state.initialAdsList);
                }, 10);
              } else {
                OwnerAds.loadAdsList({offset: 0});
              }
              return false;
            },
            updateAd: function(ad) {
              if (!Aj.state || !Aj.state.adsList) {
                return;
              }
              var adsList = Aj.state.adsList;
              for (var i = 0; i < adsList.length; i++) {
                if (ad.ad_id == adsList[i].ad_id) {
                  ad.base_url = '/account/ad/' + ad.ad_id;
                  ad._values = [
                    ad.title.toLowerCase(),
                    ad.tme_path.toLowerCase(),
                  ];
                  adsList[i] = ad;
                  OwnerAds.updateAdsList();
                  Aj.state.$searchField.trigger('contentchange');
                  return;
                }
              }
            }
        };

        $.fn.initSearch = function (options) {
            return this.map(function () {
                var $field = $(this);
                var curValue = $field.value();
                var curSelectedIndex = false;
                var curResult = [];
                var curRenderedIndex = 0;
                var dataWaiting = false;
                var keyUpTimeout = null;
                var blurTimeout = null;
                var isFocused = false;
                options = options || {};
                if (!options.searchEnabled) {
                    options.searchEnabled = function () {
                        return true;
                    };
                }
                if (!options.enterEnabled) {
                    options.enterEnabled = function () {
                        return true;
                    };
                }
                if (!options.prepareQuery) {
                    options.prepareQuery = function (str) {
                        return str.toLowerCase();
                    };
                }
                $field.data("searchOptions", options);

                function onKeyDown(e) {
                    switch (e.which) {
                        case Keys.ESC:
                            $field.blur();
                            break;
                        case Keys.RETURN:
                            select(curSelectedIndex);
                            break;
                        case Keys.UP:
                            var index;
                            if (!curSelectedIndex) {
                                if (options.$enter && options.enterEnabled()) {
                                    index = false;
                                } else {
                                    break;
                                }
                            } else {
                                index = curSelectedIndex - 1;
                            }
                            hover(index, true);
                            break;
                        case Keys.DOWN:
                            var index;
                            if (curSelectedIndex === false) {
                                index = 0;
                            } else {
                                index = curSelectedIndex + 1;
                            }
                            if (index > curResult.length - 1) {
                                break;
                            }
                            hover(index, true);
                            break;
                        default:
                            return;
                    }
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }

                function onKeyUp(e) {
                    clearTimeout(blurTimeout);
                    var value = $field.value();
                    clearTimeout(keyUpTimeout);
                    if (curValue !== value) {
                        // if (e.type == 'keyup') {
                        //   keyUpTimeout = setTimeout(function() {
                        //     valueChange();
                        //   }, 50);
                        // } else {
                        options.onInputBeforeChange && options.onInputBeforeChange(value);
                        valueChange();
                        options.onInput && options.onInput(value);
                        open();
                        // }
                    }
                }

                function onClick(e) {
                    open();
                }

                function check(item, queryLower) {
                    if (options.checkItem) {
                        return options.checkItem(item, queryLower);
                    }
                    if (!queryLower.length) {
                        return 0;
                    }
                    for (var j = 0; j < item._values.length; j++) {
                        var valueLower = item._values[j];
                        if (valueLower == queryLower) {
                            item._fullmatch = true;
                            return valueLower.length;
                        }
                    }
                    for (var j = 0; j < item._values.length; j++) {
                        var valueLower = item._values[j];
                        var index = valueLower.indexOf(queryLower);
                        var found = options.prefixOnly ? index === 0 : index !== -1;
                        if (found) {
                            return valueLower.length;
                        }
                    }
                    return false;
                }

                function search(data, query) {
                    var result = [];
                    result.fullMatchIndex = null;
                    if (!options.emptyQueryEnabled && !query.length) {
                        return result;
                    }
                    var time = +new Date();
                    var queryLower = options.prepareQuery(query);
                    for (var i = 0; i < data.length; i++) {
                        var item = data[i];
                        var valueScore = check(item, queryLower);
                        if (valueScore !== false) {
                            item._score = valueScore;
                            if (item._top) item._score -= 10000000;
                            else if (item._bottom) item._score += 10000000;
                            item._i = i;
                            result.push(item);
                        }
                    }

                    let isSort = $(".sort-active");

                    result.sort(function (a, b) {
                        if (isSort.length) return a._score - b._score || a._i - b._i;

                        const aScore = a?.score || 0;
                        const bScore = b?.score || 0;

                        if (aScore > 0 && bScore <= 0) return -1;
                        if (bScore > 0 && aScore <= 0) return 1;

                        if (aScore > 0 && bScore > 0) {
                            return bScore - aScore; // 分数高的在前
                        }

                        // 分数都为0，用 pays 字段排序（升序）
                        const aJonins = a?.joins || 0;
                        const bJonins = b?.joins || 0;

                        return bJonins - aJonins;

                        // return (item2?.score - item1?.score) || (item2?.pays - item1?.pays);
                    });
                    for (i = 0; i < result.length; i++) {
                        var item = result[i];
                        if (item._fullmatch) {
                            delete item._fullmatch;
                            if (result.fullMatchIndex === null) {
                                result.fullMatchIndex = i;
                            }
                        }
                        delete item._score;
                        delete item._i;
                    }
                    // console.log('自定义search: ' + (((new Date) - time) / 1000) + 's');
                    return result;
                }

                function render(result, query, from_index) {
                    if (from_index && from_index >= result.length) {
                        return;
                    }
                    var time = +new Date();
                    from_index = from_index || 0;
                    var html = "";
                    var render_limit = options.renderLimit || 50;
                    if (result.length > 0) {
                        for (var i = from_index, j = 0; i < result.length && j < render_limit; i++, j++) {
                            var item = result[i];
                            var tagName = options.itemTagName || "div";
                            var className =
                                "search-item" +
                                (options.itemClass ? " " + options.itemClass : "") +
                                (item.className ? " " + item.className : "");
                            var item_html =
                                "<" +tagName +' class="' +className +'" data-i="' +i +'">' +
                                options.renderItem(item, query) +
                                "</" +tagName +">";
                            html += item_html;
                        }
                        curRenderedIndex = i;
                    } else {
                        html = options.renderNoItems ? options.renderNoItems(query) : "";
                        curRenderedIndex = 0;
                    }
                    if (curRenderedIndex >= result.length) {
                        html += options.appendToItems
                            ? options.appendToItems(query, result.length)
                            : "";
                    }
                    if (!result.length && html == "") {
                        options.$results.fadeHide(function () {
                            if (options.$results.isFadeHidden()) {
                                options.$results.html(html);
                            }
                        });
                    } else {
                        if (options.$results.isFadeHidden()) {
                            options.$results.fadeShow();
                        }
                        if (!from_index) {
                            options.$results.html(html);
                        } else if (html) {
                            options.$results.append(html);
                        }
                    }
                    updateScrollState();
                    // console.log('render: from ' + from_index + ', ' + j + ' lines, ' + (((new Date) - time) / 1000) + 's');
                }

                function renderLoading() {
                    curRenderedIndex = 0;
                    options.$results.html(
                        options.renderLoading ? options.renderLoading() : ""
                    );
                    updateScrollState();
                }

                function renderEmpty() {
                    curRenderedIndex = 0;
                    options.$results.html("");
                    updateScrollState();
                }

                function close(no_anim) {
                    // console.log(+new Date, 'close', no_anim);
                    clearTimeout(keyUpTimeout);
                    if (!options.$results.hasClass("collapsed")) {
                        if (options.$enter && options.enterEnabled()) {
                            options.$enter.removeClass("selected");
                        }
                        if (no_anim) {
                            options.$results.animOff();
                        }
                        options.$results.addClass("collapsed");
                        options.onClose && options.onClose(curValue);
                        if (no_anim) {
                            options.$results.animOn();
                        }
                    }
                }

                function open() {
                    if ($field.data("disabled")) {
                        return false;
                    }
                    clearTimeout(blurTimeout);
                    hover(curSelectedIndex, true);
                    if (options.$results.hasClass("collapsed")) {
                        options.$results.removeClass("collapsed");
                        options.onOpen && options.onOpen();
                    }
                }

                function onFocus() {
                    isFocused = true;
                    var value = $field.value();
                    if (
                        curValue != value ||
                        (options.searchEnabled() && options.getData(value) === false)
                    ) {
                        valueChange();
                    }
                    open();
                }

                function onBlur() {
                    if (!isFocused) return;
                    // console.log(+new Date, 'onblur');
                    isFocused = false;
                    clearTimeout(blurTimeout);
                    blurTimeout = setTimeout(close, 100, false);
                    options.onBlur && options.onBlur(curValue);
                }

                function valueChange() {
                    clearTimeout(blurTimeout);
                    clearTimeout(keyUpTimeout);
                    var value = $field.value();
                    curValue = value;
                    // console.log('valueChange', options.searchEnabled());
                    if (options.searchEnabled()) {
                        var data = options.getData(value);
                        if (data === false) {
                            if (!dataWaiting) {
                                dataWaiting = true;
                                $field.one("dataready.search", function () {
                                    dataWaiting = false;
                                    valueChange();
                                });
                            }
                            if (curValue.length || options.emptyQueryEnabled) {
                                renderLoading();
                            } else {
                                renderEmpty();
                            }
                            return;
                        }
                        curResult = search(data, curValue);
                        var index = false;
                        var $scrollableEl = options.resultsNotScrollable
                            ? $(window)
                            : options.$results;
                        $scrollableEl.scrollTop(0);
                        if (curValue.length || options.emptyQueryEnabled) {
                            render(curResult, curValue);
                            if (curResult.length && !options.enterEnabled()) {
                                index = 0;
                            }
                            if (
                                options.selectFullMatch &&
                                curResult.fullMatchIndex !== null
                            ) {
                                index = curResult.fullMatchIndex;
                            }
                        } else {
                            renderEmpty();
                        }
                    } else {
                        curResult = [];
                        var index = false;
                        renderEmpty();
                    }
                    hover(index, true);
                }

                function hover(i, adjust_scroll, middle) {
                    $(".search-item.selected", options.$results).removeClass("selected");
                    curSelectedIndex = i;
                    if (curSelectedIndex !== false) {
                        var selectedEl = $(".search-item", options.$results).get(
                            curSelectedIndex
                        );
                        if (!selectedEl) {
                            curSelectedIndex = false;
                        } else {
                            $(selectedEl).addClass("selected");
                            if (adjust_scroll) {
                                adjustScroll($(selectedEl), middle);
                            }
                            if (Math.abs(curSelectedIndex - curRenderedIndex) < 5) {
                                render(curResult, curValue, curRenderedIndex);
                            }
                        }
                    }
                    if (options.$enter && options.enterEnabled()) {
                        options.$enter.toggleClass("selected", curSelectedIndex === false);
                    }
                }

                function select(i) {
                    if (i === false) {
                        if (options.enterEnabled()) {
                            if (!options.noCloseOnEnter) {
                                $field.blur();
                            }
                            options.onEnter && options.onEnter(curValue);
                            if (!options.noCloseOnEnter) {
                                close(true);
                            }
                        }
                        return;
                    }
                    if (!options.noCloseOnSelect) {
                        $field.blur();
                    }
                    options.onSelect && options.onSelect(curResult[i]);
                    if (!options.noCloseOnSelect) {
                        close(true);
                    }
                }

                function onItemHover() {
                    hover($(this).data("i"), true, true);
                }

                function onItemMouseOver() {
                    hover($(this).data("i"));
                }

                function updateScrollState() {
                    var results = options.$results.get(0);
                    if (results) {
                        options.$results.toggleClass("topscroll", results.scrollTop > 0);
                        options.$results.toggleClass(
                            "bottomscroll",
                            results.scrollTop < results.scrollHeight - results.clientHeight
                        );
                    }
                }

                function onResultsScroll(e) {
                    updateScrollState();
                    if (options.resultsNotScrollable) {
                        var bottom =
                            options.$results.offset().top +
                            options.$results.height() -
                            $(window).scrollTop();
                        if (bottom < $(window).height() * 2) {
                            render(curResult, curValue, curRenderedIndex);
                        }
                    } else {
                        if (this.scrollTop > this.scrollHeight - this.clientHeight - 1000) {
                            render(curResult, curValue, curRenderedIndex);
                        }
                    }
                }

                function onItemClick(e) {
                    if (e.metaKey || e.ctrlKey) return true;
                    clearTimeout(blurTimeout);
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    select($(this).data("i"));
                }

                function adjustScroll($itemEl, middle) {
                    var scrollTop = options.$results.scrollTop(),
                        itemTop = $itemEl.position().top + scrollTop,
                        itemHeight = $itemEl.outerHeight(),
                        itemBottom = itemTop + itemHeight,
                        contHeight = options.$results.height() || 300;

                    if (middle) {
                        options.$results.scrollTop(itemTop - (contHeight - itemHeight) / 2);
                    } else if (itemTop < scrollTop) {
                        options.$results.scrollTop(itemTop);
                    } else if (itemBottom > scrollTop + contHeight) {
                        options.$results.scrollTop(itemBottom - contHeight);
                    }
                }

                if (options.$enter && options.enterEnabled()) {
                    options.$enter.on("mouseover.search", onItemMouseOver);
                    options.$enter.on("mousedown.search", onItemClick);
                    options.$enter.data("i", false);
                }
                options.$results.on("hover.search", ".search-item", onItemHover);
                options.$results.on(
                    "mouseover.search",
                    ".search-item",
                    onItemMouseOver
                );
                options.$results.on("mousedown.search", ".search-item", onItemClick);
                if (options.resultsNotScrollable) {
                    $(window).on("scroll.search", onResultsScroll);
                } else {
                    options.$results.on("scroll.search", onResultsScroll);
                    if (options.$results.isFixed()) {
                        options.$results.blockBodyScroll();
                    }
                }
                if (options.initTextarea) {
                    $field.initTextarea(options.initTextarea);
                }
                $field.on("keydown.search", onKeyDown);
                $field.on("keyup.search", onKeyUp);
                $field.on("focus.search", onFocus);
                $field.on("blur.search", onBlur);
                $field.on("input.search", onKeyUp);
                $field.on("click.search", onClick);

                $field.on("disable.search", function (e, disable) {
                    $field.data("disabled", disable);
                    $field.attr("contenteditable", disable ? "false" : "true");
                    close(true);
                });
                $field.on("datachange.search", function () {
                    valueChange();
                });
                $field.on("contentchange.search", function () {
                    if (options.resultsNotScrollable) {
                        var scrolltop = $(window).scrollTop();
                    } else {
                        var scrolltop = options.$results.scrollTop();
                    }
                    var limit = options.renderLimit;
                    options.renderLimit = curRenderedIndex;
                    valueChange();
                    options.renderLimit = limit;
                    if (options.resultsNotScrollable) {
                        $(window).scrollTop(scrolltop);
                    } else {
                        options.$results.scrollTop(scrolltop);
                    }
                });

                options.$results.addClass("collapsed");

                if (options.updateOnInit) {
                    valueChange();
                }
                return this;
            });
        };

        resolve(true);
    });
});

// 等待 jQuery 注入（页面加载）
if (postID.length) {
    $(".pr-logo-title").text(`Telegram Ads 存在分析数据${postID.length}条`);
}

// 根据类型获取文案
const getUserText = (value, text) => {
    let type = value || $(".select")?.val()?.split('?')?.[0] || "";
    let texts = {
        /****************** 金貝综合盘  ******************** */
        // 金貝推广人员
        JB6666_BOT: [
            "🎉 金貝娱乐综合盘火热运营中！只需一个 Telegram 账户，一个钱包，畅玩 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟、老虎机🎰等超多精彩游戏🔥！注册即享首充加赠活动，机会不容错过！🎉 ",
            "🎁 金貝娱乐综合盘，超强充值回馈！充值 10U - 100000U，最高加赠 1000% 的奖励等你拿！越充越划算，让你每一笔投入都值回票价！💰赶快加入，开启财富之门！🔥 ",
            "🧩 加入 金貝娱乐综合盘，即享充值赠送活动！玩 老虎机🎰、视讯📹、捕鱼🐟等超火游戏，轻松获得专属 茶水费🎁、转运金💰等福利，乐享不停！🎉 ",
            "🎁 金貝娱乐综合电子娱乐，限时狂欢！今日注册即享最高 3688U 赠金！ 💰 50U 送 18U，100U 送 38U，300U送88U，500U送188U, 1000U送288U，50000U 送 3688U！ 仅限新用户，手慢无！ 🕒🔥",
            "🎉金貝娱乐综合电子娱乐， 首充大礼限量放送！错过不再有！ 💰 50U 送 18U，充 100U 送 38U，500U 送 188U，10000U 送 1288U！ 💎 立即注册，抢占先机！ 🚀",
            "🏆 仅限 24 小时！金貝娱乐综合电子娱乐，新人首充翻倍送！ 存 50U 送 18U，充 100U 送 38U，存 500U 送 188U，存 50000U 送 3688U！ 💰 快来领取你的专属彩金！ 🕒💨",
            "🎰 最后 100 个名额！先到先得！ 金貝娱乐综合电子娱乐，存 50U 送 18U，存 100U 送 38U，存 500U 送 188U，存 1000U 送 288U，存 5000U 送 588U！ 💵 再犹豫，福利就没了！ 🎯🔥",
            "🔥 今日专享，机会稍纵即逝！ 金貝娱乐综合电子娱乐，充 50U 送 18U，100U 送 38U，存 500U 送 188U，存 1000U 送 288U，5000U 送 588U！ 💎 仅限新玩家，速抢！ 🚀💰",
            "💰 特惠 24H！新人充值必赚！ 金貝娱乐综合电子娱乐，充 50U 送 18U，100U 送 38U，存 500U 送 188U，存 10000U 送 1288U，存 50000U 送 3688U！ 🏆 再晚就没了！ 🕒💨",
            "🎯 最后一波！今晚 23:59 截止！ 金貝娱乐综合电子娱乐，充50U 送 18U，100U 送 38U，存 500U 送 188U，存 10000U 送 1288U，存50000U 送 3688U！ 💰 抓住机会，一夜翻倍！ 🕒🔥",
            "🎉 新人专属限时特权！错过等一年！ 金貝娱乐综合电子娱乐，充50U 送 18U，充 100U 送 38U，充 300U 送 88U，存 500U 送 188U，5000U 送 588U！ 💎 立即参与，赢在起跑线！ 🚀💰",
            "🏅 超短时限！24 小时内有效！ 金貝娱乐综合电子娱乐，存 50U 送 18U，充 100U 送 38U，充 300U 送 88U，1000U 送 288U，50000U 送 3688U！ 💵 立即充值，错过无补！ 🔥💎",
            "💥 最后倒计时！名额有限，快冲！ 金貝娱乐综合电子娱乐，存 100U 送 38U，500U 送 188U，10000U 送 1288U！ 💰 别等了，越晚福利越少！ 🕒🔥",
            "充值回馈火热开启！ 金貝娱乐开启 💰流水挑战 💰活动，存 10U - 100000U，加赠高达 1000%！🔥",
            "🎁 金貝娱乐新人首存礼即送，18U - 10888U，👑 VIP晋级奖，专属返水 🔥 打码彩金、爆分加赠，赢取更多奖励！❤️亏损救援，助您翻盘！📈 累计打榜 🎯 冲击榜单，解锁更多惊喜！🤝 代理合作：高佣金 35%， 永久扶持！💸 每日红包雨 ☔ ，惊喜享不停！",
            "🎁 金貝娱乐新人首存礼：首次充值送彩金，18U - 10888U！💸 每日红包雨，惊喜不断！👑 VIP福利：VIP晋级奖，享专属返水！❤️ 亏损救援：每日亏损可领救援金，助您翻盘！🤝 代理合作：高佣 35%，永久扶持，共享收益！",
            "🚀 存取自由！资金安全有保障！ 金貝娱乐综合电子盘，采用顶级风控系统，账户安全无忧！你敢押，我敢赔 🔒",
            "🎉首存即送最高10888U，新人专享豪礼！每日天降惊喜，💎高返水、打码彩金轻松拿，爆分加赠、亏损救援金守护每次投注！💰红包雨不定时降临，福利不停！🎉成为代理，享50%永久佣金，轻松赚取丰厚回报！🚀立即充值，开启专属财富之门，福利等你来拿！🎁",
            "🏆 想要玩最刺激的游戏？金貝娱乐综合盘让你轻松进入游戏世界！无需实名，只要一个 Telegram 账户，一个钱包，支持 汇旺、USDT 下注，畅玩 PC28🎲、电子🎮、**体育⚽**等热门游戏🔥！现在加入，等你来挑战！💥 ",
            "💥 新人首充超值大礼包！在 金貝娱乐综合盘注册，充 50U 送 18U，充 100U 送 38U，充 300U 送 88U，充 500U 送 158U！让你畅玩 电子🎮、老虎机🎰等超刺激游戏，快速开启赚钱之旅！🎉",
            "🃏 只需一个 Telegram 账户，随时随地玩转 PC28🎲、捕鱼🐟、**体育⚽**等热门游戏！没有实名限制，金貝娱乐综合盘让你享受极速下注，轻松获利！",
            "🎮 想挑战自己的运气？在 金貝娱乐综合盘，你可以玩转 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟等超刺激游戏！不容错过的精彩等着你！",
            "🌟 加入 金貝娱乐综合盘，不仅能玩 PC28🎲、捕鱼🐟、老虎机🎰等游戏，还可以通过专属推广线，发展下级，实时返佣，轻松赚取佣金！",
            "🏅 官方直营，值得信赖！ 金貝娱乐实力盘口支持 USDT、汇旺支付，资金安全，充提秒速到账！💸 放心玩，尽情赚！",
            "🔥给自己一个机会，翻身不是梦，📲 0 负担畅玩！ 仅需 一个 Telegram 账户，一个钱包，无实名限制，秒速开户，即刻开启综合电子娱乐新世界！✨",
            "🎮 金貝娱乐平台已全面上线，一键接入 Telegram 即可畅玩各类热门游戏：PC28、电子、棋牌、捕鱼、老虎机等！现在加入还有专属入场福利，轻松开启娱乐之旅！",
            "💰 金貝平台开启限时充值激励计划！单笔充值越高，回馈力度越大，真实玩家专属优待，随时入金畅玩，即刻解锁属于你的专属加码！",
            "🎁 金貝平台限时推出入场奖励，首笔充值将获得等级补贴，活动仅限新玩家参与！老虎机、棋牌、捕鱼通通支持，马上开玩！",

            "💣 天天打工月入3千？我一把梭哈就赚5万！你不来金貝娱乐试试，就是在浪费你的人生！⚡新人首充即送彩金，白送钱让你直接开局翻盘！",
            "🐶 看你那副天天等发工资的样儿，真心替你急！马上上号，赤脚来的金貝，晚上可能就翻身开跑车回去！🎁新人首充加送100%，只要你敢冲，平台就敢送！",
            "🔥 别人的人生在逆袭，你却还在刷短视频打发时间？真正牛的人都在金貝彩娱乐挣钱了！🚀首充即送福利狂飙，新人限定，错过血亏！",
            "⚔️ 这不是游戏，这是一场收割战！你要敢进来就别怂，一晚上干翻你三个月工资！💸金貝娱乐新人专属首充翻倍送，激活你的暴富通道！",
            "🧠 不信命就试一把，信了命就别怪命苦！快来金貝娱乐，试一次你就知道自己值几个钱！💥首充立返，不爽你来骂我！",
            "🧨 一群人赚疯了你还在犹豫？等你决定好了，活动早结束了，机会不会等废物！🎊金貝娱乐新人冲100送38，U，送U。送钱都不来你怪谁？",
            "💥 有种你就过来冲100，不中算我输！**别逼逼，金貝娱乐靠实力让你服气！🎯新人首充专享返现，直接让你一把入魂！",
            "🚬 都2025了还靠工资活着？别人一局下去提车提表，你在那买包烟还掏几个口袋，扣扣索索的，丢不丢人？🔥首充福利大爆送，现在不上车你就等着羡慕吧！",
            "🎯 拼命的人在金貝娱乐赢到了尊严，混日子的继续搬砖！机会就在这，看你选哪边？🏆新人首充直接送大礼，没本你也能玩得风生水起！",
            "💰 我从不劝人赌，只叫人来提路虎。金貝娱乐综合盘是聪明人的战场！翻身不靠祈祷，靠一把操作干爆全场！🎉新人注册首充送福利，稳中爆赚不靠命！",
            "💰 祈祷要是有用，拜财神都要收费。求人不如求己，来金貝娱乐综合盘，一起上桌，用最公平公正公开的方式，托起你的高傲的尊严地位",
            "💥 能给你几百上千的叫朋友，能给你几千上万的叫亲戚，能给你几十上百万的是爹妈。能给你提个几百上千万的。 我！只有我金貝娱乐综合电子盘。你品！你细品！！！",
            "🤑我朋友冲了100，晚上叫我出来喝酒，说他心态崩了，在金貝娱乐搞了几把打的，钱赚太多了都不知道怎么花🍻你冲不冲自己看着办！",
            "⏰你上班打卡像坐牢，下班看剧像养老📺人家在金貝娱乐一冲直接上道🔥首充送爆你都不试试？",
            "👟你在商场精挑细选一双鞋🛒人家在金貝娱乐冲一把直接提车提表🚗新人福利不领也不拦你，好歹给自己个改命的机会好吧！",
            "🤣你刷短视频笑哈哈📱人家在金貝娱乐提着宝马🚘笑，你好好想想你比人家差在哪里了？想做别人口中的人家嘛？新人首冲福利翻倍送，机会不给磨叽的人！",
            "🙃别动不动说自己穷💸 一生都唯唯诺诺的，冲都不敢冲你还觉得穷得挺踏实的，金貝娱乐送福利送到你门口📬你都不知道伸手接住这泼天富贵？",
            "🧱老板各种给你画饼，PUA你让你努力搬砖🪨你信了，我说让你来金貝娱乐提块金砖你犹豫了，人与人的差距就在你这一丢丢犹豫之间 💥 该你听谁的自己掂量掂量吧！",
            "🎯有的人打工是为了梦想💤但是谁的梦想是打工，我给你个机会，来金貝娱乐梭哈几把。你看是打工实现梦想快还是电子让你实现梦想快🌈你还在纠结干嘛？",
            "📉一个月工资刚到账💰扣掉房租水电还剩可怜巴巴，整天怨天尤人的，怨恨老天爷不公。你来金貝娱乐啊，我让你上桌，给你公平，在给你首充送超水的机会，你就问问自己的心敢不敢冲？🎁",
            "🤔你以为你缺的是钱💵你每天拼了命的去打几份工赚钱，可是赚到了嘛？其实你缺的是冲动⚡金貝娱乐新人专享福利直接送，别等别人晒图刺激你📸！",
            "👔你打工月入3000，人家在金貝娱乐一把提车提表。你苦哈哈搬砖，他笑呵呵爆赚。不是你不行，是你不玩！⚡新人首充超水送，送你一次不靠老板的机会！冲不冲你自己掂量！",
            "🧧你省吃俭用搞副业，人家玩金貝娱乐边冲边赚钱！工资到账还没热，人家已经赚翻买表了。💥首充超水送福利，不靠命靠操作，一局干翻三个月工龄！冲不冲随你，但别怪我没提醒！",
            "🎯你熬夜学理财，人家秒进金貝娱乐提百万！你抱着K线哇哇叫，人家充值就送钱。还不试试？⚡新人冲100送38，走上人生巅峰不靠玄学靠胆子！",
            "💸别人首充送翻倍，你首充送心碎？别搞笑了，来金貝娱乐，新人专享首充超水送，不靠命，全靠冲！⚡别等别人晒收益图才后悔，机会是给动手快的人！",
            "🎰你还在研究“怎么发工资前活下去”，人家在金貝娱乐研究“今晚提现去哪潇洒”！新人福利直接送爆，一把翻身不是梦。💥要稳你去银行，要爽你就来这！",
            "🤣你不敢冲100，结果亏掉100个机会！金貝娱乐送的是翻倍福利，不是讲故事。🚀新人首充超水送，一口气干出工资十倍的收益，敢不敢试一把？",
            "🚬你上班八小时提不起劲，人家冲五分钟提了奔驰。金貝娱乐不是吹，首充赠送的水位全网第一，送到你想骂平台“太狠了”！💰想翻身就别嘴硬，赶紧上车，错过一天就少赚一天！",
            "🧠你说“等等再看”，但机会不会等你！别人已经靠金貝娱乐搬进新小区，你还在等老板加工资？🧧新人首充超水送，福利只给敢动手的人，别犹豫，犹豫就会败北！",
            "你为公司卖命，人家为自己冲金貝。你在群里抢红包，他在后台抢提现额度！🧧新人首充超水送，冲的不只是钱，是你迟到好几年的人生尊严！",
            "你充钱玩游戏，只赢个皮肤；他冲金貝娱乐，直接赢辆车。🎮你玩的是快乐，他玩的是生活质量。别再精打细算了，来这冲一把，可能明天就辞职！",
            "你学理财，看完只剩一句“长期持有”；他玩金貝娱乐，三天收益超你半年存款。📈新人福利爆炸送，没技术？没关系，你只要有胆子！",
            "你卷KPI卷出抑郁，人家卷彩金卷出宝马。🤯你在工位上喘气，他在提款机前数U。新人首充翻倍送，这年头不靠命靠冲，一次机会都不能让！",
            "你吐槽房租太高，他在金貝娱乐冲一晚上把房东请去喝茶了。🏠首充福利直接超水送，新人限定，不用抢、不用抽，只要你敢点进来！",
            "你怕被骗，不敢冲；别人冲完笑得像诈骗犯。🤣平台送钱你都不来，那真不能怪平台偏心了。金貝娱乐首充就送，靠实力送到你不信自己！",
            "你在拼多多砍一刀，他在金貝娱乐一冲到账。💸你满世界找副业，他坐着点点屏幕，收入比你主业都稳。首充福利还翻倍，不试你都对不起自己！",
            "你为1块红包点赞三十条，他为一波彩金冲进VIP群。🤡说到底，不是你不行，是你走错了方向。金貝娱乐首充送上天，这回可别又躺着错过！",
            "你不信平台，我理解；但你信星座、不信福利，我真笑不出来。🤪金貝娱乐首充福利眼睁睁送到你面前，你却继续刷短视频浪费天赋！",
            "你问“冲了会亏吗”，我只想说：不冲一定没戏。🔥金貝娱乐新人首充超水送，别人抢着冲你还在问，这不是犹豫，这是落后！难怪你会败北",
            "🧧朋友说我最近气质变了，我说金貝娱乐到账速度太快，整个人都自信了。以前冲100叫冲动消费，现在冲100叫预支尊贵人生，冲完直接请他喝酒。",
            "🍾昨天我朋友冲了100，晚上叫我喝酒，说他心态崩了，在金貝赢太快不知道钱花哪。我不怪他，因为我当初也是这么一路从公交挤上了宝马的。",
            "🚬你抽9块5的烟觉得很省，我一把金貝娱乐冲下去直接换整条烟，顺便送了个火机和打车红包，消费降级是你的，我这叫财富快速迭代。",
            "📲你刷视频笑得肚子疼，我冲金貝娱乐笑着提了个新手机。差距不在努力，而在你一直犹豫我早就上了车，机会从来不等磨叽人。",
            "🚗以前打车看价格，现在打车只看颜色，冲了金貝娱乐才知道尊贵和穷忙的差距。你还在问靠谱不靠谱，我已经排队提车去了。",
            "📦你早上准点打卡上班，我中午醒来冲了一把金貝娱乐直接到账3000U，还躺着点了星巴克外卖，人生不在起点，在于你懂不懂冲。",
            "📈朋友说打工能积累经验，我说我冲金貝娱乐积累的是资产。经验会变老，资产会增值，别光努力别犹豫，冲一把说不定你也提U上瘾。",
            "🧾你想靠工资生活，我靠金貝娱乐冲出来的人生已经考虑换座城市生活了。不是我张狂，是平台送钱送得太真了，让我失去了“平凡”的资格。",
            "🎮朋友氪金抽卡还没出SSR，我随手冲了金貝娱乐直接到账两百，顺手请他吃了个饭。他感动哭了，我说这只是平台的一点心意而已。",
        ],

        // 金貝娱乐频道
        jbpc28: [
            "🎉 金貝娱乐综合盘火热运营中！只需一个 Telegram 账户，一个钱包，畅玩 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟、老虎机🎰等超多精彩游戏🔥！注册即享首充加赠活动，机会不容错过！🎉 ",
            "🧩 加入 金貝娱乐综合盘，即享充值赠送活动！玩 老虎机🎰、视讯📹、捕鱼🐟等超火游戏，轻松获得专属 茶水费🎁、转运金💰等福利，乐享不停！🎉 ",
            "🎁 金貝娱乐新人首存礼即送，18U - 10888U，👑 VIP晋级奖，专属返水 🔥 打码彩金、爆分加赠，赢取更多奖励！❤️亏损救援，助您翻盘！📈 累计打榜 🎯 冲击榜单，解锁更多惊喜！🤝 代理合作：高佣金 35%， 永久扶持！💸 每日红包雨 ☔ ，惊喜享不停！",
            "🎮 想挑战自己的运气？在 金貝娱乐综合盘，你可以玩转 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟等超刺激游戏！不容错过的精彩等着你！",
            "🌟 加入 金貝娱乐综合盘，不仅能玩 PC28🎲、捕鱼🐟、老虎机🎰等游戏，还可以通过专属推广线，发展下级，实时返佣，轻松赚取佣金！",
            "🏅 官方直营，值得信赖！ 金貝娱乐实力盘口支持 USDT、汇旺支付，资金安全，充提秒速到账！💸 放心玩，尽情赚！",
            "💣 天天打工月入3千？我一把梭哈就赚5万！你不来金貝娱乐试试，就是在浪费你的人生！⚡新人首充即送彩金，白送钱让你直接开局翻盘！",
            "🐶 看你那副天天等发工资的样儿，真心替你急！马上上号，赤脚来的金貝，晚上可能就翻身开跑车回去！🎁新人首充加送100%，只要你敢冲，平台就敢送！",
            "🔥 别人的人生在逆袭，你却还在刷短视频打发时间？真正牛的人都在金貝彩娱乐挣钱了！🚀首充即送福利狂飙，新人限定，错过血亏！",
            "⚔️ 这不是游戏，这是一场收割战！你要敢进来就别怂，一晚上干翻你三个月工资！💸金貝娱乐新人专属首充翻倍送，激活你的暴富通道！",
            "🧠 不信命就试一把，信了命就别怪命苦！快来金貝娱乐，试一次你就知道自己值几个钱！💥首充立返，不爽你来骂我！",
            "🧨 一群人赚疯了你还在犹豫？等你决定好了，活动早结束了，机会不会等废物！🎊金貝娱乐新人冲100送38，U，送U。送钱都不来你怪谁？",
            "💥 有种你就过来冲100，不中算我输！**别逼逼，金貝娱乐靠实力让你服气！🎯新人首充专享返现，直接让你一把入魂！",
            "🚬 都2025了还靠工资活着？别人一局下去提车提表，你在那买包烟还掏几个口袋，扣扣索索的，丢不丢人？🔥首充福利大爆送，现在不上车你就等着羡慕吧！",
            "🎯 拼命的人在金貝娱乐赢到了尊严，混日子的继续搬砖！机会就在这，看你选哪边？🏆新人首充直接送大礼，没本你也能玩得风生水起！",
            "💰 我从不劝人赌，只叫人来提路虎。金貝娱乐综合盘是聪明人的战场！翻身不靠祈祷，靠一把操作干爆全场！🎉新人注册首充送福利，稳中爆赚不靠命！",
            "💰 祈祷要是有用，拜财神都要收费。求人不如求己，来金貝娱乐综合盘，一起上桌，用最公平公正公开的方式，托起你的高傲的尊严地位",
            "💥 能给你几百上千的叫朋友，能给你几千上万的叫亲戚，能给你几十上百万的是爹妈。能给你提个几百上千万的。 我！只有我金貝娱乐综合电子盘。你品！你细品！！！",
            "🤑我朋友冲了100，晚上叫我出来喝酒，说他心态崩了，在金貝娱乐搞了几把打的，钱赚太多了都不知道怎么花🍻你冲不冲自己看着办！",
            "⏰你上班打卡像坐牢，下班看剧像养老📺人家在金貝娱乐一冲直接上道🔥首充送爆你都不试试？",
            "👟你在商场精挑细选一双鞋🛒人家在金貝娱乐冲一把直接提车提表🚗新人福利不领也不拦你，好歹给自己个改命的机会好吧！",
            "🤣你刷短视频笑哈哈📱人家在金貝娱乐提着宝马🚘笑，你好好想想你比人家差在哪里了？想做别人口中的人家嘛？新人首冲福利翻倍送，机会不给磨叽的人！",
            "🙃别动不动说自己穷💸 一生都唯唯诺诺的，冲都不敢冲你还觉得穷得挺踏实的，金貝娱乐送福利送到你门口📬你都不知道伸手接住这泼天富贵？",
            "🧱老板各种给你画饼，PUA你让你努力搬砖🪨你信了，我说让你来金貝娱乐提块金砖你犹豫了，人与人的差距就在你这一丢丢犹豫之间 💥 该你听谁的自己掂量掂量吧！",
            "🎯有的人打工是为了梦想💤但是谁的梦想是打工，我给你个机会，来金貝娱乐梭哈几把。你看是打工实现梦想快还是电子让你实现梦想快🌈你还在纠结干嘛？",
            "📉一个月工资刚到账💰扣掉房租水电还剩可怜巴巴，整天怨天尤人的，怨恨老天爷不公。你来金貝娱乐啊，我让你上桌，给你公平，在给你首充送超水的机会，你就问问自己的心敢不敢冲？🎁",
            "🤔你以为你缺的是钱💵你每天拼了命的去打几份工赚钱，可是赚到了嘛？其实你缺的是冲动⚡金貝娱乐新人专享福利直接送，别等别人晒图刺激你📸！",
            "👔你打工月入3000，人家在金貝娱乐一把提车提表。你苦哈哈搬砖，他笑呵呵爆赚。不是你不行，是你不玩！⚡新人首充超水送，送你一次不靠老板的机会！冲不冲你自己掂量！",
            "🧧你省吃俭用搞副业，人家玩金貝娱乐边冲边赚钱！工资到账还没热，人家已经赚翻买表了。💥首充超水送福利，不靠命靠操作，一局干翻三个月工龄！冲不冲随你，但别怪我没提醒！",
            "🎯你熬夜学理财，人家秒进金貝娱乐提百万！你抱着K线哇哇叫，人家充值就送钱。还不试试？⚡新人冲100送38，走上人生巅峰不靠玄学靠胆子！",
            "💸别人首充送翻倍，你首充送心碎？别搞笑了，来金貝娱乐，新人专享首充超水送，不靠命，全靠冲！⚡别等别人晒收益图才后悔，机会是给动手快的人！",
            "🎰你还在研究“怎么发工资前活下去”，人家在金貝娱乐研究“今晚提现去哪潇洒”！新人福利直接送爆，一把翻身不是梦。💥要稳你去银行，要爽你就来这！",
            "🤣你不敢冲100，结果亏掉100个机会！金貝娱乐送的是翻倍福利，不是讲故事。🚀新人首充超水送，一口气干出工资十倍的收益，敢不敢试一把？",
            "🚬你上班八小时提不起劲，人家冲五分钟提了奔驰。金貝娱乐不是吹，首充赠送的水位全网第一，送到你想骂平台“太狠了”！💰想翻身就别嘴硬，赶紧上车，错过一天就少赚一天！",
            "🧠你说“等等再看”，但机会不会等你！别人已经靠金貝娱乐搬进新小区，你还在等老板加工资？🧧新人首充超水送，福利只给敢动手的人，别犹豫，犹豫就会败北！",
            "你为公司卖命，人家为自己冲金貝。你在群里抢红包，他在后台抢提现额度！🧧新人首充超水送，冲的不只是钱，是你迟到好几年的人生尊严！",
            "你充钱玩游戏，只赢个皮肤；他冲金貝娱乐，直接赢辆车。🎮你玩的是快乐，他玩的是生活质量。别再精打细算了，来这冲一把，可能明天就辞职！",
            "你学理财，看完只剩一句“长期持有”；他玩金貝娱乐，三天收益超你半年存款。📈新人福利爆炸送，没技术？没关系，你只要有胆子！",
            "你卷KPI卷出抑郁，人家卷彩金卷出宝马。🤯你在工位上喘气，他在提款机前数U。新人首充翻倍送，这年头不靠命靠冲，一次机会都不能让！",
            "你吐槽房租太高，他在金貝娱乐冲一晚上把房东请去喝茶了。🏠首充福利直接超水送，新人限定，不用抢、不用抽，只要你敢点进来！",
            "你怕被骗，不敢冲；别人冲完笑得像诈骗犯。🤣平台送钱你都不来，那真不能怪平台偏心了。金貝娱乐首充就送，靠实力送到你不信自己！",
            "你在拼多多砍一刀，他在金貝娱乐一冲到账。💸你满世界找副业，他坐着点点屏幕，收入比你主业都稳。首充福利还翻倍，不试你都对不起自己！",
            "你为1块红包点赞三十条，他为一波彩金冲进VIP群。🤡说到底，不是你不行，是你走错了方向。金貝娱乐首充送上天，这回可别又躺着错过！",
            "你不信平台，我理解；但你信星座、不信福利，我真笑不出来。🤪金貝娱乐首充福利眼睁睁送到你面前，你却继续刷短视频浪费天赋！",
            "你问“冲了会亏吗”，我只想说：不冲一定没戏。🔥金貝娱乐新人首充超水送，别人抢着冲你还在问，这不是犹豫，这是落后！难怪你会败北",
            "🧧朋友说我最近气质变了，我说金貝娱乐到账速度太快，整个人都自信了。以前冲100叫冲动消费，现在冲100叫预支尊贵人生，冲完直接请他喝酒。",
            "🍾昨天我朋友冲了100，晚上叫我喝酒，说他心态崩了，在金貝赢太快不知道钱花哪。我不怪他，因为我当初也是这么一路从公交挤上了宝马的。",
            "🚬你抽9块5的烟觉得很省，我一把金貝娱乐冲下去直接换整条烟，顺便送了个火机和打车红包，消费降级是你的，我这叫财富快速迭代。",
            "📲你刷视频笑得肚子疼，我冲金貝娱乐笑着提了个新手机。差距不在努力，而在你一直犹豫我早就上了车，机会从来不等磨叽人。",
            "🚗以前打车看价格，现在打车只看颜色，冲了金貝娱乐才知道尊贵和穷忙的差距。你还在问靠谱不靠谱，我已经排队提车去了。",
            "📦你早上准点打卡上班，我中午醒来冲了一把金貝娱乐直接到账3000U，还躺着点了星巴克外卖，人生不在起点，在于你懂不懂冲。",
            "📈朋友说打工能积累经验，我说我冲金貝娱乐积累的是资产。经验会变老，资产会增值，别光努力别犹豫，冲一把说不定你也提U上瘾。",
            "🧾你想靠工资生活，我靠金貝娱乐冲出来的人生已经考虑换座城市生活了。不是我张狂，是平台送钱送得太真了，让我失去了“平凡”的资格。",
            "🎮朋友氪金抽卡还没出SSR，我随手冲了金貝娱乐直接到账两百，顺手请他吃了个饭。他感动哭了，我说这只是平台的一点心意而已。",
        ],

        // 金貝飞投频道
        jbft: [
            "🎉 金貝娱乐综合盘火热运营中！只需一个 Telegram 账户，一个钱包，畅玩 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟、老虎机🎰等超多精彩游戏🔥！注册即享首充加赠活动，机会不容错过！🎉 ",
            "🧩 加入 金貝娱乐综合盘，即享充值赠送活动！玩 老虎机🎰、视讯📹、捕鱼🐟等超火游戏，轻松获得专属 茶水费🎁、转运金💰等福利，乐享不停！🎉 ",
            "🎁 金貝娱乐新人首存礼即送，18U - 10888U，👑 VIP晋级奖，专属返水 🔥 打码彩金、爆分加赠，赢取更多奖励！❤️亏损救援，助您翻盘！📈 累计打榜 🎯 冲击榜单，解锁更多惊喜！🤝 代理合作：高佣金 35%， 永久扶持！💸 每日红包雨 ☔ ，惊喜享不停！",
            "🎮 想挑战自己的运气？在 金貝娱乐综合盘，你可以玩转 PC28🎲、电子🎮、棋牌♠️、捕鱼🐟等超刺激游戏！不容错过的精彩等着你！",
            "🌟 加入 金貝娱乐综合盘，不仅能玩 PC28🎲、捕鱼🐟、老虎机🎰等游戏，还可以通过专属推广线，发展下级，实时返佣，轻松赚取佣金！",
            "🏅 官方直营，值得信赖！ 金貝娱乐实力盘口支持 USDT、汇旺支付，资金安全，充提秒速到账！💸 放心玩，尽情赚！",
            "💣 天天打工月入3千？我一把梭哈就赚5万！你不来金貝娱乐试试，就是在浪费你的人生！⚡新人首充即送彩金，白送钱让你直接开局翻盘！",
            "🐶 看你那副天天等发工资的样儿，真心替你急！马上上号，赤脚来的金貝，晚上可能就翻身开跑车回去！🎁新人首充加送100%，只要你敢冲，平台就敢送！",
            "🔥 别人的人生在逆袭，你却还在刷短视频打发时间？真正牛的人都在金貝彩娱乐挣钱了！🚀首充即送福利狂飙，新人限定，错过血亏！",
            "⚔️ 这不是游戏，这是一场收割战！你要敢进来就别怂，一晚上干翻你三个月工资！💸金貝娱乐新人专属首充翻倍送，激活你的暴富通道！",
            "🧠 不信命就试一把，信了命就别怪命苦！快来金貝娱乐，试一次你就知道自己值几个钱！💥首充立返，不爽你来骂我！",
            "🧨 一群人赚疯了你还在犹豫？等你决定好了，活动早结束了，机会不会等废物！🎊金貝娱乐新人冲100送38，U，送U。送钱都不来你怪谁？",
            "💥 有种你就过来冲100，不中算我输！**别逼逼，金貝娱乐靠实力让你服气！🎯新人首充专享返现，直接让你一把入魂！",
            "🚬 都2025了还靠工资活着？别人一局下去提车提表，你在那买包烟还掏几个口袋，扣扣索索的，丢不丢人？🔥首充福利大爆送，现在不上车你就等着羡慕吧！",
            "🎯 拼命的人在金貝娱乐赢到了尊严，混日子的继续搬砖！机会就在这，看你选哪边？🏆新人首充直接送大礼，没本你也能玩得风生水起！",
            "💰 我从不劝人赌，只叫人来提路虎。金貝娱乐综合盘是聪明人的战场！翻身不靠祈祷，靠一把操作干爆全场！🎉新人注册首充送福利，稳中爆赚不靠命！",
            "💰 祈祷要是有用，拜财神都要收费。求人不如求己，来金貝娱乐综合盘，一起上桌，用最公平公正公开的方式，托起你的高傲的尊严地位",
            "💥 能给你几百上千的叫朋友，能给你几千上万的叫亲戚，能给你几十上百万的是爹妈。能给你提个几百上千万的。 我！只有我金貝娱乐综合电子盘。你品！你细品！！！",
            "🤑我朋友冲了100，晚上叫我出来喝酒，说他心态崩了，在金貝娱乐搞了几把打的，钱赚太多了都不知道怎么花🍻你冲不冲自己看着办！",
            "⏰你上班打卡像坐牢，下班看剧像养老📺人家在金貝娱乐一冲直接上道🔥首充送爆你都不试试？",
            "👟你在商场精挑细选一双鞋🛒人家在金貝娱乐冲一把直接提车提表🚗新人福利不领也不拦你，好歹给自己个改命的机会好吧！",
            "🤣你刷短视频笑哈哈📱人家在金貝娱乐提着宝马🚘笑，你好好想想你比人家差在哪里了？想做别人口中的人家嘛？新人首冲福利翻倍送，机会不给磨叽的人！",
            "🙃别动不动说自己穷💸 一生都唯唯诺诺的，冲都不敢冲你还觉得穷得挺踏实的，金貝娱乐送福利送到你门口📬你都不知道伸手接住这泼天富贵？",
            "🧱老板各种给你画饼，PUA你让你努力搬砖🪨你信了，我说让你来金貝娱乐提块金砖你犹豫了，人与人的差距就在你这一丢丢犹豫之间 💥 该你听谁的自己掂量掂量吧！",
            "🎯有的人打工是为了梦想💤但是谁的梦想是打工，我给你个机会，来金貝娱乐梭哈几把。你看是打工实现梦想快还是电子让你实现梦想快🌈你还在纠结干嘛？",
            "📉一个月工资刚到账💰扣掉房租水电还剩可怜巴巴，整天怨天尤人的，怨恨老天爷不公。你来金貝娱乐啊，我让你上桌，给你公平，在给你首充送超水的机会，你就问问自己的心敢不敢冲？🎁",
            "🤔你以为你缺的是钱💵你每天拼了命的去打几份工赚钱，可是赚到了嘛？其实你缺的是冲动⚡金貝娱乐新人专享福利直接送，别等别人晒图刺激你📸！",
            "👔你打工月入3000，人家在金貝娱乐一把提车提表。你苦哈哈搬砖，他笑呵呵爆赚。不是你不行，是你不玩！⚡新人首充超水送，送你一次不靠老板的机会！冲不冲你自己掂量！",
            "🧧你省吃俭用搞副业，人家玩金貝娱乐边冲边赚钱！工资到账还没热，人家已经赚翻买表了。💥首充超水送福利，不靠命靠操作，一局干翻三个月工龄！冲不冲随你，但别怪我没提醒！",
            "🎯你熬夜学理财，人家秒进金貝娱乐提百万！你抱着K线哇哇叫，人家充值就送钱。还不试试？⚡新人冲100送38，走上人生巅峰不靠玄学靠胆子！",
            "💸别人首充送翻倍，你首充送心碎？别搞笑了，来金貝娱乐，新人专享首充超水送，不靠命，全靠冲！⚡别等别人晒收益图才后悔，机会是给动手快的人！",
            "🎰你还在研究“怎么发工资前活下去”，人家在金貝娱乐研究“今晚提现去哪潇洒”！新人福利直接送爆，一把翻身不是梦。💥要稳你去银行，要爽你就来这！",
            "🤣你不敢冲100，结果亏掉100个机会！金貝娱乐送的是翻倍福利，不是讲故事。🚀新人首充超水送，一口气干出工资十倍的收益，敢不敢试一把？",
            "🚬你上班八小时提不起劲，人家冲五分钟提了奔驰。金貝娱乐不是吹，首充赠送的水位全网第一，送到你想骂平台“太狠了”！💰想翻身就别嘴硬，赶紧上车，错过一天就少赚一天！",
            "🧠你说“等等再看”，但机会不会等你！别人已经靠金貝娱乐搬进新小区，你还在等老板加工资？🧧新人首充超水送，福利只给敢动手的人，别犹豫，犹豫就会败北！",
            "你为公司卖命，人家为自己冲金貝。你在群里抢红包，他在后台抢提现额度！🧧新人首充超水送，冲的不只是钱，是你迟到好几年的人生尊严！",
            "你充钱玩游戏，只赢个皮肤；他冲金貝娱乐，直接赢辆车。🎮你玩的是快乐，他玩的是生活质量。别再精打细算了，来这冲一把，可能明天就辞职！",
            "你学理财，看完只剩一句“长期持有”；他玩金貝娱乐，三天收益超你半年存款。📈新人福利爆炸送，没技术？没关系，你只要有胆子！",
            "你卷KPI卷出抑郁，人家卷彩金卷出宝马。🤯你在工位上喘气，他在提款机前数U。新人首充翻倍送，这年头不靠命靠冲，一次机会都不能让！",
            "你吐槽房租太高，他在金貝娱乐冲一晚上把房东请去喝茶了。🏠首充福利直接超水送，新人限定，不用抢、不用抽，只要你敢点进来！",
            "你怕被骗，不敢冲；别人冲完笑得像诈骗犯。🤣平台送钱你都不来，那真不能怪平台偏心了。金貝娱乐首充就送，靠实力送到你不信自己！",
            "你在拼多多砍一刀，他在金貝娱乐一冲到账。💸你满世界找副业，他坐着点点屏幕，收入比你主业都稳。首充福利还翻倍，不试你都对不起自己！",
            "你为1块红包点赞三十条，他为一波彩金冲进VIP群。🤡说到底，不是你不行，是你走错了方向。金貝娱乐首充送上天，这回可别又躺着错过！",
            "你不信平台，我理解；但你信星座、不信福利，我真笑不出来。🤪金貝娱乐首充福利眼睁睁送到你面前，你却继续刷短视频浪费天赋！",
            "你问“冲了会亏吗”，我只想说：不冲一定没戏。🔥金貝娱乐新人首充超水送，别人抢着冲你还在问，这不是犹豫，这是落后！难怪你会败北",
            "🧧朋友说我最近气质变了，我说金貝娱乐到账速度太快，整个人都自信了。以前冲100叫冲动消费，现在冲100叫预支尊贵人生，冲完直接请他喝酒。",
            "🍾昨天我朋友冲了100，晚上叫我喝酒，说他心态崩了，在金貝赢太快不知道钱花哪。我不怪他，因为我当初也是这么一路从公交挤上了宝马的。",
            "🚬你抽9块5的烟觉得很省，我一把金貝娱乐冲下去直接换整条烟，顺便送了个火机和打车红包，消费降级是你的，我这叫财富快速迭代。",
            "📲你刷视频笑得肚子疼，我冲金貝娱乐笑着提了个新手机。差距不在努力，而在你一直犹豫我早就上了车，机会从来不等磨叽人。",
            "🚗以前打车看价格，现在打车只看颜色，冲了金貝娱乐才知道尊贵和穷忙的差距。你还在问靠谱不靠谱，我已经排队提车去了。",
            "📦你早上准点打卡上班，我中午醒来冲了一把金貝娱乐直接到账3000U，还躺着点了星巴克外卖，人生不在起点，在于你懂不懂冲。",
            "📈朋友说打工能积累经验，我说我冲金貝娱乐积累的是资产。经验会变老，资产会增值，别光努力别犹豫，冲一把说不定你也提U上瘾。",
            "🧾你想靠工资生活，我靠金貝娱乐冲出来的人生已经考虑换座城市生活了。不是我张狂，是平台送钱送得太真了，让我失去了“平凡”的资格。",
            "🎮朋友氪金抽卡还没出SSR，我随手冲了金貝娱乐直接到账两百，顺手请他吃了个饭。他感动哭了，我说这只是平台的一点心意而已。",
        ],

        // A仔4群频道
        jbyll: [
            "💣 天天打工月入3千？我一把梭哈就赚5万！你不来金貝娱乐试试，就是在浪费你的人生！⚡新人首充即送彩金，白送钱让你直接开局翻盘！",
            "🐶 看你那副天天等发工资的样儿，真心替你急！马上上号，赤脚来的金貝，晚上可能就翻身开跑车回去！🎁新人首充加送100%，只要你敢冲，平台就敢送！",
            "🔥 别人的人生在逆袭，你却还在刷短视频打发时间？真正牛的人都在金貝彩娱乐挣钱了！🚀首充即送福利狂飙，新人限定，错过血亏！",
            "⚔️ 这不是游戏，这是一场收割战！你要敢进来就别怂，一晚上干翻你三个月工资！💸金貝娱乐新人专属首充翻倍送，激活你的暴富通道！",
            "🧠 不信命就试一把，信了命就别怪命苦！快来金貝娱乐，试一次你就知道自己值几个钱！💥首充立返，不爽你来骂我！",
            "🧨 一群人赚疯了你还在犹豫？等你决定好了，活动早结束了，机会不会等废物！🎊金貝娱乐新人冲100送38，U，送U。送钱都不来你怪谁？",
            "💥 有种你就过来冲100，不中算我输！**别逼逼，金貝娱乐靠实力让你服气！🎯新人首充专享返现，直接让你一把入魂！",
            "🚬 都2025了还靠工资活着？别人一局下去提车提表，你在那买包烟还掏几个口袋，扣扣索索的，丢不丢人？🔥首充福利大爆送，现在不上车你就等着羡慕吧！",
            "🎯 拼命的人在金貝娱乐赢到了尊严，混日子的继续搬砖！机会就在这，看你选哪边？🏆新人首充直接送大礼，没本你也能玩得风生水起！",
            "💰 我从不劝人赌，只叫人来提路虎。金貝娱乐综合盘是聪明人的战场！翻身不靠祈祷，靠一把操作干爆全场！🎉新人注册首充送福利，稳中爆赚不靠命！",
            "💰 祈祷要是有用，拜财神都要收费。求人不如求己，来金貝娱乐综合盘，一起上桌，用最公平公正公开的方式，托起你的高傲的尊严地位",
            "💥 能给你几百上千的叫朋友，能给你几千上万的叫亲戚，能给你几十上百万的是爹妈。能给你提个几百上千万的。 我！只有我金貝娱乐综合电子盘。你品！你细品！！！",
            "🤑我朋友冲了100，晚上叫我出来喝酒，说他心态崩了，在金貝娱乐搞了几把打的，钱赚太多了都不知道怎么花🍻你冲不冲自己看着办！",
            "⏰你上班打卡像坐牢，下班看剧像养老📺人家在金貝娱乐一冲直接上道🔥首充送爆你都不试试？",
            "👟你在商场精挑细选一双鞋🛒人家在金貝娱乐冲一把直接提车提表🚗新人福利不领也不拦你，好歹给自己个改命的机会好吧！",
            "🤣你刷短视频笑哈哈📱人家在金貝娱乐提着宝马🚘笑，你好好想想你比人家差在哪里了？想做别人口中的人家嘛？新人首冲福利翻倍送，机会不给磨叽的人！",
            "🙃别动不动说自己穷💸 一生都唯唯诺诺的，冲都不敢冲你还觉得穷得挺踏实的，金貝娱乐送福利送到你门口📬你都不知道伸手接住这泼天富贵？",
            "🧱老板各种给你画饼，PUA你让你努力搬砖🪨你信了，我说让你来金貝娱乐提块金砖你犹豫了，人与人的差距就在你这一丢丢犹豫之间 💥 该你听谁的自己掂量掂量吧！",
            "🎯有的人打工是为了梦想💤但是谁的梦想是打工，我给你个机会，来金貝娱乐梭哈几把。你看是打工实现梦想快还是电子让你实现梦想快🌈你还在纠结干嘛？",
            "📉一个月工资刚到账💰扣掉房租水电还剩可怜巴巴，整天怨天尤人的，怨恨老天爷不公。你来金貝娱乐啊，我让你上桌，给你公平，在给你首充送超水的机会，你就问问自己的心敢不敢冲？🎁",
            "🤔你以为你缺的是钱💵你每天拼了命的去打几份工赚钱，可是赚到了嘛？其实你缺的是冲动⚡金貝娱乐新人专享福利直接送，别等别人晒图刺激你📸！",
            "👔你打工月入3000，人家在金貝娱乐一把提车提表。你苦哈哈搬砖，他笑呵呵爆赚。不是你不行，是你不玩！⚡新人首充超水送，送你一次不靠老板的机会！冲不冲你自己掂量！",
            "🧧你省吃俭用搞副业，人家玩金貝娱乐边冲边赚钱！工资到账还没热，人家已经赚翻买表了。💥首充超水送福利，不靠命靠操作，一局干翻三个月工龄！冲不冲随你，但别怪我没提醒！",
            "🎯你熬夜学理财，人家秒进金貝娱乐提百万！你抱着K线哇哇叫，人家充值就送钱。还不试试？⚡新人冲100送38，走上人生巅峰不靠玄学靠胆子！",
            "💸别人首充送翻倍，你首充送心碎？别搞笑了，来金貝娱乐，新人专享首充超水送，不靠命，全靠冲！⚡别等别人晒收益图才后悔，机会是给动手快的人！",
            "🎰你还在研究“怎么发工资前活下去”，人家在金貝娱乐研究“今晚提现去哪潇洒”！新人福利直接送爆，一把翻身不是梦。💥要稳你去银行，要爽你就来这！",
            "🤣你不敢冲100，结果亏掉100个机会！金貝娱乐送的是翻倍福利，不是讲故事。🚀新人首充超水送，一口气干出工资十倍的收益，敢不敢试一把？",
            "🚬你上班八小时提不起劲，人家冲五分钟提了奔驰。金貝娱乐不是吹，首充赠送的水位全网第一，送到你想骂平台“太狠了”！💰想翻身就别嘴硬，赶紧上车，错过一天就少赚一天！",
            "🧠你说“等等再看”，但机会不会等你！别人已经靠金貝娱乐搬进新小区，你还在等老板加工资？🧧新人首充超水送，福利只给敢动手的人，别犹豫，犹豫就会败北！",
            "你为公司卖命，人家为自己冲金貝。你在群里抢红包，他在后台抢提现额度！🧧新人首充超水送，冲的不只是钱，是你迟到好几年的人生尊严！",
            "你充钱玩游戏，只赢个皮肤；他冲金貝娱乐，直接赢辆车。🎮你玩的是快乐，他玩的是生活质量。别再精打细算了，来这冲一把，可能明天就辞职！",
            "你学理财，看完只剩一句“长期持有”；他玩金貝娱乐，三天收益超你半年存款。📈新人福利爆炸送，没技术？没关系，你只要有胆子！",
            "你卷KPI卷出抑郁，人家卷彩金卷出宝马。🤯你在工位上喘气，他在提款机前数U。新人首充翻倍送，这年头不靠命靠冲，一次机会都不能让！",
            "你吐槽房租太高，他在金貝娱乐冲一晚上把房东请去喝茶了。🏠首充福利直接超水送，新人限定，不用抢、不用抽，只要你敢点进来！",
            "你怕被骗，不敢冲；别人冲完笑得像诈骗犯。🤣平台送钱你都不来，那真不能怪平台偏心了。金貝娱乐首充就送，靠实力送到你不信自己！",
            "你在拼多多砍一刀，他在金貝娱乐一冲到账。💸你满世界找副业，他坐着点点屏幕，收入比你主业都稳。首充福利还翻倍，不试你都对不起自己！",
            "你为1块红包点赞三十条，他为一波彩金冲进VIP群。🤡说到底，不是你不行，是你走错了方向。金貝娱乐首充送上天，这回可别又躺着错过！",
            "你不信平台，我理解；但你信星座、不信福利，我真笑不出来。🤪金貝娱乐首充福利眼睁睁送到你面前，你却继续刷短视频浪费天赋！",
            "你问“冲了会亏吗”，我只想说：不冲一定没戏。🔥金貝娱乐新人首充超水送，别人抢着冲你还在问，这不是犹豫，这是落后！难怪你会败北",
            "🧧朋友说我最近气质变了，我说金貝娱乐到账速度太快，整个人都自信了。以前冲100叫冲动消费，现在冲100叫预支尊贵人生，冲完直接请他喝酒。",
            "🍾昨天我朋友冲了100，晚上叫我喝酒，说他心态崩了，在金貝赢太快不知道钱花哪。我不怪他，因为我当初也是这么一路从公交挤上了宝马的。",
            "🚬你抽9块5的烟觉得很省，我一把金貝娱乐冲下去直接换整条烟，顺便送了个火机和打车红包，消费降级是你的，我这叫财富快速迭代。",
            "📲你刷视频笑得肚子疼，我冲金貝娱乐笑着提了个新手机。差距不在努力，而在你一直犹豫我早就上了车，机会从来不等磨叽人。",
            "🚗以前打车看价格，现在打车只看颜色，冲了金貝娱乐才知道尊贵和穷忙的差距。你还在问靠谱不靠谱，我已经排队提车去了。",
            "📦你早上准点打卡上班，我中午醒来冲了一把金貝娱乐直接到账3000U，还躺着点了星巴克外卖，人生不在起点，在于你懂不懂冲。",
            "📈朋友说打工能积累经验，我说我冲金貝娱乐积累的是资产。经验会变老，资产会增值，别光努力别犹豫，冲一把说不定你也提U上瘾。",
            "🧾你想靠工资生活，我靠金貝娱乐冲出来的人生已经考虑换座城市生活了。不是我张狂，是平台送钱送得太真了，让我失去了“平凡”的资格。",
            "🎮朋友氪金抽卡还没出SSR，我随手冲了金貝娱乐直接到账两百，顺手请他吃了个饭。他感动哭了，我说这只是平台的一点心意而已。",
        ],

        /************** 金貝担保 ************* */
        // 金貝担保机器人
        jbdb: [
            "🔐电报交易不找担保，就像不戴头盔骑摩托，风再大你都不怕摔？我们金貝担保是专注电报交易的老牌担保频道，全天在线，仲裁公平，专人对接。担保流程公开透明，记录留痕可查，确保你每一单都落地安全不翻车。",
            "💼还在裸奔交易？电报骗子千奇百怪，光靠信任根本不顶用。我们金貝担保频道已有多年从业经验，处理过数万单大额交易，无黑历史无纠纷记录。专属客服一对一跟单，封控机制+实时仲裁双重保障，让你专心谈合作、安心收款不踩坑。",
            "⚠️一边说“人挺靠谱的”，一边转账转得手抖？聪明人做交易，第一步永远是找担保！金主、中介、工作室、代投……各种人都有风险，但靠谱担保只有一个。我们金貝担保不是官僚机器人，而是全天在线解决问题的熟练工。还等什么？带图、报单、立刻处理！",
            "🤣“骗子这东西，总觉得不会轮到我”——这种想法害了太多人。电报交易风口大，风险也大。你可以不找我，但一定要找个靠谱担保。我们金貝担保全程清晰，记录存档，避免你掉入任何一个“信得过”的陷阱。",
            "📲还在找靠谱担保？不用再犹豫了，我们金貝担保专为电报玩家、代理、商人、中介服务。正规担保流程，从头到尾有人负责、有人协调、有人记录，出问题能追责，不跑路不扯皮！现在合作，长期更优惠，欢迎报单试单！",
            "📊我们不是临时工，也不是兼职帮人转账的“联系人”——我们金貝担保是专注于 Telegram 担保的职业团队。每一单都有完整凭证与追溯机制。无论你是一次性交易还是长期合作，我们都能提供稳定、安全、无差错的对接服务。",
            "👦我兄弟上个月被骗800，还拉黑了我微信。我劝他走金貝担保，他说太麻烦。昨天他又被骗一单，我只能心疼地笑：人穷不怕，怕的是倔。",
            "💬对面说先打钱再发货，我问能走金貝担保吗？他说“你不信我？”我说：“不是不信你，我只信平台。”他秒退群了，我没说什么，只截图发了条朋友圈。",
            "👧客户说我啰嗦，我说咱们都打工的，钱不容易。她看我坚持走金貝担保，突然加了100U做大单，说信得过。我也明白了：专业，最能打动人。",
            "📉我朋友做单一直不走担保，结果丢了账号还没结款。后来我推荐他用金貝担保，三天做了十单，钱到账了，命也稳了，现在逢人就说我是他贵人。",
            "📦那天接了个急单，对面说别担保，直接信他。我犹豫了两秒，还是坚持走金貝担保。第二天他号被封，客户在群里找他。我看着到账短信，默默喝了口咖啡。",
            "👊有人说走担保麻烦，我说麻烦一次，比被骗麻烦十次强。上次走金貝担保，客户加我好友还发了红包，说第一次遇到这么讲规矩的打单人。",
            "💼我曾经把“信任”当交易基础，后来被骗三次才知道，基础要打在平台上。现在我只走金貝担保，钱稳稳的，人也舒服了，客户反而越来越多。",
            "📲昨晚接了个新客户，一口气下了三单。我问能走金貝担保吗？他说“早该这样”，十分钟完成交易，到账秒结。我发现：真正大客户，都喜欢靠谱。",
            "🧱以前我天天担心收款不到账，现在金貝担保到账消息比闹钟还准。客户也安心，我也放心，双赢的事为什么不干？非得等被骗一回才学乖吗？",
            "🎯有个客户天天说信我，但每次交易都磨叽。后来我发了金貝担保链接，他爽快秒转。那一刻我明白，别人不拖拉，是因为你够专业！",
            "💰我朋友做单不走担保，结果被骗了两次。后来我推荐他用金貝担保，他说“这才是靠谱的交易方式”。现在他每单都走担保，生意越来越好。",
            "想让更多客户看到你？加入金贝担保公群，三个月免费推流，给你超高曝光！金贝集团实体背景，平台流量大，专业运营团队全天候1v1服务，专属公群靓号等你来抢，做生意更简单高效！",
            "入驻金贝担保公群，享受专属靓号和前三个月免费推广，真正把流量送到你手上！平台背靠金贝集团，实力保障曝光，运营团队24小时贴心陪伴，1v1服务让你省心省力，把握每个机会！",
            "抢占金贝担保公群靓号，轻松提升品牌曝光！平台自带大流量，三个月免费推流福利，专业运营团队全天候1v1服务，金贝集团实力为你加持，让你的业务脱颖而出，吸引更多关注！",
            "生意想做大，先来金贝担保公群拿靓号！平台流量广、推流前三个月免费，金贝集团资金实力撑腰，1v1专属服务全天响应，专业团队陪跑到底，助你快速吸引客户，实现生意增长！",
            "平台曝光就是高！金贝担保公群靓号任你挑，三个月免费推流，金贝集团为你背书。专业运营团队24小时在线，1v1专属服务，品牌和流量一起给到你，快来加入把握商机！",
            "想让生意一炮而红？金贝担保公群为你送上大流量曝光，三个月免费推流福利，公群靓号任你选。金贝集团实力撑腰，专业团队1对1全程陪伴，让更多人第一时间看到你的业务！",
            "别让客户错过你，公群靓号等你来挑！金贝担保公群推流三个月免费，流量倾斜给你。运营团队全天在线，品牌背书、服务贴心，快来加入，轻松吸引优质资源！",
            "想高效推广？平台流量大、推流免费送三个月，专业团队帮你运营，品牌实力让你更容易被信任。抢先注册公群靓号，生意拓展快人一步！",
            "入驻金贝担保公群，免费三个月推流+靓号先到先得。专业团队24小时服务，曝光率高，金贝集团保障，让你生意好起来！",
            "服务想出圈，来金贝担保公群抢靓号。流量大、推流免费，运营团队全程帮忙，金贝集团做后盾，业务轻松上热榜。",
            "生意找人不如让客户主动找上门。金贝担保公群推流三个月全免，专属靓号，专业团队全天在线，品牌曝光快人一步！",
            "抢下公群靓号，享受三个月免费推流大福利！金贝集团实力背书，平台大流量，团队1v1帮你提升生意曝光，客户找你更方便。",
            "还在花冤枉钱推广？来金贝担保公群，推流三个月全免费，靓号开抢，专业团队全天服务，平台品牌助力你打开市场。",
            "想让品牌被更多人记住？金贝担保公群流量多，推流免费三个月，靓号名额抢手，专业团队运营，金贝集团实力做保障！",
            "抢占金贝担保公群专属靓号，享受免费推流、品牌曝光。专业运营团队24小时响应，金贝集团资金保障，商机不等人！",
            "不怕竞争，就怕你慢一步。金贝担保公群靓号先到先得，推流三个月免费，平台大流量，专业团队全程服务，品牌曝光稳妥妥！",
            "打造品牌影响力，金贝担保公群三个月免费推流，靓号开放注册，团队全程1对1服务，金贝集团实力保障，轻松成为焦点。",
            "生意做大靠平台，金贝担保公群免费推流三个月，靓号随你挑，专业团队全天运营，品牌背书让客户更信赖你！",
            "想被更多客户看到？金贝担保公群免费三个月推流，靓号名额多，金贝集团实力撑腰，团队全天候贴心服务！",
            "平台流量就是高，靓号注册随时开放。三个月免费推流，金贝集团做后盾，运营团队帮你打理好一切，品牌轻松出圈！",
            "入群抢靓号，曝光不用愁！金贝担保公群三个月免费推流，专业团队全天运营，金贝集团保障，快速吸引客户眼球。",
            "金贝担保公群推流全免费，专属靓号抢注中，团队1v1服务，品牌背书让你省时省力，客户找你超省心！",
            "让品牌曝光不再难！公群靓号多，推流免费三个月，专业团队全天护航，金贝集团实体背书，生意更顺畅。",
            "想轻松引流？金贝担保公群推流三个月免费送，靓号优先注册，专业团队运营，品牌实力为你加持！",
            "公群靓号等你来抢，三个月免费推流。金贝集团实力支撑，专业团队贴心服务，让你的服务高调亮相！",
            "新商家入驻金贝担保公群福利多，免费三个月推流，靓号开放注册，团队24小时运营，品牌曝光省时省心！",
            "拓展生意圈，来金贝担保公群。免费推流三个月，靓号先来先得，团队全天在线，金贝集团做保障！",
            "金贝担保公群流量大，推流三个月全免费，靓号随心选，专业团队帮你一站服务，生意更上一层楼！",
            "平台品牌强，靓号资源多。免费推流三个月，团队1v1陪跑，金贝集团做背书，合作更无忧。",
            "想让客户优先看到你？金贝担保公群靓号多，推流三个月免费，专业团队运营，金贝集团安全保障，生意不愁没流量！",

            "金贝担保公群服务信息一站齐全，无论你需要什么，这里都能找到！平台背靠金贝集团，仲裁团队保障权益，客服全天候在线，给你高效安全的对接体验，省时又省心。",
            "想找靠谱服务？金贝担保公群信息丰富，服务门类齐全，金贝集团实体加持，平台仲裁团队为你的权益保驾护航。遇到问题客服24小时在线，省心选择就来这里！",
            "一站式找服务，来金贝担保公群！信息量大、分类清晰、应有尽有，平台专业仲裁团队保障每位用户权益，金贝集团品牌保障，客服全天在线，让你用得舒心放心！",
            "无论找什么服务，金贝担保公群都能一网打尽。信息真实全面，仲裁团队公正透明，平台有金贝集团强大背景，客服全天候响应，遇到问题第一时间为你解决，安全感满满！",
            "找服务不怕难，金贝担保公群信息覆盖广，所有资源一应俱全。金贝集团背书，仲裁机制健全，客服全天在线，保障每一位用户的权益，体验省心高效！",
            "想找服务不再东奔西跑？金贝担保公群信息一站齐全，平台有金贝集团实体背书，专业仲裁团队保障权益，客服全天在线，让你找服务更省心！",
            "所有服务信息一网打尽，金贝担保公群帮你高效对接需求。平台背景强，仲裁保障，客服24小时服务，选择多，安全又省力！",
            "金贝担保公群资源全，找什么都能快速定位，平台仲裁团队为你的权益护航。金贝集团做背书，客服全天候响应，放心找服务首选这里！",
            "服务分类齐全，找起来超省事。金贝担保公群平台由金贝集团保障，仲裁团队公正透明，客服随时在线，遇到问题一站解决。",
            "想要高效找服务？金贝担保公群帮你轻松搞定。信息量大，选择丰富，平台仲裁保障，金贝集团背书，客服随时待命。",
            "找服务更省心，金贝担保公群信息覆盖广，分类清晰，金贝集团实力撑腰，仲裁团队保障权益，客服全天响应。",
            "金贝担保公群让你不用到处问人，信息全、服务多，平台仲裁团队让你用得放心，客服24小时在线，品牌强大，体验好！",
            "各类服务一应俱全，金贝担保公群让你一步到位。平台背靠金贝集团，仲裁机制完善，客服全天候陪伴，服务省时又安心。",
            "找服务不用等，金贝担保公群资源充足，平台仲裁团队、金贝集团实体保障，客服随叫随到，让选择更有底气。",
            "想要靠谱服务渠道？金贝担保公群信息量大，分类全，平台仲裁团队和客服时刻在线，遇到问题及时响应，品牌信赖更安心。",
            "金贝担保公群服务信息一站汇集，平台仲裁团队保障你的权益，金贝集团背书，客服随时解决难题，选择多又省事！",
            "找靠谱服务不再难，金贝担保公群平台资源全，仲裁机制健全，金贝集团做后盾，客服全天候响应，安全感十足。",
            "金贝担保公群一站式服务，信息齐全，平台仲裁团队公正处理问题，金贝集团实体保障，客服随时在线，体验省心省力！",
            "想找优质服务？金贝担保公群平台资源丰富，仲裁机制健全，金贝集团背书，客服全天候陪伴，选择丰富又安全。",
            "金贝担保公群让服务选择变简单。信息全、平台仲裁团队及时介入，金贝集团实力背书，客服随时在线，遇事不用愁。",
            "找服务首选金贝担保公群，平台信息覆盖广，仲裁团队保障权益，金贝集团做支撑，客服全天候，选择多效率高。",
            "服务一键查找，金贝担保公群信息全，仲裁机制完善，金贝集团强大背书，客服随时在线，选服务更安心！",
            "想省心选服务，金贝担保公群帮你搞定。信息分类清楚，仲裁机制公正，金贝集团品牌信赖，客服全天在线！",
            "不怕找不到服务，金贝担保公群信息量大，平台仲裁团队公正透明，金贝集团背景强，客服全天候帮你解答。",
            "找到合适服务不用等，金贝担保公群分类细致，平台仲裁团队保障权益，金贝集团做靠山，客服24小时在线。",
            "金贝担保公群让你找服务无忧，平台信息量足，仲裁团队保障权益，金贝集团实体支撑，客服贴心随叫随到。",
            "平台资源丰富，服务信息一应俱全，金贝担保公群仲裁机制健全，金贝集团品牌保障，客服全天候在线，体验超省心。",
            "想用最少时间找到最优服务？金贝担保公群平台资源全，仲裁机制强，金贝集团背书，客服随时响应，效率和安全都到位。",
            "服务选择多，信息全，金贝担保公群让你一步到位。仲裁团队专业，金贝集团品牌强，客服随叫随到，省时省力。",
            "想高效省心找服务？金贝担保公群信息量大，平台仲裁机制完善，金贝集团为你护航，客服全天候服务，选择丰富！",
        ],

        // 金貝公群
        jbgq: [
            "🔐电报交易不找担保，就像不戴头盔骑摩托，风再大你都不怕摔？我们金貝担保是专注电报交易的老牌担保频道，全天在线，仲裁公平，专人对接。担保流程公开透明，记录留痕可查，确保你每一单都落地安全不翻车。",
            "💼还在裸奔交易？电报骗子千奇百怪，光靠信任根本不顶用。我们金貝担保频道已有多年从业经验，处理过数万单大额交易，无黑历史无纠纷记录。专属客服一对一跟单，封控机制+实时仲裁双重保障，让你专心谈合作、安心收款不踩坑。",
            "⚠️一边说“人挺靠谱的”，一边转账转得手抖？聪明人做交易，第一步永远是找担保！金主、中介、工作室、代投……各种人都有风险，但靠谱担保只有一个。我们金貝担保不是官僚机器人，而是全天在线解决问题的熟练工。还等什么？带图、报单、立刻处理！",
            "🤣“骗子这东西，总觉得不会轮到我”——这种想法害了太多人。电报交易风口大，风险也大。你可以不找我，但一定要找个靠谱担保。我们金貝担保全程清晰，记录存档，避免你掉入任何一个“信得过”的陷阱。",
            "📲还在找靠谱担保？不用再犹豫了，我们金貝担保专为电报玩家、代理、商人、中介服务。正规担保流程，从头到尾有人负责、有人协调、有人记录，出问题能追责，不跑路不扯皮！现在合作，长期更优惠，欢迎报单试单！",
            "📊我们不是临时工，也不是兼职帮人转账的“联系人”——我们金貝担保是专注于 Telegram 担保的职业团队。每一单都有完整凭证与追溯机制。无论你是一次性交易还是长期合作，我们都能提供稳定、安全、无差错的对接服务。",
            "👦我兄弟上个月被骗800，还拉黑了我微信。我劝他走金貝担保，他说太麻烦。昨天他又被骗一单，我只能心疼地笑：人穷不怕，怕的是倔。",
            "💬对面说先打钱再发货，我问能走金貝担保吗？他说“你不信我？”我说：“不是不信你，我只信平台。”他秒退群了，我没说什么，只截图发了条朋友圈。",
            "👧客户说我啰嗦，我说咱们都打工的，钱不容易。她看我坚持走金貝担保，突然加了100U做大单，说信得过。我也明白了：专业，最能打动人。",
            "📉我朋友做单一直不走担保，结果丢了账号还没结款。后来我推荐他用金貝担保，三天做了十单，钱到账了，命也稳了，现在逢人就说我是他贵人。",
            "📦那天接了个急单，对面说别担保，直接信他。我犹豫了两秒，还是坚持走金貝担保。第二天他号被封，客户在群里找他。我看着到账短信，默默喝了口咖啡。",
            "👊有人说走担保麻烦，我说麻烦一次，比被骗麻烦十次强。上次走金貝担保，客户加我好友还发了红包，说第一次遇到这么讲规矩的打单人。",
            "💼我曾经把“信任”当交易基础，后来被骗三次才知道，基础要打在平台上。现在我只走金貝担保，钱稳稳的，人也舒服了，客户反而越来越多。",
            "📲昨晚接了个新客户，一口气下了三单。我问能走金貝担保吗？他说“早该这样”，十分钟完成交易，到账秒结。我发现：真正大客户，都喜欢靠谱。",
            "🧱以前我天天担心收款不到账，现在金貝担保到账消息比闹钟还准。客户也安心，我也放心，双赢的事为什么不干？非得等被骗一回才学乖吗？",
            "🎯有个客户天天说信我，但每次交易都磨叽。后来我发了金貝担保链接，他爽快秒转。那一刻我明白，别人不拖拉，是因为你够专业！",
            "💰我朋友做单不走担保，结果被骗了两次。后来我推荐他用金貝担保，他说“这才是靠谱的交易方式”。现在他每单都走担保，生意越来越好。",
            "想让更多客户看到你？加入金贝担保公群，三个月免费推流，给你超高曝光！金贝集团实体背景，平台流量大，专业运营团队全天候1v1服务，专属公群靓号等你来抢，做生意更简单高效！",
            "入驻金贝担保公群，享受专属靓号和前三个月免费推广，真正把流量送到你手上！平台背靠金贝集团，实力保障曝光，运营团队24小时贴心陪伴，1v1服务让你省心省力，把握每个机会！",
            "抢占金贝担保公群靓号，轻松提升品牌曝光！平台自带大流量，三个月免费推流福利，专业运营团队全天候1v1服务，金贝集团实力为你加持，让你的业务脱颖而出，吸引更多关注！",
            "生意想做大，先来金贝担保公群拿靓号！平台流量广、推流前三个月免费，金贝集团资金实力撑腰，1v1专属服务全天响应，专业团队陪跑到底，助你快速吸引客户，实现生意增长！",
            "平台曝光就是高！金贝担保公群靓号任你挑，三个月免费推流，金贝集团为你背书。专业运营团队24小时在线，1v1专属服务，品牌和流量一起给到你，快来加入把握商机！",
            "想让生意一炮而红？金贝担保公群为你送上大流量曝光，三个月免费推流福利，公群靓号任你选。金贝集团实力撑腰，专业团队1对1全程陪伴，让更多人第一时间看到你的业务！",
            "别让客户错过你，公群靓号等你来挑！金贝担保公群推流三个月免费，流量倾斜给你。运营团队全天在线，品牌背书、服务贴心，快来加入，轻松吸引优质资源！",
            "想高效推广？平台流量大、推流免费送三个月，专业团队帮你运营，品牌实力让你更容易被信任。抢先注册公群靓号，生意拓展快人一步！",
            "入驻金贝担保公群，免费三个月推流+靓号先到先得。专业团队24小时服务，曝光率高，金贝集团保障，让你生意好起来！",
            "服务想出圈，来金贝担保公群抢靓号。流量大、推流免费，运营团队全程帮忙，金贝集团做后盾，业务轻松上热榜。",
            "生意找人不如让客户主动找上门。金贝担保公群推流三个月全免，专属靓号，专业团队全天在线，品牌曝光快人一步！",
            "抢下公群靓号，享受三个月免费推流大福利！金贝集团实力背书，平台大流量，团队1v1帮你提升生意曝光，客户找你更方便。",
            "还在花冤枉钱推广？来金贝担保公群，推流三个月全免费，靓号开抢，专业团队全天服务，平台品牌助力你打开市场。",
            "想让品牌被更多人记住？金贝担保公群流量多，推流免费三个月，靓号名额抢手，专业团队运营，金贝集团实力做保障！",
            "抢占金贝担保公群专属靓号，享受免费推流、品牌曝光。专业运营团队24小时响应，金贝集团资金保障，商机不等人！",
            "不怕竞争，就怕你慢一步。金贝担保公群靓号先到先得，推流三个月免费，平台大流量，专业团队全程服务，品牌曝光稳妥妥！",
            "打造品牌影响力，金贝担保公群三个月免费推流，靓号开放注册，团队全程1对1服务，金贝集团实力保障，轻松成为焦点。",
            "生意做大靠平台，金贝担保公群免费推流三个月，靓号随你挑，专业团队全天运营，品牌背书让客户更信赖你！",
            "想被更多客户看到？金贝担保公群免费三个月推流，靓号名额多，金贝集团实力撑腰，团队全天候贴心服务！",
            "平台流量就是高，靓号注册随时开放。三个月免费推流，金贝集团做后盾，运营团队帮你打理好一切，品牌轻松出圈！",
            "入群抢靓号，曝光不用愁！金贝担保公群三个月免费推流，专业团队全天运营，金贝集团保障，快速吸引客户眼球。",
            "金贝担保公群推流全免费，专属靓号抢注中，团队1v1服务，品牌背书让你省时省力，客户找你超省心！",
            "让品牌曝光不再难！公群靓号多，推流免费三个月，专业团队全天护航，金贝集团实体背书，生意更顺畅。",
            "想轻松引流？金贝担保公群推流三个月免费送，靓号优先注册，专业团队运营，品牌实力为你加持！",
            "公群靓号等你来抢，三个月免费推流。金贝集团实力支撑，专业团队贴心服务，让你的服务高调亮相！",
            "新商家入驻金贝担保公群福利多，免费三个月推流，靓号开放注册，团队24小时运营，品牌曝光省时省心！",
            "拓展生意圈，来金贝担保公群。免费推流三个月，靓号先来先得，团队全天在线，金贝集团做保障！",
            "金贝担保公群流量大，推流三个月全免费，靓号随心选，专业团队帮你一站服务，生意更上一层楼！",
            "平台品牌强，靓号资源多。免费推流三个月，团队1v1陪跑，金贝集团做背书，合作更无忧。",
            "想让客户优先看到你？金贝担保公群靓号多，推流三个月免费，专业团队运营，金贝集团安全保障，生意不愁没流量！",

            "金贝担保公群服务信息一站齐全，无论你需要什么，这里都能找到！平台背靠金贝集团，仲裁团队保障权益，客服全天候在线，给你高效安全的对接体验，省时又省心。",
            "想找靠谱服务？金贝担保公群信息丰富，服务门类齐全，金贝集团实体加持，平台仲裁团队为你的权益保驾护航。遇到问题客服24小时在线，省心选择就来这里！",
            "一站式找服务，来金贝担保公群！信息量大、分类清晰、应有尽有，平台专业仲裁团队保障每位用户权益，金贝集团品牌保障，客服全天在线，让你用得舒心放心！",
            "无论找什么服务，金贝担保公群都能一网打尽。信息真实全面，仲裁团队公正透明，平台有金贝集团强大背景，客服全天候响应，遇到问题第一时间为你解决，安全感满满！",
            "找服务不怕难，金贝担保公群信息覆盖广，所有资源一应俱全。金贝集团背书，仲裁机制健全，客服全天在线，保障每一位用户的权益，体验省心高效！",
            "想找服务不再东奔西跑？金贝担保公群信息一站齐全，平台有金贝集团实体背书，专业仲裁团队保障权益，客服全天在线，让你找服务更省心！",
            "所有服务信息一网打尽，金贝担保公群帮你高效对接需求。平台背景强，仲裁保障，客服24小时服务，选择多，安全又省力！",
            "金贝担保公群资源全，找什么都能快速定位，平台仲裁团队为你的权益护航。金贝集团做背书，客服全天候响应，放心找服务首选这里！",
            "服务分类齐全，找起来超省事。金贝担保公群平台由金贝集团保障，仲裁团队公正透明，客服随时在线，遇到问题一站解决。",
            "想要高效找服务？金贝担保公群帮你轻松搞定。信息量大，选择丰富，平台仲裁保障，金贝集团背书，客服随时待命。",
            "找服务更省心，金贝担保公群信息覆盖广，分类清晰，金贝集团实力撑腰，仲裁团队保障权益，客服全天响应。",
            "金贝担保公群让你不用到处问人，信息全、服务多，平台仲裁团队让你用得放心，客服24小时在线，品牌强大，体验好！",
            "各类服务一应俱全，金贝担保公群让你一步到位。平台背靠金贝集团，仲裁机制完善，客服全天候陪伴，服务省时又安心。",
            "找服务不用等，金贝担保公群资源充足，平台仲裁团队、金贝集团实体保障，客服随叫随到，让选择更有底气。",
            "想要靠谱服务渠道？金贝担保公群信息量大，分类全，平台仲裁团队和客服时刻在线，遇到问题及时响应，品牌信赖更安心。",
            "金贝担保公群服务信息一站汇集，平台仲裁团队保障你的权益，金贝集团背书，客服随时解决难题，选择多又省事！",
            "找靠谱服务不再难，金贝担保公群平台资源全，仲裁机制健全，金贝集团做后盾，客服全天候响应，安全感十足。",
            "金贝担保公群一站式服务，信息齐全，平台仲裁团队公正处理问题，金贝集团实体保障，客服随时在线，体验省心省力！",
            "想找优质服务？金贝担保公群平台资源丰富，仲裁机制健全，金贝集团背书，客服全天候陪伴，选择丰富又安全。",
            "金贝担保公群让服务选择变简单。信息全、平台仲裁团队及时介入，金贝集团实力背书，客服随时在线，遇事不用愁。",
            "找服务首选金贝担保公群，平台信息覆盖广，仲裁团队保障权益，金贝集团做支撑，客服全天候，选择多效率高。",
            "服务一键查找，金贝担保公群信息全，仲裁机制完善，金贝集团强大背书，客服随时在线，选服务更安心！",
            "想省心选服务，金贝担保公群帮你搞定。信息分类清楚，仲裁机制公正，金贝集团品牌信赖，客服全天在线！",
            "不怕找不到服务，金贝担保公群信息量大，平台仲裁团队公正透明，金贝集团背景强，客服全天候帮你解答。",
            "找到合适服务不用等，金贝担保公群分类细致，平台仲裁团队保障权益，金贝集团做靠山，客服24小时在线。",
            "金贝担保公群让你找服务无忧，平台信息量足，仲裁团队保障权益，金贝集团实体支撑，客服贴心随叫随到。",
            "平台资源丰富，服务信息一应俱全，金贝担保公群仲裁机制健全，金贝集团品牌保障，客服全天候在线，体验超省心。",
            "想用最少时间找到最优服务？金贝担保公群平台资源全，仲裁机制强，金贝集团背书，客服随时响应，效率和安全都到位。",
            "服务选择多，信息全，金贝担保公群让你一步到位。仲裁团队专业，金贝集团品牌强，客服随叫随到，省时省力。",
            "想高效省心找服务？金贝担保公群信息量大，平台仲裁机制完善，金贝集团为你护航，客服全天候服务，选择丰富！",
        ],

        // 金貝集团
        jbjt: [
            "金貝担保业务！我们致力于为广大客户提供专业、诚信、安全、流量共享的担保服务，打造高效可信赖的服务体系，全面保障您的权益。为您带来的全新保障体验！",
            "金貝集团致力于打造一站式数位资产服务生态🌐平台涵盖娱乐担保供需等多个板块为用户提供安全合规高效的服务环境助力价值落地",
            "选择金貝就是选择效率与信任💼我们以专业的团队丰富的资源为核心为客户提供全方位数位解决方案覆盖多场景多需求全流程无忧",
            "🌟金貝集团构建多元生态场景从担保系统到娱乐专区从交易撮合到供需发布打造透明公开可持续的数位资产综合平台助你安心入场",
            "金貝担保系统上线以来成功保障上万笔交易🔐以安全高效著称为平台用户构建信任桥梁助力整个生态良性循环降低交易成本提升用户体验",
            "在金貝我们相信每一笔交易都值得被尊重每一次协作都应该被保护🏛平台以风控系统和履约机制为基础保障交易双方权益促进生态健康发展",
            "金貝娱乐版块持续扩容玩法丰富🌈活动不断以合规前提提供轻量级休闲娱乐方案首充福利实时到账打造高粘性用户沉浸式体验新选择",
            "金貝供需平台为用户提供高效对接通道⚙️通过实名认证技术风控内容审核等机制保障信息真实推动资源精准匹配提升商机转化效率",
            "我们专注信任机制构建与用户资产安全金貝担保📲采用平台托管履约验收方式有效避免跑单风险实现交易闭环保障多方利益不受损",
            "金貝集团始终坚持用户第一服务为本🤝我们相信长期主义与口碑才是品牌价值的核心持续优化功能拓展场景提升用户全链路体验",
            "从入门小白到资深玩家金貝集团都能提供适配服务📊从平台担保供需对接到项目咨询全流程陪伴式支持助你从新手快速成长到专家",
            "金貝平台已覆盖多国用户🌍我们在数据安全跨境合规客户支持等维度持续投入构建高可用稳定平台让每位用户都能安心参与生态建设",
            "金貝致力于用技术赋能信任⛓平台不断升级风控体系上线智能合约担保审核标准等机制为每一笔交易设下防线守护你的资金安全",
            "金貝担保不只是交易工具而是用户信心的延伸🔍我们用流程标准保障公平用系统机制提升效率用服务态度赢得用户长期信赖",
            "我们的供需平台基于实名信用体系👔支持多标签筛选匹配透明履约记录为商家与资源方提供稳定持续拓展管道解决双方互信难题",
            "金貝集团坚持长期价值导向🎯摒弃短期逐利行为专注产品沉淀服务打磨数据积累让信任成为连接用户与平台之间最坚实的桥梁",
            "选择金貝不是偶然而是看中背后逻辑📐我们重视风控效率体验稳定性每一次优化背后都是对平台安全和用户资产的高度负责",
            "我们不炒概念不追热度🔥金貝始终围绕真实交易场景设计产品以担保为底层逻辑构建生态闭环帮助用户在复杂市场中找到确定路径",
            "金貝集团平台兼容多元角色需求📦不论你是商家用户工作室项目方都能在生态中找到定位链接场景整合资源提升价值转化效率",
            "我们的目标不仅是提供平台更是构建信任金貝生态强调人与人之间的履约与合作通过技术工具机制标准让信任可视可控可验证",
            "金貝集团未来将拓展更多场景应用🧩围绕娱乐交易供需金融等板块深入打通生态脉络打造一体化高质量数字服务平台持续赋能用户",
        ],

        // 金貝供需
        jbgx: [
            "👥找人？找货？找资源？发不出去的单，没人理的需求，全都来这！金貝供需专为电报玩家打造，一手项目、精准资源、靠谱合作，一贴搞定供需对接。",
            "⏱信息更新快、圈子够精准、处理有速度，不管你是中介、商人、推广员，还是想找金主、拉团队、搬资源，这里都是你的信息高速公路！",
            "💼供需不求人，发布不收费，欢迎主动进场，别在朋友圈白吼了，来金貝供需，秒配靠谱圈！",
            "🚀金貝供需频道专注高效撮合供需信息📌后台机制保障信息真实👥快速找到你要的人和资源让合作更简单更靠谱",
            "✅还在群里盲目刷消息吗📌金貝供需频道帮你精准推送真实资源与需求💬分类明确内容清晰告别低效沟通一步直达合作",
            "📌金貝供需频道覆盖项目推广群控服务广告投放等高频需求🚀让信息不再沉底资源不再滞留💬对接效率高两端满意度更高",
            "👥金貝供需频道海量用户💼配套审核机制提升发布质量🚀一站式撮合供需真实有效拒绝无效对话节省时间成本",
            "📢你想找推广他想找资源💬金貝供需频道聚集高活跃从业者📌每日更新高质量供需信息撮合快成交快省时省力更专业",
            "✅金貝供需频道集推广项目代理招商广告渠道方一体📌真实认证用户发单接单透明安全🚀实现资源与需求精准配对",
            "👥不用加几十个群等人来问📌金貝供需频道直接看到精准信息💬实时对接节省时间避免骚扰🚀让交易更高效更有保障",
            "📌加入金貝供需频道真实资源每天更新👥拒绝广告水贴🚀严选项目高效撮合💼让你从混乱中脱离走进真正的合作圈",
            "💬平台引入用户信用评级机制📌黑名单实时更新👥保障交易公平透明🚀金貝供需频道为高效协作和真实对接保驾护航",
            "📌金貝供需频道每天精准曝光上百条真实需求🚀为资源方提供稳定流量支持✅在这里发布让更多人第一时间看到你的价值",
        ],

        /***************** 金博电子盘 ********* */
        // 金博娱乐频道
        jb123_com: [
            "顶级品牌授权：PC28、电子、棋牌、体育、视讯，充值提款极速到账，输赢百万秒结算，超高彩金池，派奖池常备千万USDT，不限IP，支持USDT、HUIONE充值，全球任意畅玩（柬埔寨、菲律宾、迪拜等）",
            "🎰金博娱乐荣获国际顶级品牌授权涵盖PC28棋牌视讯电子体育等高人气项目充值提款秒速到账支持全球畅玩不限IP稳定安全",
            "🪙百万彩金池持续派发输赢百万也可秒结算金博娱乐支持USDT HUIONE充值提款零延迟全球任意接入畅玩无阻畅享娱乐盛宴",
            "🎮全品类游戏集合金博娱乐一站式提供PC28棋牌体育视讯电子极速结算💸支持无限代拓展全球玩家与代理共同变现收益",
            "🌍全球不限IP任意接入金博娱乐支持菲律宾柬埔寨迪拜等地区充值秒到提款更快📈千万派奖池稳定派发秒结秒提体验极佳",
            "💼金博娱乐推出无限代合伙人制度支持多渠道拓展USDT HUIONE等支付方式灵活使用秒速到账每日佣金自动结算长期收益稳定",
            "⚡顶级品牌加持金博娱乐打造国际化娱乐平台PC28棋牌视讯电子全覆盖支持全球访问不锁区充值提款快如闪电值得信赖",
            "📢金博娱乐官方授权正规运营每日千万彩金池高频派发📈多游戏项目支持平台稳定安全收益透明适合全球长期布局",
            "🏆PC28棋牌视讯体育等热门游戏尽在金博娱乐📌支持无限代裂变代理系统日结佣金无延迟💰轻松打造属于你的娱乐生态圈",
            "📈稳定输出百万派奖金博娱乐支持全球玩家接入不限制地区IP💸充值提款极速到账安全透明🌐支持多种支付方式灵活便捷",
            "🎯加入金博娱乐享受极速游戏体验充值提分快人一步⚡千万彩金池长期派送无限代机制收益日结无门槛适合推广代理运营",
            "🧩整合多元娱乐系统金博娱乐构建全球化生态📌支持PC28棋牌视讯等多种玩法结算秒级到账收益稳定代理机制清晰透明",
            "💰金博娱乐注册送即玩充值秒到账提款免等待📢PC28视讯棋牌电子多种玩法任选🔥无限代代理制度助你轻松起盘",
            "🪙从菲律宾到柬埔寨金博娱乐全球畅通支持主流加密支付系统充值提款秒到🔐不限IP不封号让你安心娱乐放心变现",
            "📈金博娱乐每日千万派彩金池实时刷新📌支持USDT HUIONE充值不封区不锁IP全球玩家畅享极致娱乐体验收益可持续",
            "🚀输赢百万照样秒到账金博娱乐高频结算系统稳定运行📢支持无限代拓展代理日结佣金💰轻松实现娱乐变现双向收入",
            "🌟金博娱乐联合国际授权平台打造正规专业娱乐生态支持PC28棋牌视讯等玩法📈多元支付渠道全球任意畅玩安全可靠",
            "📌不管你在迪拜菲律宾还是越南金博娱乐都能稳定接入📢不限IP支持多支付系统⚡输赢实时结算日结收益稳定高效",
            "🎲金博娱乐海量游戏种类任你选PC28棋牌视讯体育玩法丰富📈官方授权运营稳定平台秒充秒提无限代代理全程技术支持",
            "📢千万彩金池每日派发金博娱乐全天候运营不卡顿不限地不限IP💼全球任意接入极速响应支持主流加密支付系统安全可靠",
            "💼金博娱乐邀请你共建全球化娱乐体系不限地区不封IP支持USDT与HUIONE极速到账📢代理拓展轻松变现收益模式成熟稳定",
        ],

        // 金博娱乐机器人
        JBYL_bot: [
            "顶级品牌授权：PC28、电子、棋牌、体育、视讯，充值提款极速到账，输赢百万秒结算，超高彩金池，派奖池常备千万USDT，不限IP，支持USDT、HUIONE充值，全球任意畅玩（柬埔寨、菲律宾、迪拜等）",
            "🎰金博娱乐荣获国际顶级品牌授权涵盖PC28棋牌视讯电子体育等高人气项目充值提款秒速到账支持全球畅玩不限IP稳定安全",
            "🪙百万彩金池持续派发输赢百万也可秒结算金博娱乐支持USDT HUIONE充值提款零延迟全球任意接入畅玩无阻畅享娱乐盛宴",
            "🎮全品类游戏集合金博娱乐一站式提供PC28棋牌体育视讯电子极速结算💸支持无限代拓展全球玩家与代理共同变现收益",
            "🌍全球不限IP任意接入金博娱乐支持菲律宾柬埔寨迪拜等地区充值秒到提款更快📈千万派奖池稳定派发秒结秒提体验极佳",
            "💼金博娱乐推出无限代合伙人制度支持多渠道拓展USDT HUIONE等支付方式灵活使用秒速到账每日佣金自动结算长期收益稳定",
            "⚡顶级品牌加持金博娱乐打造国际化娱乐平台PC28棋牌视讯电子全覆盖支持全球访问不锁区充值提款快如闪电值得信赖",
            "📢金博娱乐官方授权正规运营每日千万彩金池高频派发📈多游戏项目支持平台稳定安全收益透明适合全球长期布局",
            "🏆PC28棋牌视讯体育等热门游戏尽在金博娱乐📌支持无限代裂变代理系统日结佣金无延迟💰轻松打造属于你的娱乐生态圈",
            "📈稳定输出百万派奖金博娱乐支持全球玩家接入不限制地区IP💸充值提款极速到账安全透明🌐支持多种支付方式灵活便捷",
            "🎯加入金博娱乐享受极速游戏体验充值提分快人一步⚡千万彩金池长期派送无限代机制收益日结无门槛适合推广代理运营",
            "🧩整合多元娱乐系统金博娱乐构建全球化生态📌支持PC28棋牌视讯等多种玩法结算秒级到账收益稳定代理机制清晰透明",
            "💰金博娱乐注册送即玩充值秒到账提款免等待📢PC28视讯棋牌电子多种玩法任选🔥无限代代理制度助你轻松起盘",
            "🪙从菲律宾到柬埔寨金博娱乐全球畅通支持主流加密支付系统充值提款秒到🔐不限IP不封号让你安心娱乐放心变现",
            "📈金博娱乐每日千万派彩金池实时刷新📌支持USDT HUIONE充值不封区不锁IP全球玩家畅享极致娱乐体验收益可持续",
            "🚀输赢百万照样秒到账金博娱乐高频结算系统稳定运行📢支持无限代拓展代理日结佣金💰轻松实现娱乐变现双向收入",
            "🌟金博娱乐联合国际授权平台打造正规专业娱乐生态支持PC28棋牌视讯等玩法📈多元支付渠道全球任意畅玩安全可靠",
            "📌不管你在迪拜菲律宾还是越南金博娱乐都能稳定接入📢不限IP支持多支付系统⚡输赢实时结算日结收益稳定高效",
            "🎲金博娱乐海量游戏种类任你选PC28棋牌视讯体育玩法丰富📈官方授权运营稳定平台秒充秒提无限代代理全程技术支持",
            "📢千万彩金池每日派发金博娱乐全天候运营不卡顿不限地不限IP💼全球任意接入极速响应支持主流加密支付系统安全可靠",
            "💼金博娱乐邀请你共建全球化娱乐体系不限地区不封IP支持USDT与HUIONE极速到账📢代理拓展轻松变现收益模式成熟稳定",
        ],

        /**************** 克隆频道 *********** */
        // 克隆 金色财经新闻频道
        jbtg001: [
            "🧠 加密市场瞬息万变，金色财经为你秒级推送重磅快讯，聚焦热点、深度解析，让你第一时间把握投资机会！",
            "🚀 还在刷无用资讯？来金色财经，关注币圈核心动态，告别盲目投资，早一步获取市场情报，早一步吃肉！",
            "📉 每一次行情波动背后，都藏着资本博弈。金色财经带你看懂逻辑、避开雷区，精准掌握加密市场风向！",
            "💰 真正的投资人，不靠“听说”，靠数据和判断。金色财经，24 小时无死角播报全球加密市场动向！",
            "🔥 币圈热度疯涨？别再靠小道消息跟风操作！金色财经带你直击官方、项目方、机构动态，少走弯路！",
            "📊 金色财经，专为数字资产爱好者打造，政策消息、链上数据、巨鲸异动一网打尽，新手也能轻松看懂！",
            "🎯 无论你是投研、矿工还是项目方，金色财经都是你不可缺的资讯雷达，行情分析 + 快讯解读一应俱全！",
            "🕵️‍♂️ 抢先看到机构建仓、巨鲸转账？金色财经帮你用最短时间掌握最大价值的信息，快人一步不是口号！",
            "⏰ 新人错过牛市的暴涨？别再错过关键节点！订阅金色财经，每天 1 分钟速览加密圈全局动态！",
            "🌐 币圈“消息差”决定成败！关注金色财经，不漏掉每一条影响行情的大新闻，领先他人不是梦！",
        ],

        // 克隆 Telo News 简体中文 - 加密货币｜DeFi ｜Web3
        jbtg002: [
            "🚀 加密世界瞬息万变？来 Telo News 简中频道，一站获取 DeFi、链游、Web3 热点，读懂趋势，不再落后！",
            "🌐 Telo News 简体中文频道，专业播报全球 Web3 热点项目、链上动态、政策要闻，快速掌握加密新机遇！",
            "💡 学会看懂加密趋势，先人一步布局热门赛道！Telo News 简中频道，每日更新 Web3、DeFi 一手情报！",
            "🧠 每天 1 分钟速览币圈重点资讯，Telo News 用简体中文为你拆解复杂信息，Web3 世界轻松入门！",
            "📢 不会翻墙也能掌握全球加密头条？Telo News 简中频道全网同步，DeFi、NFT、链游干货一网打尽！",
            "📉 DeFi 数据异动？Web3 项目上线？新链启动？全都锁定 Telo News 简体中文频道，动态尽在掌握！",
            "🔥 Web3 时代信息差致胜！Telo News 简中频道助你精准判断市场，避开坑、捡到金，全网同步更高效！",
            "📊 把握 Web3 红利，从关注 Telo News 开始！每日资讯 + 独家分析，助力你理解赛道、投资不再迷茫！",
            "🎯 关注 Telo News 简中频道，全球链圈热文、项目点评、融资消息应有尽有，一键掌握前沿脉动！",
            "🕵️‍♂️ Web3 新人也能看懂！Telo News 简体中文频道用最懂用户的语言，带你洞悉加密新秩序！",
        ],

        // 克隆 DJ彼岸花音乐频道
        jbtg003: [
            "🎧 不嗨不睡觉！DJ彼岸花，全网最炸 remix 现场，每天更新，耳朵爽翻，灵魂出窍！",
            "🔊 节奏一响，全身起舞！DJ彼岸花，集合全网顶级嗨曲，一秒点燃你的夜晚情绪！",
            "🚨 独享节奏暴击！DJ彼岸花音乐频道上线，全网爆款电音、嗨曲一站打包，耳朵爽爆！",
            "🌙 熬夜刷手机不如来点狠的！DJ彼岸花，高能音乐输出，嗨到停不下来！",
            "🚀 解压、提神、蹦迪必备！DJ彼岸花，每日上新劲爆神曲，夜猫子最爱的频道！",
            "💣 再多压力，一首电音就能释放！DJ彼岸花，你的深夜能量补给站！",
            "🧠 上班摸鱼、通勤无聊、夜晚无声？DJ彼岸花，全程高能陪你嗨到底！",
            "🔥 DJ彼岸花上线！中文 remix、电音混剪、夜店神曲，24小时无限循环！",
            "💥 不看颜值，只听节奏！DJ彼岸花给你一耳入魂，刷到停不下的神级频道！",
            "🎵 不玩虚的，只放狠的！DJ彼岸花音乐频道——带感、不腻、绝对炸！",
        ],

        // 克隆 篮球赛事-世界篮球赛事专题大全
        jbtg004: [
            "🏀 NBA、CBA、奥运男篮、世界杯全覆盖！世界篮球赛事专题大全，每天准时更新！",
            "🌍 篮球迷狂喜！全网最全世界级篮球赛事资讯，比分、录像、花絮一站搞定！",
            "📺 想看球？别满网找！篮球赛事专题大全频道，全网高能集锦、数据解读全都有！",
            "🔥 今日谁封盖？谁绝杀？谁爆砍50分？关注篮球赛事大全，第一时间掌握赛场热点！",
            "🎯 一键关注全球焦点篮球赛事！NBA、FIBA、WNBA全都有，随时随地看球不掉队！",
            "🧠 球星数据分析、热门赛程提醒、战术回放，尽在世界篮球赛事专题大全！",
            "🏆 关注篮球赛场，不止热血，更有深度！世界赛事动态一手掌握，尽在本频道！",
            "📊 看球赛也要专业！战术解析+数据图解+精彩高光，篮球迷必备收藏频道！",
            "🔔 篮球不只是 NBA！世界杯、奥运、欧洲杯、亚锦赛，全球赛事一网打尽！",
            "🗓️ 每日更新全球顶级篮球赛事专题，视频、数据、比分统统奉上，精彩不错过！",
        ],

        // 克隆 华人大事件
        jbtg005: [
            "🌏 全球华人关注的大事小情，第一时间呈现！华人大事件频道，不止快，还够狠！",
            "📰 一站式掌握全球华人圈热议事件，社会、时政、突发爆料，全都不错过！",
            "🔥 别被热搜骗了眼！这里才是真·华人视角的大事件集结地，每天都有新料！",
            "📢 海内外重大突发、政商风云、人物变动，华人大事件频道，一条都不漏！",
            "🎯 别再四处刷新闻！想了解全球华人圈真正关心的事？这个频道每天更新不含水！",
            "🚨 全球华人热议事件大合集，每天不定时高能推送，一手消息抢先知道！",
            "🧠 聚焦全球华人圈最热、最爆、最有影响力的新闻事件，三分钟掌握一天要闻！",
            "🌍 华人圈大事风云录，热点、内幕、观点一次看全，节省你的时间只看重点！",
            "📱 别再刷没用的短视频了，真正对你有用的华人世界动态，这里一网打尽！",
            "📌 全球华人重大新闻推送站，每天都是信息高能场，敢看，才敢真懂华人圈！",
        ],

        // 克隆 大象新闻☀️吃瓜☀️曝光
        jbft100: [
            "🍉 网红撕逼、明星塌房、富豪翻车，每天一瓜，快乐无价！关注大象新闻，天天有料！",
            "🕵️‍♂️ 谁又出轨？谁被抓？谁社死？大象新闻吃瓜频道，全网最猛爆料第一时间送达！",
            "⚠️ 明星翻车、富婆开撕、主播自爆，瓜太大别吞太快！关注大象新闻，每天吃饱！",
            "🔍 看腻了假装正经？大象新闻只讲你想听的瓜！曝光、内幕、猛料，统统一锅端！",
            "🐍 谁在装，谁在演，谁真的翻车了？大象新闻爆料不留情面，真相直白砸脸！",
            "📱 吃瓜群众请就位！每天都有惊掉下巴的新瓜爆料，就在大象新闻，来了就上头！",
            "💥 全网最带劲吃瓜地！娱乐圈、网红圈、富人圈，谁出事谁爆雷，全在这里！",
            "🤯 三分钟一个大瓜，五分钟一次惊讶！大象新闻频道，每天都在上演网络爽文！",
            "🎬 看不完的狗血剧情，扒不尽的劲爆内幕，大象新闻频道，吃瓜人的乐园！",
            "🧨 你朋友圈不敢发的瓜，我们敢发！大象新闻，每天带你看透表象，直戳真相！",
        ],

        // 克隆 亚太曝光 |亚太新闻|缅北大事件|东南亚新闻
        JBFT101: [
            "🌏 缅北战况、东南亚内幕、亚太局势全掌握！每天一爆料，真相直达你手机！",
            "🔥 缅北战乱、诈骗基地、突发冲突、社会黑幕，亚太曝光频道，敢讲你不敢听！",
            "🧨 缅北大瓜太猛！东南亚热点、亚太突发事件，天天爆料，事事直击内幕！",
            "🕵️‍♂️ 想知道缅北真实情况？想掌握东南亚第一手消息？来亚太曝光，信息不打码！",
            "⚔️ 缅北局势升级？东南亚频出事？别刷慢新闻，亚太曝光带你看最狠内幕！",
            "📡 每天推送亚太敏感大事！缅北生死线、诈骗黑幕、区域冲突尽收眼底！",
            "📢 没人敢讲的，我们爆！缅北最新战报、东南亚社会现状，亚太曝光让你看真相！",
            "🚨 缅北、老挝、泰国、马来……新闻只说一半？亚太曝光告诉你背后的那一半！",
            "🤯 真实缅北，热爆东南亚！这里是信息交锋前线，亚太曝光，拒绝假新闻！",
            "🧭 跨境大事、灰色内幕、缅北真相……只有亚太曝光，不洗稿、不粉饰，只讲实情！",
        ],

        // 克隆 东南亚群英会曝光新闻
        jbtg102: [
            "🚨 东南亚群英会曝光新闻，第一时间带你直击缅北、东南亚的重大事件！我们为你呈现最热、最真实的资讯，绝对不容错过！💥",
            "🌏 东南亚新闻大爆料！ 从缅北到东南亚，揭露所有你不知道的内幕，掌握最前沿的动态，加入我们，站在资讯的顶端！🔍",
            "📢 东南亚群英会曝光新闻，专注报道东南亚的重磅事件！实时更新，带你抢先了解背后的故事。立即关注，了解最新真相！⚡",
            "🚀 缅北风云，东南亚动荡，只有东南亚群英会曝光新闻，帮你捕捉每一条重要资讯！快来看看，成为真相的第一手知情者！🌟",
            "🔥 东南亚新闻曝光！ 想知道缅北最新局势和东南亚重磅事件？东南亚群英会带你走在新闻最前沿，抓住每一个不可忽视的热点！💡",
        ],

        // 克隆 企业微信 公众号 微信小店
        jbtg103: [],

        // 克隆 电影频道【SOTV】
        jbtg105: [
            "🎬 电影迷必看！ 立即关注【SOTV】频道，海量影视大片随时看，最新最热的电影资源等你来发现！✨",
            "🍿 好剧看不停！ 【SOTV】电影频道为你带来全球最火电影，经典与新片一网打尽！不容错过的电影盛宴！🎥",
            "🎥 想看最新大片？ 【SOTV】电影频道让你随时畅享高清影视，最新剧集、热播电影全都有！快来加入我们，带你领略视听震撼！🍿",
            "🌟 电影世界无限精彩！ 在【SOTV】电影频道，享受全新的观影体验，跟随最热门影片一起探索精彩世界！🎬",
            "🔥 【SOTV】电影频道上线！ 热门电影、新片发布，尽在掌握。无论是好莱坞大片还是国内经典，尽情畅享！🎥",
        ],

        // 克隆 吃瓜频道
        jbtg106: [
            "🍿 笑点爆表，乐不停！ 吃瓜频道为你带来最新娱乐八卦、内涵段子和搞笑视频，笑翻全场，天天开怀！😂",
            "🎬 娱乐圈最搞笑的内幕都在这里！ 吃瓜频道汇聚最热娱乐段子和爆笑视频，快来围观，跟朋友一起笑到肚子疼！😆",
            "💥 搞笑视频、内涵段子，笑到停不下来！ 吃瓜频道每时每刻都有娱乐圈最新最有趣的爆笑内容，笑点随时刷新！🤣",
            "🍉 让你笑得停不下来，娱乐从未如此有趣！ 吃瓜频道带来最搞笑的段子和视频，轻松愉快、乐趣无穷！🎥",
            "🔥 搞笑段子和爆笑视频大集合！ 吃瓜频道带你重温经典笑话，娱乐圈最劲爆、最幽默的内容等你来发现！😄",
        ],

        // 克隆 东南亚黑暗大事件
        qnzx8: [
            "⚠️ 东南亚背后的黑暗真相曝光！ 揭示不为人知的秘密，带你深入了解那些不敢公开的事件和故事！🔍",
            "🌐 黑暗中的真相，谁敢直面？ 东南亚发生的离奇事件，一切都在这个频道，为你揭开神秘面纱！👀",
            "🕵️‍♂️ 真相终将浮出水面，东南亚黑暗事件大揭秘！ 你绝对无法想象的背后故事，马上来看！🚨",
            "🛑 东南亚黑暗事件，让你大开眼界！ 看不见的真相，正在这里曝光，赶紧加入我们，一起了解隐藏在表面之下的秘密！🔒",
            "⚡ 黑暗深处的震撼揭秘！ 东南亚的阴暗面逐一揭开，了解更多不为人知的大事件，让你震惊不已！💣",
        ],

        // 克隆 奥斯卡4K蓝光(精品)影视磁力站🍟
        cflm88: [
            "🎬 奥斯卡电影4K蓝光，高清震撼！ 每一部都是经典，带你体验无与伦比的视觉盛宴！🍿 快来享受电影之夜吧！",
            "🌟 奥斯卡精品，4K蓝光电影不容错过！ 让你在家也能感受影院级别的视听享受！🚀 立即加入，一起看大片！",
            "🎥 想看奥斯卡最佳影片？ 我们提供最高清4K蓝光版本，给你最真实的影院体验！🎉 尽在奥斯卡4K蓝光影视磁力站！",
            "🍿 4K高清蓝光电影，奥斯卡精品尽收眼底！ 每个画面都细致入微，让你享受超清视觉冲击！赶紧加入吧！🔥",
            "🌍 顶级电影，4K蓝光，奥斯卡经典全收录！ 每部影片都是震撼人心的视觉艺术，赶紧来体验！🎬 影院级的享受就在家里！",
        ],

        // 克隆 【TMGM币圈分析】比特币每日策略🚀
        cflr8: [
            "💰 比特币每日最新分析！ 跟随【TMGM币圈分析】，让你把握市场脉搏，制定完美策略！🚀 立刻加入，快人一步！",
            "📊 比特币市场波动大，如何精准操作？ 每日策略解读，助你把握每一次赚钱机会！💥 点击进入【TMGM币圈分析】！",
            "🚀 每日比特币行情解析！【TMGM币圈分析】为你提供最专业的市场动态与交易策略，抓住每个盈利机会！💎",
            "🤑 比特币行情瞬息万变！ 不用担心，【TMGM币圈分析】每日更新，帮助你做出最精准的投资决策！📈",
            "💹 比特币投资不再迷茫！ 订阅【TMGM币圈分析】，获取每日最新市场策略，带你走在盈利前沿！🔥",
        ],
    };

    // 金貝供需单独处理
    console.log(type)
    if(type === 'jbgq'){
        const classify = $(".GQClassify")?.val();
        if(!text?.length) return GQText[classify]
        for (const key in GQText) {
            if(GQText[key]?.find(v => v === text)){
                return GQText[key]
            }
        }
        return []
    }

    return texts?.[type];
};

// 根据类型获取推广链接
const getUserUrl = () => {
    let user = $(".pr-header-account-name").text();
    let type = $(".select")?.val();

    // 推广码
    let users = {
        "金貝招商 @jbdb": 64777,
        "ads 老k": 53377,
        "ads 菲菲": 53377,
        "ads 头头": 53377,
        "ADS组织": 53377,
        "ads 贝贝": 64777,
        "ads 欢欢": 64777,
        "ads 可可": 64777,
        "ads 晶晶": 64782,
        "ads 莹莹": 64782,
        "ads 妮妮": 64782,
        "金貝推广-KK": 53377,
        "金貝推广-天天": 53377,
        "金貝推广-小虎": 64777,
        "金貝推广-小龙": 64777,
        "金貝推广-小豹": 64777,
        "金貝推广-贝贝": 64777,
        "金貝推广-锅巴": 64777,
        "金貝推广-花花": 64777,
        "金貝推广-七七": 64777,
        "金貝推广-蛋蛋": 64777,
    };

    // 浏览器序号
    let browserObj = {
        "金貝招商 @jbdb": 0,
        "ads 晶晶": 1,
        "ads 贝贝": 2,
        "ads 菲菲": 3,
        "ads 头头": 4,
        "ads 欢欢": 5,
        "ads 莹莹": 6,
        "ads 妮妮": 7,
        "ads 老k": 8,
        "ads 可可": 9,
        "ADS组织": 20,
        "金貝推广-KK": 10,
        "金貝推广-天天": 11,
        "金貝推广-小虎": 12,
        "金貝推广-小龙": 13,
        "金貝推广-小豹": 14,
        "金貝推广-贝贝": 15,
        "金貝推广-锅巴": 16,
        "金貝推广-花花": 17,
        "金貝推广-七七": 18,
        "金貝推广-蛋蛋": 19,
    };

    // 先区分账号, 在区分下拉框选项
    if (![...FTChannel, ...JBChannel, ...DBChannel].includes(user)) {
        // 正常推广金貝链接
        const code = users[user] ?? 53377; // 推广码
        const source = "ADS"; // 来源
        const browserNum = browserObj[user] ?? "N"; // 浏览器编号 没有为N代替
        const accountEN = accountObj[user] ?? "null"; // 推广账号
        const postID = guid(); // 推广ID
        return `t.me/JB6666_BOT?start=${code}_${source}-${accountEN}-${browserNum}${postID}`;
    } else {
        let item = promoteOpts?.find?.((v) => v?.value === type);
        return item?.url;
    }
};

// 获取余额
const getMoney = () => $(".js-header_owner_budget .pr-link").text().match(/(\d+)(?=\s*\.)/)?.[0] || 0;

// 刷新
const onRefresh = async () => {
    window.isLoad = false;
    loadADSFlag = false;
    await updatePviews()
    Aj.state.adsList = [];
    window.Aj.reload();
    return new Promise((resolve) => {
        let timer = setInterval(async () => {
            if (window.isLoad) {
                clearInterval(timer);
                timer = null;
                console.log("刷新成功");
                resolve(true);
            }
        }, 500);
    });
};

// confirm
const confirm = async (msg) => {
    return new Promise((resolve, reject) => {
        Swal.fire({
            text: msg,
            position: "top",
            backdrop: false,
            showCancelButton: true,
            confirmButtonText: "确定",
            cancelButtonText: "取消",
        }).then((result) => {
            if (result.isConfirmed) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
};

// toast
const toast = (msg, fn) => {
    Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: msg,
        showConfirmButton: false,
        timer: 2000, // 自动关闭
        timerProgressBar: true,
        didClose: () => {
            fn && fn();
        },
    });
};

const prompt = (title) => {
    return new Promise((resolve) => {
        Swal.fire({
            title: title,
            input: "text",
            inputPlaceholder: "请输入",
            inputValidator: (value) => {
                if (!value) return "❌ 请输入价格！";
                const price = parseFloat(value);
                if (isNaN(price) || price <= 0)
                    return "⚠️ 请输入一个大于0的正确数字！";
                return null; // 返回null表示验证通过
            },
            showCancelButton: true,
            confirmButtonText: "确认",
            cancelButtonText: "取消",
            focusConfirm: false,
            preConfirm: (value) => parseFloat(value), // 转为浮动数字
        }).then((result) => {
            if (result.isConfirmed) {
                const price = result.value;
                resolve(price);
            } else {
                resolve(0);
            }
        });
    });
};

// 自动加预算
const addMountFn = async () => {
    await onRefresh();

    let path = "/edit_budget";
    let list = OwnerAds.getAdsList();

    // 三重因子判断，加入率、点击率、曝光量， 加入率 > 20% && 点击率 > 2%
    /**
     * 广告的CTR点击率超过
     * 1. 只处理预算余额小于5
     * 2. 加入量大于20  增加 10
     * 3. 加入量大于10  增加 5
     * 4. 加入量大于0   增加 3
     * 5. 没有加入量 且 余额为0  增加2
     **/
    let total = 0;
    list = list.filter((v) => {
        if (v.status !== "Active" && v.status !== "Stopped") return false;
        if (v.hasOwnProperty("score")) {
            if (v.score <= 2) {
                if (+v.budget >= 1) return false;
                v["add_budget"] = 1;
            } else if (v.score < 5) {
                if (+v.budget >= 2) return false;
                v["add_budget"] = 2;
            } else if (v.score < 10) {
                if (+v.budget >= 5) return false;
                v["add_budget"] = 5;
            }
        } else {
            if (+v.joins < 1) {
                if (v.status === "Stopped") {
                    v["add_budget"] = 0.5;
                }
            } else if (+v.joins < 10) {
                if (+v.budget >= 1) return false;
                v["add_budget"] = 1;
            } else if (+v.joins < 30) {
                if (+v.budget >= 1) return false;
                v["add_budget"] = 2;
            } else if (+v.joins < 50) {
                if (+v.budget >= 3) return false;
                v["add_budget"] = 3;
            } else {
                if (+v.budget >= 5) return false;
                v["add_budget"] = 5;
            }
        }

        v["url"] = `${host}/account?l=account/ad/${v.ad_id}${path}`;
        total += v["add_budget"];
        $(`a[href="/account/ad/${v.ad_id}"]`)
            .first()
            .parents("tr")
            .find("td")
            .css("backgroundColor", "rgb(17, 154, 245, .5)");

        return true;
    });

    if (!list.length) {
        toast("预算充足 !!!");
        return false;
    }

    // 超预算停止定时器
    if (getMoney() < total) {
        clearInterval(timerID);
        timerID = null;
    }

    Aj.showProgress();

    // 循环获取html放入数组中
    let htmlPromise = list.map(async (v) => await getHTML(v.url, "l"));

    // 获取所有html
    let htmlArr = await Promise.all(htmlPromise); // 等待所有任务完成

    let submitPromise = list.map((v, i) => {
        let $form = htmlArr[i];
        let owner_id = $form.find("input[name='owner_id']").value();
        let ad_id = $form.find("input[name='ad_id']").value();
        let params = { owner_id, ad_id, amount: v.add_budget, popup: 1 };
        return new Promise((resolve) => {
            Aj.apiRequest("incrAdBudget", params, function (result) {
                if (result.error) {
                    resolve(false);
                    return false;
                }

                if (result.ad) {
                    OwnerAds.updateAd(result.ad);
                }
                if (result.header_owner_budget) {
                    // 更新总金额
                    $(".js-header_owner_budget").html(result.header_owner_budget);
                }
                if (result.owner_budget) {
                    $(".js-owner_budget").html(result.owner_budget);
                }
                if (result.ad_budget_val) {
                    $(".js-ad_budget_val").value(result.ad_budget_val);
                }

                resolve(true);
            });
        });
    });

    let submitArr = await Promise.all(submitPromise); // 等待所有任务完成
    let successNum = submitArr.filter((flag) => flag)?.length;
    let errorNum = submitArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();

    toast(`增加预算：成功${successNum}条，失败${errorNum}条`);

    await onRefresh();
};

// 设置CPM价格
let editCPM = async (item, cpm) => {
    return new Promise((resolve, reject) => {
        let params = { owner_id: Aj.state.ownerId, ad_id: item.ad_id, cpm };
        Aj.apiRequest("editAdCPM", params, function (result) {
            if (result.error) {
                resolve(false);
                return false;
            } else {
                if (result.ad) {
                    OwnerAds.updateAd(result.ad);
                }

                // 根据帖子id 记录在库(时间到秒, 帖子id, 帖子标识, 浏览量, 点击量, 加入量, 付款人数, 付款价格)
                let tmp = item?.tme_path?.split("_") || [];
                let ads = tmp[tmp.length - 1] || "";
                setDB({
                    ad_id: item.ad_id,
                    ads,
                    cpm: cpm,
                    float: (cpm - item.cpm).toFixed(2),
                    views: item?.views || 0,
                    clicks: item?.clicks || 0,
                    joins: item?.joins || 0,
                    pays: item?.pays || 0,
                    money: item?.money || 0,
                    createDate: date.getBeijingString(),
                });

                resolve(true);
            }
        });
    });
};

// 已跑动提价, 在原价基数上随机增加0.1 - 0.5
const addPriceActiveFn = async () => {
    let list = OwnerAds.getAdsList();
    list = list.filter((v) => {
        if (v?.tme_path?.indexOf("?") === -1) return false;
        if (v.status === "Active" && +v?.score && +v?.score > 0) {
            $(`a[href="/account/ad/${v.ad_id}"]`)
                .first()
                .parents("tr")
                .find("td")
                .css("backgroundColor", "rgb(17, 154, 245, .5)");
            return true;
        }
        return false;
    });
    if (!list?.length) return toast("没有跑动的广告");

    Aj.showProgress();

    // 循环加报价
    let promiseArr = list.map(async (item) => {
        let romPrice = getRNum(0.1, 0.5, 1);
        let price = (item.cpm + +romPrice).toFixed(2);
        return await editCPM(item, price);
    });

    // 开始报价
    let promiseRes = await Promise.all(promiseArr); // 等待所有任务完成

    let successNum = promiseRes.filter((flag) => flag)?.length;
    let errorNum = promiseRes.filter((flag) => !flag)?.length;

    Aj.hideProgress();
    toast(`加价完成：成功${successNum}条，失败${errorNum}条`);
    await onRefresh();
};

// 未跑动自动加报价 在原价格基础上随机增加0.1 - 1元
const addPriceFn = async () => {
    let list = OwnerAds.getAdsList();
    list = list.filter((v) => {
        if (v?.tme_path?.indexOf("?") === -1) return false;
        if (v.status === "Active" && !v?.score && +v?.score === 0) {
            $(`a[href="/account/ad/${v.ad_id}"]`)
                .first()
                .parents("tr")
                .find("td")
                .css("backgroundColor", "rgb(17, 154, 245, .5)");
            return true;
        }
        return false;
    });
    if (!list?.length) return toast("没有0权重广告");

    Aj.showProgress();

    // 循环加报价
    let promiseArr = list.map(async (item) => {
        let romPrice = getRNum(0.1, 1, 1);
        let price = (item.cpm + +romPrice).toFixed(2);
        return await editCPM(item, price);
    });

    // 开始报价
    let promiseRes = await Promise.all(promiseArr); // 等待所有任务完成

    let successNum = promiseRes.filter((flag) => flag)?.length;
    let errorNum = promiseRes.filter((flag) => !flag)?.length;

    Aj.hideProgress();
    toast(`加价完成：成功${successNum}条，失败${errorNum}条`);
    await onRefresh();
};

// 自动提价
const onProPrice = async () => {
    let list = OwnerAds.getAdsList();
    list = list.filter((v) => {
        // if (v?.tme_path?.indexOf("?") === -1) return false;
        if (v.status === "Active" && v.qviews < 500) {
            $(`a[href="/account/ad/${v.ad_id}"]`)
                .first()
                .parents("tr")
                .find("td")
                .css("backgroundColor", "rgb(17, 154, 245, .5)");
            return true;
        }
        return false;
    });
    if (!list?.length) return toast("全部达标");

    console.log(list)

    Aj.showProgress();

    let promiseArr = list.map(async (item) => {
        let romPrice = 0
        if(item?.qviews < 150){
            romPrice = (item.cpm * 0.1).toFixed(2)
        } else if(item?.qviews < 350){
            romPrice = (item.cpm * 0.05).toFixed(2)
        } else {
            romPrice = (item.cpm * 0.01).toFixed(2)
        }
        let price = (item.cpm + +romPrice).toFixed(2);
        return await editCPM(item, price);
    });

    // 开始报价
    let promiseRes = await Promise.all(promiseArr); // 等待所有任务完成

    let successNum = promiseRes.filter((flag) => flag)?.length;
    let errorNum = promiseRes.filter((flag) => !flag)?.length;

    Aj.hideProgress();
    toast(`加价完成：成功${successNum}条，失败${errorNum}条`);
    await onRefresh();
}

// 设置单价
$("body").on(
    "click",
    'td[style="display:var(--coldp-cpm,table-cell)"] a',
    async function (e) {
        e.preventDefault();
        e.stopPropagation();

        let list = OwnerAds.getAdsList();
        let ad_id = $(this).attr("href")?.split("/")?.[3];
        if (!ad_id) return false;

        const item = list?.find?.((v) => +v?.ad_id === +ad_id);

        const cpm = await prompt(item?._title || item?.title);
        if (cpm <= 0) return false;

        Aj.showProgress();
        let res = await editCPM(item, cpm);
        Aj.hideProgress();

        if (!res) return toast("设置cpm失败 !");

        await onRefresh();
    }
);

// 一键审核，搜索广告不重审
const onReview = async () => {
    await onRefresh();

    let list = OwnerAds.getAdsList();
    list = list.filter((v) => {
        if (v.status !== "Declined") return false;
        if (v.trg_type === "search") return false;
        v["url"] = `${host}${v.base_url}`;

        return true;
    });

    if (!list.length) {
        toast("没有需要审核的广告 !!!");
        return false;
    }

    let submitPromise = list.map((v, i) => {
        let key = v.tme_path?.split?.("?")?.[0];
        let texts = getUserText(key, v.text);
        if (texts?.length) {
            return new Promise((resolve) => {
                let params = {
                    owner_id: Aj.state.ownerId,
                    ad_id: v.ad_id,
                    title: v?.["_title"] || v?.title,
                    text: texts[getRNum(0, texts.length - 1, 0)], // 文案
                    promote_url: `t.me/${v.tme_path}`, // 推广链接
                    website_name: "",
                    website_photo: "",
                    media: "",
                    ad_info: "",
                    cpm: v.cpm,
                    daily_budget: 0,
                    active: 1,
                    views_per_user: getRNum(1, 4), // 观看次数
                };
                Aj.apiRequest("editAd", params, function (result) {
                    if (result.error) {
                        resolve(false);
                    }
                    resolve(true);
                });
            });
        } else {
            return false;
        }
    });

    submitPromise = submitPromise?.filter?.((v) => v);

    Aj.showProgress();

    let submitArr = await Promise.all(submitPromise); // 等待所有任务完成

    let successNum = submitArr.filter((flag) => flag)?.length;
    let errorNum = submitArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();

    toast(`审核完成：成功${successNum}条，失败${errorNum}条`);

    await onRefresh();
};

// 替换文案
const onReplace = async () => {
    let list = OwnerAds.getAdsList();
    list = list.filter((v) => {
        if (v.status !== "In Review") return false;
        v["url"] = `${host}${v.base_url}`;

        return true;
    });

    if (!list.length) {
        toast("没有需要审核的广告 !!!");
        return false;
    }

    let submitPromise = list.map((v, i) => {
        let key = v.tme_path?.split?.("?")?.[0];
        let texts = getUserText(key, v.text);
        return new Promise((resolve) => {
            let params = {
                owner_id: Aj.state.ownerId,
                ad_id: v.ad_id,
                title: v?.["_title"] || v?.title,
                text: texts[getRNum(0, texts.length - 1, 0)], // 文案
                promote_url: `t.me/${v.tme_path}`, // 推广链接
                website_name: "",
                website_photo: "",
                media: "",
                ad_info: "",
                cpm: v.cpm,
                daily_budget: 0,
                active: 1,
                views_per_user: getRNum(1, 4), // 观看次数
            };
            Aj.apiRequest("editAd", params, function (result) {
                if (result.error) {
                    resolve(false);
                }
                resolve(true);
            });
        });
    });

    Aj.showProgress();

    let submitArr = await Promise.all(submitPromise); // 等待所有任务完成

    let successNum = submitArr.filter((flag) => flag)?.length;
    let errorNum = submitArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();

    toast(`替换完成：成功${successNum}条，失败${errorNum}条`);

    await onRefresh();
};

// 一键删除
const onDels = async () => {
    let list = OwnerAds.getAdsList()?.filter((v) => {
        if (v.status === "Declined" && !v?.score) {
            $(`a[href="/account/ad/${v.ad_id}"]`)
                .first()
                .parents("tr")
                .find("td")
                .css("backgroundColor", "rgb(17, 154, 245, .5)");
            return true;
        }
        return false;
    });
    if (!list.length) return toast("暂无可删除广告 !!!");
    if (!(await confirm(`删除数量 ${list.length} 条`))) {
        await onRefresh();
        return false;
    }

    // 拿到 confirm_hash
    let submitDelHashPromise = list.map((v) => {
        let params = { owner_id: Aj.state.ownerId, ad_id: v.ad_id };
        return new Promise((resolve) => {
            Aj.apiRequest("deleteAd", params, (result) => {
                if (result.error) {
                    resolve(false);
                } else {
                    resolve(result.confirm_hash);
                }
            });
        });
    });
    let hashArr = await Promise.all(submitDelHashPromise);

    // 二次确认删除
    let submitDelPromise = hashArr.filter((v, i) => {
        if (!v) return false;

        let params = {
            owner_id: Aj.state.ownerId,
            ad_id: list[i].ad_id,
            confirm_hash: v,
        };
        return new Promise((resolve) => {
            Aj.apiRequest("deleteAd", params, (result) => {
                if (result.ok) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    });

    if (!submitDelPromise.length) return toast("广告冷却中, 请稍后删除 !!!");

    Aj.showProgress();

    let submitDelArr = await Promise.all(submitDelPromise); // 等待所有任务完成
    let successNum = submitDelArr.filter((flag) => flag)?.length;
    let errorNum = submitDelArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();

    toast(
        `删除广告：成功${successNum}条，失败${errorNum}条, ${list.length - successNum - errorNum
        }条正在冷却`,
        async () => {
            await onRefresh();
        }
    );
};

// 判断时间 s 级别时间戳, 是否大于指定天数
const isTimeExpired = (timestampInSeconds, days = 30) => {
    if (typeof timestampInSeconds !== "number" || typeof days !== "number") {
        console.error("参数必须是数字");
        return false;
    }

    const now = Date.now(); // 当前时间戳（毫秒）
    const inputTime = timestampInSeconds * 1000; // 转为毫秒
    const msInDay = 24 * 60 * 60 * 1000;

    return now - inputTime > days * msInDay;
};

// 删除创建15天无浏览量帖子
const onDelsViews = async () => {
    let list = OwnerAds.getAdsList()?.filter((v) => {
        if (
            isTimeExpired(+v.date, 15) &&
            +v.views === 0 &&
            (v.status === "In Review" || v.status === "Declined")
        ) {
            $(`a[href="/account/ad/${v.ad_id}"]`)
                .first()
                .parents("tr")
                .find("td")
                .css("backgroundColor", "rgb(17, 154, 245, .5)");
            return true;
        }
        return false;
    });
    if (!list.length) return toast("暂无可删除广告 !!!");
    if (!(await confirm(`删除数量 ${list.length} 条`))) {
        await onRefresh();
        return false;
    }

    // 拿到 confirm_hash
    let submitDelHashPromise = list.map((v) => {
        let params = { owner_id: Aj.state.ownerId, ad_id: v.ad_id };
        return new Promise((resolve) => {
            Aj.apiRequest("deleteAd", params, (result) => {
                if (result.error) {
                    resolve(false);
                } else {
                    resolve(result.confirm_hash);
                }
            });
        });
    });
    let hashArr = await Promise.all(submitDelHashPromise);

    // 二次确认删除
    let submitDelPromise = hashArr.filter((v, i) => {
        if (!v) return false;

        let params = {
            owner_id: Aj.state.ownerId,
            ad_id: list[i].ad_id,
            confirm_hash: v,
        };
        return new Promise((resolve) => {
            Aj.apiRequest("deleteAd", params, (result) => {
                if (result.ok) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    });

    if (!submitDelPromise.length) return toast("广告冷却中, 请稍后删除 !!!");

    Aj.showProgress();

    let submitDelArr = await Promise.all(submitDelPromise); // 等待所有任务完成
    let successNum = submitDelArr.filter((flag) => flag)?.length;
    let errorNum = submitDelArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();

    toast(
        `删除广告：成功${successNum}条，失败${errorNum}条, ${list.length - successNum - errorNum
        }条正在冷却`,
        async () => {
            await onRefresh();
        }
    );
};

// 关键字
const onTargetQuerySearch = (value) => {
    return new Promise((resolve) => {
        Aj.apiRequest(
            "searchTargetQuery",
            {
                query: value,
            },
            function (result) {
                if (result.error) {
                    resolve(false);
                }
                if (result.query) {
                    let html = new DOMParser().parseFromString(
                        result.query.sample_results,
                        "text/html"
                    );
                    if ($(html).find(".empty").length > 0) {
                        resolve(false);
                    } else {
                        let item = {
                            val: result.query.id,
                            name: result.query.title,
                            sample_results: result.query.sample_results,
                        };
                        resolve(item);
                    }
                }
            }
        );
    });
};

// 发布搜索广告
const onSearchADS = async () => {
    if (getMoney() < 2) return toast("余额过低");

    let keys = $(".urls").value();
    const regex = /^[A-Za-z0-9\u4e00-\u9fa5@]{4,}$/;
    if (!keys.length) return toast("请先设置搜索关键词");

    keys = keys.split(/\r?\n/);
    keys = keys.filter((item) => regex.test(item));

    if (!keys.length) return toast("已剔除不符合的关键词，剩余0条符合");
    if ($(".select").val() === "jbtg")
        return toast("搜索广告只能发频道，请切换类型");

    keys = keys.length > 10 ? keys.slice(0, 10) : keys;
    let keyPromise = keys.map(async (key) => await onTargetQuerySearch(key));
    let searchArr = await Promise.all(keyPromise); // 查询所有的关键词

    // 随机设置单价
    let minPrice = parseFloat($("#minPrice").val());
    let maxPrice = parseFloat($("#maxPrice").val());

    // 随机设置总预算
    let minBudget = parseFloat($("#minBudget").val());
    let maxBudget = parseFloat($("#maxBudget").val());

    let title = keys[0];
    let ids = [];
    searchArr.map((v) => {
        ids.push(v.val);
    });

    // 准备参数
    let params = {
        owner_id: Aj.state.ownerId, //  owner_id
        title: title, // 标题
        text: "", // 文案
        promote_url: getUserUrl(), // 推广频道链接
        website_name: "", // ’‘
        website_photo: "", // ''
        media: "", // ''
        ad_info: "", // ''
        cpm: getRNum(minPrice, maxPrice, 1), // 单价
        views_per_user: getRNum(1, 4), // 观看次数
        budget: getRNum(minBudget, maxBudget), // 总预算
        daily_budget: 0, // 0
        active: 1, // 1
        target_type: "search", // bots
        channels: "",
        bots: "",
        search_queries: ids.join(";"),
        method: "createAd",
    };

    let createAd = async (params) => {
        return new Promise((resolve) => {
            Aj.apiRequest("createAd", params, (result) => {
                if (result.error) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    };

    // 发送请求
    Aj.showProgress();

    NewAd.saveDraftAuto(true);
    let sendFlag = await createAd(params);

    Aj.hideProgress();

    if (sendFlag) {
        NewAd.saveDraftAuto(true);
        toast("发布成功 !!!");
        $(".urls").val("");
        await onRefresh();
    }
};

// 查询频道 / 机器人
const searchChannel = (isBot, value) => {
    return new Promise((resolve, reject) => {
        Aj.apiRequest(
            isBot ? "searchBot" : "searchChannel",
            {
                owner_id: Aj.state.ownerId,
                query: value,
            },
            (result) => {
                if (result.error) {
                    resolve(false);
                    return false;
                }
                if (result.ok) {
                    let item = {
                        val: isBot ? result.bot.id : result.channel.val,
                        name: isBot ? result.bot.title : result.channel.name,
                        photo: isBot ? result.bot.photo : result.channel.photo,
                        username: isBot ? result.bot.username : result.channel.username,
                    };
                    resolve(item);
                } else {
                    resolve(false);
                }
            },
            (err) => {
                console.log("请求错误", err);
                resolve(false);
            }
        );
    });
};

// 发布单通道广告
const sendChannel = async () => {
    if (getMoney() < 2) return toast("余额过低");
    let urls = $(".urls").value();
    if (!urls.length) return toast("请先设置频道/机器人链接");

    urls = urls.split(/\r?\n/);

    let texts = getUserText();
    let createAd = async (url) => {
        let isBot = /bot$/i.test(url);
        let channelinfo = await searchChannel(isBot, url);
        if (!channelinfo) {
            isBot = true
            channelinfo = await searchChannel(isBot, url);
            if (!channelinfo) {
                return false;
            }
        }

        return new Promise(async (resolve) => {
            // 随机设置单价
            let minPrice = parseFloat($("#minPrice").val());
            let maxPrice = parseFloat($("#maxPrice").val());

            // 随机设置总预算
            let minBudget = parseFloat($("#minBudget").val());
            let maxBudget = parseFloat($("#maxBudget").val());

            let name = channelinfo?.name?.replace(/<[^>]+>/g, "");
            name = name.replace(/[\u{1D400}-\u{1D7FF}]/gu, "");

            let title = name?.length > 19 ? name?.slice(0, 19) : name;
            let id = channelinfo?.val;

            // 准备参数
            let params = {
                owner_id: Aj.state.ownerId, //  owner_id
                title: title, // 标题
                text: texts[getRNum(0, texts.length - 1, 0)], // 文案
                button: undefined, // undefined
                promote_url: getUserUrl(), // 推广链接
                website_name: "", // ’‘
                website_photo: "", // ''
                media: "", // ''
                ad_info: "", // ''
                cpm: getRNum(minPrice, maxPrice, 1), // 单价
                views_per_user: getRNum(1, 4), // 观看次数
                budget: getRNum(minBudget, maxBudget), // 总预算
                daily_budget: 0, // 0
                active: 1, // 1
                target_type: isBot ? "bots" : "channels", // bots
                device: undefined, // undefined
            };

            if (isBot) {
                params["bots"] = id;
            } else {
                params["channels"] = id;
            }
            Aj.apiRequest(
                "createAd",
                params,
                (result) => {
                    if (result?.error) {
                        resolve(false);
                        return false;
                    } else {
                        resolve(true);
                    }
                },
                (err) => {
                    console.log("请求错误", err);
                    resolve(false);
                }
            );
        });
    };

    Aj.showProgress();

    let sendPromise = urls.map(async (url) => createAd(url));
    let sendArr = await Promise.all(sendPromise); // 创建所有广告
    let successNum = sendArr.filter((flag) => flag)?.length;
    let errorNum = sendArr.filter((flag) => !flag)?.length;

    Aj.hideProgress();
    $(".urls").val("");
    toast(`广告发布：成功${successNum}条，失败${errorNum}条`);
    await onRefresh();
};

// 发布多通道广告
const sendMoreChannel = async () => {
    if (getMoney() < 2) return toast("余额过低");
    let urls = $(".urls").value();
    if (!urls.length) return toast("请先设置频道/机器人链接");

    // 随机设置单价
    let minPrice = parseFloat($("#minPrice").val());
    let maxPrice = parseFloat($("#maxPrice").val());

    // 随机设置总预算
    let minBudget = parseFloat($("#minBudget").val());
    let maxBudget = parseFloat($("#maxBudget").val());

    urls = urls.split(/\r?\n/);
    let isBot = /bot$/i.test(urls?.[0]);

    // 查询频道 或 帖子, 获取标题和ID
    let channelPromise = urls.map(async (v) => await searchChannel(isBot, v));
    let channelArr = await Promise.all(channelPromise); // 查询所有通道

    let title = "";
    let ids = [];
    channelArr.map((v) => {
        if (!title.length) {
            let name = v.name.replace(/<[^>]+>/g, "");
            title = name.length > 19 ? name.slice(0, 19) : name;
        }
        ids.push(v.val);
    });

    // 准备参数
    let texts = getUserText();
    let params = {
        owner_id: Aj.state.ownerId, //  owner_id
        title: title, // 标题
        text: texts[getRNum(0, texts.length - 1, 0)], // 文案
        button: undefined, // undefined
        promote_url: getUserUrl(), // 推广链接
        website_name: "", // ’‘
        website_photo: "", // ''
        media: "", // ''
        ad_info: "", // ''
        cpm: getRNum(minPrice, maxPrice, 1), // 单价
        views_per_user: getRNum(1, 4), // 观看次数
        budget: getRNum(minBudget, maxBudget), // 总预算
        daily_budget: 0, // 0
        active: 1, // 1
        target_type: isBot ? "bots" : "channels", // bots
        device: undefined, // undefined
    };

    if (isBot) {
        params["bots"] = ids.join(";");
    } else {
        params["channels"] = ids.join(";");
    }

    let createAd = async (params) => {
        return new Promise((resolve) => {
            Aj.apiRequest("createAd", params, (result) => {
                if (result.error) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    };

    // 发送请求
    Aj.showProgress();

    NewAd.saveDraftAuto(true);
    let sendFlag = await createAd(params);

    Aj.hideProgress();

    if (sendFlag) {
        NewAd.saveDraftAuto(true);
        toast("发布成功 !!!");
        $(".urls").val("");
        await onRefresh();
    }
};

// 提取数据
const extractMiddleMultiple = (str, start, end) => {
    const regex = new RegExp(start + "(.*?)" + end, "g");
    let matches = [];
    let match;

    while ((match = regex.exec(str)) !== null) {
        matches.push(JSON.parse(match[1]));
    }

    return matches;
};

// 动态创建一个弹窗
const showIframePopup = async (url) => {
    if ($("#popupOverlay").length) {
        $("#popupOverlay").remove();
    }

    console.log(`${url}?period=day`)

    let data = await getHTML(`${url}?period=day`, "j", false);
    let code = data[0]["j"];
    let array = extractMiddleMultiple(code, 'columns":', ',"types');
    let dates = array[0]?.[0] || [];
    let views = array[0]?.[1] || [];
    let clicks = array[0]?.[2] || [];
    let joins = array[0]?.[3] || [];
    let total = array[1]?.[1] || [];

    // 如果不够当日8点, 往最后一天插入一个时间戳
    const now = new Date();
    const eightAM = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        8,
        0,
        0,
        0
    );
    if (now < eightAM) {
        const timestamp = eightAM.getTime();
        dates.push(timestamp);
        views.push(0);
        clicks.push(0);
        joins.push(0);
        total.push(0);
    }

    if (!dates?.length) {
        return toast("暂无数据 !!!");
    }

    let ad_id = url?.split("/")?.[3];
    let cpms = await filterDB((item) => +item?.ad_id === +ad_id);
    console.log("cpms", cpms);

    const res = [];
    const rangLen = 15;
    for (let i = dates?.length - 1; i >= 0; i--) {
        if (i !== 0) {
            if (res.length >= rangLen) {
                break;
            } else {
                let date = timestampToDate(dates[i]);
                let tmp = [];
                let tmp1 = [];
                const cpmArr = cpms.map((v) => {
                    const dateArr = v.createDate.split(" ");
                    if (date === dateArr[0]) {
                        tmp.push(`${dateArr[1]}: ${v.float} = ${v.cpm}`);
                        tmp1.push(v.float);
                    }
                });
                res.push({
                    date: date,
                    cpm: tmp,
                    float: tmp1,
                    view: views?.[i] || 0,
                    click: clicks?.[i] || 0,
                    join: joins?.[i] || 0,
                    total: +(total[i] / 1000000).toFixed(4),
                });
            }
        }
    }

    let tableHtml = `<table width="100%" border><thead><tr>
            <th style="padding: 5px 12px;">日期</th>
            <th style="padding: 5px 12px;">CPM</th>
            <th style="padding: 5px 12px;">展示</th>
            <th style="padding: 5px 12px;">点击</th>
            <th style="padding: 5px 12px;">加入</th>
            <th style="padding: 5px 12px;">消耗</th>
        </tr></thead><tbody>`;
    res?.map((v) => {
        tableHtml += `
                <tr>
                    <td style="padding: 5px 12px;">${v.date}</td>
                    <td style="padding: 5px 12px;">`;

        v?.cpm?.map?.((z, i) => {
            tableHtml += `
                    <div>
                        ${z.slice(0, 9)}
                        <span style="color: ${+v.float[i] > 0 ? "red" : "green"
                };">
                        ${z.slice(10, z.length)}
                        </span>
                    </div>
                `;
        });

        tableHtml += `</td>
                <td style="padding: 5px 12px;">${v.view}</td>
                <td style="padding: 5px 12px;">${v.click}</td>
                <td style="padding: 5px 12px;">${v.join}</td>
                <td style="padding: 5px 12px;">${v.total}</td>
                </tr>
            `;
    });
    tableHtml += `</tbody></table>`;

    // 创建遮罩和弹窗内容
    const popup = $(`
        <div id="popupOverlay" style="position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;">
            <div id="popupBody" style="background: white; padding: 30px; width: 40%; border-radius: 10px; overflow: hidden; position: relative;">
            ${tableHtml}
            <button id="closePopup" style="position: absolute; top: 10px; right: 10px; background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">关闭</button>
            </div>
        </div>
        `);

    // 加入页面
    $("body").append(popup);

    // 在 iframe 加载后，隐藏内部 DOM 元素
    $("#iframePopup").on("load", async function () {
        // 只有当 iframe 加载完成后才可以操作它的内容
        const iframeDoc = $(this)[0].contentWindow.document;

        $(iframeDoc)
            .find(".nav-pills")
            .eq(1)
            .find("li")
            .last()
            .find("a")[0]
            .click();
        // $(iframeDoc).find('[data-label="Views"]').click()
        // $(iframeDoc).find('[data-label="Clicks"]').click()

        await sleep(1000);

        $(iframeDoc).find(".pr-header").hide();
        $(iframeDoc).find(".pr-page-tabs").hide();
        $(iframeDoc).find(".pr-review-ad").hide();
    });

    // 绑定关闭按钮
    $("#closePopup").on("click", () => {
        $("#popupOverlay").remove();
    });
    // $('#popupBody').on('mouseleave', () => {
    //     $('#popupOverlay').remove();
    // });
};

// 双击展示报表
$("body").on("dblclick", "tbody>tr", function (event) {
    let url = $(this)
        ?.find('[style*="display:var(--coldp-views,table-cell)"] a')
        ?.attr("href");
    showIframePopup(url);
}).on("contextmenu", "tbody>tr .pr-cell-title", function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    let href = $(this)?.find?.("small a")?.text?.();
    let ads = href?.split("_");
    ads = ads?.[ads?.length - 1];
    copyText(ads);
});

// 更新观看量
const updatePviews = async () => {
    let list = OwnerAds?.getAdsList?.() || [];
    const date = timestampToDate()
    for (let i = 0; i < list.length; i++) {
        const { ad_id, cpm, views, clicks, joins, pays, money } = list[i]
        let res = await getDB('ads_date', `${date}_${ad_id}`, pviews_store)
        let data = {}
        if(res){
            data = {...res, cpm, views, clicks, joins, pays, money}
        } else {
            data = { ads_date: `${date}_${ad_id}`, ad_id,  cpm, views, clicks, joins, pays, money }
        }
        await setDB(data, pviews_store)
    }
}

// 每到0 和 30分的时候自动执行一次加预算
async function runMyTask() {
    await addMountFn();

    if (![...FTChannel, ...JBChannel, ...DBChannel].includes(user)) {
        await onReview();
    }

    await updatePviews()
}
(function loop() {
    requestAnimationFrame(loop);

    const now = new Date();
    const min = now.getMinutes();
    const sec = now.getSeconds();

    // 判断分钟是5、15、30、45、59并且秒数在0~1之间（防止多次触发）
    if ([15, 30, 45, 59].includes(min) && sec === 0) {
        if (!loop.lastTrigger || loop.lastTrigger !== `${now.getHours()}-${min}`) {
            loop.lastTrigger = `${now.getHours()}-${min}`;
            runMyTask();
        }
    }
})();


