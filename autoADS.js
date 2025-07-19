(async () => {
    "use strict";
    const {
        fbtg,
        tstg,
        accountAll,
        texts,
        GQText,
        copyText,
        guid,
        getRNum,
        sleep,
        date,
        timestampToDate,
        minViews,
    } = autoADSData;
    const db = window.db;
    const cpms_store = window.cpms_store; // 记录单价
    const pviews_store = window.pviews_store; // 记录展示量

    const postDate = await window.get("/user/getAccoutPost", {
        ads: autoADSData?.["accountAll"]?.[window.user]?.["en"],
    });
    window.postData = postDate?.data || [];

    // 获取近3日的浏览数据
    const viewListTmp = await window.get("/ads/getAdsDailyStats", {
        ads: accountAll?.[window.user]?.["en"],
    });
    const viewList = viewListTmp?.data || [];

    console.log("静态数据", autoADSData);
    console.log("帖子数据", window.postData);
    console.log("浏览数据", viewList);

    window.isLoad = false;

    let animationFrameId;
    var timerID = null;
    var host = "https://ads.telegram.org";

    var maxWidth = "100%";
    var loadADSFlag = false;

    // 生成用户名ID
    const getShortId = async (url) => {
        const BASE62 =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        const toBase62 = (num) => {
            let result = "";
            while (num > 0) {
                result = BASE62[num % 62] + result;
                num = Math.floor(num / 62);
            }
            return result.padStart(6, "a");
        };

        const extractShortKey = (url) => {
            try {
                url = url.replace(/@/g, "");
                const u = new URL(url);
                const parts = u.pathname.split("/").filter(Boolean);
                if (parts.length === 0) return url;
                if (parts[0] === "joinchat" && parts[1]) return parts[1];
                return parts[0];
            } catch {
                return url;
            }
        };

        const generateShortIdFromString = async (input, length = 6) => {
            const key = extractShortKey(input);

            // 将 key 转为 Uint8Array
            const encoder = new TextEncoder();
            const data = encoder.encode(key);

            // 生成 sha256 hash
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = new Uint8Array(hashBuffer);

            // 截取前 6 字节用于转换
            const slice = hashArray.slice(0, 6);
            const hex = Array.from(slice)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            const num = parseInt(hex, 16);

            return toBase62(num).slice(0, length);
        };

        const shortId = await generateShortIdFromString(url);
        return shortId;
    };

    // 按状态排序
    const statusOrder = {
        "In Review": 1, // 待审
        Declined: 2, // 拒绝
        Active: 3, // 通过
        "On Hold": 4, // 暂停
        Stopped: 5, // 预算不足
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

    // 不保底线性置信度（真实占比）
    const rawConfidence = (value, threshold) => {
        if (typeof value !== "number" || isNaN(value)) return 0;
        return Math.min(value / threshold, 1);
    };

    // 安全除法
    const safeDiv = (a, b) => {
        if (!b || isNaN(a) || isNaN(b)) return 0;
        return a / b;
    };

    // 主评分函数
    const scoreAd = (ad) => {
        const {
            views = 0,
            clicks = 0,
            regs = 0,
            pays = 0,
            money = 0,
            ctr = 0,
            cvr = 0,
        } = ad;

        const regRate = safeDiv(regs, clicks); // 注册转化率

        // 各项得分（总分100）
        const moneyScore = Number((40 * rawConfidence(money, 300)).toFixed(2));
        const paysScore = Number((30 * rawConfidence(pays, 10)).toFixed(2));
        const regsScore = Number((20 * rawConfidence(regs, 30)).toFixed(2));
        const cvrScore = cvr
            ? Number(Math.min(5, (cvr / 100) * 5 * 2).toFixed(2))
            : 0;
        const ctrScore = ctr
            ? Number(Math.min(5, (ctr / 100) * 5 * 5).toFixed(2))
            : 0;

        const total = Number(
            (moneyScore + paysScore + regsScore + cvrScore + ctrScore).toFixed(
                2
            )
        );

        let suggestion = "";
        if (total >= 85) {
            suggestion = "✅ 表现优异，建议加大预算扩大投放";
        } else if (total >= 70) {
            suggestion = "🟡 效果良好，建议继续投放并微调素材";
        } else if (total >= 50) {
            suggestion = "🔻 效果一般，建议调低出价或调整受众";
        } else {
            suggestion = "⛔ 效果较差，建议暂停投放或大幅重构";
        }

        return {
            score: total,
            suggestion,
            details: {
                moneyScore,
                paysScore,
                regsScore,
                cvrScore,
                ctrScore,
            },
        };
    };

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
            },
        }).css({
            width: "100%",
            marginBottom: "5px",
            padding: "5px",
            fontSize: "12px",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "5px",
            cursor: "pointer",
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
        accountAll?.[window.user]?.options?.map?.((v) => {
            $select.append(
                $(`<option value="${v.tgname}">${v.label}</option>`)
            );
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

        Object.keys(GQText).map((v) =>
            $GQSelet.append($(`<option value="${v}">${v}</option>`))
        );

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
                <input type="number" id="maxBudget" class="budget-input" style="flex: 1; border: 1px solid #ccc; width: 40px;" value="5" min="1" max="50" step="1">
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
                !fbtg?.includes?.(window.user) &&
                !tstg?.includes?.(window.user) &&
                ["textTeviewBtn"].includes(className)
            ) {
                return null;
            } else if (
                (fbtg?.includes?.(window.user) ||
                    tstg?.includes?.(window.user)) &&
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
            // createButton("帖子同步", "syncAds", () => syncAdsAll()),
            createButton("单链发布", "newADBtn", () => sendChannel()),
            createButton("多链发布", "sendMoreUrl", () => sendMoreChannel()),
            createButton("搜索广告", "searchADSBtn", () => onSearchADS()),
            createButton("一键重审", "reviewBtn", async () => onReview()),
            createButton("加预算", "addMount", async () => addMountFn()),
            createButton("待审核文案替换", "textTeviewBtn", async () =>
                onReplace()
            ),
            createButton("删除0评分审核失败", "delBtn", async () => onDels()),
            createButton("提价(曝光不足)", "proPrice", async () =>
                onProPrice()
            ),
            createButton("提价(曝光达标)", "proPrice", async () =>
                onProAddPrice()
            ),
            createButton("刷新页面", "refreshBtn", async () => onRefresh()),
            createButton("筛选低评分广告", "refreshBtn", async () =>
                onFilter()
            ),
            // createButton("替换机器人", "replaceBotBtn", async () => onReplaceBot()),
            createButton("筛选英文名广告", "refreshBtn", async () =>
                onGetENFilter()
            ),
            createButton("今日数据", "getTodayData", async () =>
                onGetTodayData()
            ),
            createButton("机器人投放检测", "botVerify", async () =>
                onBotVerify()
            ),
        ];

        // 添加元素到容器
        $container.append(
            $textArea,
            $select,
            accountAll?.[window.user]?.options?.find?.(
                (v) => v?.tgname === "jbgq"
            )
                ? $GQSelet
                : null, // 公群添加行业
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
            url.search +=
                (url.search ? "&" : "?") + "l=" + encodeURIComponent(l);
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
            curOnLoad.push(func);
        }

        function onUnload(func) {
            curOnUnload.push(func);
        }

        function onLayerLoad(func) {
            curOnLayerLoad.push(func);
        }

        function onLayerUnload(func) {
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
                    curOnLayerLoad[i](Aj.layerState);
                }
            }
            onLayerUnload(function () {
                Aj.layer.off(".curLayer");
            });
            Aj.layer.one("popup:close", function () {
                if (curOnLayerUnload.length) {
                    for (var i = 0; i < curOnLayerUnload.length; i++) {
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
            var saved_lcl =
                !Aj.layer || !push_state ? layerCloseLocation : false;
            underLayerTitle = false;
            layerCloseLocation = false;
            closeAllPopups();
            underLayerTitle = saved_ult;
            layerCloseLocation = saved_lcl;

            if (result.h) {
                if (curOnUnload.length) {
                    for (var i = 0; i < curOnUnload.length; i++) {
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
                    window.execScript
                        ? window.execScript(result.j)
                        : eval(result.j);
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
                    window.execScript
                        ? window.execScript(result.j)
                        : eval(result.j);
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
            } else {
                history.pushState(
                    { i: curHistoryState.i + 1, u: url },
                    null,
                    short_url
                );
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
                showConfirm(
                    message_html,
                    load_func,
                    l("WEB_LEAVE_PAGE", "Leave")
                );
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
        init: function () {
            var cont = window.Aj.ajContainer;
            window.Aj.onLoad(function (state) {
                state.$searchField = $(".pr-search-input");
                state.$adsListTable = $(".pr-table");
                state.$searchResults = $(".pr-table tbody");
                Ads.fieldInit(state.$searchField);
                cont.on("click.curPage", ".pr-cell-sort", OwnerAds.eSortList);
                cont.on(
                    "click.curPage",
                    ".pr-table-settings",
                    OwnerAds.eSettingsOpen
                );
                cont.on("click.curPage", ".js-clone-ad-btn", EditAd.eCloneAd);
                cont.on("click.curPage", ".delete-ad-btn", EditAd.deleteAd);
                state.$tableColumnsPopup = $(".js-table-columns-popup");
                state.$tableColumnsForm = $(".js-table-columns-form");
                state.$tableColumnsForm.on(
                    "change.curPage",
                    "input.checkbox",
                    OwnerAds.eColumnChange
                );
                state.$tableColumnsForm.on("submit.curPage", preventDefault);

                state.$searchField.initSearch({
                    $results: state.$searchResults,
                    emptyQueryEnabled: true,
                    updateOnInit: true,
                    resultsNotScrollable: true,
                    itemTagName: "tr",
                    enterEnabled: function () {
                        return false;
                    },

                    renderItem: function (item, query) {
                        var status_attrs =
                            ' href="' +
                            item.base_url +
                            item.status_url +
                            '" ' +
                            (item.status_attrs || "data-layer");
                        var title_class = "pr-trg-type-" + item.trg_type;
                        if (item.tme_path) {
                            var promote_url = "https://t.me/" + item.tme_path;
                            var promote_url_text = "t.me/" + item.tme_path;
                            var promote_link =
                                '<a href="' +
                                promote_url +
                                '" target="_blank">' +
                                promote_url_text +
                                "</a>";
                        } else if (item.promote_url) {
                            var promote_url = item.promote_url;
                            var promote_url_text = promote_url
                                .replace(/^https?:\/\//, "")
                                .replace(/\/$/, "");
                            var promote_link =
                                '<a href="' +
                                promote_url +
                                '" target="_blank">' +
                                promote_url_text +
                                "</a>";
                        } else {
                            var promote_url = "#";
                            var promote_url_text = l("WEB_ADS_NO_TME_LINK");
                            var promote_link =
                                '<span class="pr-no-tme-link">' +
                                promote_url_text +
                                "</span>";
                        }
                        var actions =
                            item.actions !== false
                                ? formatNumber(item.actions)
                                : "–";
                        var opens =
                            item.opens !== false
                                ? formatNumber(item.opens)
                                : "–";
                        var clicks =
                            item.clicks !== false
                                ? formatNumber(item.clicks)
                                : "–";
                        var ctr = item.ctr !== false ? item.ctr + "%" : "–";
                        var cpc =
                            item.cpc !== false ? Ads.wrapAmount(item.cpc) : "–";
                        var cps =
                            item.cps !== false ? Ads.wrapAmount(item.cps) : "–";
                        var cpa =
                            item.cpa !== false ? Ads.wrapAmount(item.cpa) : "–";
                        var daily_spent =
                            item.daily_spent !== false
                                ? "<small><br>" +
                                  Ads.wrapAmount(item.daily_spent) +
                                  "</small>"
                                : "";
                        var daily_budget =
                            item.daily_budget !== false
                                ? '<small><br><a href="' +
                                  item.base_url +
                                  '/edit_daily_budget" data-layer>' +
                                  Ads.wrapAmount(item.daily_budget) +
                                  "</a></small>"
                                : "";
                        var sugges =
                            item.score >= 80
                                ? "↑"
                                : item.score >= 70
                                ? "-"
                                : item.score > 50
                                ? "↓"
                                : item.score <= 30
                                ? "x"
                                : "";
                        return `<td>
                            <div class="pr-cell pr-cell-title ${title_class}" style="position: relative; padding-left: 30px;">
                                <span style="position: absolute; top: 7px; left: 18px;
                                color: ${
                                    ["x", "↑"].includes(sugges)
                                        ? "red;"
                                        : sugges == "↓"
                                        ? "green;"
                                        : ";"
                                }">${sugges}</span>
                                <a href="${item.base_url}" class="pr-link">${
                            item.title
                        }</a>
                                <small style="display:var(--coldp-url,inline)"><br>${promote_link}</small>
                            </div>
                        </td>

                        ${
                            accountAll?.[window.user]?.options?.length === 1
                                ? `
                                <td><div class="pr-cell score">${
                                    item.score || ""
                                }</div></td>
                                <td><div class="pr-cell regs">${
                                    item.regs || ""
                                }</div></td>
                                <td><div class="pr-cell pays">${
                                    item.pays || ""
                                }</div></td>
                                <td><div class="pr-cell money">${
                                    item.money || ""
                                }</div></td>
                            `
                                : ""
                        }
                        
                        <td><div class="pr-cell qviews" style="color: ${
                            +item?.qviews < +minViews ? "green" : ""
                        };">${formatNumber(item?.qviews) || ""}</div></td>
                        <td><div class="pr-cell pviews">${Ads.wrapAmount(
                            item?.qspent
                        )}</div></td>
                        <td><div class="pr-cell pviews" style="color: ${
                            +item?.pviews < +item?.qviews ? "red" : ""
                        };">${formatNumber(item?.pviews) || ""}</div></td>
                        <td><div class="pr-cell pviews">${Ads.wrapAmount(
                            item?.pspent
                        )}</div></td>

                        <td style="display:var(--coldp-views,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${formatNumber(
                            item.views
                        )}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-opens,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${opens}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-clicks,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${clicks}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-actions,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${actions}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-ctr,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${ctr}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-cpm,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/edit_cpm" data-layer>${Ads.wrapAmount(
                            item.cpm
                        )}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-cpc,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${cpc}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-cpa,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${cpa}</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-spent,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/stats" class="pr-link">${
                            Ads.wrapAmount(item.spent) + daily_spent
                        }</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-budget,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }/edit_budget" data-layer>${Ads.wrapAmount(
                            item.budget
                        )}</a>
                                ${daily_budget}
                            </div>
                        </td>
                        <td style="display:var(--coldp-target,table-cell)">
                            <div class="pr-cell">
                                <a href="${item.base_url}" class="pr-link">${
                            item.target
                        }</a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-status,table-cell)">
                            <div class="pr-cell">
                                <a ${status_attrs}>
                                ${
                                    [
                                        { status: "Active", label: "通过" },
                                        {
                                            status: "In Review",
                                            label: "审核中",
                                        },
                                        { status: "Declined", label: "拒绝" },
                                        { status: "On Hold", label: "暂停" },
                                        {
                                            status: "Stopped",
                                            label: "预算不足",
                                        },
                                    ].find((v) => v.status === item.status)
                                        ?.label || item.status
                                }
                                </a>
                            </div>
                        </td>
                        <td style="display:var(--coldp-date,table-cell)">
                            <div class="pr-cell">
                                <a href="${
                                    item.base_url
                                }" class="pr-link">${date.formatCustomDate(
                            item.date
                        )}</a>
                            </div>
                        </td>
                        <td>
                            <div class="pr-actions-cell">
                                ${Aj.state.adsDropdownTpl
                                    .replace(/\{ad_id\}/g, item.ad_id)
                                    .replace(/\{promote_url\}/g, promote_url)
                                    .replace(
                                        /\{promote_url_text\}/g,
                                        promote_url_text
                                    )
                                    .replace(/\{ad_text\}/g, item.text)}
                            </div>
                        </td>`;
                    },
                    renderLoading: function () {
                        return (
                            '<tr><td colspan="100" class="pr-cell-empty"><div class="pr-cell">' +
                            l("WEB_OWNER_ADS_LOADING") +
                            "</div></td></tr>"
                        );
                    },
                    renderNoItems: function (query) {
                        if (Aj.state.adsListIsLoading) {
                            return (
                                '<tr><td colspan="100" class="pr-cell-empty-full"><div class="pr-cell">' +
                                l("WEB_OWNER_ADS_LOADING") +
                                "</div></td></tr>"
                            );
                        }
                        return (
                            '<tr><td colspan="100" class="pr-cell-empty-full"><div class="pr-cell">' +
                            l("WEB_OWNER_NO_ADS") +
                            "</div></td></tr>"
                        );
                    },
                    appendToItems: function (query, result_count) {
                        if (Aj.state.adsListIsLoading && result_count > 0) {
                            return (
                                '<tr><td colspan="100" class="pr-cell-empty"><div class="pr-cell">' +
                                l("WEB_OWNER_ADS_LOADING") +
                                "</div></td></tr>"
                            );
                        }
                        return "";
                    },
                    getData: function () {
                        return OwnerAds.getAdsList();
                    },
                });
            });
            window.Aj.onUnload(function (state) {
                Ads.fieldDestroy(state.$searchField);
                state.$searchField.destroySearch();
                state.$tableColumnsForm.off(".curPage");
            });
        },
        eSortList: function (e) {
            var $sortEl = $(this);
            var sortBy = $sortEl.attr("data-sort-by");
            var sortAsc = $sortEl.hasClass("sort-asc");
            if (sortBy == Aj.state.adsListSortBy) {
                Aj.state.adsListSortAsc = !sortAsc;
            } else {
                Aj.state.adsListSortBy = sortBy;
                Aj.state.adsListSortAsc = false;
            }
            OwnerAds.updateAdsList();
            Aj.state.$searchField.trigger("datachange");
        },
        eSettingsOpen: function () {
            openPopup(Aj.state.$tableColumnsPopup, {
                closeByClickOutside: ".popup-no-close",
            });
        },
        eColumnChange: function () {
            var column = $(this).prop("name");
            var checked = $(this).prop("checked");
            Aj.state.$adsListTable.cssProp(
                "--coldp-" + column,
                checked ? "" : "none"
            );
            OwnerAds.submitColumns();
        },
        submitColumns: function () {
            var $form = Aj.state.$tableColumnsForm;
            var active_columns = [];
            for (var i = 0; i < Aj.state.adsListAllColumns.length; i++) {
                var column = Aj.state.adsListAllColumns[i];
                if ($form.field(column).prop("checked")) {
                    active_columns.push(column);
                }
            }
            Aj.apiRequest("saveAdsColumns", {
                columns: active_columns.join(";"),
            });
            return false;
        },
        updateAdsList: function () {
            if (Aj.state.adsList) {
                var sortBy = Aj.state.adsListSortBy;
                var sortAsc = Aj.state.adsListSortAsc;
                $(".pr-cell-sort").each(function () {
                    var $sortEl = $(this);
                    var curSortBy = $sortEl.attr("data-sort-by");
                    $sortEl.toggleClass("sort-active", sortBy == curSortBy);
                    $sortEl.toggleClass(
                        "sort-asc",
                        sortAsc && sortBy == curSortBy
                    );
                });
                Aj.state.adsList.sort(function (ad1, ad2) {
                    var v1 = sortAsc ? ad1 : ad2;
                    var v2 = sortAsc ? ad2 : ad1;

                    return (
                        v1[sortBy] - v2[sortBy] ||
                        v2?.score - v1?.score ||
                        v2?.qviews - v1?.qviews ||
                        v1.date - v2.date
                    );
                });
            }
        },
        processAdsList: async function (result, opts) {
            if (!$(".table > thead > tr .pviews")?.length) {
                $(".table > thead > tr > th:first").after(`
                    ${
                        accountAll?.[window.user]?.options?.length === 1
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
                        `
                            : ""
                    }
                        
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
                `);
            }

            // 获取昨天所有数据
            let yesday = date.getBeijingDateOnly(-1);
            let qianday = date.getBeijingDateOnly(-2);

            opts = opts || {};
            if (result.items) {
                if (!Aj.state.adsList) {
                    Aj.state.adsList = [];
                }
                let list = [];
                for (var i = 0; i < result.items.length; i++) {
                    var item = result.items[i];
                    let ads = getADSKey(item);
                    let rowViews = viewList?.find?.((v) => v?.ads === ads);
                    let tviews = item?.views || 0; // 当前总浏览量
                    let pviews = rowViews?.[yesday]?.["views"] || 0; // 昨日总浏览量
                    let qviews = rowViews?.[qianday]?.["views"] || 0; // 前日总浏览量
                    let pspent = (
                        +item?.spent - (+rowViews?.[yesday]?.["spent"] || 0)
                    ).toFixed(2); // 当日花费
                    let qspent = (
                        (+rowViews?.[yesday]?.["spent"] || 0) -
                        (+rowViews?.[qianday]?.["spent"] || 0)
                    ).toFixed(2); // 昨日花费

                    let post = window.postData?.find?.((v) => v?.ads === ads);
                    if (post) {
                        if (!loadADSFlag) {
                            loadADSFlag = true;
                            $(".pr-logo-title").text(
                                `Telegram Ads 已加载分析数据${window.postData.length}条`
                            );
                        }

                        item["pviews"] = tviews - pviews || 0;
                        item["pspent"] = pspent || 0;
                        item["qviews"] = pviews - qviews || 0;
                        item["qspent"] = qspent || 0;
                        item["regs"] = +post?.regs || 0;
                        item["pays"] = +post?.pays || 0;
                        item["money"] = +post?.money || 0;
                        item["_title"] = item.title;
                    } else {
                        item["pviews"] = tviews - pviews || 0;
                        item["pspent"] = pspent || 0;
                        item["qviews"] = pviews - qviews || 0;
                        item["qspent"] = qspent || 0;
                        item["regs"] = 0;
                        item["pays"] = 0;
                        item["money"] = 0;
                        item["_title"] = item.title;
                    }
                    let scoreInfo = scoreAd(item);
                    item["score"] = scoreInfo?.score?.toFixed(0) || 0;
                    item["scoreDetails"] = scoreInfo?.details || {};
                    item["suggestion"] = scoreInfo?.suggestion;
                    item.base_url = "/account/ad/" + item.ad_id;
                    item._values = [
                        item.title.toLowerCase(),
                        item.tme_path.toLowerCase(),
                    ];
                    list.push(item);
                }
                Aj.state.adsList = [...Aj.state.adsList, ...list];
                Aj.state.adsList.sort((a, b) => {
                    const statusDiff =
                        statusOrder[b.status] - statusOrder[a.status];
                    if (statusDiff !== 0) return statusDiff;

                    const aScore = a?.score || 0;
                    const bScore = b?.score || 0;

                    if (aScore > 0 && bScore <= 0) return -1;
                    if (bScore > 0 && aScore <= 0) return 1;

                    if (aScore > 0 && bScore > 0) {
                        return bScore - aScore; // 分数高的在前
                    }

                    // 分数都为0，用 pays 字段排序（升序）
                    const aqviews = a?.qviews || 0;
                    const bqviews = b?.qviews || 0;

                    return bqviews - aqviews;

                    // (b.score - a.score) || (b.pays - a.pays))
                });
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

                // 空闲时获取花费
                requestIdleCallback(
                    (deadline) => {
                        getMonthTotal();
                        $("#aj_content").css({ width: "89%" });
                        $(".pr-container").css({
                            "max-width": maxWidth,
                            margin: "0 20px",
                        });
                    },
                    { timeout: 2000 }
                );

                window.isLoad = true;
            }
        },
        loadAdsList: function (opts) {
            opts = opts || {};
            Aj.apiRequest(
                "getAdsList",
                {
                    owner_id: Aj.state.ownerId,
                    offset_id: opts.offset,
                },
                function (result) {
                    if (result.error) {
                        if (!opts.retry) opts.retry = 1;
                        else opts.retry++;
                        setTimeout(function () {
                            OwnerAds.loadAdsList(opts);
                        }, opts.retry * 1000);
                    } else {
                        if (opts.retry) {
                            opts.retry = 0;
                        }
                        OwnerAds.processAdsList(result, opts);
                    }
                }
            );
        },
        getAdsList: function () {
            var _data = Aj?.state?.adsList;
            if (_data === false) {
                return false;
            } else if (_data) {
                return _data;
            }
            Aj.state.adsList = false;
            Aj.state.adsListIsLoading = true;
            if (Aj.state.initialAdsList) {
                setTimeout(function () {
                    OwnerAds.processAdsList(Aj.state.initialAdsList);
                }, 10);
            } else {
                OwnerAds.loadAdsList({ offset: 0 });
            }
            return false;
        },
        updateAd: function (ad) {
            if (!Aj.state || !Aj.state.adsList) {
                return;
            }
            var adsList = Aj.state.adsList;
            for (var i = 0; i < adsList.length; i++) {
                if (ad.ad_id == adsList[i].ad_id) {
                    ad.base_url = "/account/ad/" + ad.ad_id;
                    ad._values = [
                        ad.title.toLowerCase(),
                        ad.tme_path.toLowerCase(),
                    ];
                    adsList[i] = ad;
                    OwnerAds.updateAdsList();
                    Aj.state.$searchField.trigger("contentchange");
                    return;
                }
            }
        },
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
                    options.onInputBeforeChange &&
                        options.onInputBeforeChange(value);
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
                    if (isSort.length)
                        return a._score - b._score || a._i - b._i;

                    const statusDiff =
                        statusOrder[a.status] - statusOrder[b.status];
                    if (statusDiff !== 0) return statusDiff;

                    const aScore = a?.score || 0;
                    const bScore = b?.score || 0;

                    if (aScore > 0 && bScore <= 0) return -1;
                    if (bScore > 0 && aScore <= 0) return 1;

                    if (aScore > 0 && bScore > 0) {
                        return bScore - aScore; // 分数高的在前
                    }

                    // 分数都为0，用 pays 字段排序（升序）
                    const aqviews = a?.qviews || 0;
                    const bqviews = b?.qviews || 0;

                    return bqviews - aqviews;

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
                    for (
                        var i = from_index, j = 0;
                        i < result.length && j < render_limit;
                        i++, j++
                    ) {
                        var item = result[i];
                        var tagName = options.itemTagName || "div";
                        var className =
                            "search-item" +
                            (options.itemClass ? " " + options.itemClass : "") +
                            (item.className ? " " + item.className : "");
                        var item_html = `<${tagName} class="${className}" data-i="${i}">
                                ${options.renderItem(item, query)}
                            </${tagName}>`;
                        html += item_html;
                    }
                    curRenderedIndex = i;
                } else {
                    html = options.renderNoItems
                        ? options.renderNoItems(query)
                        : "";
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
                    (options.searchEnabled() &&
                        options.getData(value) === false)
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
                $(".search-item.selected", options.$results).removeClass(
                    "selected"
                );
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
                    options.$enter.toggleClass(
                        "selected",
                        curSelectedIndex === false
                    );
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
                    options.$results.toggleClass(
                        "topscroll",
                        results.scrollTop > 0
                    );
                    options.$results.toggleClass(
                        "bottomscroll",
                        results.scrollTop <
                            results.scrollHeight - results.clientHeight
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
                    if (
                        this.scrollTop >
                        this.scrollHeight - this.clientHeight - 1000
                    ) {
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
                    options.$results.scrollTop(
                        itemTop - (contHeight - itemHeight) / 2
                    );
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
            options.$results.on(
                "mousedown.search",
                ".search-item",
                onItemClick
            );
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
        return mAmount;
    };

    // 等待 jQuery 注入（页面加载）
    if (window.postData.length) {
        $(".pr-logo-title").text(
            `Telegram Ads 存在分析数据${window.postData.length}条`
        );
    }

    // 根据类型获取文案
    const getUserText = (value, text) => {
        let type = value || $(".select")?.val()?.split("?")?.[0] || "";

        // 金貝供需单独处理
        if (type === "jbgq") {
            const classify = $(".GQClassify")?.val();
            if (!text?.length) return GQText[classify];
            for (const key in GQText) {
                if (GQText[key]?.find((v) => v === text)) {
                    return GQText[key];
                }
            }
            return [];
        }

        // 金貝飞投
        if (type === "JB7777_BOT") {
            let emjo = `![😀](tg://emoji?id=6093793027988393802)![😀](tg://emoji?id=6091314909168012709)![😀](tg://emoji?id=6093901746495557133)![😀](tg://emoji?id=6093916216240377552) `;
            if (texts?.[type]?.length) {
                return texts[type].map((v) => emjo + v);
            }
        }

        return texts?.[type] || [];
    };

    // 根据类型获取推广链接
    const getUserUrl = async (url) => {
        let tgname = $(".select")?.val();

        // 先区分账号, 在区分下拉框选项
        if (fbtg?.includes?.(window.user) || tstg?.includes?.(window.user)) {
            const platform = fbtg?.includes?.(window.user)
                ? "JB7777_BOT"
                : tstg?.includes?.(window.user)
                ? "TSYL666bot"
                : "";
            const code = accountAll?.[window.user]?.["code"]; // 推广码
            const source = "ADS"; // 来源
            const accountEN = accountAll?.[window.user]?.["en"] ?? "null"; // 推广账号
            let postID = ""; // 推广ID, 区分单链接(前6(频道用户名id) + 后4(随机文本)) 和 多链接(沿用之前的逻辑),
            if (url?.length) {
                const shortId = await getShortId(url); // 6位数
                const guId = guid(4); // 4位数
                postID = `${shortId}${guId}`;
            } else {
                postID = guid(9);
            }

            if (!platform || !code) return false;
            return `t.me/${platform}?start=${code}_${source}-${accountEN}-${postID}`;
        } else {
            return `t.me/${tgname}`;
        }
    };

    // 获取余额
    const getMoney = () =>
        $(".js-header_owner_budget .pr-link")
            .text()
            .match(/(\d+)(?=\s*\.)/)?.[0] || 0;

    // 刷新
    const onRefresh = async () => {
        window.isLoad = false;
        loadADSFlag = false;
        await updatePviews();
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

    // 获取唯一ads key值
    const getADSKey = (row) => {
        let tmp = row?.tme_path?.split("_") || [];
        let ads = tmp[tmp.length - 1] || "";
        ads = ads?.toLowerCase()?.includes("ads")
            ? ads
            : `ADS-${accountAll?.[window.user]?.["en"]}-${row?.ad_id}`;
        return ads;
    };

    // 帖子同步
    const syncAds = async (arr) => {
        const list = arr?.filter?.((v) => {
            if (!v?.ads?.toLowerCase()?.includes("ads")) return false;
            return true;
        });

        if (list?.some((v) => v?.ads === "" || v?.title === "")) {
            return toast("部分帖子缺少必要参数, 同步失败");
        }

        const res = window.post("/ads/syncAds", { list });
        if (res) {
            toast("帖子同步成功");
        }
    };

    // 同步所有帖子
    const syncAdsAll = async () => {
        let list = OwnerAds.getAdsList();
        list = list?.map((v) => ({
            ads: getADSKey(v),
            title: v?._title || "",
        }));
        await syncAds(list);
        return true;
    };

    // 单条广告增加预算
    const asyncAddAmount = async (row) => {
        let owner_id = Aj.state.ownerId;
        let ad_id = row.ad_id;
        let amount = row.add_budget;
        let params = { owner_id, ad_id, amount, popup: 1 };
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
                    $(".js-header_owner_budget").html(
                        result.header_owner_budget
                    );
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
        let total = 1;
        list = list.filter((v) => {
            if (v.status !== "Active" && v.status !== "Stopped") return false;
            if (v.hasOwnProperty("score")) {
                if (v.score <= 50) {
                    if (+v.budget >= 0.5) return false;
                    v["add_budget"] = 1;
                } else if (v.score <= 80) {
                    if (+v.budget >= 1) return false;
                    v["add_budget"] = 1;
                } else if (v.score <= 100) {
                    if (+v.budget >= 2) return false;
                    v["add_budget"] = 2;
                }
            } else {
                if (+v.actions < 1) {
                    if (v.status === "Stopped") {
                        v["add_budget"] = 0.5;
                    }
                } else if (+v.actions < 10) {
                    if (+v.budget >= 1) return false;
                    v["add_budget"] = 1;
                } else if (+v.actions < 30) {
                    if (+v.budget >= 1) return false;
                    v["add_budget"] = 2;
                } else if (+v.actions < 50) {
                    if (+v.budget >= 3) return false;
                    v["add_budget"] = 3;
                } else {
                    if (+v.budget >= 5) return false;
                    v["add_budget"] = 5;
                }
            }

            v["url"] = `${host}/account?l=account/ad/${v.ad_id}${path}`;
            total += v["add_budget"];
            // $(`a[href="/account/ad/${v.ad_id}"]`)
            //     .first()
            //     .parents("tr")
            //     .find("td")
            //     .css("backgroundColor", "rgb(17, 154, 245, .5)");

            return true;
        });

        if (!list.length) {
            toast("预算充足 !!!");
            return false;
        }

        if (getMoney() < 1) {
            clearInterval(timerID);
            timerID = null;
            toast("余额不足 !!!");
            return false;
        }

        Aj.showProgress();

        for (const row of list) {
            let res = await asyncAddAmount(row);
            if (res) {
                toast(`${row.title}增加${row.add_budget}成功!`);
            }

            if (getMoney() < 1) {
                Aj.hideProgress();
                clearInterval(timerID);
                timerID = null;
                toast("余额不足 !!!");
                await onRefresh();
                return false;
            }
        }
        Aj.hideProgress();

        toast(`增加预算完成`);
        await onRefresh();
    };

    // 设置CPM价格
    let editCPM = async (item, cpm) => {
        return new Promise((resolve, reject) => {
            let params = { owner_id: Aj.state.ownerId, ad_id: item.ad_id, cpm };
            Aj.apiRequest("editAdCPM", params, async function (result) {
                if (result.error) {
                    resolve(false);
                    return false;
                } else {
                    let ads = getADSKey(item);
                    const res = await window.post("/ads/recordCpm", {
                        ads,
                        cpm,
                        float: (cpm - item.cpm).toFixed(2),
                        views: item?.views || 0,
                        clicks: item?.clicks || 0,
                        actions: item?.actions || 0,
                    });

                    if (result.ad) {
                        OwnerAds.updateAd(result.ad);
                    }
                    resolve(true);
                }
            });
        });
    };

    // 提价(曝光不足)
    const onProPrice = async () => {
        let list = OwnerAds.getAdsList();
        list = list.filter((v) => {
            // if (v?.tme_path?.indexOf("?") === -1) return false;
            if (v.status === "Active" && v.qviews < +minViews) {
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

        console.log(list);

        Aj.showProgress();

        let promiseArr = list.map(async (item) => {
            let romPrice = 0;
            if (item?.qviews < +minViews * 0.3) {
                romPrice = (item.cpm * 0.1).toFixed(2);
            } else if (item?.qviews < +minViews * 0.5) {
                romPrice = (item.cpm * 0.05).toFixed(2);
            } else {
                romPrice = (item.cpm * 0.01).toFixed(2);
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
    };

    // 提价(曝光达标)
    const onProAddPrice = async () => {
        let list = OwnerAds.getAdsList();
        list = list.filter((v) => {
            if (
                v.status === "Active" &&
                v.qviews > +minViews &&
                v.qviews <= +minViews * 20
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
        if (!list?.length) return toast("全部达标");

        console.log(list);

        Aj.showProgress();

        let promiseArr = list.map(async (item) => {
            let romPrice = 0;
            if (item?.qviews > +minViews * 10) {
                romPrice = (item.cpm * 0.01).toFixed(2);
            } else if (item?.qviews > +minViews * 5) {
                romPrice = (item.cpm * 0.02).toFixed(2);
            } else {
                romPrice = (item.cpm * 0.03).toFixed(2);
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
    };

    // 筛选低评分帖子
    const onFilter = async () => {
        let list = OwnerAds.getAdsList();
        list = list.filter((v) => {
            if (
                v.status !== "On Hold" &&
                v.views > 2000 &&
                v.ctr < 1 &&
                v.cvr < 10
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
    };

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
                            name: isBot
                                ? result.bot.title
                                : result.channel.name,
                            photo: isBot
                                ? result.bot.photo
                                : result.channel.photo,
                            username: isBot
                                ? result.bot.username
                                : result.channel.username,
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

    // 关键字查询结果
    const onTargetQuerySearch = (query) => {
        return new Promise((resolve) => {
            Aj.apiRequest("searchTargetQuery", { query }, (result) => {
                if (result.error) return resolve(false);
                if (result.query) {
                    let html = new DOMParser().parseFromString(
                        result?.query?.sample_results,
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
            });
        });
    };

    // 创建广告
    const createAd = async (params) => {
        let query = {
            owner_id: Aj.state.ownerId, //  owner_id
            button: undefined, // undefined
            website_name: "", // ’‘
            website_photo: "", // ''
            media: "", // ''
            ad_info: "", // ''
            views_per_user: getRNum(1, 4), // 观看次数
            daily_budget: 100, // 日最高预算
            active: 1, // 开始投放
            device: undefined, // undefined
        };
        const {
            title = "",
            text = "",
            promote_url = "",
            cpm = 0,
            budget = 0,
            target_type = "",
        } = params;
        if (!title || !text || !promote_url || !cpm)
            return toast("标题、文案、推广链接、CPM 不能为空");

        return new Promise((resolve) => {
            Aj.apiRequest(
                "createAd",
                { ...query, ...params },
                async (result) => {
                    if (result.error) {
                        resolve(false);
                    } else {
                        await syncAds([
                            {
                                ads:
                                    params?.promote_url?.split("_")?.pop() ||
                                    "",
                                title: params.title || "",
                            },
                        ]);
                        resolve(true);
                    }
                }
            );
        });
    };

    // 编辑广告
    const editAd = async (row) => {
        // 获取文案
        let key = row.tme_path?.split?.("?")?.[0];
        const obj = {
            tsyl: "TSYL666bot", // 天胜
            tsyx: "TSYL666bot", // 天胜
            jbtb: "JB7777_BOT", // 金貝
            jbyx: "JB7777_BOT", // 金貝
            jbdp: "JBYL_bot", // 金博
        };
        let texts = getUserText(obj[key] || key, row.text);
        if (!texts?.length) {
            return false;
        }

        // 根据ad_id获取图片id
        let html = await getHTML(
            `https://ads.telegram.org/account/ad/${row.ad_id}`,
            "h"
        );
        let media = html.find('input[name="media"]')?.val() || "";

        let data = {
            owner_id: Aj.state.ownerId,
            ad_id: row.ad_id,
            title: row?.["_title"] || row?.title,
            text: texts[getRNum(0, texts.length - 1, 0)], // 文案
            promote_url: `t.me/${row.tme_path}`, // 推广链接
            website_name: "",
            website_photo: "",
            media: media,
            ad_info: "",
            cpm: row.cpm,
            daily_budget: row.daily_budget || 0,
            active: 1,
            views_per_user: getRNum(1, 4), // 观看次数
        };
        Aj.apiRequest("editAd", data, function (result) {
            if (result.error) {
                return false;
            }
            return true;
        });
    };

    // 删除广告
    const deleteAd = async (ad_id, owner_id = Aj.state.ownerId) => {
        return new Promise((resolve, reject) => {
            Aj.apiRequest("deleteAd", { owner_id, ad_id }, (res1) => {
                if (res1.error) return resolve(false);

                Aj.apiRequest(
                    "deleteAd",
                    { owner_id, ad_id, confirm_hash: res1.confirm_hash },
                    (res2) => {
                        if (res2.ok) return resolve(true);
                        return resolve(false);
                    }
                );
            });
        });
    };

    // 一键重审
    const onReview = async () => {
        await onRefresh();
        let list = OwnerAds.getAdsList();
        list = list.filter((v) => {
            if (v.status !== "Declined") return false;
            if (v.trg_type === "search") return false;
            v["url"] = `${host}${v.base_url}`;
            return true;
        });

        if (!list.length) return toast("没有需要审核的广告 !!!");

        Aj.showProgress();
        const submitArr = [];
        for (const row of list) {
            let res = await editAd(row);
            submitArr.push(res);
        }
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
            if (key === "tsyl" || key === "tsyx") {
                key = "TSYL666bot";
            } else if (key === "jbtb" || key === "jbyx") {
                key = "JB7777_BOT";
            }
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
            if (v.status === "Declined" && v?.score < 30) {
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

        if (!submitDelPromise.length)
            return toast("广告冷却中, 请稍后删除 !!!");

        Aj.showProgress();

        let submitDelArr = await Promise.all(submitDelPromise); // 等待所有任务完成
        let successNum = submitDelArr.filter((flag) => flag)?.length;
        let errorNum = submitDelArr.filter((flag) => !flag)?.length;

        Aj.hideProgress();

        toast(
            `删除广告：成功${successNum}条，失败${errorNum}条, ${
                list.length - successNum - errorNum
            }条正在冷却`,
            async () => {
                await onRefresh();
            }
        );
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

        keys = keys.length > 10 ? keys.slice(0, 10) : keys;
        let keyPromise = keys.map(
            async (key) => await onTargetQuerySearch(key)
        );
        let searchArr = await Promise.all(keyPromise); // 查询所有的关键词

        if (!searchArr.length) return toast("没有符合的关键词");

        // 随机设置单价
        let minPrice = parseFloat($("#minPrice").val());
        let maxPrice = parseFloat($("#maxPrice").val());

        // 随机设置总预算
        let minBudget = parseFloat($("#minBudget").val());
        let maxBudget = parseFloat($("#maxBudget").val());

        let title = [];
        let ids = [];
        searchArr.map((v) => {
            title.push(v.name);
            ids.push(v.val);
        });

        title = title.join("，");
        if (title.length > 32) {
            title = title.slice(0, 32);
        }

        // 准备参数
        let params = {
            title, // 标题
            text: "", // 文案
            promote_url: await getUserUrl(), // 推广频道链接
            cpm: getRNum(minPrice, maxPrice, 1), // 单价
            budget: getRNum(minBudget, maxBudget), // 总预算
            target_type: "search",
            channels: "",
            bots: "",
            search_queries: ids.join(";"),
            method: "createAd",
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

    // 发布单通道广告
    const sendChannel = async () => {
        if (getMoney() < 2) return toast("余额过低");
        let urls = $(".urls").value();
        if (!urls.length) return toast("请先设置频道/机器人链接");

        urls = urls.split(/\r?\n/);

        let texts = getUserText();
        if (!texts?.length) return false;

        Aj.showProgress();

        const sendArr = [];
        for (const url of urls) {
            let isBot = /bot$/i.test(url);
            let channelinfo = await searchChannel(isBot, url);
            if (!channelinfo) {
                isBot = true;
                channelinfo = await searchChannel(isBot, url);
                if (!channelinfo) {
                    toast(`${url}，发布失败！`);
                    sendArr.push(false);
                    continue; // 进入下一次循环
                }
            }

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

            let params = {
                title, // 标题
                text: texts[getRNum(0, texts.length - 1, 0)], // 文案
                promote_url: await getUserUrl(url), // 推广链接
                cpm: getRNum(minPrice, maxPrice, 1), // 单价
                budget: getRNum(minBudget, maxBudget), // 总预算
                target_type: isBot ? "bots" : "channels", // bots
            };
            isBot ? (params["bots"] = id) : (params["channels"] = id);
            const isFlag = await createAd(params);
            sendArr.push(isFlag);
            if (isFlag) {
                toast(`${title}，发布成功！`);
            } else {
                toast(`${title}，发布失败！`);
            }
        }
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
        let channelPromise = urls.map(
            async (v) => await searchChannel(isBot, v)
        );
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
            title: title, // 标题
            text: texts[getRNum(0, texts.length - 1, 0)], // 文案
            promote_url: await getUserUrl(), // 推广链接
            cpm: getRNum(minPrice, maxPrice, 1), // 单价
            budget: getRNum(minBudget, maxBudget), // 总预算
            target_type: isBot ? "bots" : "channels", // bots
        };

        if (isBot) {
            params["bots"] = ids.join(";");
        } else {
            params["channels"] = ids.join(";");
        }

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

    // 替换机器人
    const onReplaceBot = async () => {
        let list = OwnerAds.getAdsList();
        list = list.filter((v) => {
            if (v.status !== "Declined") return false;
            if (v.trg_type === "search") return false;
            v["url"] = `${host}${v.base_url}`;
            return true;
        });

        if (!list.length) {
            toast("所有机器人已经替换完成 !!!");
            return false;
        }
        if (getMoney() < 2) return toast("余额过低");
        const owner_id = Aj.state.ownerId;
        for (const v of list) {
            Aj.showProgress();

            const html = await getHTML(v.url, "h");
            let ids = html.find(".select").data("value");
            let isBot = v.trg_type === "bot" ? true : false;

            let params = {
                title: v.title, // 标题
                text: v.text, // 文案
                promote_url: `t.me/${v.tme_path?.replace(
                    /JB6666_BOT/gi,
                    "JB7777_BOT"
                )}`, // 推广链接
                cpm: v.cpm, // 单价
                budget: 1, // 总预算
                target_type: v.trg_type, // 类型
            };
            isBot ? (params["bots"] = ids) : (params["channels"] = ids);
            const isFlag = await createAd(params);
            if (isFlag) {
                await deleteAd(v.ad_id, owner_id);
                Aj.hideProgress();
                toast(`${v.title}新建成功, 旧广告已删除!`);
            } else {
                const result = [];
                html?.find?.(".selected-item")?.each(function () {
                    const dataVal = $(this).data("val");
                    const label = $(this).find(".label").text().trim();
                    result.push({ id: dataVal, title: label });
                });

                for (const row of result) {
                    let query = {
                        title: row.title, // 标题
                        text: v.text, // 文案
                        promote_url: `t.me/${v.tme_path?.replace(
                            /JB6666_BOT/gi,
                            "JB7777_BOT"
                        )}-${row.id}`, // 推广链接
                        cpm: v.cpm, // 单价
                        budget: 1, // 总预算
                        target_type: isBot ? "bots" : "channels", // 类型
                    };
                    isBot
                        ? (params["bots"] = row.id)
                        : (params["channels"] = row.id);
                    await createAd(query);
                }

                await deleteAd(v.ad_id, owner_id);
                Aj.hideProgress();
                toast(`${v.title}新建成功, 旧广告已删除!`);
            }
        }

        await onRefresh();
    };

    // 查看哪些链接协议号注册多
    const onGetENFilter = async () => {
        const res = await window.get("/ads/getAdsUEN", {
            ads: accountAll?.[window.user]?.["en"],
        });
        console.log(res.data);
    };

    // 获取今日数据
    const onGetTodayData = async () => {
        await syncAdsAll();
        const res = await window.get("/ads/getTodayData", {
            ads: accountAll?.[window.user]?.["en"],
        });
        console.log(res.data);
    };

    // 机器人投放验证
    const onBotVerify = async () => {
        let urls = $(".urls").value();
        if (!urls.length) return toast("请先设置机器人链接");

        urls = urls.split(/\r?\n/);

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
                            resolve(result.error);
                            return false;
                        }
                        if (result.ok) {
                            let item = {
                                val: isBot ? result.bot.id : result.channel.val,
                                name: isBot
                                    ? result.bot.title
                                    : result.channel.name,
                                photo: isBot
                                    ? result.bot.photo
                                    : result.channel.photo,
                                username: isBot
                                    ? result.bot.username
                                    : result.channel.username,
                            };
                            resolve(item);
                        } else {
                            resolve(false);
                        }
                    },
                    (err) => {
                        resolve(err);
                    }
                );
            });
        };

        const sendArr = [];
        for (const url of urls) {
            let res = await searchChannel(true, url);
            console.log("res", res);
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
    const showIframePopup = async (url, ads) => {
        if ($("#popupOverlay").length) {
            $("#popupOverlay").remove();
        }

        let data = await getHTML(`${url}?period=day`, "j", false);
        let code = data[0]["j"];
        let array = extractMiddleMultiple(code, 'columns":', ',"types');
        let dates = array[0]?.[0] || [];
        let views = array[0]?.[1] || [];
        let clicks = array[0]?.[2] || [];
        let actions = array[0]?.[3] || [];
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
            actions.push(0);
            total.push(0);
        }

        if (!dates?.length) {
            return toast("暂无数据 !!!");
        }

        let tmp = await window.get("/ads/cpmList", { ads });
        let cpms = tmp?.data || [];
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
                        action: actions?.[i] || 0,
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
                            <span style="color: ${
                                +v.float[i] > 0 ? "red" : "green"
                            };">
                            ${z.slice(10, z.length)}
                            </span>
                        </div>
                    `;
            });

            tableHtml += `</td>
                    <td style="padding: 5px 12px;">${v.view}</td>
                    <td style="padding: 5px 12px;">${v.click}</td>
                    <td style="padding: 5px 12px;">${v.action}</td>
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
    $("body")
        .on("dblclick", "tbody>tr", function (event) {
            let url = $(this)
                ?.find('[style*="display:var(--coldp-views,table-cell)"] a')
                ?.attr("href");

            let href = $(this)?.find?.(".pr-cell-title small a")?.text?.();
            let ads = href?.split("_");
            ads = ads?.[ads?.length - 1];
            showIframePopup(url, ads);
        })
        .on("contextmenu", "tbody>tr .pr-cell-title", function (e) {
            e?.preventDefault();
            e?.stopPropagation();
            let href = $(this)?.find?.("small a")?.text?.();
            let ads = href?.split("_");
            ads = ads?.[ads?.length - 1];
            copyText(ads);
        });

    // 更新观看量
    const updatePviews = async (isRefresh = true, isLast = false) => {
        let arr = OwnerAds?.getAdsList?.() || [];
        let ySpent = 0;
        const list = arr?.map?.((v) => {
            let ads = getADSKey(v);
            ySpent = ySpent + +(v?.qspent || 0);
            return {
                ads,
                views: v?.views || 0,
                clicks: v?.clicks || 0,
                actions: v?.actions || 0,
                spent: v?.spent || 0,
            };
        });
        if (!list?.length) return false;

        const params = { adsUser: window.user, list };

        // 不是刷新时才出来推送
        if (!isRefresh) {
            const budget = $(
                ".pr-header-auth .pr-header-text .js-header_owner_budget .pr-link"
            )
                ?.text()
                ?.match?.(/[-+]?\d*\.?\d+/g)?.[0];
            let totalBudget = await getMonthTotal();
            totalBudget = parseInt(
                totalBudget
                    ?.match?.(
                        /[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?/g
                    )?.[0]
                    ?.replace(/,/g, "") || "",
                10
            );
            if (budget && budget < 10 && window.user?.includes("天胜")) {
                params["budget"] = budget; // 当前预算
                params["ySpent"] = ySpent.toFixed(0); // 昨日消耗
            }
            if (isLast && totalBudget && window.user?.includes("天胜")) {
                params["totalBudget"] = totalBudget;
            }
        }

        const res = await window.post("/ads/recordViews", params);
        if (res) {
            console.log("观看量更新成功");
        }
    };

    // 每到0 和 30分的时候自动执行一次加预算
    const runMyTask = async (isLast) => {
        await addMountFn();

        // 金貝推广人员帖子自动重审
        if (accountAll[window.user]?.options?.length === 1) {
            await onReview();
        }

        // 天胜推广人员帖子自动重审
        // if (tstg?.includes?.(window.user)) {
        //     await onReview();
        // }

        await updatePviews(false, isLast);
    };

    const loop = () => {
        animationFrameId = requestAnimationFrame(loop);

        const now = new Date(autoADSData.date.getBeijingString());
        const hours = now.getHours();
        const min = now.getMinutes();
        const sec = now.getSeconds();

        if ([15, 30, 45, 59].includes(min) && sec === 0) {
            if (!loop.lastTrigger || loop.lastTrigger !== `${hours}-${min}`) {
                loop.lastTrigger = `${hours}-${min}`;
                runMyTask(hours === 23 && min === 59);
            }
        }
    };
    loop(); // 启动

    // 主动停止调用，执行取消
    const stopLoop = () => {
        cancelAnimationFrame(animationFrameId);
    };

    window.loadFinish = true;
})();
