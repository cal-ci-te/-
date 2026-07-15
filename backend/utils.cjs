const path = require('path');
const fs = require('fs');

const DEFAULT_UPLOAD_DIR = path.join(__dirname, 'uploads/decos');
const DECO_UPLOAD_DIR = process.env.DECO_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;

function ensureUploadDir() {
    if (!fs.existsSync(DECO_UPLOAD_DIR)) {
        fs.mkdirSync(DECO_UPLOAD_DIR, { recursive: true });
        console.log(`📁 创建上传目录: ${DECO_UPLOAD_DIR}`);
    }
}

module.exports = {
    DECO_UPLOAD_DIR,
    ensureUploadDir,
};