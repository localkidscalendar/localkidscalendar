/**
 * Supporter ad creative frame on Home / Ad Manager previews.
 * The black footer (zip + “Supporter” + link icon) sits below the image — it is not part of the upload.
 */
export const SUPPORTER_AD_CREATIVE_WIDTH = 600;
export const SUPPORTER_AD_CREATIVE_HEIGHT = 400;

/** Tailwind aspect ratio for the visible image area (footer is a separate row below). */
export const SUPPORTER_AD_IMAGE_FRAME_CLASS = "aspect-[3/2] w-full overflow-hidden relative";

/** Image inside the frame — object-contain shows the full creative (stored as 3:2). */
export const SUPPORTER_AD_IMAGE_CLASS = "absolute inset-0 w-full h-full object-contain block";

export const SUPPORTER_AD_CREATIVE_RATIO =
  SUPPORTER_AD_CREATIVE_WIDTH / SUPPORTER_AD_CREATIVE_HEIGHT;

/** Human-readable recommended creative size (visible photo area only). */
export const SUPPORTER_AD_RECOMMENDED_LABEL = `${SUPPORTER_AD_CREATIVE_WIDTH} × ${SUPPORTER_AD_CREATIVE_HEIGHT} px (3:2)`;

/**
 * Output pixel size for a Supporter ad upload: 3:2, within max box, honoring minimums.
 */
export function supporterAdOutputDimensions(
  naturalW,
  naturalH,
  maxW,
  maxH,
  minW,
  minH
) {
  let scale = Math.min(1, maxW / naturalW, maxH / naturalH);
  let outW = Math.max(1, Math.round(naturalW * scale));
  let outH = Math.max(1, Math.round(naturalH * scale));

  const targetRatio = SUPPORTER_AD_CREATIVE_RATIO;
  let cropW = outW;
  let cropH = Math.round(cropW / targetRatio);
  if (cropH > outH) {
    cropH = outH;
    cropW = Math.round(cropH * targetRatio);
  }

  cropW = Math.max(minW, cropW);
  cropH = Math.max(minH, cropH);
  if (cropW / cropH > targetRatio) {
    cropH = Math.round(cropW / targetRatio);
  } else {
    cropW = Math.round(cropH * targetRatio);
  }

  return { width: cropW, height: cropH };
}
