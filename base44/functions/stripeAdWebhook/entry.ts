import { createClient } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.5.0';

const GRACE_PERIOD_DAYS = 7;

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Stripe event received: ${event.type}`);

    // ── Checkout completed → activate ad ────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { ad_id, user_id, zip_code, plan_type, discount_code_id, ad_library_id, waitlist_entry_id } = session.metadata || {};

      if (!ad_id) {
        console.log('No ad_id in metadata, skipping');
        return Response.json({ received: true });
      }

      const now = new Date();
      const planStart = now.toISOString().split('T')[0];
      const planEnd = plan_type === 'annual'
        ? new Date(new Date(now).setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0]
        : new Date(new Date(now).setMonth(now.getMonth() + 1)).toISOString().split('T')[0];

      let adUpdate = {
        status: 'active',
        moderation_status: 'auto_approved',
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer,
        plan_start_date: planStart,
        plan_end_date: planEnd,
        next_renewal_date: planEnd,
        rate_at_purchase: plan_type === 'annual' ? 1260 : 150,
        grace_period_start: null,
      };

      if (ad_library_id) {
        try {
          const libAd = await base44.asServiceRole.entities.AdLibrary.get(ad_library_id);
          if (libAd && libAd.moderation_status === 'approved') {
            adUpdate.image_url = libAd.image_url;
            adUpdate.link_url = libAd.link_url;
            adUpdate.business_name = adUpdate.business_name || libAd.ad_name;
          } else {
            adUpdate.status = 'pending_review';
            adUpdate.moderation_status = 'needs_review';
          }
        } catch (e) {
          console.error('Failed to load ad library item:', e.message);
          adUpdate.status = 'pending_review';
          adUpdate.moderation_status = 'needs_review';
        }
      }

      await base44.asServiceRole.entities.BannerAd.update(ad_id, adUpdate);

      // Mark zip reservation completed
      if (user_id && zip_code) {
        try {
          const reservations = await base44.asServiceRole.entities.ZipCodeReservation.filter({ user_id, zip_code, status: 'active' });
          for (const res of reservations) {
            await base44.asServiceRole.entities.ZipCodeReservation.update(res.id, { status: 'completed' });
          }
          if (waitlist_entry_id) {
            await base44.asServiceRole.entities.AdWaitlist.update(waitlist_entry_id, { status: 'accepted' }).catch(e => console.error('Waitlist update failed:', e.message));
          } else {
            const waitlistEntries = await base44.asServiceRole.entities.AdWaitlist.filter({ user_id, zip_code, status: 'offered' });
            for (const entry of waitlistEntries) {
              await base44.asServiceRole.entities.AdWaitlist.update(entry.id, { status: 'accepted' });
            }
          }
        } catch (e) {
          console.error('Failed to clean up reservation/waitlist:', e.message);
        }
      }

      // Update discount code usage
      if (discount_code_id) {
        try {
          const dc = await base44.asServiceRole.entities.DiscountCode.get(discount_code_id);
          if (dc) {
            await base44.asServiceRole.entities.DiscountCode.update(discount_code_id, {
              times_used: (dc.times_used || 0) + 1,
              used_by_user_ids: [...(dc.used_by_user_ids || []), user_id],
            });
          }
        } catch (e) {
          console.error('Failed to update discount code:', e.message);
        }
      }

      // Update user advertiser flag
      if (user_id) {
        try {
          await base44.asServiceRole.entities.User.update(user_id, { is_advertiser: true });
        } catch (e) {
          console.error('Failed to update user advertiser flag:', e.message);
        }
      }

      console.log(`Ad ${ad_id} activated after successful payment`);
    }

    // ── Subscription deleted → cancel ad + trigger waitlist ─────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const adId = sub.metadata?.ad_id;
      if (adId) {
        const ad = await base44.asServiceRole.entities.BannerAd.get(adId).catch(() => null);
        await base44.asServiceRole.entities.BannerAd.update(adId, {
          status: 'cancelled',
          auto_renew: false,
          cancelled_at: new Date().toISOString().split('T')[0],
        });
        console.log(`Ad ${adId} cancelled due to subscription deletion`);

        // Notify waitlist for freed slot
        if (ad?.zip_code) {
          try {
            await base44.asServiceRole.functions.invoke('processWaitlist', { zip_code: ad.zip_code });
            console.log(`Triggered waitlist processing for zip ${ad.zip_code}`);
          } catch (e) {
            console.error('Failed to trigger waitlist:', e.message);
          }
        }
      }
    }

    // ── Payment failed → grace period ───────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (subId) {
        const ads = await base44.asServiceRole.entities.BannerAd.filter({ stripe_subscription_id: subId });
        for (const ad of ads) {
          // Only move to past_due if currently active (not already in grace period or further along)
          if (ad.status === 'active') {
            const gracePeriodStart = new Date().toISOString();
            const graceDeadline = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
            const graceDeadlineFormatted = graceDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            await base44.asServiceRole.entities.BannerAd.update(ad.id, {
              status: 'past_due',
              grace_period_start: gracePeriodStart,
            });
            console.log(`Ad ${ad.id} moved to past_due (grace period started)`);

            // Send grace period email to the advertiser
            try {
              const users = await base44.asServiceRole.entities.User.filter({ id: ad.user_id });
              const advertiser = users[0];
              if (advertiser?.email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: advertiser.email,
                  from_name: 'LocalKidsCalendar',
                  subject: 'Action Required: Update Your Payment Method',
                  body: `Hi ${advertiser.full_name || 'there'},

We were unable to process the renewal payment for your ad in zip code ${ad.zip_code} (${ad.business_name}).

Your ad has been temporarily hidden from public view, but your spot is still reserved. You have until ${graceDeadlineFormatted} to update your payment method before your spot is released.

To update your payment information, please visit your Ad Manager and look for the payment update link on your ad.

If payment is not updated within ${GRACE_PERIOD_DAYS} days, your spot will be released and may be offered to others on the waitlist.

Questions? Reply to this email and we'll help you out.

— The LocalKidsCalendar Team`,
                });
                console.log(`Grace period email sent to ${advertiser.email} for ad ${ad.id}`);
              }
            } catch (e) {
              console.error('Failed to send grace period email:', e.message);
            }
          }
        }
      }
    }

    // ── Payment succeeded (recovery from past_due) ───────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      // billing_reason 'subscription_cycle' or 'subscription_update' means a real renewal
      if (subId && invoice.billing_reason !== 'subscription_create') {
        const ads = await base44.asServiceRole.entities.BannerAd.filter({ stripe_subscription_id: subId });
        for (const ad of ads) {
          // On a real renewal cycle, refresh the plan dates so they reflect the plan_type
          // in effect at renewal (e.g. after a monthly→annual switch scheduled earlier).
          if (invoice.billing_reason === 'subscription_cycle') {
            const renewalNow = new Date();
            const renewalStart = renewalNow.toISOString().split('T')[0];
            const renewalEnd = ad.plan_type === 'annual'
              ? new Date(new Date(renewalNow).setFullYear(renewalNow.getFullYear() + 1)).toISOString().split('T')[0]
              : new Date(new Date(renewalNow).setMonth(renewalNow.getMonth() + 1)).toISOString().split('T')[0];
            await base44.asServiceRole.entities.BannerAd.update(ad.id, {
              plan_start_date: renewalStart,
              plan_end_date: renewalEnd,
              next_renewal_date: renewalEnd,
            });
            console.log(`Ad ${ad.id} renewed on ${ad.plan_type} plan, next renewal ${renewalEnd}`);
          }

          if (ad.status === 'past_due') {
            await base44.asServiceRole.entities.BannerAd.update(ad.id, {
              status: 'active',
              grace_period_start: null,
            });
            console.log(`Ad ${ad.id} recovered from past_due — now active`);

            // Send recovery confirmation email
            try {
              const users = await base44.asServiceRole.entities.User.filter({ id: ad.user_id });
              const advertiser = users[0];
              if (advertiser?.email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: advertiser.email,
                  from_name: 'LocalKidsCalendar',
                  subject: 'Payment Received — Your Ad is Live Again!',
                  body: `Hi ${advertiser.full_name || 'there'},

Great news! Your payment was successfully processed and your ad for ${ad.business_name} in zip code ${ad.zip_code} is now live again.

You can manage your ad at any time from your Ad Manager.

Thank you for being a LocalKidsCalendar Supporter!

— The LocalKidsCalendar Team`,
                });
              }
            } catch (e) {
              console.error('Failed to send recovery email:', e.message);
            }
          }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeAdWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});