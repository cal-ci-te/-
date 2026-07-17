// ========== 存储配置管理 ==========
const path = require('path');
require('dotenv').config(); // 如果使用 dotenv

// 存储类型：'local' 或 'rustfs'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// RustFS 配置（兼容 S3 协议）
const RUSTFS_CONFIG = {
    endpoint: process.env.RUSTFS_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.RUSTFS_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.RUSTFS_SECRET_KEY || 'minioadmin',
    bucket: process.env.RUSTFS_BUCKET || 'revachol',
    region: process.env.RUSTFS_REGION || 'us-east-1',
    useSSL: process.env.RUSTFS_USE_SSL === 'true' || false,
    forcePathStyle: true, // RustFS/MinIO 需要
};

// 本地存储配置
const LOCAL_CONFIG = {
    uploadDir: path.join(__dirname, '../../uploads/decos'),
    baseUrl: '/uploads/decos',
};

module.exports = {
    STORAGE_TYPE,
    RUSTFS_CONFIG,
    LOCAL_CONFIG,
};