import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updates = {};

    // Update role if provided
    if (body.role !== undefined) {
      const allowedRoles = ['community_member', 'organizer'];
      if (!allowedRoles.includes(body.role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }
      updates.role = body.role;
    }

    // Note: is_advertiser is intentionally NOT settable here. It is only granted by
    // the Stripe webhook after a verified payment, or by an admin, to prevent
    // self-service privilege escalation to Supporter/Advertiser status.

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(user.id, updates);

    return Response.json({ success: true });
  } catch (error) {
    console.error('updateUserRole error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});