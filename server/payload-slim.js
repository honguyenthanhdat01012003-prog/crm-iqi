/**
 * Pure helpers to keep /api/data and extras payloads small.
 * Used by server/index.js and unit-tested in isolation.
 */

/** Keep project cost summary only — drop daily/detail arrays that inflate bootstrap. */
export function slimCostData(costData) {
  if (!costData || typeof costData !== "object") {
    return { totalSpent: 0, totalLeads: 0, totalBooking: 0, cpLead: 0 };
  }
  const totalSpent = Number(costData.totalSpent) || 0;
  const totalLeads = Number(costData.totalLeads) || 0;
  const totalBooking = Number(costData.totalBooking) || 0;
  const cpLead =
    Number(costData.cpLead) ||
    (totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0);
  return { totalSpent, totalLeads, totalBooking, cpLead };
}

/**
 * List/extras schedule: progress + meta only.
 * Full assignmentLog / leadIds stay on GET /api/leads/schedules/:id/detail.
 */
export function slimScheduleForList(schedule) {
  if (!schedule || typeof schedule !== "object") return schedule;
  const log = Array.isArray(schedule.assignmentLog) ? schedule.assignmentLog : [];
  const skippedCount = log.filter(
    (e) =>
      e &&
      (e.skipped ||
        e.stopped ||
        e.type === "schedule_stopped" ||
        e.type === "sale_done")
  ).length;
  const { assignmentLog, leadIds, ...rest } = schedule;
  return {
    ...rest,
    leadIds: [],
    assignmentLog: [],
    skippedCount,
  };
}

export function slimSchedulesForList(schedules) {
  if (!Array.isArray(schedules)) return [];
  return schedules.map(slimScheduleForList);
}
