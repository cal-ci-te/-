// ========== 贴图数据仓库（BLOB 存储适配） ==========
import { ApiClient } from './api-client.js';
import { StorageAdapter } from './storage-adapter.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { API_ENDPOINTS } from '../config.js';

const STORAGE_KEY = 'deco_library';

export const DecoRepository = {
    _cache: null,
    _pendingIds: new Set(),

    _ensureCache() {
        if (!this._cache || !Array.isArray(this._cache)) {
            this._cache = [];
        }
        return this._cache;
    },

    async load(forceRemote = false) {
        if (this._cache && !forceRemote) {
            return this._cache;
        }
        const localData = StorageAdapter.get(STORAGE_KEY);
        if (localData && Array.isArray(localData) && !forceRemote) {
            // ★★★ 为每个贴图补充 dataUrl 字段（图片路由） ★★★
            const enriched = localData.map(item => ({
                ...item,
                dataUrl: `/api/decos/${item.id}/image`
            }));
            this._cache = enriched;
            console.log('[DecoRepository] 从本地缓存加载，共', enriched.length, '项');
            this._syncFromServerSilently();
            return enriched;
        }
        return this._fetchFromServer();
    },

    async save(item) {
        const isNew = !item.id || !this._cache.some(i => i.id === item.id);

        if (isNew) {
            console.log('[DecoRepository] 新建贴图:', item.name || '未命名');
            try {
                if (!item.dataUrl && item.file) {
                    throw new Error('缺少 dataUrl');
                }
                const result = await this._postToServer(item);
                const newItem = { ...item, id: result.id };
                if (result.dataUrl) newItem.dataUrl = result.dataUrl;
                this._ensureCache();
                this._cache.push(newItem);
                this._syncToStorage();
                EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
                console.log('[DecoRepository] 新建成功，正式 ID:', result.id);
                return newItem;
            } catch (error) {
                console.error('[DecoRepository] 新建失败:', error);
                throw error;
            }
        } else {
            if (this._pendingIds.has(item.id)) {
                throw new Error('该贴图正在同步中，请稍后操作');
            }
            console.log('[DecoRepository] 更新贴图:', item.id);
            this._ensureCache();
            const index = this._cache.findIndex(i => i.id === item.id);
            if (index !== -1) {
                this._cache[index] = { ...this._cache[index], ...item };
            } else {
                this._cache.push(item);
            }
            this._syncToStorage();
            this._pendingIds.add(item.id);
            try {
                await this._putToServer(item);
                this._pendingIds.delete(item.id);
                EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
                return item;
            } catch (error) {
                this._pendingIds.delete(item.id);
                console.warn('[DecoRepository] 更新同步失败，已保存到本地:', error);
                EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
                return item;
            }
        }
    },

    async delete(id) {
        if (this._pendingIds.has(id)) {
            throw new Error('该贴图正在同步中，请稍后操作');
        }
        this._ensureCache();
        const index = this._cache.findIndex(item => item.id === id);
        if (index !== -1) {
            this._cache.splice(index, 1);
            this._syncToStorage();
            EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
        }
        try {
            await this._deleteFromServer(id);
            return true;
        } catch (error) {
            console.warn('[DecoRepository] 删除同步失败，已从本地删除:', error);
            return true;
        }
    },

    async syncFromServer() {
        return this._fetchFromServer(true);
    },

    getAll() {
        this._ensureCache();
        return [...this._cache];
    },

    get(id) {
        this._ensureCache();
        return this._cache.find(item => item.id === id) || null;
    },

    // ===== 私有方法 =====
    async _fetchFromServer(forceUpdate = false) {
        try {
            const data = await ApiClient.get(API_ENDPOINTS.DECOS);
            const list = Array.isArray(data) ? data : [];
            const enriched = list.map(item => ({
                ...item,
                dataUrl: `/api/decos/${item.id}/image`
            }));
            this._cache = enriched;
            this._syncToStorage();
            console.log('[DecoRepository] 从服务器同步成功，共', enriched.length, '项');
            EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
            return enriched;
        } catch (error) {
            console.error('[DecoRepository] 从服务器拉取失败:', error);
            if (this._cache) return this._cache;
            const local = StorageAdapter.get(STORAGE_KEY);
            if (local && Array.isArray(local)) {
                const enriched = local.map(item => ({
                    ...item,
                    dataUrl: `/api/decos/${item.id}/image`
                }));
                this._cache = enriched;
                return enriched;
            }
            this._cache = [];
            return [];
        }
    },

    async _syncFromServerSilently() {
        // 静默同步已在 _fetchFromServer 中处理
    },

    async _postToServer(item) {
        let base64 = item.dataUrl;
        if (!base64 && item.file) {
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(item.file);
            });
        }
        if (!base64) {
            throw new Error('No image data');
        }
        const payload = {
            name: item.name || '',
            base64: base64,
        };
        const result = await ApiClient.post(API_ENDPOINTS.DECOS, payload);
        return result;
    },

    async _putToServer(item) {
        const endpoint = API_ENDPOINTS.DECOS + '/' + item.id;
        const payload = { ...item };
        delete payload.file;
        delete payload.dataUrl;
        await ApiClient.put(endpoint, payload);
    },

    async _deleteFromServer(id) {
        const endpoint = API_ENDPOINTS.DECOS + '/' + id;
        await ApiClient.delete(endpoint);
    },

    _syncToStorage() {
        if (this._cache) {
            // 存储时去除 dataUrl（图片路由可动态生成）
            const toStore = this._cache.map(item => {
                const { dataUrl, ...rest } = item;
                return rest;
            });
            StorageAdapter.set(STORAGE_KEY, toStore);
            console.log('[DecoRepository] 已同步到本地存储，共', toStore.length, '项');
        } else {
            StorageAdapter.set(STORAGE_KEY, []);
        }
    },
};

console.log('✅ DecoRepository 已加载（BLOB 存储适配 + dataUrl 补充）');
