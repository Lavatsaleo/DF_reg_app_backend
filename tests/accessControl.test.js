const test = require('node:test');
const assert = require('node:assert/strict');
const { getApplicantCountryFilter, getCommitteeMemberCountryFilter, canAccessCountry } = require('../src/utils/countryAccess');
const { getSecret, createAuthToken, verifyAuthToken } = require('../src/utils/authToken');

const NO_SCOPE = { id: '__NO_COUNTRY_SCOPE__' };

function withEnv(values, fn) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  let result;
  try {
    result = fn();
  } catch (error) {
    restore();
    throw error;
  }
  if (result instanceof Promise) return result.finally(restore);
  restore();
  return result;
}

test('only super admins see every country', () => {
  assert.deepEqual(getApplicantCountryFilter({ role: 'ADMIN' }), {});
  assert.equal(canAccessCountry({ role: 'ADMIN' }, 'Ghana'), true);

  for (const role of ['COUNTRY_ADMIN', 'COMMITTEE_CHAIRPERSON', 'COMMITTEE_MEMBER', 'VIEWER']) {
    assert.deepEqual(getApplicantCountryFilter({ role }), NO_SCOPE, role);
    assert.deepEqual(getCommitteeMemberCountryFilter({ role }), NO_SCOPE, role);
    assert.equal(canAccessCountry({ role }, 'Kenya'), false, role);
  }
});

test('country-scoped staff are limited to their own country', () => {
  const chair = { role: 'COMMITTEE_CHAIRPERSON', country: 'kenya' };
  assert.deepEqual(getApplicantCountryFilter(chair), { country: 'Kenya' });
  assert.equal(canAccessCountry(chair, 'Kenya'), true);
  assert.equal(canAccessCountry(chair, 'Nigeria'), false);

  const member = { role: 'COMMITTEE_MEMBER', committeeMember: { country: 'Zambia' } };
  assert.deepEqual(getCommitteeMemberCountryFilter(member), { country: 'Zambia' });
});

test('the public development secret is refused outside development and test', () => {
  withEnv({ AUTH_TOKEN_SECRET: undefined, JWT_SECRET: undefined, NODE_ENV: undefined }, () => {
    assert.throws(() => getSecret(), /AUTH_TOKEN_SECRET must be set/);
  });
  withEnv({ AUTH_TOKEN_SECRET: undefined, JWT_SECRET: undefined, NODE_ENV: 'production' }, () => {
    assert.throws(() => createAuthToken({ sub: 'user' }), /AUTH_TOKEN_SECRET must be set/);
  });
  withEnv({ AUTH_TOKEN_SECRET: undefined, JWT_SECRET: undefined, NODE_ENV: 'development' }, () => {
    assert.ok(getSecret());
  });
});

test('tokens signed with one secret are rejected under another', () => {
  const token = withEnv({ AUTH_TOKEN_SECRET: 'first-secret' }, () => createAuthToken({ sub: 'user-1' }));
  withEnv({ AUTH_TOKEN_SECRET: 'first-secret' }, () => assert.equal(verifyAuthToken(token).sub, 'user-1'));
  withEnv({ AUTH_TOKEN_SECRET: 'second-secret' }, () => assert.equal(verifyAuthToken(token), null));
});

test('cross-origin access is granted only to configured frontend origins', async (t) => {
  const app = withEnv({}, () => require('../src/app'));
  const server = app.listen(0);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/health`;

  await withEnv({ FRONTEND_BASE_URL: 'https://df.example.org/', CORS_ALLOWED_ORIGINS: 'https://other.example.org' }, async () => {
    const allowed = await fetch(url, { headers: { Origin: 'https://df.example.org' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://df.example.org');

    const extra = await fetch(url, { headers: { Origin: 'https://other.example.org' } });
    assert.equal(extra.headers.get('access-control-allow-origin'), 'https://other.example.org');

    const blocked = await fetch(url, { headers: { Origin: 'https://attacker.example' } });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  });
});
