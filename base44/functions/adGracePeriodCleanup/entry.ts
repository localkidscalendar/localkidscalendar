import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GRACE_PERIOD_DAYS = 7;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be authenticated as admin OR called as a scheduled automation (service role)
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAuthorized = true;
    } catch {
      // Scheduled automations won't have a user token — allow via service role
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pastDueAds = await base44.asServiceRole.entities.BannerAd.filter({ status: 'past_due' });
    const now = Date.now();
    let expired = 0;

    for (const ad of pastDueAds) {
      if (!ad.grace_period_start) continue;
      const graceStart = new Date(ad.grace_period_start).getTime();
      const daysSinceGrace = (now - graceStart) / (1000 * 60 * 60 * 24);

      if (daysSinceGrace >= GRACE_PERIOD_DAYS) {
        await base44.asServiceRole.entities.BannerAd.update(ad.id, {
          status: 'expired',
          auto_renew: false,
        });
        console.log(`Ad ${ad.id} expired after grace period (zip: ${ad.zip_code})`);
        expired++;

        // Trigger waitlist for freed slot
        try {
          await base44.asServiceRole.functions.invoke('processWaitlist', { zip_code: ad.zip_code });
          console.log(`Triggered waitlist for zip ${ad.zip_code}`);
        } catch (e) {
          console.error(`Failed to trigger waitlist for zip ${ad.zip_code}:`, e.message);
        }

        // Send final expiration email
        try {
          const users = await base44.asServiceRole.entities.User.filter({ id: ad.user_id });
          const advertiser = users[0];
          if (advertiser?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: advertiser.email,
              from_name: 'LocalKidsCalendar',
              subject: 'Your Ad Spot Has Been Released',
              body: `Hi ${advertiser.full_name || 'there'},

Unfortunately, your ad spot in zip code ${ad.zip_code} (${ad.business_name}) has been released because we were unable to process payment after our ${GRACE_PERIOD_DAYS}-day grace period.

If you'd like to advertise again, you're welcome to submit a new ad from your Ad Manager. Note that your previous spot may have been offered to others on the waitlist.

We'd love to have you back as a Supporter!

— The LocalKidsCalendar Team`,
            });
          }
        } catch (e) {
          console.error('Failed to send expiration email:', e.message);
        }
      }
    }

    console.log(`Grace period cleanup complete. Expired ${expired} of ${pastDueAds.length} past_due ads.`);
    return Response.json({ checked: pastDueAds.length, expired });
  } catch (error) {
    console.error('adGracePeriodCleanup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});