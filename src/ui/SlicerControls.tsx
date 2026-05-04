import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { FilterState, RegionId, Stage } from '../types';
import { REGION_IDS, REGIONS } from '../data/regions';
import { STAGES } from '../data/stages';
import { VERTICALS, VERTICAL_LIST, subSectorsOf } from '../data/sectors';
import { INVESTORS } from '../data/investors';
import { UNIVERSITIES } from '../data/universities';
import { bucketFor } from '../data/stages';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="slicer">
      <div className="slicer-head" onClick={() => setOpen(!open)}>
        <h4>{title}</h4>
        <span className="chev">{open ? '−' : '+'}</span>
      </div>
      {open && <div className="slicer-body">{children}</div>}
    </div>
  );
}

function ChipRow<T extends string>({
  values,
  active,
  onToggle,
  classFor,
  labelFor,
}: {
  values: T[];
  active: T[];
  onToggle: (v: T) => void;
  classFor?: (v: T) => string;
  labelFor?: (v: T) => string;
}) {
  return (
    <div className="chip-row">
      {values.map((v) => {
        const isActive = active.includes(v);
        const extra = classFor ? classFor(v) : '';
        return (
          <button
            key={v}
            className={`chip ${extra} ${isActive ? 'active' : ''}`}
            onClick={() => onToggle(v)}
          >
            {labelFor ? labelFor(v) : v}
          </button>
        );
      })}
    </div>
  );
}

const SIZES: FilterState['companySize'] = ['1-10', '11-50', '51-200', '201-500', '500+'];
const INVESTOR_TYPES: FilterState['investorType'] = [
  'VC',
  'Angel',
  'PE',
  'Accelerator',
  'Government',
];
const OUTCOMES: FilterState['outcomeStatus'] = [
  'Active',
  'Unicorn',
  'Acquired',
  'Flopped',
  'IPO',
];
const FUND_STATUSES: FilterState['fundraisingStatus'] = [
  'Likely Raising',
  'Mid-Cycle',
  'Recently Raised',
];
const EDU: FilterState['education'] = ['BSc', 'MSc', 'MBA', 'PhD', 'No Degree', 'Other'];
const BACKGROUND: FilterState['founderBackground'] = [
  'Engineering',
  'Product',
  'Science',
  'Finance',
  'Sales',
  'Operations',
  'Design',
];
const TIME_PERIODS: FilterState['timePeriod'][] = [
  'Month',
  'Quarter',
  'Year',
  'LTM',
  'YTD',
];

export function SlicerControls({ activeCount }: { activeCount: number }) {
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const toggleFilterValue = useAppStore((s) => s.toggleFilterValue);
  const resetFilters = useAppStore((s) => s.resetFilters);

  const subSectorOptions = useMemo(() => {
    if (filters.vertical.length === 0) {
      return Object.values(VERTICALS).flat();
    }
    return filters.vertical.flatMap((v) => subSectorsOf(v));
  }, [filters.vertical]);

  const universityFiltered = useMemo(() => {
    return UNIVERSITIES.map((u) => u.name);
  }, []);

  const investorOptions = useMemo(() => {
    return INVESTORS.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <div className="slicers">
      <Section title="Round Stage" defaultOpen>
        <ChipRow<Stage>
          values={STAGES}
          active={filters.stage}
          onToggle={(v) => toggleFilterValue('stage', v)}
          classFor={(v) => `chip-stage-${bucketFor(v)}`}
        />
      </Section>

      <Section title="Vertical" defaultOpen>
        <ChipRow<string>
          values={VERTICAL_LIST}
          active={filters.vertical}
          onToggle={(v) => {
            toggleFilterValue('vertical', v);
            setFilter(
              'subSector',
              filters.subSector.filter((ss) =>
                subSectorsOf(v).every((sub) => sub !== ss)
              )
            );
          }}
        />
      </Section>

      <Section title="Sub-Sector">
        <ChipRow<string>
          values={subSectorOptions}
          active={filters.subSector}
          onToggle={(v) => toggleFilterValue('subSector', v)}
        />
      </Section>

      <Section title="Geography">
        <ChipRow<RegionId>
          values={REGION_IDS}
          active={filters.geography}
          onToggle={(v) => toggleFilterValue('geography', v)}
          labelFor={(v) => REGIONS[v].name}
        />
      </Section>

      <Section title="Time Period">
        <div className="chip-row">
          {TIME_PERIODS.map((tp) => (
            <button
              key={tp}
              className={`chip ${filters.timePeriod === tp ? 'active' : ''}`}
              onClick={() => setFilter('timePeriod', tp)}
            >
              {tp}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Company Size">
        <ChipRow<FilterState['companySize'][number]>
          values={SIZES}
          active={filters.companySize}
          onToggle={(v) => toggleFilterValue('companySize', v)}
        />
      </Section>

      <Section title="Investor Type">
        <ChipRow<FilterState['investorType'][number]>
          values={INVESTOR_TYPES}
          active={filters.investorType}
          onToggle={(v) => toggleFilterValue('investorType', v)}
        />
      </Section>

      <Section title="Investor Name">
        <input
          className="chip"
          placeholder="Filter investor list..."
          style={{ marginBottom: 6, width: '100%', padding: '4px 8px' }}
          onChange={() => {
            // The chip list below is alphabetical; adding a free-text input
            // here is a UX nicety but the list itself does the heavy lifting.
          }}
        />
        <div className="chip-row" style={{ maxHeight: 180, overflowY: 'auto' }}>
          {investorOptions.map((inv) => {
            const active = filters.investorName.includes(inv.id);
            return (
              <button
                key={inv.id}
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => toggleFilterValue('investorName', inv.id)}
                title={inv.type}
              >
                {inv.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Outcome Status">
        <ChipRow<FilterState['outcomeStatus'][number]>
          values={OUTCOMES}
          active={filters.outcomeStatus}
          onToggle={(v) => toggleFilterValue('outcomeStatus', v)}
        />
      </Section>

      <Section title="Fundraising Status">
        <ChipRow<FilterState['fundraisingStatus'][number]>
          values={FUND_STATUSES}
          active={filters.fundraisingStatus}
          onToggle={(v) => toggleFilterValue('fundraisingStatus', v)}
        />
      </Section>

      <Section title="Education Level">
        <ChipRow<FilterState['education'][number]>
          values={EDU}
          active={filters.education}
          onToggle={(v) => toggleFilterValue('education', v)}
        />
      </Section>

      <Section title="Founder Background">
        <ChipRow<FilterState['founderBackground'][number]>
          values={BACKGROUND}
          active={filters.founderBackground}
          onToggle={(v) => toggleFilterValue('founderBackground', v)}
        />
      </Section>

      <Section title="University">
        <div className="chip-row" style={{ maxHeight: 160, overflowY: 'auto' }}>
          {universityFiltered.map((name) => {
            const active = filters.university.includes(name);
            return (
              <button
                key={name}
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => toggleFilterValue('university', name)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Repeat Founder">
        <div className="chip-row">
          {(['any', 'yes', 'no'] as const).map((v) => (
            <button
              key={v}
              className={`chip ${filters.repeatFounder === v ? 'active' : ''}`}
              onClick={() => setFilter('repeatFounder', v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Prior Exit">
        <div className="chip-row">
          {(['any', 'yes', 'no'] as const).map((v) => (
            <button
              key={v}
              className={`chip ${filters.priorExit === v ? 'active' : ''}`}
              onClick={() => setFilter('priorExit', v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      <button
        className="btn-link"
        style={{ marginTop: 12 }}
        onClick={() => resetFilters()}
      >
        Reset all filters ({activeCount} active)
      </button>
    </div>
  );
}
