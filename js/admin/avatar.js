// ========== 管理员头像管理 ==========
import { DOMRefs } from '../core/dom-refs.js';
import { Utils } from '../utils.js';
import { CONFIG } from '../config.js';
import { UI } from '../utils/ui-strings.js';

export const AdminAvatar = {
  originalImage: null,
  cropSelection: {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    originalW: 0,
    originalH: 0,
    displayW: 0,
    displayH: 0,
  },
  resizeCorner: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,

  setAvatarImage: function (dataUrl) {
    const avatarImg = DOMRefs.get(DOMRefs.login.avatar);
    if (avatarImg && dataUrl) {
      avatarImg.src = dataUrl;
    }
    this.saveAvatarForUser(dataUrl);
    const adminPreview = DOMRefs.get(DOMRefs.adminControls.adminAvatarPreview);
    if (adminPreview && dataUrl) {
      adminPreview.src = dataUrl;
    }
  },

  getAvatarForUser: function () {
    const username = CONFIG.ADMIN_USERNAME || 'admin';
    return Utils.storage.get('avatar_' + username);
  },

  saveAvatarForUser: function (dataUrl) {
    const username = CONFIG.ADMIN_USERNAME || 'admin';
    Utils.storage.set('avatar_' + username, dataUrl);
  },

  openUpload: function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = function (e) {
      const file = e.target.files[0];
      if (file) {
        AdminAvatar.initCropModal(file);
      }
    };
    input.click();
  },

  initCropModal: function (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        AdminAvatar.originalImage = img;
        AdminAvatar.setupCropCanvas(img);
        const overlay = DOMRefs.get(DOMRefs.crop.overlay);
        if (overlay) overlay.classList.add('active');
        AdminAvatar.bindCropEvents();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  bindCropEvents: function () {
    const confirmBtn = DOMRefs.get(DOMRefs.crop.confirmBtn);
    const cancelBtn = DOMRefs.get(DOMRefs.crop.cancelBtn);

    if (confirmBtn) {
      confirmBtn.removeEventListener('click', this._confirmHandler);
      this._confirmHandler = function () {
        AdminAvatar.confirmCrop();
      };
      confirmBtn.addEventListener('click', this._confirmHandler);
    }

    if (cancelBtn) {
      cancelBtn.removeEventListener('click', this._cancelHandler);
      this._cancelHandler = function () {
        AdminAvatar.cancelCrop();
      };
      cancelBtn.addEventListener('click', this._cancelHandler);
    }

    const overlay = DOMRefs.get(DOMRefs.crop.overlay);
    if (overlay) {
      overlay.removeEventListener('click', this._overlayHandler);
      this._overlayHandler = function (e) {
        if (e.target === overlay) {
          AdminAvatar.cancelCrop();
        }
      };
      overlay.addEventListener('click', this._overlayHandler);
    }
  },

  setupCropCanvas: function (img) {
    const canvas = DOMRefs.get(DOMRefs.crop.canvas);
    if (!canvas) {
      console.warn('[AdminAvatar] cropCanvas 元素不存在');
      return;
    }
    const ctx = canvas.getContext('2d');

    const maxSize = 400;
    let displayW = img.width;
    let displayH = img.height;

    if (displayW > maxSize) {
      displayW = maxSize;
      displayH = (img.height * maxSize) / img.width;
    }
    if (displayH > maxSize) {
      displayH = maxSize;
      displayW = (img.width * maxSize) / img.height;
    }

    canvas.width = displayW;
    canvas.height = displayH;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    ctx.drawImage(img, 0, 0, displayW, displayH);

    const cropSize = Math.min(displayW, displayH) * 0.7;
    AdminAvatar.cropSelection = {
      x: (displayW - cropSize) / 2,
      y: (displayH - cropSize) / 2,
      w: cropSize,
      h: cropSize,
      originalW: img.width,
      originalH: img.height,
      displayW: displayW,
      displayH: displayH,
    };

    AdminAvatar.enableCropDrawing(canvas);
    AdminAvatar.updatePreview();
  },

  enableCropDrawing: function (canvas) {
    let isDragging = false;
    let dragStartX = 0,
      dragStartY = 0;
    const self = this;

    const redraw = function () {
      const ctx = canvas.getContext('2d');
      const sel = self.cropSelection;

      ctx.drawImage(self.originalImage, 0, 0, sel.displayW, sel.displayH);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, sel.y);
      ctx.fillRect(0, sel.y + sel.h, canvas.width, canvas.height - sel.y - sel.h);
      ctx.fillRect(0, sel.y, sel.x, sel.h);
      ctx.fillRect(sel.x + sel.w, sel.y, canvas.width - sel.x - sel.w, sel.h);

      ctx.strokeStyle = '#c47a44';
      ctx.lineWidth = 2;
      ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);

      const handleSize = 8;
      ctx.fillStyle = '#c47a44';
      const corners = [
        [sel.x - handleSize / 2, sel.y - handleSize / 2],
        [sel.x + sel.w - handleSize / 2, sel.y - handleSize / 2],
        [sel.x - handleSize / 2, sel.y + sel.h - handleSize / 2],
        [sel.x + sel.w - handleSize / 2, sel.y + sel.h - handleSize / 2],
      ];
      corners.forEach(function (corner) {
        ctx.fillRect(corner[0], corner[1], handleSize, handleSize);
      });
    };

    const getMousePos = function (e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      let clientX, clientY;
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const onMouseDown = function (e) {
      e.preventDefault();
      const pos = getMousePos(e);
      const sel = self.cropSelection;
      const handleSize = 8;

      const corners = [
        { x: sel.x, y: sel.y, type: 'nw' },
        { x: sel.x + sel.w, y: sel.y, type: 'ne' },
        { x: sel.x, y: sel.y + sel.h, type: 'sw' },
        { x: sel.x + sel.w, y: sel.y + sel.h, type: 'se' },
      ];

      for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];
        if (Math.abs(pos.x - corner.x) < handleSize && Math.abs(pos.y - corner.y) < handleSize) {
          self.resizeCorner = corner.type;
          isDragging = true;
          dragStartX = pos.x;
          dragStartY = pos.y;
          return;
        }
      }

      if (pos.x >= sel.x && pos.x <= sel.x + sel.w && pos.y >= sel.y && pos.y <= sel.y + sel.h) {
        self.resizeCorner = 'move';
        isDragging = true;
        dragStartX = pos.x - sel.x;
        dragStartY = pos.y - sel.y;
      }
    };

    const onMouseMove = function (e) {
      if (!isDragging) return;
      e.preventDefault();
      const pos = getMousePos(e);
      const sel = self.cropSelection;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      if (self.resizeCorner === 'move') {
        let newX = pos.x - dragStartX;
        let newY = pos.y - dragStartY;
        newX = Math.max(0, Math.min(newX, canvasWidth - sel.w));
        newY = Math.max(0, Math.min(newY, canvasHeight - sel.h));
        sel.x = newX;
        sel.y = newY;
      } else {
        let newW = sel.w;
        let newH = sel.h;
        let newX2 = sel.x;
        let newY2 = sel.y;

        if (self.resizeCorner === 'se') {
          newW = pos.x - sel.x;
          newH = pos.y - sel.y;
        } else if (self.resizeCorner === 'sw') {
          newW = sel.x + sel.w - pos.x;
          newH = pos.y - sel.y;
          newX2 = pos.x;
        } else if (self.resizeCorner === 'ne') {
          newW = pos.x - sel.x;
          newH = sel.y + sel.h - pos.y;
          newY2 = pos.y;
        } else if (self.resizeCorner === 'nw') {
          newW = sel.x + sel.w - pos.x;
          newH = sel.y + sel.h - pos.y;
          newX2 = pos.x;
          newY2 = pos.y;
        }

        const size = Math.min(newW, newH);
        // 删除无用的赋值 newW = size; newH = size;（已移除）

        sel.w = Math.max(20, Math.min(size, canvasWidth - newX2));
        sel.h = sel.w;
        sel.x = Math.max(0, Math.min(newX2, canvasWidth - sel.w));
        sel.y = Math.max(0, Math.min(newY2, canvasHeight - sel.h));
      }

      redraw();
      self.updatePreview();
    };

    const onMouseUp = function () {
      isDragging = false;
      self.resizeCorner = null;
    };

    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('touchstart', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('touchend', onMouseUp);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);

    redraw();
  },

  updatePreview: function () {
    const previewCanvas = DOMRefs.get(DOMRefs.crop.previewCanvas);
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');

    const sel = this.cropSelection;
    const scaleX = this.originalImage.width / sel.displayW;
    const scaleY = this.originalImage.height / sel.displayH;

    const sx = sel.x * scaleX;
    const sy = sel.y * scaleY;
    const sw = sel.w * scaleX;
    const sh = sel.h * scaleY;

    previewCanvas.width = 80;
    previewCanvas.height = 80;
    ctx.drawImage(this.originalImage, sx, sy, sw, sh, 0, 0, 80, 80);
  },

  confirmCrop: function () {
    const cropCanvas = document.createElement('canvas');
    const sel = this.cropSelection;
    const scaleX = this.originalImage.width / sel.displayW;
    const scaleY = this.originalImage.height / sel.displayH;

    const sx = sel.x * scaleX;
    const sy = sel.y * scaleY;
    const sw = sel.w * scaleX;
    const sh = sel.h * scaleY;

    cropCanvas.width = 200;
    cropCanvas.height = 200;
    const ctx = cropCanvas.getContext('2d');
    ctx.drawImage(this.originalImage, sx, sy, sw, sh, 0, 0, 200, 200);

    cropCanvas.toBlob(
      function (blob) {
        if (blob) {
          const reader = new FileReader();
          reader.onload = function (e) {
            AdminAvatar.setAvatarImage(e.target.result);
            Utils.showToast(UI.toast.avatarUploadSuccess, false);
            const adminPreview = DOMRefs.get(DOMRefs.adminControls.adminAvatarPreview);
            if (adminPreview) adminPreview.src = e.target.result;
          };
          reader.readAsDataURL(blob);
        }
        const overlay = DOMRefs.get(DOMRefs.crop.overlay);
        if (overlay) overlay.classList.remove('active');
      },
      'image/webp',
      0.85
    );
  },

  cancelCrop: function () {
    const overlay = DOMRefs.get(DOMRefs.crop.overlay);
    if (overlay) overlay.classList.remove('active');
  },
};

console.log('✅ AdminAvatar 已加载 (ES Module)');
