const fs = require("fs");
const UglifyJS = require("uglify-js");

// 定义黑名单
const blacklist = ["tg-ads.user.js"]; // 在这里列出您希望跳过的文件

// 获取当前目录下的所有 JS 文件
const files = fs
    .readdirSync("./")
    .filter((file) => file.endsWith(".js") && file !== "minify.js");

// 过滤不在黑名单中的文件
const filesToProcess = files.filter((file) => !blacklist.includes(file));

filesToProcess.forEach((file) => {
    // 读取源文件
    const code = fs.readFileSync(file, "utf8");

    // 压缩代码
    const result = UglifyJS.minify(code);

    if (result.error) {
        console.error(`错误：无法压缩 ${file} - ${result.error}`);
    } else {
        // 生成新文件名
        const minifiedFileName = file.replace(".js", ".min.js");

        // 写入压缩后的文件
        fs.writeFileSync(minifiedFileName, result.code);
        console.log(`压缩完成: ${minifiedFileName}`);
    }
});
