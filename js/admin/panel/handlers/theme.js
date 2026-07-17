// ========== 主题切换处理器 ==========
import { ThemeService } from '../../../services/theme-service.js';

export function themeSwitchHandler(event) {
    const btn = event.target.closest('[data-theme]');
    if (!btn) return;
    const themeId = btn.dataset.theme;
    if (themeId) {
        console.log('[ThemeHandler] 切换主题:', themeId);
        ThemeService.switchTheme(themeId);
    }
}