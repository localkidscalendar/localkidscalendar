import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@14.5.0';
import { isAuthorizedInternalCall } from '../../shared/internalAuth.ts';

const LOCK_IN_DAYS = 21;
const ANNUAL_PRICE_ID = 'price_1Tn4v2K0ZBuK45DCAUIDOxqf';
const MONTHLY_PRICE_ID = 'price_1Tn4v2K0ZBuK45DCjrDbRjrq';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // Admin-only, or the scheduled automation presenting the internal call token
    if (!(await isAuthorizedInternalCall(base44, payload))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const now = Date.now();
    let switched = 0;
    let checked = 0;

    // ── Monthly → Annual upgrades ──────────────────────────────────────────
    const pendingUpgrades = await base44.asServiceRole.entities.BannerAd.filter({
      plan_type: 'monthly',
      upgrade_to_annual_pending: true,
      status: 'active',
    });
    checked += pendingUpgrades.length;

    for (const ad of pendingUpgrades) {
      if (!ad.next_renewal_date || !ad.stripe_subscription_id) continue;
      const daysUntilRenewal = (new Date(ad.next_renewal_date).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysUntilRenewal > LOCK_IN_DAYS) continue; // not within the lock-in window yet

      try {
        let annualRate = ad.upgrade_locked_annual_rate;
        if (annualRate === null || annualRate === undefined) {
          const pricingConfigs = await base44.asServiceRole.entities.AdPricingConfig.filter({ config_key: 'global' });
          const pricing = pricingConfigs[0] || { monthly_rate: 150, annual_discount_percent: 30 };
          annualRate = Math.round(pricing.monthly_rate * 12 * (1 - pricing.annual_discount_percent / 100));
        }

        const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
        const itemId = subscription.items.data[0]?.id;
        if (!itemId) {
          console.error(`processAdPlanUpgrades: No subscription item found for ad ${ad.id}`);
          continue;
        }

        await stripe.subscriptions.update(ad.stripe_subscription_id, {
          items: [{ id: itemId, price: ANNUAL_PRICE_ID }],
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
        });

        await base44.asServiceRole.entities.BannerAd.update(ad.id, {
          plan_type: 'annual',
          rate_at_purchase: annualRate,
          upgrade_locked_annual_rate: annualRate,
          upgrade_to_annual_pending: false,
        });

        console.log(`processAdPlanUpgrades: Ad ${ad.id} switched to annual (locked rate $${annualRate}), effective at renewal on ${ad.next_renewal_date}`);
        switched++;

        try {
          const users = await base44.asServiceRole.entities.User.filter({ id: ad.user_id });
          const advertiser = users[0];
          if (advertiser?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: advertiser.email,
              from_name: 'LocalKidsCalendar',
              subject: 'Your Supporter Plan is Switching to Annual',
              body: `Hi ${advertiser.full_name || 'there'},

As requested, your ad for ${ad.business_name} in zip code ${ad.zip_code} will switch from monthly to the annual plan at your upcoming renewal on ${ad.next_renewal_date}.

Your annual rate has been locked in at $${annualRate}/year. This rate will be charged at renewal, and your plan will continue to renew annually going forward unless you cancel.

Thank you for being a LocalKidsCalendar Supporter!

— The LocalKidsCalendar Team`,
            });
          }
        } catch (e) {
          console.error('Failed to send upgrade notification email:', e.message);
        }
      } catch (e) {
        console.error(`processAdPlanUpgrades: Failed to switch ad ${ad.id} to annual:`, e.message);
      }
    }

    // ── Annual → Monthly downgrades ─────────────────────────────────────────
    const pendingDowngrades = await base44.asServiceRole.entities.BannerAd.filter({
      plan_type: 'annual',
      downgrade_to_monthly_pending: true,
      status: 'active',
    });
    checked += pendingDowngrades.length;

    for (const ad of pendingDowngrades) {
      if (!ad.next_renewal_date || !ad.stripe_subscription_id) continue;
      const daysUntilRenewal = (new Date(ad.next_renewal_date).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysUntilRenewal > LOCK_IN_DAYS) continue; // not within the lock-in window yet

      try {
        let monthlyRate = ad.downgrade_locked_monthly_rate;
        if (monthlyRate === null || monthlyRate === undefined) {
          const pricingConfigs = await base44.asServiceRole.entities.AdPricingConfig.filter({ config_key: 'global' });
          const pricing = pricingConfigs[0] || { monthly_rate: 150, annual_discount_percent: 30 };
          monthlyRate = pricing.monthly_rate;
        }

        const subscription = await stripe.subscriptions.retrieve(ad.stripe_subscription_id);
        const itemId = subscription.items.data[0]?.id;
        if (!itemId) {
          console.error(`processAdPlanUpgrades: No subscription item found for ad ${ad.id}`);
          continue;
        }

        await stripe.subscriptions.update(ad.stripe_subscription_id, {
          items: [{ id: itemId, price: MONTHLY_PRICE_ID }],
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
        });

        await base44.asServiceRole.entities.BannerAd.update(ad.id, {
          plan_type: 'monthly',
          rate_at_purchase: monthlyRate,
          downgrade_locked_monthly_rate: monthlyRate,
          downgrade_to_monthly_pending: false,
        });

        console.log(`processAdPlanUpgrades: Ad ${ad.id} switched to monthly (locked rate $${monthlyRate}), effective at renewal on ${ad.next_renewal_date}`);
        switched++;

        try {
          const users = await base44.asServiceRole.entities.User.filter({ id: ad.user_id });
          const advertiser = users[0];
          if (advertiser?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: advertiser.email,
              from_name: 'LocalKidsCalendar',
              subject: 'Your Supporter Plan is Switching to Monthly',
              body: `Hi ${advertiser.full_name || 'there'},

As requested, your ad for ${ad.business_name} in zip code ${ad.zip_code} will switch from annual to the monthly plan at your upcoming renewal on ${ad.next_renewal_date}.

Your monthly rate has been locked in at $${monthlyRate}/month. This rate will be charged at renewal, and your plan will continue to renew monthly going forward unless you cancel.

Thank you for being a LocalKidsCalendar Supporter!

— The LocalKidsCalendar Team`,
            });
          }
        } catch (e) {
          console.error('Failed to send downgrade notification email:', e.message);
        }
      } catch (e) {
        console.error(`processAdPlanUpgrades: Failed to switch ad ${ad.id} to monthly:`, e.message);
      }
    }

    console.log(`processAdPlanUpgrades complete. Checked ${checked} pending plan change(s), switched ${switched}.`);
    return Response.json({ checked, switched });
  } catch (error) {
    console.error('processAdPlanUpgrades error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});