const test = require('node:test');
const assert = require('node:assert/strict');

const envKeys = [
  'MAIL_SERVICE_URL',
  'MAIL_USER',
  'MAIL_PASS',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'MAIL_FROM',
  'RESEND_API_KEY',
];
const invite = {
  email: 'invitee@example.com',
  name: 'Jane Doe',
  inviteLink: 'https://app.example.com/accept-invite?token=test-token',
};

const saveEnvironment = () =>
  Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const restoreEnvironment = (saved) => {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
};

const clearMailerEnvironment = () => {
  for (const key of envKeys) delete process.env[key];
};

test('requires a sender address when Resend is configured', async () => {
  const saved = saveEnvironment();
  clearMailerEnvironment();
  process.env.RESEND_API_KEY = 'test-api-key';

  try {
    const { isRealMailerConfigured, sendInviteViaMail } = require('../dist/utils/mailer.js');
    assert.equal(isRealMailerConfigured(), false);
    await assert.rejects(
      sendInviteViaMail(invite),
      /MAIL_FROM must be set to an address on a verified Resend domain/,
    );
  } finally {
    restoreEnvironment(saved);
  }
});

test('sends invites with Resend using the configured sender and multipart content', async () => {
  const saved = saveEnvironment();
  const originalFetch = global.fetch;
  clearMailerEnvironment();
  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.MAIL_FROM = 'WizzyBug <invites@example.com>';
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { sendInviteViaMail } = require('../dist/utils/mailer.js');
    const result = await sendInviteViaMail(invite);
    const payload = JSON.parse(request.options.body);

    assert.equal(result.success, true);
    assert.equal(result.message, 'Invite sent via Resend');
    assert.match(request.url, /\/emails$/);
    assert.equal(payload.from, process.env.MAIL_FROM);
    assert.equal(payload.to, invite.email);
    assert.equal(payload.reply_to, process.env.MAIL_FROM);
    assert.equal(payload.subject, 'Welcome to WizzyBug');
    assert.match(payload.text, /Hello Jane Doe,\n\nWelcome to WizzyBug!/);
    assert.match(payload.text, /You’ve been invited to join your team on WizzyBug and start collaborating on bug tracking and project management/);
    assert.match(payload.text, /Click below to accept your invitation and get started/);
    assert.ok(payload.text.includes(invite.inviteLink));
    assert.match(payload.html, /Hi Jane Doe,/);
    assert.match(payload.html, /Welcome to <strong>WizzyBug!<\/strong>/);
    assert.match(payload.html, /Accept Invitation/);
    assert.match(payload.html, /<strong>The WizzyBug Team<\/strong>/);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment(saved);
  }
});

test('sends verification emails with a Verify Email link', async () => {
  const saved = saveEnvironment();
  const originalFetch = global.fetch;
  clearMailerEnvironment();
  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.MAIL_FROM = 'WizzyBug <invites@example.com>';
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { sendVerificationEmailViaMail } = require('../dist/utils/mailer.js');
    const verification = {
      email: 'new-user@example.com',
      name: 'Jane Doe',
      verificationLink: 'https://app.example.com/verify-email?token=test-token',
    };
    const result = await sendVerificationEmailViaMail(verification);
    const payload = JSON.parse(request.options.body);

    assert.equal(result.success, true);
    assert.equal(payload.to, verification.email);
    assert.match(payload.subject, /verify/i);
    assert.ok(payload.text.includes(verification.verificationLink));
    assert.match(payload.html, /Verify Email/);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment(saved);
  }
});

test('formats assignment email priorities as P1-P4 labels', async () => {
  const saved = saveEnvironment();
  const originalFetch = global.fetch;
  clearMailerEnvironment();
  process.env.MAIL_SERVICE_URL = 'https://mail.example.com/send';
  process.env.MAIL_FROM = 'WizzyBug <bugs@example.com>';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { sendBugAssignmentEmail } = require('../dist/utils/mailer.js');
    const labels = [
      ['critical', 'P1-Immediate Fix'],
      ['high', 'P2-High'],
      ['medium', 'P3-Medium'],
      ['low', 'P4-Low'],
    ];

    for (const [priority, label] of labels) {
      await sendBugAssignmentEmail({
        to: 'assignee@example.com',
        assigneeName: 'Jane Doe',
        assignedBy: 'Alex',
        bugId: 'BUG-1',
        title: 'Assignment email formatting',
        description: 'Regression test',
        projectName: 'WizzyBug',
        priority,
        severity: 'Major',
        appUrl: 'https://app.example.com',
      });

      const payload = JSON.parse(requests.at(-1).options.body);
      assert.match(payload.body, new RegExp(`Priority: ${label}`));
      assert.match(payload.html, new RegExp(`<td>${label}<\\/td>`));
      assert.doesNotMatch(payload.body, new RegExp(`Priority: ${priority}$`, 'm'));
    }
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment(saved);
  }
});