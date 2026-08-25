import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only create for community members (not organizers)
    if (user.role === 'organizer') {
      return Response.json({ skipped: true, reason: 'organizer accounts do not receive notifications' });
    }

    // Check if a preference record already exists for this user
    const existing = await base44.entities.NotificationPreference.filter({}, '-created_date', 1);
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'preference record already exists' });
    }

    // Create a default preference record based on the NotificationPreference schema:
    // frequency: daily|weekly|monthly|none (default: weekly)
    // categories: array of strings (default: [] = all types)
    // organizer_ids: array of strings (default: [] = all organizers)
    // keywords: string (default: empty = any)
    // zip_code: string (pre-fill from user profile if available)
    // radius_miles: number (default: 15)
    // age_min: number (optional)
    // age_max: number (optional)
    const created = await base44.entities.NotificationPreference.create({
      frequency: 'weekly',
      categories: [],
      organizer_ids: [],
      keywords: '',
      zip_code: user.zip_code || '',
      radius_miles: 15,
    });

    return Response.json({ success: true, preference_id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});