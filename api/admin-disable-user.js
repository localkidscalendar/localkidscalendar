import Stripe from "stripe";
import { isAdminCaller } from "./_lib/adminAuth.js";
import {
  createAdminClient,
  requireUser,
  getEnv,
  SLOT_HOLDING_STATUSES,
} from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";
import { sendViaResend } from "./_lib/resendSend.js";

const QUEUE_STATUSES = ["waiting", "offered"];
const APP_URL = getEnv("APP_URL", "VITE_APP_URL") || "https://localkidscalendar.com";

/**
 * Admin-only: disable a user account.
 * Always: role → disabled, digest notifications off, hide active activities/comments.
 * If Supporter (is_advertiser): cancel slot-holding ads, Stripe non-renew,
 * release waitlist entries, then advance waitlists.
 *
 * Body: { user_id, note, prior_role?, send_email?, disable_source? }
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user: authUser, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const admin = createAdminClient();
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", authUser.id)
      .maybeSingle();
    const callerEmail = (callerProfile?.email || authUser.email || "").trim().toLowerCase();
    if (!isAdminCaller(callerProfile, authUser.email)) {
      return res.status(403).json({
        error: `Forbidden — admin role required (signed in as ${callerEmail || "unknown"}, role: ${callerProfile?.role || "none"})`,
      });
    }

    const userId = typeof req.body?.user_id === "string" ? req.body.user_id.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    if (!note) return res.status(400).json({ error: "note is required" });

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, role, role_before_disabled, is_advertiser, email, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return res.status(404).json({ error: "User not found" });

    const sendEmail = Boolean(req.body?.send_email);
    const disableSourceRaw =
      typeof req.body?.disable_source === "string" ? req.body.disable_source.trim() : "";
    const disableSource =
      disableSourceRaw === "flagged_users" ? "flagged_users" : "users_list";

    const requestedPrior =
      typeof req.body?.prior_role === "string" ? req.body.prior_role.trim() : "";
    const currentRole = target.role;
    const priorRole =
      requestedPrior && ["community_member", "organizer", "admin"].includes(requestedPrior)
        ? (requestedPrior === "admin" ? "community_member" : requestedPrior)
        : currentRole && currentRole !== "disabled" && ["community_member", "organizer", "admin"].includes(currentRole)
          ? (currentRole === "admin" ? "community_member" : currentRole)
          : (target.role_before_disabled || "community_member");

    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "disabled",
        role_before_disabled: priorRole,
        disabled_note: note,
        disabled_at: now,
        disabled_by: authUser.id,
        suspended_at: null,
        updated_at: now,
      })
      .eq("id", userId);
    if (profileError) throw profileError;

    // New disable cycle: clear any prior reactivation request so they may request review again
    const { error: reactivationClearError } = await admin
      .from("account_reactivation_requests")
      .delete()
      .eq("user_id", userId);
    if (reactivationClearError) {
      console.error(
        "admin-disable-user: clear reactivation request failed:",
        reactivationClearError.message
      );
    }

    // Best-effort Flagged Users disposition (do not block disable)
    try {
      const { data: existingFlagCase } = await admin
        .from("profiles")
        .select("user_flag_case_admin_history")
        .eq("id", userId)
        .maybeSingle();
      const priorFlagHistory = Array.isArray(existingFlagCase?.user_flag_case_admin_history)
        ? existingFlagCase.user_flag_case_admin_history
        : [];
      await admin
        .from("profiles")
        .update({
          user_flag_case_admin_action: "manually_deactivated",
          user_flag_case_admin_history: [
            ...priorFlagHistory,
            {
              action: "manually_deactivated",
              at: now,
              by: "Admin",
              scope: "account_disabled",
              source: disableSource,
              note: note || null,
            },
          ],
          updated_at: now,
        })
        .eq("id", userId);
    } catch (err) {
      console.error("admin-disable-user: flag case update failed:", err.message);
    }

    // Turn off weekly digest (upsert so users without a prefs row are covered).
    const { error: digestError } = await admin
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          frequency: "none",
          updated_at: now,
        },
        { onConflict: "user_id" }
      );
    if (digestError) {
      console.error("admin-disable-user: digest prefs update failed:", digestError.message);
    }

    const hideReason = "Removed after the poster's account was disabled.";
    const caseStamp = {
      action: "manually_deactivated",
      at: now,
      by: "Admin",
      scope: "account_disabled",
      source: disableSource,
      note: note || null,
    };

    const { data: activeEvents, error: eventsSelectError } = await admin
      .from("events")
      .select("id, flag_case_admin_history")
      .eq("created_by_id", userId)
      .eq("status", "active");
    if (eventsSelectError) {
      console.error("admin-disable-user: events select failed:", eventsSelectError.message);
    }

    let activitiesHidden = 0;
    for (const event of activeEvents || []) {
      const history = Array.isArray(event.flag_case_admin_history)
        ? event.flag_case_admin_history
        : [];
      const { error: eventHideError } = await admin
        .from("events")
        .update({
          status: "archived",
          admin_notes: hideReason,
          flag_case_admin_action: "manually_deactivated",
          flag_case_admin_history: [...history, caseStamp],
          updated_at: now,
        })
        .eq("id", event.id)
        .eq("status", "active");
      if (eventHideError) {
        console.error(`admin-disable-user: hide event ${event.id} failed:`, eventHideError.message);
      } else {
        activitiesHidden += 1;
      }
    }

    const { data: hiddenComments, error: commentsHideError } = await admin
      .from("comments")
      .update({
        status: "archived",
        flag_case_admin_action: "manually_deactivated",
        updated_at: now,
      })
      .eq("created_by_id", userId)
      .eq("status", "active")
      .select("id");
    if (commentsHideError) {
      console.error("admin-disable-user: hide comments failed:", commentsHideError.message);
    }
    const commentsHidden = (hiddenComments || []).length;

    // Notify users who favorited this organizer/poster (directory hide is role-based)
    let favoritersNotified = 0;
    try {
      const { data: favCount, error: favError } = await admin.rpc(
        "notify_favoriters_organizer_removed",
        {
          p_poster_user_id: userId,
          p_reason: "Removed after the organizer's account was disabled.",
        }
      );
      if (favError) {
        console.error("admin-disable-user: favoriter notify failed:", favError.message);
      } else {
        favoritersNotified = Number(favCount) || 0;
      }
    } catch (err) {
      console.error("admin-disable-user: favoriter notify failed:", err.message);
    }

    const isSupporter = Boolean(target.is_advertiser);
    const summary = {
      prior_role: priorRole,
      is_supporter: isSupporter,
      activities_hidden: activitiesHidden,
      comments_hidden: commentsHidden,
      favoriters_notified: favoritersNotified,
      ads_cancelled: 0,
      stripe_non_renew: 0,
      waitlist_released: 0,
    };

    // Optional disable email — for every account type (was incorrectly supporter-only)
    let emailSent = false;
    let emailError = null;
    if (sendEmail) {
      if (!target.email) {
        emailError = "User has no email on file";
      } else {
        try {
          const contactUrl = `${APP_URL.replace(/\/$/, "")}/contact`;
          const displayName =
            [target.first_name, target.last_name].filter(Boolean).join(" ").trim() || "there";
          const html = `
            <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
              <h2 style="margin:0 0 12px;">Your Local Kids Calendar account was disabled</h2>
              <p>Hi ${displayName},</p>
              <p>Your account on Local Kids Calendar has been disabled by our Admin team.</p>
              <p><strong>Note from Admin:</strong></p>
              <p style="white-space:pre-wrap;">${note.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              <p>If you believe this was a mistake, you can sign in and submit a reactivation request, or <a href="${contactUrl}">contact us</a>.</p>
            </div>
          `;
          await sendViaResend({
            to: target.email,
            subject: "Your Local Kids Calendar account was disabled",
            html,
          });
          emailSent = true;
        } catch (err) {
          emailError = err.message || "Email send failed";
          console.error("admin-disable-user: email failed:", emailError);
        }
      }
    }

    if (!isSupporter) {
      console.log(`admin-disable-user: disabled ${userId} by ${authUser.id}`, summary);
      return res.status(200).json({
        success: true,
        email_sent: emailSent,
        email_error: emailError,
        ...summary,
      });
    }

    // Full disable for Supporters: inactive ads, Stripe non-renew, release waitlist.
    const { data: ads, error: adsError } = await admin
      .from("banner_ads")
      .select("id, status, stripe_subscription_id, auto_renew")
      .eq("user_id", userId);
    if (adsError) throw adsError;

    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
    const holdingAds = (ads || []).filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
    const allAds = ads || [];

    for (const ad of allAds) {
      // Non-renew every ad that still has a Stripe subscription (or auto_renew on).
      if (ad.stripe_subscription_id && stripe) {
        try {
          await stripe.subscriptions.update(ad.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
          summary.stripe_non_renew += 1;
        } catch (err) {
          console.error(
            `admin-disable-user: Stripe non-renew failed for ad ${ad.id}:`,
            err.message
          );
        }
      }
    }

    if (holdingAds.length > 0) {
      const holdingIds = holdingAds.map((a) => a.id);
      const { error: cancelAdsError } = await admin
        .from("banner_ads")
        .update({
          status: "cancelled",
          auto_renew: false,
          cancelled_at: now,
          upgrade_to_annual_pending: false,
          upgrade_locked_annual_rate: null,
          upgrade_requested_date: null,
          downgrade_to_monthly_pending: false,
          downgrade_locked_monthly_rate: null,
          downgrade_requested_date: null,
          updated_at: now,
        })
        .in("id", holdingIds);
      if (cancelAdsError) throw cancelAdsError;
      summary.ads_cancelled = holdingIds.length;
    }

    // Mark remaining non-holding ads as non-renewing as well.
    const nonHoldingIds = allAds
      .filter((ad) => !SLOT_HOLDING_STATUSES.includes(ad.status) && ad.auto_renew !== false)
      .map((ad) => ad.id);
    if (nonHoldingIds.length > 0) {
      const { error: nonRenewError } = await admin
        .from("banner_ads")
        .update({ auto_renew: false, updated_at: now })
        .in("id", nonHoldingIds);
      if (nonRenewError) {
        console.error("admin-disable-user: auto_renew clear failed:", nonRenewError.message);
      }
    }

    const { data: waitlistRows, error: waitlistError } = await admin
      .from("ad_waitlist")
      .update({ status: "cancelled", updated_at: now })
      .eq("user_id", userId)
      .in("status", QUEUE_STATUSES)
      .select("id");
    if (waitlistError) throw waitlistError;
    summary.waitlist_released = (waitlistRows || []).length;

    try {
      const waitlistResult = await runProcessWaitlist(admin);
      console.log("admin-disable-user: processWaitlist after release:", waitlistResult);
    } catch (err) {
      console.error("admin-disable-user: processWaitlist failed:", err.message);
    }

    console.log(`admin-disable-user: disabled ${userId} by ${authUser.id}`, summary);
    return res.status(200).json({
      success: true,
      email_sent: emailSent,
      email_error: emailError,
      ...summary,
    });
  } catch (error) {
    console.error("admin-disable-user error:", error);
    return res.status(500).json({ error: error.message || "Failed to disable user" });
  }
}
