import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, formatPhoneInput } from "../../src/lib/phone.js";
import {
  isAccountDisabled,
  isRegisteredUser,
  restoreRoleFromProfile,
} from "../../src/lib/authRoles.js";
import { normalizeRadiusMiles, DEFAULT_RADIUS_MILES } from "../../src/lib/locationDefaults.js";
import { toTitleCaseLabel } from "../../src/lib/titleCase.js";
import { messageActionPageByHref, MESSAGE_ACTION_PAGES } from "../../src/lib/messageActionPages.js";
import { pickDefaultFillerAds } from "../../shared/pickDefaultFillerAds.js";
import { buildCardFeedItems, buildListFeedSegments } from "../../src/lib/feedAdPlacement.js";
import { betaZipsForDisplay, isZipAllowed } from "../../src/lib/betaZipDisplay.js";
import { buildDigestHtml, DIGEST_SAMPLE_EVENTS } from "../../shared/digestEmailHtml.js";
import { parseContactSubmitBody } from "../../api/_lib/contactBotGuards.js";
import { parseTurnstileVerifyBody } from "../../api/_lib/turnstileFormGuards.js";
import { isAdminCaller } from "../../api/_lib/adminAuth.js";
import {
  alreadySentDigestThisWeek,
  isEmailSendingEnabled,
  makeDigestUnsubToken,
  verifyDigestUnsubToken,
} from "../../api/_lib/emailGuards.js";
import {
  decideModerationPhase,
  reasonFromModerationCategories,
  MODERATION_HIGH_THRESHOLD,
  MODERATION_LOW_THRESHOLD,
} from "../../api/_lib/imageModeration.js";
import {
  fitWithin,
  validateOriginalImageFile,
  IMAGE_PRESETS,
  MAX_ORIGINAL_BYTES,
  MAX_OUTPUT_BYTES_DEFAULT,
} from "../../src/lib/imageProcess.js";
import { validateBusinessLinkUrl } from "../../shared/linkUrlSafety.js";

describe("phone helpers", () => {
  it("masks progressive input", () => {
    expect(formatPhoneInput("5")).toBe("(5");
    expect(formatPhoneInput("555123")).toBe("(555) 123");
    expect(formatPhoneInput("5551234567")).toBe("(555) 123-4567");
    expect(formatPhoneInput("55512345678999")).toBe("(555) 123-4567");
  });

  it("displays 10-digit and +1 numbers", () => {
    expect(formatPhoneDisplay("5551234567")).toBe("(555) 123-4567");
    expect(formatPhoneDisplay("15551234567")).toBe("(555) 123-4567");
    expect(formatPhoneDisplay("ext 12")).toBe("ext 12");
  });
});

describe("authRoles", () => {
  it("detects disabled and registered users", () => {
    expect(isAccountDisabled({ role: "disabled" })).toBe(true);
    expect(isAccountDisabled({ role: "community_member" })).toBe(false);
    expect(isRegisteredUser({ role: "organizer" })).toBe(true);
    expect(isRegisteredUser({ role: "disabled" })).toBe(false);
  });

  it("restores prior role safely", () => {
    expect(restoreRoleFromProfile({ role_before_disabled: "organizer" })).toBe("organizer");
    expect(restoreRoleFromProfile({ role_before_disabled: "admin" })).toBe("admin");
    expect(restoreRoleFromProfile({})).toBe("community_member");
  });
});

describe("locationDefaults", () => {
  it("normalizes radius", () => {
    expect(normalizeRadiusMiles(25)).toBe(25);
    expect(normalizeRadiusMiles("0")).toBe(DEFAULT_RADIUS_MILES);
    expect(normalizeRadiusMiles(null)).toBe(DEFAULT_RADIUS_MILES);
  });
});

describe("toTitleCaseLabel", () => {
  it("title-cases labels and keeps separators", () => {
    expect(toTitleCaseLabel("open ad manager")).toBe("Open Ad Manager");
    expect(toTitleCaseLabel("tips for supporters")).toBe("Tips For Supporters");
    expect(toTitleCaseLabel("camps & lessons")).toBe("Camps & Lessons");
  });
});

describe("messageActionPages", () => {
  it("resolves known hrefs and stays unique", () => {
    expect(messageActionPageByHref("/ad-manager")?.label).toBe("Ad Manager");
    expect(messageActionPageByHref("/nope")).toBeNull();
    const hrefs = MESSAGE_ACTION_PAGES.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("pickDefaultFillerAds", () => {
  it("orders slot flags and respects emptySlots", () => {
    const ads = [
      { id: "c", is_slot_3: true },
      { id: "a", is_slot_1: true },
      { id: "b", is_slot_2: true },
    ];
    expect(pickDefaultFillerAds(ads, 2).map((a) => a.id)).toEqual(["a", "b"]);
    expect(pickDefaultFillerAds(ads, 0)).toEqual([]);
  });
});

describe("feedAdPlacement", () => {
  const events = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}` }));
  const ads = (n) => Array.from({ length: n }, (_, i) => ({ type: "paid", ad: { id: `a${i + 1}` } }));

  it("cards: dumps ads after events when fewer than 6 activities", () => {
    const items = buildCardFeedItems(events(3), ads(3), 0);
    expect(items.map((x) => x.type)).toEqual([
      "event", "event", "event", "ad", "ad", "ad",
    ]);
  });

  it("cards: places first three ads in first three rows then content gap before 4th", () => {
    const items = buildCardFeedItems(events(12), ads(4), 0);
    const types = items.map((x) => x.type);
    // Row0: ad+2ev, row1: ad+2ev, row2: ad+2ev, row3: 3ev, row4: ad+2ev …
    expect(types.filter((t) => t === "ad")).toHaveLength(4);
    const adIndexes = types.map((t, i) => (t === "ad" ? i : -1)).filter((i) => i >= 0);
    expect(adIndexes[0]).toBeLessThan(3);
    expect(adIndexes[3]).toBeGreaterThanOrEqual(9); // after first wave + content row
  });

  it("list: first ad row after 3 activities; second after 6 more", () => {
    const segments = buildListFeedSegments(events(12), ads(5));
    expect(segments.map((s) => [s.type, s.items.length])).toEqual([
      ["events", 3],
      ["ads", 3],
      ["events", 6],
      ["ads", 2],
      ["events", 3],
    ]);
  });

  it("list: leftover ads append when the activity list ends early", () => {
    const segments = buildListFeedSegments(events(2), ads(5));
    expect(segments.map((s) => [s.type, s.items.length])).toEqual([
      ["events", 2],
      ["ads", 3],
      ["ads", 2],
    ]);
  });
});

describe("buildDigestHtml", () => {
  it("includes event titles and unsubscribe link", () => {
    const html = buildDigestHtml({
      userName: "Alex",
      events: DIGEST_SAMPLE_EVENTS.slice(0, 2),
      ads: [],
      unsubscribeUrl: "https://localkidscalendar.com/unsubscribe?token=test",
      appUrl: "https://localkidscalendar.com",
    });
    expect(html).toContain("Summer Soccer Camp");
    expect(html).toContain("Art & Crafts Workshop");
    expect(html).toContain("Hi Alex!");
    expect(html).toContain("unsubscribe?token=test");
  });
});

describe("betaZipsForDisplay", () => {
  const betaConfig = { enabled: true, zip_codes: ["89448", "00000", "89451"] };

  it("hides internal sample zips from public lists", () => {
    expect(betaZipsForDisplay(betaConfig.zip_codes)).toEqual(["89448", "89451"]);
  });

  it("still allows hidden zips for isZipAllowed", () => {
    expect(isZipAllowed("00000", betaConfig)).toBe(true);
    expect(isZipAllowed("90210", betaConfig)).toBe(false);
  });
});

describe("parseContactSubmitBody", () => {
  it("rejects honeypot fills as bot", () => {
    const result = parseContactSubmitBody({
      website: "http://spam.test",
      form_loaded_at: Date.now() - 5000,
      sender_name: "A",
      sender_email: "a@example.com",
      subject: "General Questions",
      message: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(result.bot).toBe(true);
  });

  it("accepts valid payload after min wait", () => {
    const result = parseContactSubmitBody({
      form_loaded_at: Date.now() - 5000,
      sender_name: "Alex",
      sender_email: "alex@example.com",
      subject: "General Questions",
      message: "Hello there",
      turnstile_token: "token",
    });
    expect(result.ok).toBe(true);
    expect(result.payload.sender_email).toBe("alex@example.com");
  });
});

describe("parseTurnstileVerifyBody", () => {
  it("rejects honeypot fills as bot", () => {
    const result = parseTurnstileVerifyBody({
      action: "register",
      website: "http://spam.test",
      form_loaded_at: Date.now() - 5000,
      turnstile_token: "token",
    });
    expect(result.ok).toBe(false);
    expect(result.bot).toBe(true);
  });

  it("rejects too-fast register submits as bot", () => {
    const result = parseTurnstileVerifyBody({
      action: "register",
      form_loaded_at: Date.now() - 500,
      turnstile_token: "token",
    });
    expect(result.ok).toBe(false);
    expect(result.bot).toBe(true);
  });

  it("accepts register and reactivate after min wait", () => {
    const register = parseTurnstileVerifyBody({
      action: "register",
      form_loaded_at: Date.now() - 5000,
      turnstile_token: "token",
    });
    expect(register.ok).toBe(true);
    expect(register.payload.action).toBe("register");

    const reactivate = parseTurnstileVerifyBody({
      action: "reactivate",
      form_loaded_at: Date.now() - 5000,
      turnstile_token: "token",
    });
    expect(reactivate.ok).toBe(true);
    expect(reactivate.payload.action).toBe("reactivate");
  });

  it("rejects contact action (uses contact-submit instead)", () => {
    const result = parseTurnstileVerifyBody({
      action: "contact",
      form_loaded_at: Date.now() - 5000,
      turnstile_token: "token",
    });
    expect(result.ok).toBe(false);
    expect(result.bot).toBe(false);
  });
});

describe("adminAuth", () => {
  it("allows role admin or allowlisted email", () => {
    expect(isAdminCaller({ role: "admin" })).toBe(true);
    expect(isAdminCaller({ role: "community_member", email: "localkidscalendar@gmail.com" })).toBe(
      true
    );
    expect(isAdminCaller({ role: "community_member", email: "other@example.com" })).toBe(false);
  });
});

describe("emailGuards", () => {
  it("respects EMAIL_SENDING_ENABLED", () => {
    const prev = process.env.EMAIL_SENDING_ENABLED;
    process.env.EMAIL_SENDING_ENABLED = "false";
    expect(isEmailSendingEnabled()).toBe(false);
    process.env.EMAIL_SENDING_ENABLED = "true";
    expect(isEmailSendingEnabled()).toBe(true);
    if (prev === undefined) delete process.env.EMAIL_SENDING_ENABLED;
    else process.env.EMAIL_SENDING_ENABLED = prev;
  });

  it("round-trips unsubscribe tokens", () => {
    process.env.CRON_SECRET = process.env.CRON_SECRET || "unit-test-secret";
    const userId = "11111111-2222-3333-4444-555555555555";
    const token = makeDigestUnsubToken(userId);
    expect(verifyDigestUnsubToken(token)).toBe(userId);
    expect(verifyDigestUnsubToken("bad.token")).toBeNull();
  });

  it("detects same-week digest sends", () => {
    expect(alreadySentDigestThisWeek(new Date().toISOString())).toBe(true);
    expect(alreadySentDigestThisWeek(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())).toBe(
      false
    );
    expect(alreadySentDigestThisWeek(null)).toBe(false);
  });
});

describe("imageModeration hybrid phase decision", () => {
  it("declines high-confidence sexual content", () => {
    expect(
      decideModerationPhase({
        flagged: true,
        categories: { sexual: true },
        category_scores: { sexual: 0.92 },
      })
    ).toBe("decline");
  });

  it("approves clearly clean images", () => {
    expect(
      decideModerationPhase({
        flagged: false,
        categories: { sexual: false, violence: false },
        category_scores: { sexual: 0.01, violence: 0.02 },
      })
    ).toBe("approve");
  });

  it("escalates medium / gray scores to custom vision", () => {
    expect(
      decideModerationPhase({
        flagged: false,
        categories: { sexual: false },
        category_scores: { sexual: 0.45 },
      })
    ).toBe("escalate");
  });

  it("declines flagged content with strong mid-high scores", () => {
    expect(
      decideModerationPhase({
        flagged: true,
        categories: { "violence/graphic": true },
        category_scores: { "violence/graphic": 0.75 },
      })
    ).toBe("decline");
  });

  it("maps moderation categories to natural-language reasons", () => {
    const reason = reasonFromModerationCategories(
      { sexual: true },
      { sexual: MODERATION_HIGH_THRESHOLD }
    );
    expect(reason.toLowerCase()).toContain("sexual");
    expect(reason).not.toMatch(/^sexual$/i);
  });

  it("keeps threshold constants in expected bands", () => {
    expect(MODERATION_LOW_THRESHOLD).toBeLessThan(MODERATION_HIGH_THRESHOLD);
    expect(MODERATION_LOW_THRESHOLD).toBe(0.2);
    expect(MODERATION_HIGH_THRESHOLD).toBe(0.85);
  });
});

describe("imageProcess sizing helpers", () => {
  it("fits within max box without upscaling", () => {
    expect(fitWithin(4000, 3000, 1600, 1200)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2000, 500, 1200, 800)).toEqual({ width: 1200, height: 300 });
  });

  it("rejects non-images and oversized originals", () => {
    expect(() =>
      validateOriginalImageFile(new File(["x"], "a.txt", { type: "text/plain" }))
    ).toThrow(/image file/i);
    expect(() =>
      validateOriginalImageFile(
        new File([new Uint8Array(MAX_ORIGINAL_BYTES + 1)], "big.jpg", { type: "image/jpeg" })
      )
    ).toThrow(/15 MB/i);
  });

  it("exposes expected preset ceilings", () => {
    expect(IMAGE_PRESETS.activityPhoto.maxWidth).toBe(1600);
    expect(IMAGE_PRESETS.adCreative.maxHeight).toBe(800);
    expect(IMAGE_PRESETS.defaultAd.maxHeight).toBe(858);
    expect(IMAGE_PRESETS.logo.maxOutputBytes).toBe(512 * 1024);
    expect(MAX_OUTPUT_BYTES_DEFAULT).toBe(2 * 1024 * 1024);
  });
});

describe("supporterAdDisplay", () => {
  it("keeps exact 600x400 output dimensions", async () => {
    const { supporterAdOutputDimensions } = await import("../../src/lib/supporterAdDisplay.js");
    expect(
      supporterAdOutputDimensions(600, 400, 1200, 800, 300, 200)
    ).toEqual({ width: 600, height: 400 });
  });

  it("center-crops wider sources to 3:2 within max box", async () => {
    const { supporterAdOutputDimensions } = await import("../../src/lib/supporterAdDisplay.js");
    expect(
      supporterAdOutputDimensions(1200, 800, 1200, 800, 300, 200)
    ).toEqual({ width: 1200, height: 800 });
    expect(
      supporterAdOutputDimensions(1200, 600, 1200, 800, 300, 200)
    ).toEqual({ width: 900, height: 600 });
  });

  it("sizes default ads to match supporter card total height", async () => {
    const { defaultAdOutputDimensions } = await import("../../src/lib/supporterAdDisplay.js");
    expect(
      defaultAdOutputDimensions(600, 429, 1200, 858, 200, 143)
    ).toEqual({ width: 600, height: 429 });
  });
});

describe("linkUrlSafety", () => {
  it("requires a public domain with a dot", () => {
    expect(validateBusinessLinkUrl("https://yourbusiness.com").ok).toBe(true);
    expect(validateBusinessLinkUrl("yourbusiness.com").ok).toBe(true);
    expect(validateBusinessLinkUrl("https://www.yourbusiness.com").ok).toBe(true);
    expect(validateBusinessLinkUrl("mybusiness").ok).toBe(false);
    expect(validateBusinessLinkUrl("https://foo").ok).toBe(false);
  });

  it("rejects www without a real TLD (e.g. www.sftahoe)", () => {
    expect(validateBusinessLinkUrl("www.sftahoe").ok).toBe(false);
    expect(validateBusinessLinkUrl("https://www.sftahoe").ok).toBe(false);
    expect(validateBusinessLinkUrl("www.sftahoe.com").ok).toBe(true);
  });

  it("rejects unsafe keywords in hostname or path", () => {
    const bad = validateBusinessLinkUrl("https://adult.example.com");
    expect(bad.ok).toBe(false);
  });
});
