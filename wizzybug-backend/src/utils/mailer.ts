/**
 * Mail delivery integration.
 * Prefer authenticated Gmail SMTP when configured, then fall back to the deployed mail service.
 */
import nodemailer from "nodemailer";
import { Resend } from "resend";

export const resolveMailServiceUrl = (): string => {
  const configuredUrl = process.env.MAIL_SERVICE_URL?.trim().replace(
    /\/+$/,
    "",
  );
  if (!configuredUrl) return "";

  // The deployed mail service exposes its handler at /api/index. Accepting
  // the shorter /api value avoids silently posting to the Vercel directory....
  if (configuredUrl.endsWith("/api")) return `${configuredUrl}/index`;
  return configuredUrl;
};

const getSmtpTransport = () => {
  const mailUser = (process.env.MAIL_USER || process.env.GMAIL_USER)?.trim();
  const mailPassword = (
    process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD
  )?.trim();

  if (!mailUser || !mailPassword) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: mailUser,
      pass: mailPassword,
    },
  });
};

const getMailFrom = (): string | undefined =>
  process.env.MAIL_FROM || process.env.MAIL_USER || process.env.GMAIL_USER;

export const isRealMailerConfigured = (): boolean =>
  Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim(),
  ) ||
  Boolean(resolveMailServiceUrl()) ||
  Boolean(getSmtpTransport());

export const sendInviteViaMail = async (opts: {
  email: string;
  name: string;
  inviteLink: string;
}): Promise<{ success: boolean; message: string }> => {
  const mailServiceUrl = resolveMailServiceUrl();
  const smtpTransport = getSmtpTransport();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!mailServiceUrl && !smtpTransport && !resendApiKey) {
    const msg =
      "No email provider is configured. Set RESEND_API_KEY and MAIL_FROM, MAIL_SERVICE_URL, or Gmail SMTP credentials.";
    console.error("[mailer] Error:", msg);
    throw new Error(msg);
  }

  const subject = "Welcome to WizzyBug";
  const body = `Hello ${opts.name},

Welcome to WizzyBug!

You’ve been invited to join your team on WizzyBug and start collaborating on bug tracking and project management.

Click below to accept your invitation and get started:

Accept Invitation
${opts.inviteLink}

Thanks,
The WizzyBug Team`;
  const inviteLink = escapeHtml(opts.inviteLink);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(opts.name)},</p>
                <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#202124;">Welcome to <strong>WizzyBug!</strong></h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">You’ve been invited to join your team on WizzyBug and start collaborating on bug tracking and project management.</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Click below to accept your invitation and get started:</p>
                <p style="margin:0 0 24px;">
                  <a href="${inviteLink}" style="display:inline-block;padding:12px 20px;background-color:#2563eb;border-radius:6px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Accept Invitation</a>
                </p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#5f6368;">Thanks,<br><strong>The WizzyBug Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  if (resendApiKey) {
    const from = process.env.MAIL_FROM?.trim();
    if (!from) {
      throw new Error(
        "MAIL_FROM must be set to an address on a verified Resend domain.",
      );
    }

    const { error } = await new Resend(resendApiKey).emails.send({
      from,
      to: opts.email,
      replyTo: from,
      subject,
      text: body,
      html,
    });
    if (error) {
      throw new Error(`Resend could not send the invite: ${error.message}`);
    }
    return {
      success: true,
      message: "Invite sent via Resend",
    };
  }

  console.log("[mailer] Configuration check:");
  console.log(`  - MAIL_SERVICE_URL: ${mailServiceUrl}`);
  console.log(`  - Email: ${opts.email}`);
  console.log(`  - Subject: ${subject}`);

  let mailServiceError: Error | null = null;

  if (smtpTransport) {
    try {
      const info = await smtpTransport.sendMail({
        from: getMailFrom(),
        replyTo: getMailFrom(),
        to: opts.email,
        subject,
        text: body,
        html,
      });

      console.log(
        "[mailer] ✅ SMTP fallback invitation sent  successfully:",
        info.messageId,
      );
      return {
        success: true,
        message: " Invite sent successfully via Gmail SMTP",
      };
    } catch (smtpError) {
      console.error(
        "[mailer] ❌ Gmail SMTP invitation send failed:",
        smtpError,
      );
    }
  }

  try {
    if (mailServiceUrl) {
      const response = await fetch(mailServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: opts.email,
          subject,
          body,
          html,
          from: getMailFrom(),
          replyTo: getMailFrom(),
        }),
      });

      console.log(
        `[mailer] Mail Service responded with status: ${response.status}`,
      );

      if (response.ok) {
        const data = await response.json();
        console.log(
          "[mailer] Mail Service invitation sent successfully:",
          data,
        );

        return {
          success: true,
          message: "Invite sent successfully",
        };
      }

      let errorData = "Unable to read response";
      try {
        errorData = await response.text();
      } catch (e) {
        console.error("[mailer] Failed to read error response:", e);
      }

      mailServiceError = new Error(
        `Mail Service returned ${response.status}: ${response.statusText} - ${errorData}`,
      );
      console.error("[mailer] Mail Service rejected invitation:", {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorData,
      });
    }
  } catch (error) {
    mailServiceError =
      error instanceof Error ? error : new Error(String(error));
    console.error(
      "[mailer] ❌ Mail Service invitation send failed:",
      mailServiceError,
    );
  }

  if (mailServiceError) {
    throw mailServiceError;
  }

  throw new Error("No mail transport is configured.");
};

export const sendVerificationEmailViaMail = async (opts: {
  email: string;
  name: string;
  verificationLink: string;
}): Promise<{ success: boolean; message: string }> => {
  const mailServiceUrl = resolveMailServiceUrl();
  const smtpTransport = getSmtpTransport();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!mailServiceUrl && !smtpTransport && !resendApiKey) {
    throw new Error("No email provider is configured for verification emails.");
  }

  const subject = "Verify your WizzyBug email";
  const body = `Hello ${opts.name},\n\nPlease verify your WizzyBug email address using this link:\n\n${opts.verificationLink}\n\nThis link expires in 24 hours.`;
  const html = `<h2>Hello ${escapeHtml(opts.name)},</h2><p>Please verify your WizzyBug email address:</p><p><a href="${escapeHtml(opts.verificationLink)}">Verify Email</a></p><p>This link expires in 24 hours.</p>`;
  const from = getMailFrom();

  if (resendApiKey) {
    if (!process.env.MAIL_FROM?.trim()) {
      throw new Error(
        "MAIL_FROM must be set to an address on a verified Resend domain.",
      );
    }
    const { error } = await new Resend(resendApiKey).emails.send({
      from: process.env.MAIL_FROM.trim(),
      to: opts.email,
      replyTo: from,
      subject,
      text: body,
      html,
    });
    if (error)
      throw new Error(
        `Resend could not send the verification email: ${error.message}`,
      );
    return { success: true, message: "Verification email sent via Resend" };
  }

  if (smtpTransport) {
    try {
      await smtpTransport.sendMail({
        from,
        replyTo: from,
        to: opts.email,
        subject,
        text: body,
        html,
      });
      return {
        success: true,
        message: "Verification email sent via Gmail SMTP",
      };
    } catch (error) {
      if (!mailServiceUrl) throw error;
      console.error("[mailer] Gmail SMTP verification email failed:", error);
    }
  }

  if (mailServiceUrl) {
    const response = await fetch(mailServiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: opts.email,
        subject,
        body,
        html,
        from,
        replyTo: from,
      }),
    });
    if (response.ok)
      return { success: true, message: "Verification email sent" };
    const responseBody = await response.text();
    throw new Error(
      `Mail Service returned ${response.status}: ${response.statusText} - ${responseBody}`,
    );
  }

  throw new Error("Verification email could not be sent.");
};

export const sendPasswordResetViaMail = async (opts: {
  email: string;
  name: string;
  resetLink: string;
}): Promise<{ success: boolean; message: string }> => {
  const mailServiceUrl = resolveMailServiceUrl();
  const smtpTransport = getSmtpTransport();
  if (!mailServiceUrl && !smtpTransport) {
    throw new Error(
      "MAIL_SERVICE_URL is not configured. Set it in your environment variables.",
    );
  }

  const subject = "Reset your WizzyBug password";
  const body = `Hello ${opts.name},\n\nReset your WizzyBug password using this link:\n\n${opts.resetLink}\n\nThis link expires in one hour.`;
  const html = `<h2>Hello ${opts.name},</h2><p>Reset your WizzyBug password using the link below:</p><p><a href="${opts.resetLink}">Reset Password</a></p><p>This link expires in one hour.</p>`;

  if (mailServiceUrl) {
    try {
      const response = await fetch(mailServiceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: opts.email, subject, body, html }),
      });
      if (response.ok)
        return { success: true, message: "Password reset email sent" };
    } catch (error) {
      console.error("[mailer] Password reset mail service failed:", error);
    }
  }

  if (smtpTransport) {
    await smtpTransport.sendMail({
      from: getMailFrom(),
      replyTo: getMailFrom(),
      to: opts.email,
      subject,
      text: body,
      html,
    });
    return {
      success: true,
      message: "Password reset email sent via SMTP fallback",
    };
  }

  throw new Error("Password reset email could not be sent.");
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character,
  );

const PRIORITY_EMAIL_LABELS: Record<string, string> = {
  critical: "P1-Immediate Fix",
  high: "P2-High",
  medium: "P3-Medium",
  low: "P4-Low",
};

const getPriorityEmailLabel = (priority: string): string =>
  PRIORITY_EMAIL_LABELS[priority.toLowerCase()] || priority;

export const sendBugAssignmentEmail = async (opts: {
  to: string;
  assigneeName: string;
  assignedBy: string;
  bugId: string;
  title: string;
  description: string;
  projectName: string;
  projectKey?: string;
  priority: string;
  severity: string;
  appUrl: string;
  event?: "assigned" | "updated";
  changedFields?: string[];
}): Promise<{ success: boolean; message: string }> => {
  const mailServiceUrl = resolveMailServiceUrl();
  const smtpTransport = getSmtpTransport();
  if (!mailServiceUrl && !smtpTransport) {
    throw new Error(
      "MAIL_SERVICE_URL is not configured. Set it in your environment variables.",
    );
  }

  const project = opts.projectKey
    ? `${opts.projectName} (${opts.projectKey})`
    : opts.projectName;
  const isUpdate = opts.event === "updated";
  const subject = `${isUpdate ? "Bug updated" : "New bug assignment"}: ${opts.bugId} - ${opts.title}`;
  const changeSummary =
    isUpdate && opts.changedFields?.length
      ? `\nChanged details: ${opts.changedFields.join(", ")}\n`
      : "";
  const actionMessage = isUpdate
    ? `${opts.assignedBy} updated the following bug assigned to you in WizzyBug.`
    : `${opts.assignedBy} assigned the following bug to you in WizzyBug.`;
  const priorityLabel = getPriorityEmailLabel(opts.priority);
  const body = `Hi ${opts.assigneeName},

${isUpdate ? "This bug assignment has been updated." : "You have been assigned a new bug."}

${actionMessage}

Assignment details
-------------------
Bug ID: ${opts.bugId}
Title: ${opts.title}
Project: ${project}
Priority: ${priorityLabel}
Severity: ${opts.severity}${changeSummary}

Description:
${opts.description || "No description provided."}

Please review the bug details and update its status in WizzyBug:
${opts.appUrl}

Regards,
The WizzyBug Team`;
  const changesHtml =
    isUpdate && opts.changedFields?.length
      ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b5563;"><strong>Changed details:</strong> ${opts.changedFields.map(escapeHtml).join(", ")}</p>`
      : "";
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#2563eb;">WizzyBug</p>
                <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#111827;">${isUpdate ? "Bug assignment updated" : "New bug assigned to you"}</h1>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(opts.assigneeName)},</p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.5;"><strong>${escapeHtml(opts.assignedBy)}</strong> ${isUpdate ? "updated the following bug assigned to you" : "assigned the following bug to you"} in WizzyBug.</p>
                <h2 style="margin:0 0 12px;font-size:17px;color:#111827;">Assignment details</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px;font-size:14px;">
                  <tr><td style="padding:9px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:bold;width:32%;">Bug ID</td><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(opts.bugId)}</td></tr>
                  <tr><td style="padding:9px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:bold;">Title</td><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(opts.title)}</td></tr>
                  <tr><td style="padding:9px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:bold;">Project</td><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(project)}</td></tr>
                  <tr><td style="padding:9px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:bold;">Priority</td><td style="padding:9px 12px;">${escapeHtml(priorityLabel)}</td></tr>
                  <tr><td style="padding:9px 12px;background:#f9fafb;font-weight:bold;">Severity</td><td style="padding:9px 12px;">${escapeHtml(opts.severity)}</td></tr>
                </table>
                ${changesHtml}
                <h2 style="margin:0 0 8px;font-size:17px;color:#111827;">Description</h2>
                <div style="margin:0 0 24px;padding:14px 16px;background:#f9fafb;border-left:4px solid #2563eb;font-size:15px;line-height:1.6;white-space:normal;">${escapeHtml(opts.description || "No description provided.").replace(/\n/g, "<br>")}</div>
                <p style="margin:0 0 24px;"><a href="${escapeHtml(opts.appUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;border-radius:6px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Review bug in WizzyBug</a></p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">This is an automated notification from WizzyBug. Please do not reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  if (smtpTransport) {
    try {
      await smtpTransport.sendMail({
        from: getMailFrom(),
        replyTo: getMailFrom(),
        to: opts.to,
        subject,
        text: body,
        html,
      });
      return {
        success: true,
        message: "Bug assignment email sent via Gmail SMTP",
      };
    } catch (error) {
      console.error("[mailer] Bug assignment SMTP delivery failed:", error);
    }
  }

  if (mailServiceUrl) {
    const response = await fetch(mailServiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: opts.to,
        subject,
        body,
        html,
        from: getMailFrom(),
        replyTo: getMailFrom(),
      }),
    });
    if (response.ok) {
      return { success: true, message: "Bug assignment email sent" };
    }
    const responseBody = (await response.text()).slice(0, 1000);
    throw new Error(
      `Mail Service returned ${response.status}: ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`,
    );
  }

  throw new Error("Bug assignment email could not be sent.");
};

/**
 * Legacy sendMail function (kept for backwards compatibility)
 * Use sendInviteViaMail for sending invitations instead
 */
export const sendMail = async (opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ id: string }> => {
  throw new Error(
    "sendMail is no longer supported. Use sendInviteViaMail with the Mail Service instead.",
  );
};
