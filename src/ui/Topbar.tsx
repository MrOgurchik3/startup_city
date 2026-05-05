import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getDataset } from '../data/generateFakeData';
import { REGION_IDS, REGIONS } from '../data/regions';
import { fmtMoney } from '../lib/encoding';

export function Topbar() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const region = useAppStore((s) => s.region);
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const setRegion = useAppStore((s) => s.setRegion);
  const selectEntity = useAppStore((s) => s.selectEntity);
  const selectRegion = useAppStore((s) => s.selectRegion);
  const globalNavMode = useAppStore((s) => s.globalNavMode);
  const setGlobalNavMode = useAppStore((s) => s.setGlobalNavMode);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { startups: [], regions: [] };
    const { startups } = getDataset();
    const startupMatches = startups
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
    const regionMatches = REGION_IDS.filter((rid) =>
      REGIONS[rid].name.toLowerCase().includes(q)
    );
    return { startups: startupMatches, regions: regionMatches };
  }, [search]);

  const showResults = open && search.trim().length > 0;
  const meta = REGIONS[region];

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-title">Venture Intelligence Map</div>
        <div className="brand-sub">
          {mode === 'city'
            ? `City · ${meta.name} — square grid (not a country map)`
            : 'Global · world map (countries) + cross-border flows'}
        </div>
      </div>

      <div className="topbar-center">
        <div className="mode-switch">
          <button
            className={mode === 'city' ? 'active' : ''}
            onClick={() => setMode('city')}
          >
            City
          </button>
          <button
            className={mode === 'global' ? 'active' : ''}
            onClick={() => setMode('global')}
          >
            Global
          </button>
        </div>
        {mode === 'global' && (
          <div className="global-nav-toggle" role="group" aria-label="Global map navigation">
            <button
              type="button"
              className={globalNavMode === 'orbit' ? 'active' : ''}
              onClick={() => setGlobalNavMode('orbit')}
              title="Left drag: orbit"
            >
              Orbit
            </button>
            <button
              type="button"
              className={globalNavMode === 'pan' ? 'active' : ''}
              onClick={() => setGlobalNavMode('pan')}
              title="Left drag: pan the map"
            >
              Pan
            </button>
          </div>
        )}
        <div className="search">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search startups or regions..."
            value={search}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => setSearch(e.target.value)}
          />
          {showResults && (
            <div className="search-results">
              {results.regions.length > 0 && (
                <>
                  <div className="group">Regions</div>
                  {results.regions.map((rid) => {
                    const m = REGIONS[rid];
                    return (
                      <button
                        key={`r-${rid}`}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setMode('global');
                          setRegion(rid);
                          selectRegion(rid);
                          setSearch('');
                          setOpen(false);
                        }}
                      >
                        <span>{m.name}</span>
                        <span className="secondary">{m.flag}</span>
                      </button>
                    );
                  })}
                </>
              )}
              {results.startups.length > 0 && (
                <>
                  <div className="group">Startups</div>
                  {results.startups.map((s) => (
                    <button
                      key={`s-${s.id}`}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        setRegion(s.region);
                        setMode('city');
                        selectEntity(s.id);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <span>{s.name}</span>
                      <span className="secondary">
                        {s.stage} · {fmtMoney(s.totalRaised)} · {REGIONS[s.region].name}
                      </span>
                    </button>
                  ))}
                </>
              )}
              {results.startups.length === 0 && results.regions.length === 0 && (
                <div className="group">No matches</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="brand-spacer" />
    </div>
  );
}
