import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_url } = await req.json();
    if (!image_url) return Response.json({ error: 'image_url required' }, { status: 400 });

    console.log(`Moderating activity photo: ${image_url}`);

    const moderationPrompt = `You are a content moderator for a family-friendly community website that lists kids' activities (camps, classes, sports, events).

Review the following photo, which an Organizer is uploading as the cover photo for a kids' activity listing.

Analyze the image for the following HIGH-LEVEL concerns only (do not be overly strict — only flag clear, obvious violations):
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible, blank, or corrupted image (no meaningful content)
6. Content clearly inappropriate for children or families

Return a JSON object with exactly this structure:
{
  "status": "approved" or "declined",
  "reason": "clear explanation of what was flagged and why, if declined. Empty string if approved."
}

Be lenient — only decline for clear, obvious violations.`;

    let aiResult;
    try {
      aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: moderationPrompt,
        file_urls: [image_url],
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
      // If AI fails, auto-approve with a note rather than blocking the organizer
      aiResult = { status: 'approved', reason: '' };
    }

    console.log(`AI moderation result for activity photo:`, JSON.stringify(aiResult));

    const newStatus = aiResult.status === 'approved' ? 'approved' : 'declined';
    return Response.json({ status: newStatus, reason: aiResult.reason || '' });
  } catch (error) {
    console.error('moderateEventImage error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});