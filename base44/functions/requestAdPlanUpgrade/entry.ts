import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ad_id, action } = await req.json();
    if (!ad_id || !['request', 'cancel'].includes(action)) {
      return Response.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const ad = await base44.asServiceRole.entities.BannerAd.get(ad_id);
    if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'request') {
      if (!['active', 'past_due'].includes(ad.status)) {
        return Response.json({ error: 'Ad must be active to schedule a plan change.' }, { status: 400 });
      }

      if (ad.plan_type === 'monthly') {
        await base44.asServiceRole.entities.BannerAd.update(ad_id, {
          upgrade_to_annual_pending: true,
          upgrade_requested_date: new Date().toISOString(),
        });
        console.log(`requestAdPlanUpgrade: Ad ${ad_id} scheduled to switch to annual at next renewal by user ${user.id}`);
        return Response.json({ success: true, message: 'Your ad will switch to the annual plan at your next renewal.' });
      }

      if (ad.plan_type === 'annual') {
        await base44.asServiceRole.entities.BannerAd.update(ad_id, {
          downgrade_to_monthly_pending: true,
          downgrade_requested_date: new Date().toISOString(),
        });
        console.log(`requestAdPlanUpgrade: Ad ${ad_id} scheduled to switch to monthly at next renewal by user ${user.id}`);
        return Response.json({ success: true, message: 'Your ad will switch to the monthly plan at your next renewal.' });
      }

      return Response.json({ error: 'Unsupported plan type.' }, { status: 400 });
    }

    // action === 'cancel'
    await base44.asServiceRole.entities.BannerAd.update(ad_id, {
      upgrade_to_annual_pending: false,
      upgrade_locked_annual_rate: null,
      downgrade_to_monthly_pending: false,
      downgrade_locked_monthly_rate: null,
    });
    console.log(`requestAdPlanUpgrade: Ad ${ad_id} plan change request cancelled by user ${user.id}`);
    return Response.json({ success: true, message: 'Plan change request cancelled.' });
  } catch (error) {
    console.error('requestAdPlanUpgrade error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});