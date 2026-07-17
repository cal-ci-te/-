// ========== 移动端设备检测 ==========

/**
 * 检测当前设备是否为移动端
 */
export function isMobile() {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 ||
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 检测是否支持触摸事件
 */
export function hasTouchSupport() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 获取设备类型
 */
export function getDeviceType() {
    if (isMobile()) {
        return 'mobile';
    }
    return 'desktop';
}

/**
 * 检测是否为 iOS 设备
 */
export function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * 检测是否为 Android 设备
 */
export function isAndroid() {
    return /Android/.test(navigator.userAgent);
}