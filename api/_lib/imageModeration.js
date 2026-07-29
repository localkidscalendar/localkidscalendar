/**
 * Shared image review for Ad Assets and activity photos.
 *
 * Hybrid flow (one seamless result for the user):
 * 1) OpenAI Moderation API (free / low-cost) — clear approve or decline
 * 2) Custom gpt-4o-mini vision — only when Moderation scores are in the gray middle
 *
 * Missing key or API errors fail open to approved (community flagging is the safety net).
 * Destination URL safety for ads is handled separately in creative-review.js.
 */

export const MODERATION_HIGH_THRESHOLD = 0.85;
export const MODERATION_LOW_THRESHOLD = 0.2;

/** Categories we treat as hard safety signals for image review. */
export const MODERATION_CATEGORY_REASONS = {
  sexual:
    "This image appears to contain sexual or explicit content, which isn't allowed on a family-friendly kids' activities site.",
  "sexual/minors":
    "This image was flagged for sexual content involving minors and cannot be used.",
  violence:
    "This image appears to show violence, which isn't appropriate for a family-friendly kids' activities site.",
  "violence/graphic":
    "This image appears to show graphic violence or gore, which isn't allowed on this site.",
  "self-harm":
    "This image appears to depict self-harm, which isn't allowed on this site.",
  "self-harm/intent":
    "This image appears related to self-harm, which isn't allowed on this site.",
  "self-harm/instructions":
    "This image appears related to self-harm, which isn't allowed on this site.",
  hate:
    "This image appears to include hate or discriminatory content, which isn't allowed on this site.",
  "hate/threatening":
    "This image appears to include hateful or threatening content, which isn't allowed on this site.",
  harassment:
    "This image appears to include harassing content, which isn't allowed on this site.",
  "harassment/threatening":
    "This image appears to include threatening harassment, which isn't allowed on this site.",
  illicit:
    "This image appears related to illegal or illicit activity, which isn't allowed on this site.",
  "illicit/violent":
    "This image appears related to violent illicit activity, which isn't allowed on this site.",
};

const FALLBACK_DECLINE_REASON =
  "This image doesn't meet our family-friendly community guidelines. Please upload a different photo.";

export function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  return "";
}

/**
 * Pick the strongest moderation category and return a natural-language decline reason.
 * @param {Record<string, boolean>} categories
 * @param {Record<string, number>} scores
 */
export function reasonFromModerationCategories(categories = {}, scores = {}) {
  const ranked = Object.keys(MODERATION_CATEGORY_REASONS)
    .map((key) => ({
      key,
      score: Number(scores[key] || 0),
      flagged: Boolean(categories[key]),
    }))
    .sort((a, b) => b.score - a.score || Number(b.flagged) - Number(a.flagged));

  const top = ranked.find((r) => r.flagged || r.score >= MODERATION_HIGH_THRESHOLD) || ranked[0];
  if (!top || (!top.flagged && top.score < MODERATION_LOW_THRESHOLD)) {
    return FALLBACK_DECLINE_REASON;
  }
  return MODERATION_CATEGORY_REASONS[top.key] || FALLBACK_DECLINE_REASON;
}

/**
 * @param {{ flagged?: boolean, categories?: Record<string, boolean>, category_scores?: Record<string, number> }} result
 * @returns {"approve"|"decline"|"escalate"}
 */
export function decideModerationPhase(result) {
  const scores = result?.category_scores || {};
  const categories = result?.categories || {};
  const relevantKeys = Object.keys(MODERATION_CATEGORY_REASONS);
  const maxScore = relevantKeys.reduce((max, key) => Math.max(max, Number(scores[key] || 0)), 0);
  const anyHardFlag = relevantKeys.some((key) => Boolean(categories[key]));

  if (maxScore >= MODERATION_HIGH_THRESHOLD) {
    return "decline";
  }
  // Flagged with a strong-enough score still declines even if just under the high bar
  if (anyHardFlag && maxScore >= 0.7) {
    return "decline";
  }
  if (maxScore <= MODERATION_LOW_THRESHOLD && !anyHardFlag && !result?.flagged) {
    return "approve";
  }
  return "escalate";
}

/**
 * Phase 1: free OpenAI Moderation API (omni multimodal).
 * @returns {Promise<null | { status: "approved"|"declined", reason: string, phase: "moderation" } | { status: "escalate", phase: "moderation", raw: object }>}
 */
export async function reviewImageWithModerationApi(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!imageUrl) {
    return {
      status: "declined",
      reason: "An image is required for review.",
      phase: "moderation",
    };
  }

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [
        {
          type: "image_url",
          image_url: { url: imageUrl },
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI Moderation API failed:", response.status, text);
    return { status: "escalate", phase: "moderation", raw: null };
  }

  const payload = await response.json();
  const raw = payload?.results?.[0];
  if (!raw) {
    return { status: "escalate", phase: "moderation", raw: null };
  }

  const decision = decideModerationPhase(raw);
  if (decision === "decline") {
    return {
      status: "declined",
      reason: reasonFromModerationCategories(raw.categories, raw.category_scores),
      phase: "moderation",
    };
  }
  if (decision === "approve") {
    return { status: "approved", reason: "", phase: "moderation" };
  }
  return { status: "escalate", phase: "moderation", raw };
}

/**
 * Phase 2: custom gpt-4o-mini vision with product-specific prompt.
 * @param {{ prompt: string, imageUrl: string }} opts
 * @returns {Promise<{ status: "approved"|"declined", reason: string, phase: "vision" }>}
 */
export async function reviewImageWithOpenAI({ prompt, imageUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "approved", reason: "", phase: "vision" };
  }
  if (!imageUrl) {
    return { status: "declined", reason: "An image is required for review.", phase: "vision" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI vision moderation failed:", response.status, text);
    return { status: "approved", reason: "", phase: "vision" };
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "approved", reason: "", phase: "vision" };
  }

  return {
    status: parsed.status === "declined" ? "declined" : "approved",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    phase: "vision",
  };
}

/**
 * Full hybrid review: Moderation API first, custom vision only when needed.
 * Looks like one review to the caller/user.
 * @param {{ prompt: string, imageUrl: string }} opts
 * @returns {Promise<{ status: "approved"|"declined", reason: string, phase: string }>}
 */
export async function reviewImageHybrid({ prompt, imageUrl }) {
  if (!imageUrl) {
    return { status: "declined", reason: "An image is required for review.", phase: "none" };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { status: "approved", reason: "", phase: "none" };
  }

  let phase1;
  try {
    phase1 = await reviewImageWithModerationApi(imageUrl);
  } catch (err) {
    console.error("Moderation API error:", err);
    phase1 = { status: "escalate", phase: "moderation", raw: null };
  }

  if (phase1?.status === "approved" || phase1?.status === "declined") {
    return {
      status: phase1.status,
      reason: phase1.reason || "",
      phase: phase1.phase || "moderation",
    };
  }

  // Gray middle (or Moderation unavailable) → custom vision
  try {
    return await reviewImageWithOpenAI({ prompt, imageUrl });
  } catch (err) {
    console.error("Vision review error:", err);
    return { status: "approved", reason: "", phase: "vision" };
  }
}

export const AD_CREATIVE_VISION_PROMPT = `You are a content moderator for a family-friendly community website focused on kids' activities.

Review the advertisement image only (the destination URL was already checked separately).

Decline only for clear, obvious violations:
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible or blank image
6. Content clearly inappropriate for children or families

Return ONLY valid JSON:
{"status":"approved"|"declined","reason":"explanation if declined, else empty string"}

Be lenient — only decline clear violations. When declining, write a short, plain-language reason a parent or local business owner can understand.`;

export const ACTIVITY_PHOTO_VISION_PROMPT = `You are a content moderator for a family-friendly community website that lists kids' activities (camps, classes, sports, events).

Review the following photo, which an Organizer is uploading as the cover photo for a kids' activity listing.

Analyze the image for the following HIGH-LEVEL concerns only (do not be overly strict — only flag clear, obvious violations):
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible, blank, or corrupted image (no meaningful content)
6. Content clearly inappropriate for children or families

Return ONLY valid JSON:
{"status":"approved"|"declined","reason":"explanation if declined, else empty string"}

Be lenient — only decline for clear, obvious violations. When declining, write a short, plain-language reason a parent or organizer can understand.`;
