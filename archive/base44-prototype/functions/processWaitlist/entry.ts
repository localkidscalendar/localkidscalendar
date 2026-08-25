import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('processWaitlist: starting run');

    const now = new Date();

    // Step 1: Expire any outstanding offers that have passed their deadline
    const offeredEntries = await base44.asServiceRole.entities.AdWaitlist.filter({ status: 'offered' });
    for (const entry of offeredEntries) {
      if (!entry.offer_expires_date || new Date(entry.offer_expires_date) >= now) continue;

      const offerCount = (entry.offer_count || 0) + 1;
      if (offerCount >= 3) {
        // 3 rotations used up — permanently cancel this entry
        await base44.asServiceRole.entities.AdWaitlist.update(entry.id, {
          status: 'cancelled',
          offer_count: offerCount,
        });
        console.log(`Cancelled waitlist entry ${entry.id} for zip ${entry.zip_code} after 3 failed offers`);
      } else {
        // Get current max position for this zip to place them at the back
        const waitingForZip = await base44.asServiceRole.entities.AdWaitlist.filter({ zip_code: entry.zip_code, status: 'waiting' });
        const maxPos = waitingForZip.reduce((max, w) => Math.max(max, w.position || 0), 0);
        await base44.asServiceRole.entities.AdWaitlist.update(entry.id, {
          status: 'waiting',
          offer_count: offerCount,
          position: maxPos + 1,
          offer_sent_date: null,
          offer_expires_date: null,
        });
        console.log(`Moved entry ${entry.id} back to waiting (offer ${offerCount}/3)`);
      }
    }

    // Step 2: Re-fetch all waiting entries after expiry processing
    const [allAds, zipConfigs, currentWaiting] = await Promise.all([
      base44.asServiceRole.entities.BannerAd.filter({ status: 'active' }),
      base44.asServiceRole.entities.AdZipConfig.list('zip_code', 200),
      base44.asServiceRole.entities.AdWaitlist.filter({ status: 'waiting' }),
    ]);

    // Build lookup maps
    const activeAdsByZip: Record<string, number> = {};
    for (const ad of allAds) {
      activeAdsByZip[ad.zip_code] = (activeAdsByZip[ad.zip_code] || 0) + 1;
    }

    const zipConfigMap: Record<string, number> = {};
    for (const cfg of zipConfigs) {
      zipConfigMap[cfg.zip_code] = cfg.max_slots;
    }
    const defaultSlots = 3;

    // Group waiting entries by zip, sorted by position
    const waitingByZip: Record<string, any[]> = {};
    for (const entry of currentWaiting) {
      if (!waitingByZip[entry.zip_code]) waitingByZip[entry.zip_code] = [];
      waitingByZip[entry.zip_code].push(entry);
    }
    for (const zip of Object.keys(waitingByZip)) {
      waitingByZip[zip].sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    // Step 3: Re-fetch still-active offered entries to avoid double-offering
    const stillOffered = await base44.asServiceRole.entities.AdWaitlist.filter({ status: 'offered' });

    // Step 4: For each zip with a waitlist, offer one spot at a time if available
    let offersCreated = 0;
    for (const zip of Object.keys(waitingByZip)) {
      const maxSlots = zipConfigMap[zip] || defaultSlots;
      const activeCount = activeAdsByZip[zip] || 0;
      const available = maxSlots - activeCount;

      if (available <= 0) continue;

      // If there's already an active (non-expired) offer for this zip, skip
      const hasActiveOffer = stillOffered.some(e => e.zip_code === zip && new Date(e.offer_expires_date) > now);
      if (hasActiveOffer) continue;

      const next = waitingByZip[zip][0];
      if (!next) continue;

      const offerExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await base44.asServiceRole.entities.AdWaitlist.update(next.id, {
        status: 'offered',
        offer_sent_date: now.toISOString(),
        offer_expires_date: offerExpires.toISOString(),
      });

      // Send email notification
      try {
        const offerNum = (next.offer_count || 0) + 1;
        const attemptsLeft = 3 - offerNum;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: next.email,
          subject: `A Supporter spot opened in zip ${zip}! Claim it within 24 hours — LocalKidsCalendar`,
          body: `Hi ${next.business_name || 'there'},

Great news! A Supporter advertising spot has opened up in zip code ${zip}.

You have 24 hours to claim it. Here's what to do:

  1. Log in to your account at LocalKidsCalendar
  2. Go to your Ad Manager page (Ad Manager tab in the navigation)
  3. Click the "Waitlist" tab
  4. Find zip code "${zip}" and click the "Subscribe Now" button
  5. Complete the subscription form to lock in your spot

Your offer expires: ${offerExpires.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific Time

⚠️ Important: If you don't complete the process within 24 hours, your spot will be offered to the next person on the waitlist and you'll be moved to the back of the line.${attemptsLeft > 0 ? ` You have ${attemptsLeft} offer attempt${attemptsLeft !== 1 ? 's' : ''} remaining before your waitlist entry is cancelled.` : ' This is your final offer — if not claimed, your waitlist entry will be cancelled.'}

Thank you for supporting the local kids community!

— The LocalKidsCalendar Team`,
        });
        console.log(`Sent waitlist offer email to ${next.email} for zip ${zip} (offer ${offerNum}/3)`);
        offersCreated++;
      } catch (e) {
        console.error(`Failed to send waitlist email to ${next.email}:`, e.message);
      }
    }

    console.log(`processWaitlist: complete. ${offersCreated} new offers sent.`);
    return Response.json({ success: true, offers_sent: offersCreated });
  } catch (error) {
    console.error('processWaitlist error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});