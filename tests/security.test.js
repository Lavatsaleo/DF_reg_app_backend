const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { createRateLimiter, redactUrl } = require('../src/middleware/security.middleware');
const { detectFileType, normalizeDocumentType, cleanOriginalName } = require('../src/services/fileUpload.service');
const { getPasswordProblem, verifyPassword, hashPassword } = require('../src/utils/passwordUtils');
const { escapeHtml } = require('../src/utils/html');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('API responses carry security headers and hide the framework', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`http://localhost:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    server.close();
  }
});

test('unknown routes and malformed JSON get short, generic answers', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  try {
    const missing = await fetch(`${base}/api/does-not-exist/<script>`);
    assert.equal(missing.status, 404);
    assert.ok(!(await missing.text()).includes('script'));

    const malformed = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": ',
    });
    assert.equal(malformed.status, 400);
    const body = await malformed.json();
    assert.equal(body.message, 'The request body is not valid JSON.');
    assert.equal(body.stack, undefined);
  } finally {
    server.close();
  }
});

test('creating the first admin is hidden without the server setup token', async () => {
  const previous = process.env.BOOTSTRAP_ADMIN_TOKEN;
  process.env.BOOTSTRAP_ADMIN_TOKEN = 'x'.repeat(32);
  const server = await startServer();
  try {
    const response = await fetch(`http://localhost:${server.address().port}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bootstrap-Token': 'wrong-token' },
      body: JSON.stringify({ email: 'attacker@example.org', password: 'Attacker-Password-1' }),
    });
    assert.equal(response.status, 404);
  } finally {
    server.close();
    if (previous === undefined) delete process.env.BOOTSTRAP_ADMIN_TOKEN;
    else process.env.BOOTSTRAP_ADMIN_TOKEN = previous;
  }
});

test('the rate limiter blocks after the limit and counts each key separately', () => {
  const limiter = createRateLimiter({ name: 'test', windowMs: 60000, max: 2, key: (req) => req.body.email });
  const run = (email, ip = '10.0.0.1') => {
    let status = 200;
    let nextCalled = false;
    const res = {
      setHeader() {},
      status(code) { status = code; return this; },
      json() { return this; },
    };
    limiter({ ip, body: { email } }, res, () => { nextCalled = true; });
    return nextCalled ? 200 : status;
  };

  assert.equal(run('a@example.org'), 200);
  assert.equal(run('a@example.org'), 200);
  assert.equal(run('a@example.org'), 429);
  assert.equal(run('b@example.org'), 200);
  assert.equal(run('a@example.org', '10.0.0.2'), 200);
});

test('uploads are identified by content, and storage paths ignore request values', () => {
  assert.equal(detectFileType(Buffer.from('%PDF-1.7\nrest of file')).mimeType, 'application/pdf');
  assert.equal(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])).extension, '.png');
  assert.equal(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])).extension, '.jpg');
  // An HTML page renamed to .pdf is still HTML.
  assert.equal(detectFileType(Buffer.from('<html><script>alert(1)</script></html>')), null);

  assert.equal(normalizeDocumentType('../../public/evil'), 'OTHER');
  assert.equal(normalizeDocumentType('national_id'), 'NATIONAL_ID');
  assert.equal(cleanOriginalName('..\\..\\etc/passwd'), 'passwd');
  assert.equal(cleanOriginalName('id<script>.pdf'), 'idscript.pdf');
});

test('new staff passwords must be long and not easy to guess', () => {
  assert.match(getPasswordProblem('short1'), /at least 10/);
  assert.match(getPasswordProblem('password123'), /easy to guess/);
  assert.match(getPasswordProblem('aaaaaaaaaaaa'), /easy to guess/);
  assert.match(getPasswordProblem('jane.otieno-2026!', { email: 'jane.otieno@example.org' }), /name or email/);
  assert.match(getPasswordProblem('x'.repeat(129)), /no more than 128/);
  assert.equal(getPasswordProblem('Blue-river-lantern-42'), '');

  // Overlong input is refused before the expensive hash runs.
  assert.equal(verifyPassword('x'.repeat(5000), hashPassword('Blue-river-lantern-42')), false);
});

test('private links are removed from request logs', () => {
  assert.equal(
    redactUrl('/api/participant-registration/invite/abcDEF123_-xyz/draft'),
    '/api/participant-registration/invite/[redacted]/draft'
  );
  assert.equal(redactUrl('/api/auth/sso/callback?code=secret&state=abc'), '/api/auth/sso/callback?code=[redacted]&state=[redacted]');
});

test('values placed into HTML emails are escaped', () => {
  assert.equal(escapeHtml('<a href="x">Jo\'s</a> & co'), '&lt;a href=&quot;x&quot;&gt;Jo&#39;s&lt;/a&gt; &amp; co');
});
