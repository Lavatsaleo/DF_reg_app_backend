const { COUNTRIES, LOCATION_HIERARCHY } = require('../data/administrativeLocations');
const AGE_BANDS = ['Under 18', '18–24', '25–29', '30–35', '36–45', '46+', 'Not recorded'];
const PATHWAYS = ['PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP'];
const canonicalKey = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/region|province|county|state/g, '').replace(/[^a-z0-9]/g, '');
function regionName(row) {
  const raw = row.country === 'Kenya' ? row.county : row.country === 'Ghana' ? row.region : row.state;
  if (!String(raw || '').trim()) return 'Not recorded';
  let key = canonicalKey(raw);
  if (row.country === 'Kenya' && ['tharaka', 'tharakanithi'].includes(key)) key = 'tharakanithi';
  if (row.country === 'Zambia' && key === 'muchinga') key = 'muchiga';
  if (row.country === 'Nigeria' && ['fct', 'abuja', 'fctabuja', 'federalcapitalterritory'].includes(key)) key = 'abujafederalcapitalterritory';
  const match = Object.keys(LOCATION_HIERARCHY[row.country]?.children || {}).find(name => canonicalKey(name) === key);
  return match || String(raw).trim();
}
function ageBand(age) {
  if (!Number.isInteger(age) || age < 0 || age > 120) return 'Not recorded';
  if (age < 18) return 'Under 18';
  if (age < 25) return '18–24';
  if (age < 30) return '25–29';
  if (age < 36) return '30–35';
  if (age < 46) return '36–45';
  return '46+';
}
function getDashboardFilters(user, query = {}) {
  const country = String(query.country || '').trim();
  const month = String(query.month || '').trim();
  const mode = String(query.mode || 'live');
  if (!['ADMIN', 'VIEWER'].includes(user?.role)) throw Object.assign(Error('Dashboard access is not enabled for this account.'), { status: 403 });
  if (country && !COUNTRIES.includes(country)) throw Object.assign(Error('Choose a supported country.'), { status: 400 });
  if (month && !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(Error('Choose a valid month.'), { status: 400 });
  if (!['live', 'demo'].includes(mode)) throw Object.assign(Error('Invalid data mode.'), { status: 400 });
  const assignedCountry = user.role === 'VIEWER' ? String(user.country || '').trim() : '';
  if (assignedCountry && !COUNTRIES.includes(assignedCountry)) throw Object.assign(Error('Your dashboard country scope needs to be corrected by an administrator.'), { status: 403 });
  if (assignedCountry && country && country !== assignedCountry) throw Object.assign(Error('You can only view your assigned country.'), { status: 403 });
  return { country: assignedCountry || country, month, mode, assignedCountry, countries: assignedCountry ? [assignedCountry] : COUNTRIES };
}
function monthKey(value) { return new Date(value).toISOString().slice(0, 7); }
function summarizeApplications(rows, filters) {
  const scoped = rows.filter(row => !filters.assignedCountry || row.country === filters.assignedCountry);
  const countryRows = scoped.filter(row => !filters.country || row.country === filters.country);
  const months = [...new Set(countryRows.map(row => monthKey(row.createdAt)))].sort().reverse();
  const selected = countryRows.filter(row => !filters.month || monthKey(row.createdAt) === filters.month);
  const ages = Object.fromEntries(AGE_BANDS.map(name => [name, 0]));
  const countries = Object.fromEntries(filters.countries.map(name => [name, 0]));
  const pathways = Object.fromEntries(PATHWAYS.map(name => [name, 0]));
  const monthly = {}, regions = new Map();
  let eligible = 0, tested = 0, scoreSum = 0, shortlisted = 0;
  for (const row of selected) {
    ages[ageBand(row.ageAtApplication)]++;
    const country = row.country || 'Not recorded'; countries[country] = (countries[country] || 0) + 1;
    const pathway = row.pathway || 'UNKNOWN'; pathways[pathway] = (pathways[pathway] || 0) + 1;
    const month = monthKey(row.createdAt); monthly[month] = (monthly[month] || 0) + 1;
    const region = regionName(row), key = `${country}|${region}`;
    if (!regions.has(key)) regions.set(key, { country, name: region, count: 0 });
    regions.get(key).count++;
    if (row.isEligible) eligible++;
    if (['APPROVED_FOR_ENROLLMENT', 'ENROLLED_IN_DHIS2_PROGRAM'].includes(row.status)) shortlisted++;
    const test = row.skillsTestAttempts?.[0];
    if (test) { tested++; scoreSum += Number(test.percentage) || 0; }
  }
  if (filters.month) monthly[filters.month] ||= 0;
  const monthNames = Object.keys(monthly).sort();
  if (monthNames.length > 1) {
    let cursor = new Date(monthNames[0] + '-01T00:00:00Z');
    const last = monthNames.at(-1);
    while (monthKey(cursor) <= last) {
      monthly[monthKey(cursor)] ||= 0;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const pairs = (object) => Object.entries(object).map(([name, count]) => ({ name, count }));
  return {
    dataMode: filters.mode, generatedAt: new Date().toISOString(), filters,
    availableMonths: months,
    totals: { applications: selected.length, eligible, skillsTestCompleted: tested, averageTestScore: tested ? Math.round(scoreSum / tested) : null, shortlisted, countries: Object.values(countries).filter(n => n > 0).length },
    ages: pairs(ages), countries: pairs(countries), pathways: pairs(pathways),
    monthly: pairs(monthly).sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regions.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
// Synthetic showcase data only. Never inserted into the application database.
function createShowcaseRows(now = new Date()) {
  const rows = [];
  COUNTRIES.forEach((country, ci) => {
    Object.keys(LOCATION_HIERARCHY[country].children).forEach((region, ri) => {
      for (let offset = 5; offset >= 0; offset--) {
        const count = 3 + ((ri * 7 + ci * 11 + (5 - offset) * 13) % 27) + (ri < 4 ? 25 : 0);
        for (let i = 0; i < count; i++) {
          const seed = ri * 31 + ci * 17 + offset * 5 + i;
          rows.push({ country, county: region, state: region, region,
            createdAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1 + i % 24)),
            ageAtApplication: seed % 23 === 0 ? null : 18 + seed % 28,
            pathway: PATHWAYS[seed % 3], isEligible: seed % 7 !== 0,
            status: seed % 5 === 0 ? 'APPROVED_FOR_ENROLLMENT' : 'SUBMITTED',
            skillsTestAttempts: seed % 3 !== 2 && seed % 4 !== 0 ? [{ percentage: 40 + seed % 61 }] : [],
          });
        }
      }
    });
  });
  return rows;
}
module.exports = { ageBand, regionName, getDashboardFilters, summarizeApplications, createShowcaseRows };
