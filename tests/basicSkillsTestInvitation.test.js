const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInviteEmail,
  createBasicSkillsTestInvitation,
} = require('../src/services/basicSkillsTestInvitation.service');

test('invitation email escapes applicant-entered names in the HTML body', () => {
  const { html, text } = buildInviteEmail({
    applicant: {
      firstName: '<a href="https://evil.example">Click</a>',
      lastName: "O'Neil",
      applicationReference: 'DF-KE-0001',
      participantCode: null,
    },
    invitationUrl: 'https://portal.example/basic-skills-test/abc?x=1&y=2',
    expiresAt: new Date('2026-12-01T00:00:00Z'),
  });

  assert.ok(!html.includes('<a href="https://evil.example">'));
  assert.ok(html.includes('&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt; O&#39;Neil'));
  assert.ok(html.includes('href="https://portal.example/basic-skills-test/abc?x=1&amp;y=2"'));
  // The plain-text part is not HTML and keeps the name as typed.
  assert.ok(text.includes('Dear <a href="https://evil.example">Click</a> O\'Neil,'));
});

test('issuing a new invitation cancels the applicant\'s older open links', async () => {
  const calls = [];
  const tx = {
    basicSkillsTestInvitation: {
      updateMany: async (args) => {
        calls.push(['updateMany', args]);
        return { count: 1 };
      },
      create: async (args) => {
        calls.push(['create', args]);
        return { id: 'new-invite', ...args.data };
      },
    },
  };

  const result = await createBasicSkillsTestInvitation(tx, { id: 'applicant-1', email: 'a@example.org' });

  assert.deepEqual(calls.map(([name]) => name), ['updateMany', 'create']);
  assert.deepEqual(calls[0][1], {
    where: {
      applicantId: 'applicant-1',
      status: { in: ['PENDING', 'SENT', 'EMAIL_FAILED', 'OPENED'] },
    },
    data: { status: 'CANCELLED' },
  });
  assert.equal(result.invitation.status, 'PENDING');
  assert.equal(result.invitation.emailTo, 'a@example.org');
});
