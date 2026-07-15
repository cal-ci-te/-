// ========== 色卡管理（渲染与操作） ==========
import { AdminPanel } from './index.js';
import { Texture } from '../../services/texture.js';
import { NotificationService } from '../../services/notification-service.js';
import { Utils } from '../../utils.js';
import { UI } from '../../utils/ui-strings.js';

// ===== 渲染色卡列表 =====
AdminPanel.renderPalettes = function () {
  const container = document.getElementById('paletteList');
  if (!container) return;

  const palettes = Texture && Texture.palettes ? Texture.palettes : [];
  if (palettes.length === 0) {
    container.innerHTML =
      `<div style="color: #7a6a58; text-align: center; padding: 6px;">${UI.admin.paletteEmpty}</div>`;
    return;
  }

  let html = '';
  palettes.forEach((p) => {
    const colorPreview =
      p.mode === 'solid'
        ? `<span style="display:inline-block;width:20px;height:20px;background:${p.colors[0]};border:1px solid #5a3e2b;border-radius:4px;vertical-align:middle;"></span>`
        : `<span style="display:inline-block;width:20px;height:20px;background:linear-gradient(${p.direction}, ${p.colors.join(', ')});border:1px solid #5a3e2b;border-radius:4px;vertical-align:middle;"></span>`;

    html += `
            <div style="display:flex; align-items:center; padding:4px 0; border-bottom:1px solid #3a2a1a;">
                ${colorPreview}
                <span style="flex:1; margin-left:8px; font-size:11px; color:#e8d5b5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Utils.escapeHtml(p.name)}</span>
                <button class="apply-palette" data-id="${p.id}" style="background:none; border:none; color:#c4b5a0; cursor:pointer; font-size:12px;" title="${UI.admin.paletteApply}">✅</button>
                <button class="delete-palette" data-id="${p.id}" style="background:none; border:none; color:#c44a44; cursor:pointer; font-size:12px;" title="${UI.admin.paletteDelete}">🗑️</button>
            </div>
        `;
  });
  container.innerHTML = html;

  // ===== 绑定应用和删除事件 =====
  container.querySelectorAll('.apply-palette').forEach((btn) => {
    btn.addEventListener('click', function () {
      const id = this.dataset.id;
      if (Texture && Texture.applyPalette) {
        Texture.applyPalette(id);

        // 更新 UI 中的颜色选择器以反映当前状态
        const palette = Texture.palettes.find((p) => p.id === id);
        if (palette) {
          const solidRadio = document.querySelector('input[name="bgMode"][value="solid"]');
          const gradientRadio = document.querySelector('input[name="bgMode"][value="gradient"]');
          const gradControls = document.getElementById('gradientControls');

          if (palette.mode === 'solid') {
            if (solidRadio) solidRadio.checked = true;
            if (gradientRadio) gradientRadio.checked = false;
            if (gradControls) gradControls.style.display = 'none';
            const bgPicker = document.getElementById('bgColorPicker');
            if (bgPicker) bgPicker.value = palette.colors[0];
          } else {
            if (gradientRadio) gradientRadio.checked = true;
            if (solidRadio) solidRadio.checked = false;
            if (gradControls) gradControls.style.display = 'block';

            const c1 = document.getElementById('gradColor1');
            const c2 = document.getElementById('gradColor2');
            const c3 = document.getElementById('gradColor3');

            if (c1 && palette.colors[0]) c1.value = palette.colors[0];
            if (c2 && palette.colors[1]) c2.value = palette.colors[1];
            if (c3) {
              if (palette.colors[2]) {
                c3.value = palette.colors[2];
                c3.style.display = '';
              } else {
                c3.style.display = 'none';
              }
            }

            const dir = document.getElementById('gradDirection');
            if (dir) dir.value = palette.direction || 'to bottom';

            const feather = document.getElementById('gradFeatherSlider');
            const featherValue = document.getElementById('gradFeatherValue');
            if (feather) {
              const val = palette.feather || 50;
              feather.value = val;
              if (featherValue) featherValue.textContent = val;
            }
          }
        }
        NotificationService.showToast(
          NotificationService.messages.paletteApplied(palette ? palette.name : '')
        );
      } else {
        NotificationService.showToast(NotificationService.messages.moduleNotLoaded, true);
      }
    });
  });

  container.querySelectorAll('.delete-palette').forEach((btn) => {
    btn.addEventListener('click', function () {
      const id = this.dataset.id;
      if (confirm(NotificationService.messages.paletteDeleteConfirm)) {
        if (Texture && Texture.deletePalette) {
          Texture.deletePalette(id);
          if (AdminPanel.renderPalettes) {
            AdminPanel.renderPalettes();
          }
        } else {
          NotificationService.showToast(NotificationService.messages.moduleNotLoaded, true);
        }
      }
    });
  });
};

console.log('✅ AdminPanel 色卡模块已加载 (ES Module)');
