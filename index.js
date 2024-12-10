let crypto = require('crypto');
module.exports = (ctx) => {
    const register = () => {
        ctx.helper.uploader.register('onemanager', {
            async handle(ctx) {
                let userConfig = ctx.getConfig('picBed.onemanager');
                if (!userConfig) {
                    throw new Error('Can\'t find uploader config')
                }
                let url = userConfig.url;
                let directLinkURL = userConfig.directLinkURL;
                let SecurityCode = userConfig.SecurityCode;
                if (!url) {
                    ctx.emit('notification', {
                        title: '上传失败',
                        body: "请填写onemanager的图床url"
                    });
                }
                if (url.charAt(url.length - 1) != "/") {
                    url = url + "/";
                }
                let imgList = ctx.output
                for (let i in imgList) {
                    const uploadInfo = await getUploadInfo(ctx, url, imgList[i], directLinkURL, SecurityCode);
                    if (imgList[i].url) continue;
                    await upload(ctx, uploadInfo.uploadUrl, imgList[i], uploadInfo.imgUrl);
                }
                return ctx;
            },
            name: 'onemanager图床',
            config: config
        })
    }
    return {
        register,
        uploader: 'onemanager',
    }
}
const upload = async (ctx, url, img, imgUrl) => {
    const totalsize = img.buffer.length;
    const asize = 0;
    const bsize = totalsize - 1;
    const customHeader = {
        "content-length": totalsize,
        "Content-Range": 'bytes ' + asize + '-' + bsize + '/' + totalsize/*,"contentType":"base64Encoded"*/
    }
    const upOpts = getOpts(customHeader, img.buffer, url, "PUT");
    upOpts.body = img.buffer;
    try {
        let resp = await ctx.request(upOpts);
        resp = JSON.parse(resp);
        if (resp.size > 0) {
            delete img.base64Image
            delete img.buffer
            img.url = imgUrl;
            img.imgUrl = imgUrl;
        }
    } catch (e) {
        return ctx.emit('notification', {
            title: '上传发生错误',
            body: JSON.stringify(e)
        });
    }
}

const getUploadInfo = async (ctx, url, img, directLinkURL, SecurityCode) => {
    let md5 = crypto.createHash("md5");
    // 获取图片上传url
    let customHeader = {'x-requested-with': 'XMLHttpRequest'};
    md5.update(img.buffer);
    md5 = md5.digest("hex");
    let filesize = img.buffer.length;
    let getUpload = {
        filemd5: Date.now(),
        filelastModified: Date.now(),
        filesize: filesize,
        upbigfilename: Date.now() + img.extname
    }
    let getUrlOpts = getOpts(customHeader, getUpload, url + "?action=upbigfile", "POST", true);

    let resp;
    try {
        resp = await ctx.request(getUrlOpts);
    } catch (e) {
        if (JSON.stringify(e).indexOf("exists") != -1) {
            ctx.emit('notification', {
                title: '图片已存在',
                body: img.fileName + " 已存在!"
            });
            delete img.base64Image
            delete img.buffer
            img.url = url + getUpload.upbigfilename;
            img.imgUrl = url + getUpload.upbigfilename;
            return null;
        } else {
            if (JSON.stringify(e).indexOf("exists") != -1) {
                ctx.emit('notification', {
                    title: '上传失败',
                    body: JSON.stringify(e)
                });
                ctx.log.warn("上传失败", JSON.stringify(e));
            }
        }
    }
    resp = JSON.parse(resp);
    resp.imgName = getUpload.upbigfilename;
    resp.imgUrl = directLinkURL + getUpload.upbigfilename + "&" + SecurityCode;
    return resp;
}
const getOpts = (customHeader = {}, body, url = "", method = "POST", toStrBody = false) => {
    if (toStrBody) {
        try {
            let stringBody = "";
            for (let key in body) {
                stringBody += (key + "=" + body[key] + "&");
            }
            body = encodeURI(stringBody.substr(0, stringBody.length - 1));
        } catch (e) {
            // TO DO...
        }
    } else {
        try {
            body = JSON.stringify(body);
        } catch (e) {
            // TO DO
        }
    }
    let headers = {
        contentType: 'text/html;charset=UTF-8',
        'User-Agent': 'PicGo'
    }
    if (customHeader) {
        headers = Object.assign(headers, customHeader)
    }
    const opts = {
        method: method,
        url: url,
        headers: headers,
        body: body
    }
    return opts
}

const config = ctx => {
    let userConfig = ctx.getConfig('picBed.onemanager');
    if (!userConfig) {
        userConfig = {};
    }
    return [
        {
            name: 'url',
            type: 'input',
            default: userConfig.url,
            required: true,
            message: '示例：https://pan.laoxin.top/od1/ykfile/ 其中ykfile为图床文件夹',
            alias: 'onemanager图床文件夹url'
        },
        {
            name: 'directLinkURL',
            type: 'input',
            default: userConfig.directLinkURL,
            required: true,
            message: '请输入 onedrive-vercel-index 的域名前缀（包括基础路径，如 test.com/api/raw/?path=/Pictures/）',
            alias: '直链URL'
        },
        {
            name: 'SecurityCode',
            type: 'input',
            default: userConfig.SecurityCode,
            required: false,
            message: '请输入 onedrive-vercel-index 的加密后缀（odpt=XXXXXX）',
            alias: '加密后缀'
        }
    ];
}