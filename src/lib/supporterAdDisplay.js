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

/** Layout-only footer row (height sizer for default/filler ads that omit the bar). */
export const SUPPORTER_AD_FOOTER_LAYOUT_CLASS =
  "shrink-0 px-3 py-1.5 flex items-center justify-between gap-2 border-t border-black";

/** Visible Supporter footer on Home. */
export const SUPPORTER_AD_FOOTER_VISIBLE_CLASS =
  "bg-black/90 backdrop-blur-sm";

export const SUPPORTER_AD_FOOTER_ROW_CLASS = `${SUPPORTER_AD_FOOTER_LAYOUT_CLASS} ${SUPPORTER_AD_FOOTER_VISIBLE_CLASS}`;

export const SUPPORTER_AD_CREATIVE_RATIO =
  SUPPORTER_AD_CREATIVE_WIDTH / SUPPORTER_AD_CREATIVE_HEIGHT;

/** Human-readable recommended creative size (visible photo area only). */
export const SUPPORTER_AD_RECOMMENDED_LABEL = `${SUPPORTER_AD_CREATIVE_WIDTH} × ${SUPPORTER_AD_CREATIVE_HEIGHT} px (3:2)`;

/**
 * Default/filler ad creative — full card height on Home (Supporter 3:2 image + footer row, no bar).
 * Reference size at 600px width: 400px image + ~29px footer row.
 */
export const DEFAULT_AD_CREATIVE_WIDTH = SUPPORTER_AD_CREATIVE_WIDTH;
export const DEFAULT_AD_CREATIVE_HEIGHT = 429;

export const DEFAULT_AD_CREATIVE_RATIO =
  DEFAULT_AD_CREATIVE_WIDTH / DEFAULT_AD_CREATIVE_HEIGHT;

export const DEFAULT_AD_RECOMMENDED_LABEL = `${DEFAULT_AD_CREATIVE_WIDTH} × ${DEFAULT_AD_CREATIVE_HEIGHT} px`;

/**
 * Center-crop output size for a target aspect ratio within max/min boxes.
 */
export function adCreativeOutputDimensions(
  naturalW,
  naturalH,
  maxW,
  maxH,
  minW,
  minH,
  targetRatio
) {
  let scale = Math.min(1, maxW / naturalW, maxH / naturalH);
  let outW = Math.max(1, Math.round(naturalW * scale));
  let outH = Math.max(1, Math.round(naturalH * scale));

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
  return adCreativeOutputDimensions(
    naturalW,
    naturalH,
    maxW,
    maxH,
    minW,
    minH,
    SUPPORTER_AD_CREATIVE_RATIO
  );
}

/** Output pixel size for a default/filler ad upload (matches Supporter card total height). */
export function defaultAdOutputDimensions(
  naturalW,
  naturalH,
  maxW,
  maxH,
  minW,
  minH
) {
  return adCreativeOutputDimensions(
    naturalW,
    naturalH,
    maxW,
    maxH,
    minW,
    minH,
    DEFAULT_AD_CREATIVE_RATIO
  );
}
