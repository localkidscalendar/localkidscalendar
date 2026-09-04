import { describe, expect, it } from "vitest";
import {
  applyDiscountToRate,
  formatAdPayingRate,
  formatAdRenewalRateNote,
  getAdTermRates,
  isAdDiscountActive,
  willDiscountApplyAtNextRenewal,
} from "../../shared/adRateDisplay.js";
import { formatAdPlanRate, formatPlanTypeLabel } from "@/lib/adBilling";

describe("formatPlanTypeLabel", () => {
  it("labels monthly and annual plans", () => {
    expect(formatPlanTypeLabel("monthly")).toBe("Monthly plan");
    expect(formatPlanTypeLabel("annual")).toBe("Annual plan");
  });
});

describe("getAdTermRates", () => {
  it("uses locked list rate and applies an active discount", () => {
    expect(
      getAdTermRates({
        plan_type: "monthly",
        rate_at_purchase: 150,
        discount_amount: 20,
        discount_renewals_applicable: 0,
        discount_cycles_used: 0,
      })
    ).toEqual({
      listRate: 150,
      effectiveRate: 120,
      discountPercent: 20,
      discountActive: true,
      discountCode: null,
    });
    expect(formatAdPayingRate({
      plan_type: "monthly",
      rate_at_purchase: 150,
      discount_amount: 20,
      discount_renewals_applicable: 0,
    })).toBe("$120/mo");
  });

  it("stops applying a one-term discount after the cycle is used", () => {
    const ad = {
      plan_type: "annual",
      rate_at_purchase: 1260,
      discount_amount: 10,
      discount_renewals_applicable: 1,
      discount_cycles_used: 1,
    };
    expect(isAdDiscountActive(ad)).toBe(false);
    expect(getAdTermRates(ad).effectiveRate).toBe(1260);
    expect(formatAdPayingRate(ad)).toBe("$1,260/yr");
  });

  it("returns null when no locked rate is stored", () => {
    expect(formatAdPayingRate({ plan_type: "monthly" })).toBeNull();
    expect(formatAdPlanRate({ plan_type: "monthly", rate_at_purchase: null })).toBeNull();
  });
});

describe("applyDiscountToRate", () => {
  it("rounds discounted amounts to cents", () => {
    expect(applyDiscountToRate(150, 20)).toBe(120);
    expect(applyDiscountToRate(1260, 15)).toBe(1071);
  });
});

describe("formatAdRenewalRateNote", () => {
  it("leads with discount continuation for ongoing discounts", () => {
    expect(
      formatAdRenewalRateNote({
        rate_at_purchase: 150,
        discount_amount: 20,
        discount_renewals_applicable: 0,
        discount_cycles_used: 0,
      })
    ).toBe(
      "Your 20% discount continues at each renewal (on the published list rate locked 21 days prior)."
    );
    expect(
      willDiscountApplyAtNextRenewal({
        discount_amount: 20,
        discount_renewals_applicable: 0,
        discount_cycles_used: 0,
      })
    ).toBe(true);
  });

  it("treats legacy discount rows without a renewals limit as ongoing", () => {
    expect(
      formatAdRenewalRateNote({
        rate_at_purchase: 150,
        discount_amount: 15,
        discount_code_used: "SAVE15",
      })
    ).toContain("continues at each renewal");
  });

  it("marks the last discounted term when the next renewal drops the discount", () => {
    expect(
      formatAdRenewalRateNote({
        rate_at_purchase: 150,
        discount_amount: 20,
        discount_renewals_applicable: 1,
        discount_cycles_used: 0,
      })
    ).toContain("last discounted term");
    expect(
      willDiscountApplyAtNextRenewal({
        discount_amount: 20,
        discount_renewals_applicable: 1,
        discount_cycles_used: 0,
      })
    ).toBe(false);
  });

  it("uses the plain published-rate note when no discount applies", () => {
    expect(
      formatAdRenewalRateNote({
        rate_at_purchase: 150,
        discount_amount: null,
      })
    ).toBe("Next renewal uses the published rate locked 21 days before renewal.");
  });
});
