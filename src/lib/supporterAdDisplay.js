/**
 * Supporter ad creative frame on Home / Ad Manager previews.
 * The black footer (zip + “Supporter” + link icon) sits below the image — it is not part of the upload.
 */
export const SUPPORTER_AD_CREATIVE_WIDTH = 600;
export const SUPPORTER_AD_CREATIVE_HEIGHT = 400;

/** Tailwind aspect ratio for the visible image area (footer is a separate row below). */
export const SUPPORTER_AD_IMAGE_FRAME_CLASS = "aspect-[3/2] w-full overflow-hidden";

export const SUPPORTER_AD_RECOMMENDED_LABEL = `${SUPPORTER_AD_CREATIVE_WIDTH} × ${SUPPORTER_AD_CREATIVE_HEIGHT} px (3:2 landscape)`;
