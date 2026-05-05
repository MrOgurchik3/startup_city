import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useFilteredDataset } from '../../lib/useFilteredDataset';
import { cityBuildingWidth } from '../../lib/encoding';
import { getDataset } from '../../data/generateFakeData';
import type { InvestorFirmProfile, Startup } from '../../types';
import type { CitySubGridSpec } from './CityGround';
import { CityGround } from './CityGround';
import { CityStreets, type StreetBlock } from './CityStreets';
import { CityMetaGridRoads } from './CityMetaGridRoads';
import { CityDistrictAccents, type DistrictAccent } from './CityDistrictAccents';
import { InfiniteHorizonBackdrop } from '../InfiniteHorizonBackdrop';
import { CityBlockLabels, type CityBlockLabel } from './CityBlockLabels';
import { Buildings } from './Buildings';
import { Spires } from './Spires';
import { GlowBase } from './GlowBase';
import { SelectionRing } from './SelectionRing';
import { NewsFireworks } from './NewsFireworks';
import { OutcomeMarkers } from './OutcomeMarkers';
import { ExitOutcomeSparkles } from './ExitOutcomeSparkles';
import { InvestorLines } from './InvestorLines';
import { SubSectorTints } from './SubSectorTints';
import { CityXZPick } from './CityXZPick';
import { Html } from '@react-three/drei';

/** Minimum centre-to-centre spacing (world units). */
const PITCH_MIN = 2.85;
/** Gap between widest footprint and the next cell centre. */
const PITCH_MARGIN = 0.55;
/** Soft cap on columns inside one vertical (keeps lots readable). */
const MAX_COLS_PER_VERTICAL = 18;
/** Padding inside each meta-cell around the largest strip footprint (× pitch). */
const META_LOT_PAD = 0.22;
/** Asphalt lane between meta-cells (× pitch). */
const META_ROAD_PITCH = 0.52;

const INVESTORS_META_KEY = '__investors__';
const EXTERNAL_FUNDING_HUB_ID = '__external_funding_hub__';

function makeExternalFundingHub(region: Startup['region']): Startup {
  const investorFirmProfile: InvestorFirmProfile = {
    assetsUnderManagement: 4.5e9,
    portfolioCompanies: 140,
    dealsLastYear: 48,
    totalDealsLtm: 110,
    leadRoundRate: 0.35,
    coInvestorFrequency: 0.62,
    avgDaysBetweenDeals: 18,
    portfolioUnicornRate: 0.12,
    portfolioFlopRate: 0.08,
    portfolioAcquisitionRate: 0.14,
    portfolioAvgRaised: 1.1e7,
    repeatFounderRate: 0.23,
    priorExitRate: 0.18,
    priorFlopRate: 0.09,
  };
  return {
    id: `${region}-${EXTERNAL_FUNDING_HUB_ID}`,
    name: 'External funding',
    region,
    city: 'External',
    lat: 0,
    lng: 0,
    stage: 'Series C+',
    vertical: 'Investors',
    subSector: 'External',
    entityType: 'Other',
    totalRaised: 1e9,
    latestValuation: 5e9,
    arr: 2e7,
    websiteVisitorsMonthly: 1e6,
    valuationRaisedMultiple: 5,
    timeToLastRoundDays: 45,
    lastRoundDate: '2026-04-01',
    founded: '2016-01-01',
    companySize: '500+',
    outcomeStatus: 'Active',
    fundraisingStatus: 'Mid-Cycle',
    founders: [],
    rounds: [],
    investorIds: [],
    events: [],
    investorFirmProfile,
  };
}

export type DistrictSlot = {
  verticalKey: string;
  displayLabel: string;
  startups: Startup[];
  colsW: number;
  rowsW: number;
  cx: number;
  cz: number;
};

export type MetaGridSpec = {
  metaCols: number;
  metaRows: number;
  metaCellW: number;
  metaCellD: number;
  roadW: number;
};

function slugId(prefix: string, key: string): string {
  const safe = key.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'x';
  return `${prefix}-${safe}`.slice(0, 64);
}

function displayVerticalName(key: string): string {
  if (key === INVESTORS_META_KEY) return 'Investors';
  const t = key.trim() || 'Other';
  return t.length <= 22 ? t : `${t.slice(0, 20)}…`;
}

function computeMetaLayout(slots: DistrictSlot[], pitch: number): MetaGridSpec {
  const nMeta = slots.length;
  const metaCols = Math.max(1, Math.ceil(Math.sqrt(nMeta)));
  const metaRows = Math.max(1, Math.ceil(nMeta / metaCols));
  const padLot = pitch * META_LOT_PAD;
  const maxHalfW = Math.max(
    pitch * 0.5,
    ...slots.map((s) => (s.colsW * pitch) / 2 + padLot)
  );
  const maxHalfD = Math.max(
    pitch * 0.5,
    ...slots.map((s) => (s.rowsW * pitch) / 2 + padLot)
  );
  const metaRoad = pitch * META_ROAD_PITCH;
  const metaCellW = 2 * maxHalfW + metaRoad;
  const metaCellD = 2 * maxHalfD + metaRoad;
  const roadW = Math.max(pitch * 0.32, metaRoad * 0.9);
  return { metaCols, metaRows, metaCellW, metaCellD, roadW };
}

function spiralOrder(metaCols: number, metaRows: number, centerC: number, centerR: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= metaCols || r >= metaRows) return;
    const idx = r * metaCols + c;
    if (seen.has(idx)) return;
    seen.add(idx);
    out.push(idx);
  };
  // Classic spiral walk around the center cell.
  let c = centerC;
  let r = centerR;
  push(c, r);

  let run = 1;
  while (out.length < metaCols * metaRows) {
    // right run
    for (let i = 0; i < run; i += 1) {
      c += 1;
      push(c, r);
    }
    // down run
    for (let i = 0; i < run; i += 1) {
      r += 1;
      push(c, r);
    }
    run += 1;
    // left run
    for (let i = 0; i < run; i += 1) {
      c -= 1;
      push(c, r);
    }
    // up run
    for (let i = 0; i < run; i += 1) {
      r -= 1;
      push(c, r);
    }
    run += 1;
  }
  return out;
}

function hashLayoutSeedStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic shuffle (Fisher-Yates) for repeatable investor-slot scatter. */
function shuffleIntsDeterministic(vals: readonly number[], seedStr: string): number[] {
  let seed = hashLayoutSeedStr(seedStr);
  const rng = (): number => {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...vals];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j]!;
    out[j] = t!;
  }
  return out;
}

export function CityScene() {
  const region = useAppStore((s) => s.region);
  const selection = useAppStore((s) => s.selection);
  const { filtered } = useFilteredDataset();

  const localStartups = useMemo(
    () =>
      filtered.filter((s) => s.entityType === 'Startup' && s.region === region),
    [filtered, region]
  );
  const investorRows = useMemo(
    () => filtered.filter((s) => s.entityType !== 'Startup'),
    [filtered]
  );

  /** Investor firms cited on local startups’ cap tables but not yet in investorRows (e.g. cross-border). */
  const referencedInvestors = useMemo(() => {
    const ids = new Set<string>();
    localStartups.forEach((s) => {
      s.investorIds.forEach((id) => ids.add(id));
      s.rounds.forEach((r) => {
        r.investorIds.forEach((id) => ids.add(id));
        if (r.leadInvestorId) ids.add(r.leadInvestorId);
      });
    });
    const investorEntityById = new Map<string, Startup>();
    getDataset().startups.forEach((row) => {
      if (row.entityType !== 'Startup') investorEntityById.set(row.id, row);
    });
    const have = new Set(investorRows.map((x) => x.id));
    const extras: Startup[] = [];
    ids.forEach((id) => {
      if (have.has(id)) return;
      const row = investorEntityById.get(id);
      if (row) extras.push(row);
    });
    return extras;
  }, [localStartups, investorRows]);

  /** Local startups + investor rows + cited investors missing from investorRows */
  const cityEntities = useMemo(() => {
    const byId = new Map<string, Startup>();
    const addAll = (list: Startup[]) => {
      list.forEach((s) => byId.set(s.id, s));
    };
    addAll(investorRows);
    addAll(referencedInvestors);
    addAll(localStartups);
    return [...byId.values()];
  }, [investorRows, referencedInvestors, localStartups]);

  const layoutEntityKey = useMemo(
    () =>
      [...cityEntities]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((e) => e.id)
        .join('\0'),
    [cityEntities]
  );

  type Layout = {
    entities: Startup[];
    positions: Map<string, [number, number]>;
    gridExtent: number;
    subGrids: CitySubGridSpec[];
    streetBlocks: StreetBlock[];
    blockLabels: CityBlockLabel[];
    districtAccents: DistrictAccent[];
    metaGrid: MetaGridSpec | null;
    hasDistricts: boolean;
  };

  const emptyLayout = useMemo<Layout>(() => {
    return {
      entities: [],
      positions: new Map<string, [number, number]>(),
      gridExtent: 48,
      subGrids: [],
      streetBlocks: [],
      blockLabels: [],
      districtAccents: [],
      metaGrid: null,
      hasDistricts: false,
    };
  }, []);

  const [layout, setLayout] = useState<Layout>(emptyLayout);
  const [isComputing, setIsComputing] = useState(false);

  const computeLayout = (): Layout => {
    const map = new Map<string, [number, number]>();
    const n = cityEntities.length;
    if (n === 0) {
      return {
        entities: [] as Startup[],
        positions: map,
        gridExtent: 48,
        subGrids: [] as CitySubGridSpec[],
        streetBlocks: [] as StreetBlock[],
        blockLabels: [] as CityBlockLabel[],
        districtAccents: [] as DistrictAccent[],
        metaGrid: null as MetaGridSpec | null,
        hasDistricts: false,
      };
    }
    const hub = makeExternalFundingHub(region);
    const sorted = [...cityEntities, hub].sort((a, b) => a.id.localeCompare(b.id));
    const startupsEnt = sorted.filter((s) => s.entityType === 'Startup');
    const investorsEnt = sorted.filter((s) => s.entityType !== 'Startup');
    const nS = startupsEnt.length;
    const nI = investorsEnt.length;

    let colsI = 0;
    let rowsI = 0;
    if (nI > 0) {
      colsI = Math.max(1, Math.ceil(Math.sqrt(nI)));
      rowsI = Math.ceil(nI / colsI);
    }

    const maxFootprint = Math.max(...sorted.map((s) => cityBuildingWidth(s)), 0.85);
    const pitch = Math.max(PITCH_MIN, maxFootprint + PITCH_MARGIN);

    const place = (s: Startup, x: number, z: number) => {
      map.set(s.id, [x, z]);
    };

    const slots: DistrictSlot[] = [];

    if (nS > 0) {
      const byVertical = new Map<string, Startup[]>();
      startupsEnt.forEach((s) => {
        const k = (s.vertical && s.vertical.trim()) || 'Other';
        if (!byVertical.has(k)) byVertical.set(k, []);
        byVertical.get(k)!.push(s);
      });
      const keys = [...byVertical.keys()].sort((a, b) => a.localeCompare(b));

      keys.forEach((key) => {
        const bucket = byVertical.get(key) ?? [];
        if (bucket.length === 0) return;
        const nW = bucket.length;
        const colsW = Math.min(
          MAX_COLS_PER_VERTICAL,
          Math.max(1, Math.ceil(Math.sqrt(nW)))
        );
        const rowsW = Math.ceil(nW / colsW);
        slots.push({
          verticalKey: key,
          displayLabel: displayVerticalName(key),
          startups: bucket,
          colsW,
          rowsW,
          cx: 0,
          cz: 0,
        });
      });
    }

    if (nI > 0) {
      const invList = [...investorsEnt];
      slots.push({
        verticalKey: INVESTORS_META_KEY,
        displayLabel: 'Investors',
        startups: invList,
        colsW: colsI,
        rowsW: rowsI,
        cx: 0,
        cz: 0,
      });
    }

    if (slots.length === 0) {
      return {
        entities: sorted,
        positions: map,
        gridExtent: 48,
        subGrids: [] as CitySubGridSpec[],
        streetBlocks: [] as StreetBlock[],
        blockLabels: [] as CityBlockLabel[],
        districtAccents: [] as DistrictAccent[],
        metaGrid: null,
        hasDistricts: false,
      };
    }

    // Layout: keep districts in a grid, but force Investors into the center cell.
    const meta = computeMetaLayout(slots, pitch);
    const { metaCols, metaRows, metaCellW, metaCellD, roadW } = meta;
    const centerFracC = (metaCols - 1) / 2;
    const centerFracR = (metaRows - 1) / 2;
    const centerC = Math.round(centerFracC);
    const centerR = Math.round(centerFracR);
    const centerCell = centerR * metaCols + centerC;

    const investorsSlot = slots.find((s) => s.verticalKey === INVESTORS_META_KEY) ?? null;
    const otherSlots = slots.filter((s) => s.verticalKey !== INVESTORS_META_KEY);
    const cellOrder = spiralOrder(metaCols, metaRows, centerC, centerR);
    const cells = cellOrder.filter((c) => (investorsSlot ? c !== centerCell : true));

    // Place investors district on the same meta-cell centroid as other verticals (fixes even-grid offset vs roads).
    if (investorsSlot) {
      const gc = centerCell % metaCols;
      const gr = Math.floor(centerCell / metaCols);
      investorsSlot.cx = (gc - centerFracC) * metaCellW;
      investorsSlot.cz = (gr - centerFracR) * metaCellD;
    }
    otherSlots.forEach((strip, i) => {
      const cell = cells[i] ?? cells[cells.length - 1] ?? 0;
      const gc = cell % metaCols;
      const gr = Math.floor(cell / metaCols);
      strip.cx = (gc - centerFracC) * metaCellW;
      strip.cz = (gr - centerFracR) * metaCellD;
    });

    // Place buildings: row-major walk for verticals; investors shuffled around hub (no tallest-in-center).
    slots.forEach((strip) => {
      const { colsW, rowsW } = strip;
      const capacity = colsW * rowsW;
      const isInvestors = strip.verticalKey === INVESTORS_META_KEY;
      const invCenter =
        Math.floor(strip.rowsW / 2) * strip.colsW + Math.floor(strip.colsW / 2);

      const hub = strip.startups.find(
        (x) => isInvestors && x.id.endsWith(EXTERNAL_FUNDING_HUB_ID)
      );

      const slotByKey = new Map<string, number>();

      if (isInvestors) {
        const others = strip.startups
          .filter((x) => x !== hub)
          .sort((a, b) => a.id.localeCompare(b.id));
        const freePool: number[] = [];
        for (let j = 0; j < capacity; j += 1) {
          if (!hub || j !== invCenter) freePool.push(j);
        }
        const freeSlots = shuffleIntsDeterministic(
          freePool,
          `${region}::inv-lot::${colsW}x${rowsW}::${others.length}`
        );
        if (hub) slotByKey.set(hub.id, invCenter);
        others.forEach((ent, idx) => {
          slotByKey.set(ent.id, freeSlots[idx] ?? freeSlots[freeSlots.length - 1] ?? 0);
        });
      } else {
        const ordered = [...strip.startups].sort((a, b) => a.id.localeCompare(b.id));
        ordered.forEach((ent, idx) => {
          slotByKey.set(ent.id, Math.min(idx, capacity - 1));
        });
      }

      strip.startups.forEach((s) => {
        const j = slotByKey.get(s.id)!;
        const lc = j % strip.colsW;
        const lr = Math.floor(j / strip.colsW);
        const xLocal = (lc - (strip.colsW - 1) / 2) * pitch;
        const zLocal = (lr - (strip.rowsW - 1) / 2) * pitch;
        place(s, strip.cx + xLocal, strip.cz + zLocal);
      });
    });

    // Compute extent from placed points.
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    map.forEach(([x, z]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    const span = Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minZ), Math.abs(maxZ), pitch * 2);
    const gridExtent = span * 2 * 1.22;

    const subGrids: CitySubGridSpec[] = [];
    const streetBlocks: StreetBlock[] = [];
    slots.forEach((v, i) => {
      subGrids.push({
        cx: v.cx,
        cz: v.cz,
        cols: v.colsW,
        rows: v.rowsW,
        pitch,
        lineColor: i % 2 === 1 ? '#a8b4c9' : undefined,
      });
      streetBlocks.push({ cx: v.cx, cz: v.cz, cols: v.colsW, rows: v.rowsW, pitch });
    });

    const metaGrid: MetaGridSpec | null = { ...meta, roadW };

    const districtAccents: DistrictAccent[] = slots.map((v) => ({
      id: slugId('acc', v.verticalKey),
      cx: v.cx,
      cz: v.cz,
      halfW: (v.colsW * pitch) / 2,
      halfD: (v.rowsW * pitch) / 2,
    }));

    const blockLabels: CityBlockLabel[] = slots.map((v) => {
      const hd = (v.rowsW * pitch) / 2;
      return {
        id: slugId('vert', v.verticalKey),
        text: v.displayLabel,
        x: v.cx,
        z: v.cz,
        halfD: hd,
      };
    });

    return {
      entities: sorted,
      positions: map,
      gridExtent,
      subGrids,
      streetBlocks,
      blockLabels,
      districtAccents,
      metaGrid,
      hasDistricts: true,
    };
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsComputing(true);
      setLayout(emptyLayout);
      const result = computeLayout();
      setLayout(result);
      setIsComputing(false);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, layoutEntityKey, emptyLayout]);

  const {
    entities,
    positions,
    gridExtent,
    subGrids,
    streetBlocks,
    blockLabels,
    districtAccents,
    metaGrid,
    hasDistricts,
  } = layout;

  const selectedStartup = useMemo(() => {
    if (selection?.kind !== 'entity') return null;
    return entities.find((s) => s.id === selection.id) ?? null;
  }, [selection, entities]);

  return (
    <group>
      <InfiniteHorizonBackdrop />
      <CityGround gridExtent={gridExtent} subGrids={subGrids} />
      <CityStreets blocks={streetBlocks} />
      {hasDistricts && metaGrid != null && <CityMetaGridRoads {...metaGrid} />}
      {hasDistricts && districtAccents.length > 0 && (
        <CityDistrictAccents strips={districtAccents} />
      )}
      <CityBlockLabels labels={blockLabels} />
      {isComputing && (
        <Html center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(10, 14, 22, 0.62)',
              color: 'rgba(241, 245, 249, 0.92)',
              fontSize: 13,
              letterSpacing: 0.2,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            Loading city…
          </div>
        </Html>
      )}
      {!isComputing && (
        <>
          <CityXZPick entities={entities} positions={positions} active />
          <SubSectorTints startups={entities} positions={positions} />
          <GlowBase startups={entities} positions={positions} />
          <Buildings startups={entities} positions={positions} />
          <Spires startups={entities} positions={positions} />
          <OutcomeMarkers startups={entities} positions={positions} />
          <ExitOutcomeSparkles startups={entities} positions={positions} />
          <SelectionRing startup={selectedStartup} positions={positions} />
          <InvestorLines startups={entities} positions={positions} />
          <NewsFireworks startups={entities} positions={positions} />
        </>
      )}
    </group>
  );
}
