const test = require('node:test');
const assert = require('node:assert/strict');

const originalMailServiceUrl = process.env.MAIL_SERVICE_URL;
const originalFrontendUrl = process.env.FRONTEND_URL;

const loadMailer = () => require('../dist/utils/mailer.js');

test('uses the configured mail service endpoint without rewriting its path', async () => {
  process.env.MAIL_SERVICE_URL = 'https://mail-services-ver.vercel.app/api/index';

  const { resolveMailServiceUrl } = loadMailer();
  assert.equal(resolveMailServiceUrl(), 'https://mail-services-ver.vercel.app/api/index');
});

test('normalizes the mail service API directory to its deployed handler', async () => {
  process.env.MAIL_SERVICE_URL = 'https://mail-services-ver.vercel.app/api/';

  const { resolveMailServiceUrl } = loadMailer();
  assert.equal(resolveMailServiceUrl(), 'https://mail-services-ver.vercel.app/api/index');
});

test.after(() => {
  if (originalMailServiceUrl === undefined) {
    delete process.env.MAIL_SERVICE_URL;
  } else {
    process.env.MAIL_SERVICE_URL = originalMailServiceUrl;
  }

  if (originalFrontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = originalFrontendUrl;
  }
});
