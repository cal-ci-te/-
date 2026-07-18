
/**
 * 压缩图片为 WebP 格式
 * @param {File} file - 图片文件
 * @param {number} maxWidth - 最大宽度（像素），默认 200
 * @param {number} quality - 压缩质量 (0-1)，默认 0.85
 * @returns {Promise<Object>} 包含 blob, dataUrl, width, height 的对象
 */
export function compressImage(file, maxWidth = 200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width,
          height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve({
              blob: blob,
              dataUrl: URL.createObjectURL(blob),
              width,
              height,
            });
          },
          'image/webp',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}