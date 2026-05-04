import type {
  FilterState,
  Startup,
  TimePeriod,
} from '../types';
import { INVESTOR_BY_ID } from '../data/investors';

// Return the inclusive [start, end] date for a given time period.
// `now` is injected so the same dataset stays deterministic across renders.
export function periodWindow(
  period: TimePeriod,
  now: Date
): [Date, Date] {
  const end = now;
  const start = new Date(now);
  switch (period) {
    case 'Month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'Quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'Year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'LTM':
      start.setMonth(start.getMonth() - 12);
      break;
    case 'YTD':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return [start, end];
}

function arrIncludes<T>(filter: T[], value: T): boolean {
  return filter.length === 0 || filter.includes(value);
}

export function applyFilters(
  startups: Startup[],
  filters: FilterState,
  now: Date
): Startup[] {
  const [winStart, winEnd] = periodWindow(filters.timePeriod, now);
  return startups.filter((s) => {
    if (!arrIncludes(filters.vertical, s.vertical)) return false;
    if (!arrIncludes(filters.subSector, s.subSector)) return false;
    if (!arrIncludes(filters.stage, s.stage)) return false;
    if (!arrIncludes(filters.geography, s.region)) return false;
    if (!arrIncludes(filters.companySize, s.companySize)) return false;
    if (!arrIncludes(filters.outcomeStatus, s.outcomeStatus)) return false;
    if (!arrIncludes(filters.fundraisingStatus, s.fundraisingStatus))
      return false;

    if (filters.investorName.length > 0) {
      const has = s.investorIds.some((id) =>
        filters.investorName.includes(id)
      );
      if (!has) return false;
    }

    if (filters.investorType.length > 0) {
      const has = s.investorIds.some((id) => {
        const inv = INVESTOR_BY_ID[id];
        return inv && filters.investorType.includes(inv.type);
      });
      if (!has) return false;
    }

    if (filters.education.length > 0) {
      const has = s.founders.some((f) =>
        filters.education.includes(f.education)
      );
      if (!has) return false;
    }

    if (filters.founderBackground.length > 0) {
      const has = s.founders.some((f) =>
        filters.founderBackground.includes(f.background)
      );
      if (!has) return false;
    }

    if (filters.university.length > 0) {
      const has = s.founders.some((f) =>
        filters.university.includes(f.university)
      );
      if (!has) return false;
    }

    if (filters.repeatFounder !== 'any') {
      const want = filters.repeatFounder === 'yes';
      const has = s.founders.some((f) => f.repeatFounder === want);
      if (!has) return false;
    }

    if (filters.priorExit !== 'any') {
      const want = filters.priorExit === 'yes';
      const has = s.founders.some((f) => f.priorExit === want);
      if (!has) return false;
    }

    // Time-period: include startups whose latest round falls inside the window
    // unless the slicer is the default LTM (which is the natural state).
    if (filters.timePeriod !== 'LTM') {
      const last = new Date(s.lastRoundDate);
      if (last < winStart || last > winEnd) return false;
    }

    return true;
  });
}
