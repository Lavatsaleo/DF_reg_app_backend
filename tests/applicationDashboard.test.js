const test = require('node:test');
const assert = require('node:assert/strict');
const { ageBand, regionName, getDashboardFilters, summarizeApplications, createShowcaseRows } = require('../src/services/applicationDashboard.service');
const admin = { role: 'ADMIN' };
test('roles and country scopes are enforced for live and showcase modes', () => {
  for (const role of ['COMMITTEE_MEMBER', 'COUNTRY_ADMIN', undefined]) assert.throws(() => getDashboardFilters({ role }), { status: 403 });
  for (const mode of ['live', 'demo']) {
    const user = { role: 'VIEWER', country: 'Kenya' };
    assert.equal(getDashboardFilters(user, { mode }).country, 'Kenya');
    assert.throws(() => getDashboardFilters(user, { mode, country: 'Ghana' }), { status: 403 });
  }
  assert.throws(() => getDashboardFilters({ role: 'VIEWER', country: 'Invalid' }), { status: 403 });
  assert.throws(() => getDashboardFilters(admin, { month: '2026-13' }), { status: 400 });
});
test('age boundaries and missing values do not lose applications', () => {
  assert.deepEqual([17,18,24,25,29,30,35,36,45,46,null,-1,121].map(ageBand), ['Under 18','18–24','18–24','25–29','25–29','30–35','30–35','36–45','36–45','46+','Not recorded','Not recorded','Not recorded']);
});
test('UTC month filtering, missing geography and submitted-test metrics', () => {
  const rows = [
    { country: 'Kenya', county: 'Nairobi', ageAtApplication: 24, createdAt: '2026-09-30T23:30:00-01:00', isEligible: true, status: 'APPROVED_FOR_ENROLLMENT', skillsTestAttempts: [{ percentage: 80 }], email: 'must-not-leak@example.test' },
    { country: 'Kenya', ageAtApplication: null, createdAt: '2026-10-02T00:00:00Z' },
    { country: 'Ghana', ageAtApplication: 30, createdAt: '2026-10-02T00:00:00Z' },
    { country: 'Kenya', ageAtApplication: 40, createdAt: '2026-09-01T00:00:00Z' },
  ];
  const result = summarizeApplications(rows, getDashboardFilters({ role:'VIEWER', country:'Kenya' }, { month:'2026-10' }));
  assert.equal(result.totals.applications, 2);
  assert.equal(result.totals.skillsTestCompleted, 1);
  assert.equal(result.totals.averageTestScore, 80);
  assert.equal(result.totals.shortlisted, 1);
  assert.equal(result.regions.find(r => r.name === 'Not recorded').count, 1);
  assert.equal(result.ages.reduce((n,r)=>n+r.count,0), 2);
  assert.ok(!JSON.stringify(result).includes('must-not-leak'));
});
test('showcase covers 110 administrative regions and six months without database writes', () => {
  const result = summarizeApplications(createShowcaseRows(new Date('2026-10-05')), getDashboardFilters(admin, { mode:'demo' }));
  assert.equal(result.regions.length, 110);
  assert.equal(result.monthly.length, 6);
  assert.equal(result.totals.applications, result.regions.reduce((n,r)=>n+r.count,0));
  assert.equal(regionName({country:'Nigeria',state:'FCT'}), 'Abuja Federal Capital Territory');
});
test('controller limits live query to scope, selects no identities and skips DB in demo', async () => {
  const prismaPath = require.resolve('../src/config/prisma');
  let queries = [];
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { applicant: { findMany: async query => { queries.push(query); return []; } } } };
  const { getApplicationDashboard } = require('../src/controllers/applicationDashboard.controller');
  const response = () => ({ code: 200, set() { return this; }, status(n) { this.code=n; return this; }, json(data) { this.data=data; return this; } });
  const user = { role:'VIEWER', country:'Kenya' };
  const live = response();
  await getApplicationDashboard({ user, query:{} }, live);
  assert.equal(live.code,200);
  assert.deepEqual(queries[0].where, {country:'Kenya'});
  assert.equal(queries[0].select.email, undefined);
  assert.deepEqual(queries[0].select.skillsTestAttempts.where, {status:'SUBMITTED'});
  const denied = response();
  await getApplicationDashboard({ user, query:{country:'Ghana'} }, denied);
  assert.equal(denied.code,403);
  await getApplicationDashboard({ user, query:{mode:'demo'} }, response());
  assert.equal(queries.length,1);
});
