import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENEWAL_CANCELLATION_WINDOW_DAYS,
  canResumeAutoRenew,
  daysUntilDate,
  isWithinCancellationLock,
} from "../../shared/adRenewalPolicy.js";
import { planDates, formatDateYmdLocal } from "../../api/_lib/stripeHelpers.js";
import { billingFieldsFromStripeSubscription } from "../../api/_lib/syncAdSubscription.js";

describe("adRenewalPolicy cancellation lock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 12, 0, 0)); // Oct 6, 2026 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a past renewal date as not locked (stale term must not block cancel)", () => {
    const ad = { next_renewal_date: "2026-10-01" };
    expect(daysUntilDate(ad.next_renewal_date)).toBe(-5);
    expect(isWithinCancellationLock(ad)).toBe(false);
    expect(canResumeAutoRenew(ad)).toBe(false);
  });

  it("locks only when renewal is still upcoming within the window", () => {
    expect(isWithinCancellationLock({ next_renewal_date: "2026-10-12" })).toBe(true);
    expect(isWithinCancellationLock({ next_renewal_date: "2026-10-20" })).toBe(false);
    expect(canResumeAutoRenew({ next_renewal_date: "2026-10-20" })).toBe(true);
    expect(RENEWAL_CANCELLATION_WINDOW_DAYS).toBe(14);
  });

  it("locks on the renewal day itself (0 days left)", () => {
    expect(isWithinCancellationLock({ next_renewal_date: "2026-10-06" })).toBe(true);
  });
});

describe("planDates anniversary billing", () => {
  it("monthly renews on the same day next month (not month-start)", () => {
    expect(planDates("monthly", new Date(2026, 9, 12))).toEqual({
      start: "2026-10-12",
      end: "2026-11-12",
    });
    expect(planDates("monthly", new Date(2026, 9, 28))).toEqual({
      start: "2026-10-28",
      end: "2026-11-28",
    });
  });

  it("annual renews on the same calendar day next year", () => {
    expect(planDates("annual", new Date(2026, 9, 12))).toEqual({
      start: "2026-10-12",
      end: "2027-10-12",
    });
  });

  it("formatDateYmdLocal matches local calendar day", () => {
    expect(formatDateYmdLocal(new Date(2026, 9, 6))).toBe("2026-10-06");
  });
});

describe("billingFieldsFromStripeSubscription", () => {
  it("maps Stripe period unix timestamps to YYYY-MM-DD renewal fields", () => {
    // 2026-10-01T00:00:00.000Z → 2026-11-01T00:00:00.000Z
    const fields = billingFieldsFromStripeSubscription({
      current_period_start: Date.UTC(2026, 9, 1) / 1000,
      current_period_end: Date.UTC(2026, 10, 1) / 1000,
      cancel_at_period_end: false,
    });
    expect(fields).toEqual({
      plan_start_date: "2026-10-01",
      plan_end_date: "2026-11-01",
      next_renewal_date: "2026-11-01",
      auto_renew: true,
    });
  });

  it("sets auto_renew false when Stripe cancel_at_period_end is true", () => {
    const fields = billingFieldsFromStripeSubscription({
      current_period_start: Date.UTC(2026, 9, 1) / 1000,
      current_period_end: Date.UTC(2026, 10, 1) / 1000,
      cancel_at_period_end: true,
    });
    expect(fields.auto_renew).toBe(false);
  });
});
