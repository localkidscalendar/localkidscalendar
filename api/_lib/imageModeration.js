/**
 * Shared OpenAI vision helpers for Ad Assets and activity photos.
 * Missing key or API errors fail open to approved (community flagging is the safety net).
 */

export function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  return "";
}

/**
 * @param {{ prompt: string, imageUrl: string }} opts
 * @returns {Promise<{ status: "approved"|"declined", reason: string }>}
 */
export async function reviewImageWithOpenAI({ prompt, imageUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "approved", reason: "" };
  }
  if (!imageUrl) {
    return { status: "declined", reason: "An image is required for review." };
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
    console.error("OpenAI moderation failed:", response.status, text);
    return { status: "approved", reason: "" };
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "approved", reason: "" };
  }

  return {
    status: parsed.status === "declined" ? "declined" : "approved",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

export const AD_CREATIVE_VISION_PROMPT = (linkUrl, imageUrl) =>
  `You are a content moderator for a family-friendly community website focused on kids' activities.

Review the following advertisement:
- Destination URL: ${linkUrl}
- Ad Image URL: ${imageUrl}

Evaluate BOTH the destination URL and the ad image.

STEP A — Destination URL review:
Based on the URL/domain alone, decline if it strongly suggests adult/pornographic content, illegal products/services (drugs, weapons, gambling), hate/extremist content, or obvious scam/phishing patterns.

STEP B — Ad Image review (only clear, obvious violations):
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible or blank image
6. Content clearly inappropriate for children or families

Return ONLY valid JSON:
{"status":"approved"|"declined","reason":"explanation if declined, else empty string"}

Be lenient on imagery — only decline clear violations. Be firm on unsafe URL domains.`;

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

Be lenient — only decline for clear, obvious violations.`;
