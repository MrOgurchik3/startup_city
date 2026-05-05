import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { defaultFilters } from '../store/useAppStore';
import { SlicerControls } from './SlicerControls';
import { useFilteredDataset } from '../lib/useFilteredDataset';

export function SidePanel() {
  const filters = useAppStore((s) => s.filters);
  const { filtered, all } = useFilteredDataset();

  const activeCount = useMemo(() => {
    let n = 0;
    (Object.keys(filters) as (keyof typeof filters)[]).forEach((key) => {
      const v = filters[key];
      const def = defaultFilters[key];
      if (Array.isArray(v) && Array.isArray(def)) {
        if (v.length !== def.length) n += 1;
      } else if (v !== def) {
        n += 1;
      }
    });
    return n;
  }, [filters]);

  return (
    <div className="side-panel">
      <div className="panel-head">
        <h3>Slicers</h3>
        <span className="count" style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
          {filtered.length.toLocaleString()} / {all.length.toLocaleString()}
        </span>
      </div>

      <div className="panel-body">
        <SlicerControls activeCount={activeCount} />
      </div>

      <div className="panel-foot">
        <span className="count">
          {filtered.length.toLocaleString()} startups in view
        </span>
      </div>
    </div>
  );
}
