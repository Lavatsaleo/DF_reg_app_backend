const prisma = require('../config/prisma');
const { getDashboardFilters, summarizeApplications, createShowcaseRows } = require('../services/applicationDashboard.service');
async function getApplicationDashboard(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    const filters = getDashboardFilters(req.user, req.query);
    const rows = filters.mode === 'demo' ? createShowcaseRows() : await prisma.applicant.findMany({
      where: filters.country ? { country: filters.country } : {},
      select: {
        country: true, county: true, state: true, region: true,
        ageAtApplication: true, sex: true, pathway: true, createdAt: true, isEligible: true, status: true,
        skillsTestAttempts: {
          where: { status: 'SUBMITTED' }, orderBy: { submittedAt: 'desc' }, take: 1,
          select: { percentage: true },
        },
      },
    });
    // Return aggregates only; no names, phone numbers, IDs or individual responses.
    return res.json({ success: true, ...summarizeApplications(rows, filters) });
  } catch (error) {
    if (!error.status) console.error('Application dashboard could not be loaded');
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to load application statistics. Please try again.' });
  }
}
module.exports = { getApplicationDashboard };
