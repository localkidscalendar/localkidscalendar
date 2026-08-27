/**
 * Client-side image prepare pipeline for uploads (activity photos, ads, logos).
 * Resize/compress in the browser first, then validate the result — so OpenAI and
 * Supabase Storage only ever see a managed-size file.
 *
 * Typical phone photos (3–8 MB+) are accepted as picks; originals over 15 MB fail fast.
 */

import { supporterAdOutputDimensions, defaultAdOutputDimensions } from "./supporterAdDisplay.js";

export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // 15 MB — absurd files fail before decode
export const MAX_OUTPUT_BYTES_DEFAULT = 2 * 1024 * 1024; // 2 MB post-process safety net

/** @typedef {{ id: string, maxWidth: number, maxHeight: number, maxOutputBytes: number, mimeType: string, quality: number, extension: string, minWidth: number, minHeight: number }} ImagePreset */

/** @type {Record<string, ImagePreset>} */
export const IMAGE_PRESETS = {
  activityPhoto: {
    id: "activityPhoto",
    maxWidth: 1600,
    maxHeight: 1200,
    maxOutputBytes: MAX_OUTPUT_BYTES_DEFAULT,
    mimeType: "image/jpeg",
    quality: 0.82,
    extension: "jpg",
    minWidth: 200,
    minHeight: 150,
  },
  adCreative: {
    id: "adCreative",
    maxWidth: 1200,
    maxHeight: 800,
    maxOutputBytes: MAX_OUTPUT_BYTES_DEFAULT,
    mimeType: "image/jpeg",
    quality: 0.82,
    extension: "jpg",
    minWidth: 300,
    minHeight: 200,
  },
  defaultAd: {
    id: "defaultAd",
    maxWidth: 1200,
    maxHeight: 858,
    maxOutputBytes: MAX_OUTPUT_BYTES_DEFAULT,
    mimeType: "image/jpeg",
    quality: 0.82,
    extension: "jpg",
    minWidth: 200,
    minHeight: 143,
  },
  logo: {
    id: "logo",
    maxWidth: 512,
    maxHeight: 512,
    maxOutputBytes: 512 * 1024, // 512 KB
    mimeType: "image/png",
    quality: 0.92,
    extension: "png",
    minWidth: 64,
    minHeight: 64,
  },
};

export class ImageProcessError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "ImageProcessError";
  }
}

/**
 * Scale dimensions to fit within max box without upscaling.
 * @param {number} width
 * @param {number} height
 * @param {number} maxWidth
 * @param {number} maxHeight
 */
export function fitWithin(width, height, maxWidth, maxHeight) {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * @param {File} file
 * @param {ImagePreset} [preset]
 */
export function validateOriginalImageFile(file, preset = IMAGE_PRESETS.activityPhoto) {
  if (!file) throw new ImageProcessError("Please choose an image file.");
  if (!file.type || !file.type.startsWith("image/")) {
    throw new ImageProcessError("Please choose an image file (JPG, PNG, or WebP).");
  }
  if (file.type === "image/svg+xml") {
    throw new ImageProcessError("SVG images aren’t supported. Please upload a JPG, PNG, or WebP.");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new ImageProcessError(
      "That image is too large to process (over 15 MB). Please choose a smaller photo."
    );
  }
  return true;
}

/**
 * @param {Blob} blob
 * @param {ImagePreset} preset
 * @param {{ width: number, height: number }} dims
 */
export function validateProcessedImage(blob, preset, dims) {
  if (!blob || blob.size <= 0) {
    throw new ImageProcessError("We couldn’t process that image. Please try a different file.");
  }
  if (dims.width < preset.minWidth || dims.height < preset.minHeight) {
    throw new ImageProcessError(
      `That image is too small. Please use at least ${preset.minWidth}×${preset.minHeight} px.`
    );
  }
  if (blob.size > preset.maxOutputBytes) {
    const mb = (preset.maxOutputBytes / (1024 * 1024)).toFixed(preset.maxOutputBytes >= 1024 * 1024 ? 0 : 1);
    throw new ImageProcessError(
      `We couldn’t shrink that image enough (over ${mb} MB). Please try a simpler photo.`
    );
  }
  return true;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageProcessError("We couldn’t read that image. Please try a different file."));
    };
    img.src = url;
  });
}

/** Decode with EXIF orientation when the browser supports it. */
async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to <img> decode (may ignore EXIF rotation).
    }
  }
  return await loadImageElement(file);
}

function sourceDimensions(source) {
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  };
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ImageProcessError("We couldn’t process that image. Please try a different file."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function drawToCanvas(source, width, height, { fillWhite = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageProcessError("This browser can’t process images.");
  if (fillWhite) {
    // Avoid black/transparent becoming black when encoding to JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** Center-crop source to exact output size (3:2 for Supporter ads). */
function drawCenterCover(source, width, height, { fillWhite = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageProcessError("This browser can’t process images.");
  if (fillWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  const { width: srcW, height: srcH } = sourceDimensions(source);
  const destRatio = width / height;
  const srcRatio = srcW / srcH;

  let cropW = srcW;
  let cropH = srcH;
  let cropX = 0;
  let cropY = 0;

  if (srcRatio > destRatio) {
    cropW = srcH * destRatio;
    cropX = (srcW - cropW) / 2;
  } else if (srcRatio < destRatio) {
    cropH = srcW / destRatio;
    cropY = (srcH - cropH) / 2;
  }

  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, width, height);
  return canvas;
}

/**
 * Encode canvas down to under maxOutputBytes by lowering quality, then scaling if needed.
 * @param {HTMLCanvasElement} canvas
 * @param {ImagePreset} preset
 */
async function encodeUnderLimit(canvas, preset) {
  let working = canvas;
  let mimeType = preset.mimeType;
  let quality = preset.quality;
  let blob = await canvasToBlob(working, mimeType, quality);

  // JPEG quality loop
  if (mimeType === "image/jpeg") {
    while (blob.size > preset.maxOutputBytes && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.1);
      blob = await canvasToBlob(working, mimeType, quality);
    }
  }

  // PNG logos can stay large — fall back to JPEG if over limit
  if (blob.size > preset.maxOutputBytes && mimeType === "image/png") {
    mimeType = "image/jpeg";
    quality = 0.85;
    working = drawToCanvas(working, working.width, working.height, { fillWhite: true });
    blob = await canvasToBlob(working, mimeType, quality);
    while (blob.size > preset.maxOutputBytes && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.1);
      blob = await canvasToBlob(working, mimeType, quality);
    }
  }

  // Still too big — scale dimensions down and retry a few times
  let guard = 0;
  while (blob.size > preset.maxOutputBytes && guard < 4) {
    guard += 1;
    const nextW = Math.max(preset.minWidth, Math.round(working.width * 0.75));
    const nextH = Math.max(preset.minHeight, Math.round(working.height * 0.75));
    if (nextW === working.width && nextH === working.height) break;
    working = drawToCanvas(working, nextW, nextH, { fillWhite: mimeType === "image/jpeg" });
    mimeType = "image/jpeg";
    quality = 0.8;
    blob = await canvasToBlob(working, mimeType, quality);
  }

  return {
    blob,
    mimeType,
    width: working.width,
    height: working.height,
    extension: mimeType === "image/png" ? "png" : "jpg",
  };
}

/**
 * Resize/compress a user-selected image, then validate the result for upload.
 * @param {File} file
 * @param {keyof typeof IMAGE_PRESETS | ImagePreset} presetOrKey
 * @returns {Promise<{ file: File, width: number, height: number, bytes: number, wasResized: boolean }>}
 */
export async function processImageForUpload(file, presetOrKey = "activityPhoto") {
  const preset =
    typeof presetOrKey === "string"
      ? IMAGE_PRESETS[presetOrKey] || IMAGE_PRESETS.activityPhoto
      : presetOrKey;

  validateOriginalImageFile(file, preset);

  const source = await loadImageSource(file);
  const { width: naturalW, height: naturalH } = sourceDimensions(source);

  if (naturalW < preset.minWidth || naturalH < preset.minHeight) {
    throw new ImageProcessError(
      `That image is too small. Please use at least ${preset.minWidth}×${preset.minHeight} px.`
    );
  }

  const fillWhite = preset.mimeType === "image/jpeg";
  let canvas;
  let outputDims;

  if (preset.id === "adCreative") {
    outputDims = supporterAdOutputDimensions(
      naturalW,
      naturalH,
      preset.maxWidth,
      preset.maxHeight,
      preset.minWidth,
      preset.minHeight
    );
    canvas = drawCenterCover(source, outputDims.width, outputDims.height, { fillWhite });
  } else if (preset.id === "defaultAd") {
    outputDims = defaultAdOutputDimensions(
      naturalW,
      naturalH,
      preset.maxWidth,
      preset.maxHeight,
      preset.minWidth,
      preset.minHeight
    );
    canvas = drawCenterCover(source, outputDims.width, outputDims.height, { fillWhite });
  } else {
    outputDims = fitWithin(naturalW, naturalH, preset.maxWidth, preset.maxHeight);
    canvas = drawToCanvas(source, outputDims.width, outputDims.height, { fillWhite });
  }

  if (typeof source.close === "function") {
    source.close();
  }

  const encoded = await encodeUnderLimit(canvas, preset);

  validateProcessedImage(encoded.blob, preset, {
    width: encoded.width,
    height: encoded.height,
  });

  const baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
  const outFile = new File([encoded.blob], `${baseName}.${encoded.extension}`, {
    type: encoded.mimeType,
    lastModified: Date.now(),
  });

  return {
    file: outFile,
    width: encoded.width,
    height: encoded.height,
    bytes: outFile.size,
    wasResized:
      outFile.size !== file.size ||
      encoded.width !== naturalW ||
      encoded.height !== naturalH,
  };
}
