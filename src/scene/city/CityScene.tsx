import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useFilteredDataset } from '../../lib/useFilteredDataset';
import { cityBuildingWidth } from '../../lib/encoding';
import type { Startup } from '../../types';
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

export function CityScene() {
  const region = useAppStore((s) => s.region);
  const selection = useAppStore((s) => s.selection);
  const { filtered } = useFilteredDataset();

  const startups = useMemo(
    () => filtered.filter((s) => s.region === region),
    [filtered, region]
  );

  const layout = useMemo(() => {
    const map = new Map<string, [number, number]>();
    const n = startups.length;
    if (n === 0) {
      return {
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
    const sorted = [...startups].sort((a, b) => a.id.localeCompare(b.id));
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
        const bucket = (byVertical.get(key) ?? []).sort((a, b) => a.id.localeCompare(b.id));
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
      const invList = [...investorsEnt].sort((a, b) => a.id.localeCompare(b.id));
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

    const meta = computeMetaLayout(slots, pitch);
    const { metaCols, metaRows, metaCellW, metaCellD, roadW } = meta;

    slots.forEach((strip, i) => {
      const gc = i % metaCols;
      const gr = Math.floor(i / metaCols);
      strip.cx = (gc - (metaCols - 1) / 2) * metaCellW;
      strip.cz = (gr - (metaRows - 1) / 2) * metaCellD;
      strip.startups.forEach((s, j) => {
        const lc = j % strip.colsW;
        const lr = Math.floor(j / strip.colsW);
        const xLocal = (lc - (strip.colsW - 1) / 2) * pitch;
        const zLocal = (lr - (strip.rowsW - 1) / 2) * pitch;
        place(s, strip.cx + xLocal, strip.cz + zLocal);
      });
    });

    const west = (-metaCols * metaCellW) / 2 - roadW * 0.65 - pitch * 0.35;
    const east = (metaCols * metaCellW) / 2 + roadW * 0.65 + pitch * 0.35;
    const minX = west;
    const maxX = east;
    const span = Math.max(Math.abs(minX), Math.abs(maxX), pitch * 2);
    const gridExtent = span * 2 * 1.12;

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

    const metaGrid: MetaGridSpec = { ...meta, roadW };

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
      positions: map,
      gridExtent,
      subGrids,
      streetBlocks,
      blockLabels,
      districtAccents,
      metaGrid,
      hasDistricts: true,
    };
  }, [startups]);

  const {
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
    if (selection?.kind !== 'startup') return null;
    return startups.find((s) => s.id === selection.id) ?? null;
  }, [selection, startups]);

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
      <GlowBase startups={startups} positions={positions} />
      <Buildings startups={startups} positions={positions} />
      <Spires startups={startups} positions={positions} />
      <OutcomeMarkers startups={startups} positions={positions} />
      <ExitOutcomeSparkles startups={startups} positions={positions} />
      <SelectionRing startup={selectedStartup} positions={positions} />
      <NewsFireworks startups={startups} positions={positions} />
    </group>
  );
}
