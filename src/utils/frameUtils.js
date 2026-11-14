// Shared frame utilities: green-screen chroma key, slot configs, canvas composition.
// Used by Result.jsx and Recap.jsx.

export const FRAME_CONFIGS = {
  frame3_1: [
    { top: '17.11%', left: '10.0%', width: '33.75%', height: '19.67%' },
    { top: '17.11%', left: '57.42%', width: '33.75%', height: '19.67%' },
    { top: '40.72%', left: '10.25%', width: '33.75%', height: '19.67%' },
    { top: '40.72%', left: '57.58%', width: '33.75%', height: '19.67%' },
    { top: '65.06%', left: '10.25%', width: '33.75%', height: '19.67%' },
    { top: '65.06%', left: '57.58%', width: '33.75%', height: '19.67%' },
  ],
  frame4_1: [
    { top: '10.22%', left: '4.25%', width: '42.17%', height: '14.5%' },
    { top: '10.33%', left: '53.83%', width: '42.17%', height: '14.39%' },
    { top: '30.0%', left: '4.25%', width: '42.17%', height: '16.22%' },
    { top: '30.0%', left: '53.83%', width: '42.17%', height: '16.22%' },
    { top: '51.5%', left: '4.25%', width: '42.17%', height: '16.28%' },
    { top: '51.56%', left: '53.83%', width: '42.17%', height: '16.22%' },
    { top: '73.06%', left: '4.25%', width: '42.17%', height: '16.22%' },
    { top: '73.0%', left: '53.83%', width: '42.17%', height: '16.28%' },
  ],
};

export const getFrameImagePath = (frame) => {
  const map = { frame3_1: '/frame3_1.png', frame4_1: '/frame4_1.png' };
  return map[frame] || '/frame3_1.png';
};

// Chroma key: green → transparent (untuk frame overlay di atas foto/video)
export const chromaKeyFrame = (src) => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (g > 100 && g > r * 1.1 && g > b + 15) {
          const greenness = Math.min(1, (g - Math.max(r, b)) / 80);
          data[i + 3] = Math.round(data[i + 3] * (1 - greenness));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

export const loadImg = (src) => new Promise((resolve, reject) => {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Komposisi foto ber-frame pada canvas 1200x1800 (untuk download PNG & share)
export const composeCanvas = async (photos, photoCount, frame, framePhotosMapping, processedFrame) => {
  const W = 1200, H = 1800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const configs = FRAME_CONFIGS[frame] || FRAME_CONFIGS.frame3_1;
  const dup = [];
  for (let i = 0; i < photoCount; i++) {
    const mi = framePhotosMapping?.[i] ?? i;
    dup.push(photos[mi]); dup.push(photos[mi]);
  }

  for (let i = 0; i < configs.length; i++) {
    if (!dup[i]) continue;
    const c = configs[i];
    const x = parseFloat(c.left) / 100 * W, y = parseFloat(c.top) / 100 * H;
    const w = parseFloat(c.width) / 100 * W, h = parseFloat(c.height) / 100 * H;
    const p = await loadImg(dup[i]);
    const scale = Math.max(w / p.width, h / p.height);
    const sw = w / scale, sh = h / scale;
    ctx.drawImage(p, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, x, y, w, h);
  }

  if (processedFrame) {
    const f = await loadImg(processedFrame);
    ctx.drawImage(f, 0, 0, W, H);
  }
  return canvas;
};

// Komposisi 1 foto plain full-canvas (tampilan GIF / take-photo, tanpa frame)
export const composePlainCanvas = async (photoSrc, W = 1200, H = 1800) => {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const p = await loadImg(photoSrc);
  const scale = Math.max(W / p.width, H / p.height);
  const sw = W / scale, sh = H / scale;
  ctx.drawImage(p, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, 0, 0, W, H);
  return canvas;
};

export const downloadDataUrl = (dataUrl, filename) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

export const downloadBlobUrl = (blobUrl, filename) => {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// Render siklus foto (plain, tanpa frame) menjadi video webm looping —
// dipakai untuk menyimpan output "GIF" sebagai satu file. Format kotak 4:3
// seperti tampilan take-photo.
export const generateGifVideo = async (photos, perPhotoMs = 700) => {
  const W = 960, H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });

  recorder.start();
  for (const src of photos) {
    const p = await loadImg(src);
    const scale = Math.max(W / p.width, H / p.height);
    const sw = W / scale, sh = H / scale;
    ctx.drawImage(p, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, 0, 0, W, H);
    await new Promise(r => setTimeout(r, perPhotoMs));
  }
  recorder.stop();
  await done;
  stream.getTracks().forEach(t => t.stop());

  return new Blob(chunks, { type: 'video/webm' });
};
