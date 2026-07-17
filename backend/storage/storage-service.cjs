// ========== 存储服务门面 ==========
const { STORAGE_TYPE } = require('./config.cjs');
const LocalAdapter = require('./adapters/local.cjs');
const RustFSAdapter = require('./adapters/rustfs.cjs');

class StorageService {
    constructor() {
        this.type = STORAGE_TYPE;
        this.adapter = this.type === 'rustfs' ? new RustFSAdapter() : new LocalAdapter();
        console.log('[StorageService] 使用存储后端:', this.type);
    }

    /**
     * 上传文件
     */
    async upload(buffer, filename, contentType) {
        return this.adapter.upload(buffer, filename, contentType);
    }

    /**
     * 获取文件访问URL
     */
    getUrl(id, filename) {
        return this.adapter.getUrl(id, filename);
    }

    /**
     * 删除文件
     */
    async delete(filename) {
        return this.adapter.delete(filename);
    }

    /**
     * 检查文件是否存在
     */
    async exists(filename) {
        return this.adapter.exists(filename);
    }

    /**
     * 读取文件内容
     */
    async read(filename) {
        return this.adapter.read(filename);
    }

    /**
     * 判断是否是本地存储
     */
    isLocal() {
        return this.type === 'local';
    }

    /**
     * 判断是否是 RustFS
     */
    isRustFS() {
        return this.type === 'rustfs';
    }
}

// 单例
const storage = new StorageService();
module.exports = storage;