const { COUNTRIES, LOCATION_HIERARCHY } = require('../data/administrativeLocations');
const AGE_BANDS = ['Under 18', '18–24', '25–29', '30–35', '36–45', '46+', 'Not recorded'];
const PATHWAYS = ['PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP'];
const SEXES = ['Female', 'Male', 'Not recorded'];
const SHORTLISTED_STATUSES = ['APPROVED_FOR_ENROLLMENT', 'ENROLLED_IN_DHIS2_PROGRAM'];
// The two application forms word options differently; both map onto one reporting list.
// Disability types are stored joined with ", " but some option names contain commas, so match patterns instead of splitting.
const DISABILITY_TYPES = [
  ['Physical disability', /physical disability/i],
  ['Blind', /(^|, )(person who is )?blind(?=,|$)/i],
  ['Low vision', /low vision/i],
  ['Deaf', /(^|, )(person who is )?deaf(?=,|$)/i],
  ['Hard of hearing', /hard of hearing/i],
  ['Deaf-blindness', /deaf-blind/i],
  ['Speech or communication', /speech or communication/i],
  ['Intellectual disability', /intellectual disability/i],
  ['Neurodiverse', /neurodiverse/i],
  ['Psychosocial disability', /psychosocial/i],
  ['Albinism', /albinism/i],
  ['Other', /(^|, )other(?=,|$)/i],
];
const SOURCES = [
  ['Social media', /social media/i],
  ['Radio', /^radio$/i],
  ['TV', /^(tv|television)$/i],
  ['Friends or family', /friend|relative|family/i],
  ['Organisation of persons with disabilities', /\bopd\b|persons with disabilities/i],
  ['TVET or university', /tvet|university/i],
  ['Community leader', /community leader/i],
  ['Employer or BDN', /employer|bdn/i],
  ['Flyer, poster or banner', /flyer|poster|banner/i],
  ['Other', /^other$/i],
];
function disabilityTypes(row) {
  const raw = String(row.disabilityType || '');
  const types = DISABILITY_TYPES.filter(([, pattern]) => pattern.test(raw)).map(([name]) => name);
  return types.length ? types : ['Type not recorded'];
}
function sourceName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Not recorded';
  return SOURCES.find(([, pattern]) => pattern.test(raw))?.[0] || 'Other';
}
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
function sexName(value) {
  const key = String(value || '').trim().toLowerCase();
  if (['female', 'f', 'woman'].includes(key)) return 'Female';
  if (['male', 'm', 'man'].includes(key)) return 'Male';
  return 'Not recorded';
}
function getDashboardFilters(user, query = {}) {
  const country = String(query.country || '').trim();
  const month = String(query.month || '').trim();
  const mode = String(query.mode || 'live');
  const sex = String(query.sex || '').trim();
  if (!['ADMIN', 'VIEWER'].includes(user?.role)) throw Object.assign(Error('Dashboard access is not enabled for this account.'), { status: 403 });
  if (country && !COUNTRIES.includes(country)) throw Object.assign(Error('Choose a supported country.'), { status: 400 });
  if (month && !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(Error('Choose a valid month.'), { status: 400 });
  if (sex && !SEXES.includes(sex)) throw Object.assign(Error('Choose a valid gender.'), { status: 400 });
  if (!['live', 'demo'].includes(mode)) throw Object.assign(Error('Invalid data mode.'), { status: 400 });
  const assignedCountry = user.role === 'VIEWER' ? String(user.country || '').trim() : '';
  if (assignedCountry && !COUNTRIES.includes(assignedCountry)) throw Object.assign(Error('Your dashboard country scope needs to be corrected by an administrator.'), { status: 403 });
  if (assignedCountry && country && country !== assignedCountry) throw Object.assign(Error('You can only view your assigned country.'), { status: 403 });
  return { country: assignedCountry || country, month, sex, mode, assignedCountry, countries: assignedCountry ? [assignedCountry] : COUNTRIES };
}
function monthKey(value) { return new Date(value).toISOString().slice(0, 7); }
// Every breakdown carries a per-sex split so the dashboard can disaggregate any chart by gender.
const emptyBySex = () => Object.fromEntries(SEXES.map(name => [name, 0]));
const counter = (names) => new Map(names.map(name => [name, { count: 0, bySex: emptyBySex() }]));
function tally(map, name, sex, extra) {
  if (!map.has(name)) map.set(name, { ...extra, count: 0, bySex: emptyBySex() });
  const entry = map.get(name);
  entry.count++; entry.bySex[sex]++;
}
const pairs = (map) => [...map].map(([name, entry]) => ({ name, ...entry }));
function summarizeApplications(rows, filters) {
  const scoped = rows.filter(row => !filters.assignedCountry || row.country === filters.assignedCountry);
  const countryRows = scoped.filter(row => !filters.country || row.country === filters.country);
  const months = [...new Set(countryRows.map(row => monthKey(row.createdAt)))].sort().reverse();
  const selected = countryRows.filter(row => (!filters.month || monthKey(row.createdAt) === filters.month) && (!filters.sex || sexName(row.sex) === filters.sex));
  const ages = counter(AGE_BANDS), countries = counter(filters.countries), pathways = counter(PATHWAYS), genders = counter(SEXES);
  const disabilities = counter(DISABILITY_TYPES.map(([name]) => name));
  const sources = counter(SOURCES.map(([name]) => name));
  const withDisability = counter(['Applicants with a disability']);
  const funnel = counter(['Applied', 'Initially eligible', 'ICT test completed', 'Shortlisted / enrolled']);
  const monthly = new Map(), regions = new Map();
  let eligible = 0, tested = 0, scoreSum = 0, shortlisted = 0;
  for (const row of selected) {
    const sex = sexName(row.sex), country = row.country || 'Not recorded';
    tally(genders, sex, sex);
    tally(ages, ageBand(row.ageAtApplication), sex);
    tally(countries, country, sex);
    tally(pathways, row.pathway || 'UNKNOWN', sex);
    tally(monthly, monthKey(row.createdAt), sex);
    const region = regionName(row);
    tally(regions, `${country}|${region}`, sex, { country, region });
    tally(funnel, 'Applied', sex);
    tally(sources, sourceName(row.heardAboutProject), sex);
    // One applicant can report several disability types, so type counts can add up to more than the disability total.
    if (row.hasDisability) {
      tally(withDisability, 'Applicants with a disability', sex);
      for (const type of disabilityTypes(row)) tally(disabilities, type, sex);
    }
    if (row.isEligible) { eligible++; tally(funnel, 'Initially eligible', sex); }
    const test = row.skillsTestAttempts?.[0];
    if (test) { tested++; scoreSum += Number(test.percentage) || 0; tally(funnel, 'ICT test completed', sex); }
    if (SHORTLISTED_STATUSES.includes(row.status)) { shortlisted++; tally(funnel, 'Shortlisted / enrolled', sex); }
  }
  const monthNames = [...monthly.keys(), filters.month].filter(Boolean).sort();
  if (monthNames.length) {
    const cursor = new Date(monthNames[0] + '-01T00:00:00Z');
    while (monthKey(cursor) <= monthNames.at(-1)) {
      if (!monthly.has(monthKey(cursor))) monthly.set(monthKey(cursor), { count: 0, bySex: emptyBySex() });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return {
    dataMode: filters.mode, generatedAt: new Date().toISOString(), filters,
    availableMonths: months,
    totals: { applications: selected.length, eligible, skillsTestCompleted: tested, averageTestScore: tested ? Math.round(scoreSum / tested) : null, shortlisted, countries: [...countries.values()].filter(c => c.count > 0).length },
    ages: pairs(ages), countries: pairs(countries), pathways: pairs(pathways), genders: pairs(genders), genderFunnel: pairs(funnel),
    disability: { ...pairs(withDisability)[0], types: pairs(disabilities).filter(t => t.count > 0 || t.name !== 'Type not recorded').sort((a, b) => b.count - a.count) },
    sources: pairs(sources).filter(source => source.count > 0 || source.name !== 'Not recorded').sort((a, b) => b.count - a.count),
    monthly: pairs(monthly).sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regions.values()].map(({ region, ...entry }) => ({ ...entry, name: region })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
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
            sex: seed % 29 === 0 ? null : (seed * 7 + ri) % 11 < 5 ? 'Female' : 'Male',
            hasDisability: seed % 4 === 0,
            disabilityType: ['Person who is blind', 'Physical disability (mobility impairments, short stature, cerebral palsy, spina bifida)', 'Low vision', 'Deaf', 'Albinism, Low vision', 'Psychosocial disability', 'Neurodiverse (incl. Autism, ADHD, dyslexia, epilepsy, learning disabilities)'][seed % 7],
            heardAboutProject: ['Social Media', 'Radio', 'Friends / Relatives', 'Organisation of Persons with Disabilities (OPD)', 'TV', 'Employer / BDN', 'TVET / University', 'Flyer/Poster/Banner'][(seed * 3 + ci) % 8],
            status: seed % 5 === 0 ? 'APPROVED_FOR_ENROLLMENT' : 'SUBMITTED',
            skillsTestAttempts: seed % 3 !== 2 && seed % 4 !== 0 ? [{ percentage: 40 + seed % 61 }] : [],
          });
        }
      }
    });
  });
  return rows;
}
module.exports = { SEXES, sexName, disabilityTypes, sourceName, ageBand, regionName, getDashboardFilters, summarizeApplications, createShowcaseRows };
