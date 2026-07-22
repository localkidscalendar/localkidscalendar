import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin auth
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email_type, recipient_email, sample_data } = await req.json();

    if (!email_type || !recipient_email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Email templates
    const templates = {
      subscription_renewing_soon: {
        subject: 'Your Supporter Ad Plan is About to Renew',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your Supporter Ad is Renewing Soon</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>This is a friendly reminder that your Supporter advertising plan is scheduled to renew on <strong>${sample_data?.renewal_date || 'MM/DD/YYYY'}</strong>.</p>
              
              <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Plan Details:</strong></p>
                <ul>
                  <li>Zip Code: ${sample_data?.zip_code || '89448'}</li>
                  <li>Plan Type: ${sample_data?.plan_type || 'Monthly'}</li>
                  <li>Renewal Rate: $${sample_data?.rate || '150'}</li>
                </ul>
              </div>
              
              <p>Your ad will continue running seamlessly, and your payment method on file will be charged automatically.</p>
              
              <p style="margin-top: 20px;">
                <a href="${sample_data?.manage_url || '#'}" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Manage Your Ad</a>
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                To avoid renewal, you must cancel at least 14 days before your renewal date from your Account page.
              </p>
              
              <p style="margin-top: 20px;">Thank you for supporting LocalKidsCalendar!</p>
            </body>
          </html>
        `,
      },
      subscription_renewed: {
        subject: 'Your Supporter Ad Plan Has Been Renewed',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Payment Successful - Ad Renewed!</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>Great news! Your Supporter advertising plan has been successfully renewed.</p>
              
              <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Payment Confirmation:</strong></p>
                <ul>
                  <li>Amount Charged: $${sample_data?.amount || '150'}</li>
                  <li>Zip Code: ${sample_data?.zip_code || '89448'}</li>
                  <li>Plan Period: ${sample_data?.period || '30 days'}</li>
                  <li>Transaction ID: ${sample_data?.transaction_id || 'ch_xxxxx'}</li>
                </ul>
              </div>
              
              <p>Your ad will continue running without interruption. Thank you for your continued support!</p>
              
              <p style="margin-top: 20px;">
                <a href="${sample_data?.manage_url || '#'}" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Ad</a>
              </p>
              
              <p style="margin-top: 20px;">Questions? Contact us at support@localkidscalendar.com</p>
            </body>
          </html>
        `,
      },
      subscription_payment_failed: {
        subject: 'Action Required: Payment Issue for Your Supporter Ad',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #D97706;">Payment Past Due - Action Required</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>We were unable to process your renewal payment for your Supporter advertising plan.</p>
              
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
                <p><strong>What happens next:</strong></p>
                <ul>
                  <li>Your ad is temporarily hidden from the site</li>
                  <li>Your spot is reserved for 7 days</li>
                  <li>Please update your payment method to restore your ad</li>
                </ul>
              </div>
              
              <p style="margin-top: 20px;">
                <a href="https://billing.stripe.com/p/login/test_00000000" style="background: #D97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Payment Method</a>
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you believe this is an error or need assistance, please contact us at support@localkidscalendar.com
              </p>
            </body>
          </html>
        `,
      },
      waitlist_spot_available: {
        subject: 'Great News! A Supporter Spot is Available in Your Zip Code',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">A Spot Has Opened Up in ${sample_data?.zip_code || '89448'}!</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>Great news! A Supporter advertising spot has become available in zip code <strong>${sample_data?.zip_code || '89448'}</strong>, and you're next in line.</p>
              
              <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Offer Details:</strong></p>
                <ul>
                  <li>Zip Code: ${sample_data?.zip_code || '89448'}</li>
                  <li>Plan Type: ${sample_data?.plan_type || 'Monthly'}</li>
                  <li>Current Rate: $${sample_data?.rate || '150'}/month</li>
                </ul>
              </div>
              
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
                <p style="margin: 0;"><strong>⏰ This offer expires on ${sample_data?.expiry_date || 'MM/DD/YYYY'}</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">You have 7 days to claim your spot. After 3 missed offers, your waitlist entry will be cancelled.</p>
              </div>
              
              <p style="margin-top: 20px;">
                <a href="${sample_data?.claim_url || '#'}" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Claim Your Spot Now</a>
              </p>
              
              <p style="margin-top: 20px;">Questions? Contact us at support@localkidscalendar.com</p>
            </body>
          </html>
        `,
      },
      ad_removed_flagged: {
        subject: 'Your Supporter Ad Has Been Removed',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #DC2626;">Ad Removal Notice</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>Your Supporter ad has been removed from LocalKidsCalendar due to community flagging or policy concerns.</p>
              
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <p><strong>Reason for removal:</strong></p>
                <p style="font-style: italic;">"${sample_data?.reason || 'Content flagged by community members'}</p>
              </div>
              
              <p><strong>What happens next:</strong></p>
              <ul>
                <li>Your subscription remains active</li>
                <li>You can submit a replacement ad that meets our community standards</li>
                <li>Replacement ads undergo manual review before going live</li>
                <li>No refunds or credits are issued for time lost during review</li>
              </ul>
              
              <p style="margin-top: 20px;">
                <a href="${sample_data?.resubmit_url || '#'}" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Submit Replacement Ad</a>
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                Please review our <a href="#" style="color: #2D7A3E;">Supporter Community Rules</a> before submitting a replacement.
              </p>
              
              <p style="margin-top: 20px;">Questions? Contact us at support@localkidscalendar.com</p>
            </body>
          </html>
        `,
      },
      ad_flagged_admin: {
        subject: 'Your Supporter Ad Has Been Flagged',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your ad was flagged</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>Your Supporter ad for zip code <strong>${sample_data?.zip_code || '89448'}</strong> has been flagged by our Admin team.</p>
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <p><strong>Reason:</strong> ${sample_data?.reason || 'Policy concern identified during review'}</p>
              </div>
              <p>Your subscription remains active. Please visit your Ad Manager to submit a corrected ad creative and restore your ad.</p>
              <p style="margin-top: 20px;">
                <a href="https://app.localkidscalendar.com/ad-manager" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Ad Manager</a>
              </p>
            </body>
          </html>
        `,
      },
      ad_deactivated_admin: {
        subject: 'Your Supporter Ad Has Been Deactivated',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your ad was deactivated</h2>
              <p>Hi ${sample_data?.business_name || 'Supporter'},</p>
              <p>Your Supporter ad for zip code <strong>${sample_data?.zip_code || '89448'}</strong> has been deactivated by our Admin team.</p>
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <p><strong>Reason:</strong> ${sample_data?.reason || 'Policy concern identified during review'}</p>
              </div>
              <p>Your subscription remains active. Please visit your Ad Manager to submit a corrected ad creative and restore your ad.</p>
              <p style="margin-top: 20px;">
                <a href="https://app.localkidscalendar.com/ad-manager" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Ad Manager</a>
              </p>
            </body>
          </html>
        `,
      },
      activity_removed_admin: {
        subject: 'Your Activity Has Been Removed',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your activity was removed</h2>
              <p>Hi ${sample_data?.contributor_name || 'there'},</p>
              <p>Your posted activity "<strong>${sample_data?.activity_title || 'Summer Soccer Camp'}</strong>" has been removed from LocalKidsCalendar by our Admin team.</p>
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <p><strong>Reason:</strong> ${sample_data?.reason || 'Policy concern identified during review'}</p>
              </div>
              <p>You can view this note on your Account page under My Posts. If you believe this was a mistake, please contact us.</p>
              <p style="margin-top: 20px;">
                <a href="https://app.localkidscalendar.com/account" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to My Account</a>
              </p>
            </body>
          </html>
        `,
      },
      activity_photo_approved_admin: {
        subject: 'Your Activity Photo Has Been Approved',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your activity photo was approved</h2>
              <p>Hi ${sample_data?.contributor_name || 'there'},</p>
              <p>The photo you uploaded for your activity "<strong>${sample_data?.activity_title || 'Summer Soccer Camp'}</strong>" has been manually reviewed by our Admin team and approved.</p>
              <p>Your photo is now live on the listing.</p>
              <p style="margin-top: 20px;">
                <a href="https://app.localkidscalendar.com/account" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to My Account</a>
              </p>
            </body>
          </html>
        `,
      },
      activity_photo_declined_admin: {
        subject: 'Your Activity Photo Was Not Approved',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2D7A3E;">Your activity photo was declined</h2>
              <p>Hi ${sample_data?.contributor_name || 'there'},</p>
              <p>The photo you uploaded for your activity "<strong>${sample_data?.activity_title || 'Summer Soccer Camp'}</strong>" has been manually reviewed by our Admin team and was not approved.</p>
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <p><strong>Reason:</strong> ${sample_data?.reason || 'Did not meet our community guidelines.'}</p>
              </div>
              <p>Please edit your activity to upload a different photo. Your activity remains live in the meantime.</p>
              <p style="margin-top: 20px;">
                <a href="https://app.localkidscalendar.com/account" style="background: #2D7A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to My Account</a>
              </p>
            </body>
          </html>
        `,
      },
    };

    const template = templates[email_type];
    if (!template) {
      return Response.json({ error: 'Invalid email type' }, { status: 400 });
    }

    // Send the email using service role
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient_email,
      subject: template.subject,
      body: template.body,
      from_name: 'LocalKidsCalendar',
    });

    return Response.json({ 
      success: true, 
      message: `Sample ${email_type} email sent to ${recipient_email}` 
    });
  } catch (error) {
    console.error('Error sending sample email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});