/**
 * Contrôle d'accès aux jobs de production (pur, testable sans boot agent).
 */
export function canAccessProductionJob(job, browserId) {
  if (!job) return false;
  if (!job.browserId || !browserId) return false;
  return job.browserId === browserId;
}
