import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isPrivateOrUnsafeUrl } from '../../shared/urlSafety.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ad_library_id } = await req.json();
    if (!ad_library_id) return Response.json({ error: 'ad_library_id required' }, { status: 400 });

    const ad = await base44.asServiceRole.entities.AdLibrary.get(ad_library_id);
    if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });

    console.log(`Moderating ad: ${ad.ad_name} (${ad_library_id})`);

    // Step 1: Check URL safety — normalize and attempt a fetch to verify the URL is reachable
    let urlSafe = true;
    let urlReason = '';
    try {
      // Normalize URL: add https:// if no protocol present
      let normalizedUrl = ad.link_url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      // Block SSRF attempts against internal/private network destinations before fetching
      if (isPrivateOrUnsafeUrl(normalizedUrl)) {
        urlSafe = false;
        urlReason = 'The destination URL points to a private or internal address and cannot be used.';
      }

      // Try HEAD first; many servers block HEAD — fall back to GET if it fails
      let urlStatus: number | null = null;
      if (urlSafe) try {
        const headCheck = await fetch(normalizedUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
        urlStatus = headCheck.status;
      } catch {
        // HEAD failed (blocked or network error) — try GET
        try {
          const getCheck = await fetch(normalizedUrl, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) });
          urlStatus = getCheck.status;
        } catch (e2) {
          console.error('GET check also failed:', e2.message);
          urlStatus = null; // can't reach — don't block; let AI review handle it
        }
      }

      // Only hard-fail on definitive 404; other errors/timeouts pass through to AI review
      if (urlStatus === 404) {
        urlSafe = false;
        urlReason = 'The destination URL returned a 404 (page not found). Please check that the link is correct.';
      }
      console.log(`URL check for ${normalizedUrl}: status=${urlStatus}`);
    } catch (e) {
      console.error('URL normalization error:', e.message);
      // Don't block on unexpected errors — let AI review proceed
    }

    if (!urlSafe) {
      await base44.asServiceRole.entities.AdLibrary.update(ad_library_id, {
        moderation_status: 'declined',
        moderation_notes: urlReason,
        moderation_date: new Date().toISOString(),
      });
      console.log(`Ad ${ad_library_id} declined: URL issue — ${urlReason}`);
      return Response.json({ status: 'declined', reason: urlReason });
    }

    // Step 2: AI image + content moderation via InvokeLLM
    const moderationPrompt = `You are a content moderator for a family-friendly community website focused on kids' activities. 

Review the following advertisement:
- Destination URL: ${ad.link_url}
- Ad Image URL: ${ad.image_url}

You must evaluate BOTH the destination URL and the ad image.

STEP A — Destination URL review:
Based on the URL/domain alone (you cannot visit it), assess whether it is clearly inappropriate for a family audience. Decline if the domain name or URL path strongly suggests:
1. Adult/pornographic content (e.g. domains containing words like "porn", "xxx", "adult", "sex", "escort", "nude", "cam", "onlyfans", etc.)
2. Illegal products or services (drugs, weapons, gambling sites)
3. Hate groups or extremist content
4. Obvious scam/phishing patterns
Be decisive — if the domain name itself is a clear red flag, decline. Do not require a visit to the URL.

STEP B — Ad Image review:
Analyze the ad image for the following HIGH-LEVEL concerns only (do not be overly strict — only flag clear, obvious violations):
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible or blank image (no meaningful content)
6. Content clearly inappropriate for children or families

Return a JSON object with exactly this structure:
{
  "status": "approved" or "declined",
  "reason": "clear explanation of what was flagged and why, if declined. Empty string if approved."
}

If either the URL or the image fails, set status to "declined" and explain which one (or both) triggered it.
Be lenient on the image — only decline for clear, obvious violations. Be firm on the URL domain name.`;

    let aiResult;
    try {
      aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: moderationPrompt,
        file_urls: [ad.image_url],
        response_json_schema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['approved', 'declined'] },
            reason: { type: 'string' }
          },
          required: ['status', 'reason']
        }
      });
    } catch (e) {
      console.error('InvokeLLM failed:', e.message);
      // If AI fails, auto-approve with a note rather than blocking the advertiser
      aiResult = { status: 'approved', reason: '' };
    }

    console.log(`AI moderation result for ${ad_library_id}:`, JSON.stringify(aiResult));

    const newStatus = aiResult.status === 'approved' ? 'approved' : 'declined';
    await base44.asServiceRole.entities.AdLibrary.update(ad_library_id, {
      moderation_status: newStatus,
      moderation_notes: aiResult.reason || '',
      moderation_date: new Date().toISOString(),
    });

    return Response.json({ status: newStatus, reason: aiResult.reason || '' });
  } catch (error) {
    console.error('moderateAdContent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});