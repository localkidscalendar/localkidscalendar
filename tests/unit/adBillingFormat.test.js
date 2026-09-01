import { describe, expect, it } from "vitest";
import {
  formatAdPlanRate,
  formatPaymentMethodLabel,
  formatPlanTypeLabel,
} from "@/lib/adBilling";

describe("formatPlanTypeLabel", () => {
  it("labels monthly and annual plans", () => {
    expect(formatPlanTypeLabel("monthly")).toBe("Monthly plan");
    expect(formatPlanTypeLabel("annual")).toBe("Annual plan");
  });
});

describe("formatAdPlanRate", () => {
  it("formats monthly and annual rates from rate_at_purchase", () => {
    expect(formatAdPlanRate({ plan_type: "monthly", rate_at_purchase: 150 })).toBe("$150/mo");
    expect(formatAdPlanRate({ plan_type: "annual", rate_at_purchase: 1260 })).toBe("$1,260/yr");
  });

  it("returns null when rate is missing", () => {
    expect(formatAdPlanRate({ plan_type: "monthly" })).toBeNull();
    expect(formatAdPlanRate({ plan_type: "monthly", rate_at_purchase: null })).toBeNull();
  });
});

describe("formatPaymentMethodLabel", () => {
  it("formats cards, Link, and bank accounts", () => {
    expect(
      formatPaymentMethodLabel({
        type: "card",
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2030,
      })
    ).toBe("Visa •••• 4242 · Exp 12/30");
    expect(formatPaymentMethodLabel({ type: "link", label: "Stripe Link" })).toBe("Stripe Link");
    expect(
      formatPaymentMethodLabel({
        type: "card",
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2030,
        via_link: true,
      })
    ).toBe("Visa •••• 4242 · Exp 12/30 (via Link)");
  });
});
