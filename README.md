# Venture Intelligence Map

A dual-view 3D venture map. **City View** renders each startup in a region as a data-encoded building; **Global View** shows capital concentration and cross-border investment flows between countries.

Built with **Vite + React 19 + react-three-fiber + drei + postprocessing**, with seeded fake data across 7 regions: **UK, US, Germany, France, Nordics, Western Europe, India** (~8.2k startups total).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
npm run preview  # serve the production bundle
npm run lint
```

**3D view:** left-drag orbit, right-drag pan, scroll zoom (middle mouse dollies where supported).

## Two modes

Switch between them in the top bar.

### Global View (default)

A flat 2.5D world map. The 7 data-rich regions are highlighted; the rest of the world renders as light grey polygons (world-atlas TopoJSON, lazy-loaded).

| Channel | KPI |
| --- | --- |
| Region colour (choropleth) | Total capital deployed (LTM) |
| Region extrusion height | Deal flow volume |
| Animated arc thickness | Cross-border capital £ |
| Animated arc speed | Deal frequency |
| Animated arc glow | Avg round size |

- **Hover** a region → tooltip with capital, deals, startups, investors.
- **Click** a region → right panel switches to region detail (top inbound / outbound flows, drill-into-City button).
- **Double-click** a region → drill straight into City View.

### City View

A skyline of one region. Each building = one startup, positioned at its HQ lat/lng (with a coarse grid snap to prevent overlap), encoded along the visual hierarchy below — the encoding is locked: one channel ↔ one KPI.

| Channel | KPI |
| --- | --- |
| Building height | Total raised (£) |
| Footprint width | ARR (£) |
| Base ring colour | Stage (red Pre-Seed/Seed, amber A/B, green C+, purple selected) |
| Window density / brightness | Monthly website visitors |
| Spire | Valuation / Raised multiple |
| Body shape | Entity type (Startup / VC / Angel / Other) |
| News bubble (top of building) | Last-7-day event (green fundraise, purple product, blue partnership, grey other) |

- **Hover** a building → tooltip with name, stage, raised, ARR.
- **Click** a building → right panel switches to detail (raised, valuation, ARR, val/raised multiple, time to last round, top investors, founders, latest news).
- **ESC** or click empty space → deselect.

## Right-side dashboard

The right panel is **slicers by default**, **detail when something is clicked** (slicers hide until you press Esc / × / click empty space). Slicers operate on the entire dataset — they reshape both views simultaneously.

15 slicers:

- **Round Stage** — Pre-Seed, Seed, Series A, Series B, Bridge, Series C+
- **Vertical** — FinTech, HealthTech, DeepTech, CleanTech, AI, SaaS, Consumer, Logistics, Education, PropTech
- **Sub-Sector** — vertical-dependent (e.g. FinTech → Payments, Lending, …)
- **Geography** — UK, US, Germany, France, Nordics, Western Europe, India
- **Time Period** — Month, Quarter, Year, LTM, YTD
- **Company Size** — 1-10, 11-50, 51-200, 201-500, 500+
- **Investor Type** — VC, Angel, PE, Accelerator, Government
- **Investor Name** — top 50 most-active investors
- **Outcome Status** — Active, Unicorn, Acquired, Flopped
- **Fundraising Status** — Likely Raising, Mid-Cycle, Recently Raised
- **Education Level** — BSc, MSc, MBA, PhD, No Degree, Other
- **Founder Background** — Engineering, Product, Science, Finance, Sales, Operations, Design
- **University** — top 30 universities
- **Repeat Founder** — Any / Yes / No
- **Prior Exit** — Any / Yes / No

A footer at the bottom shows `filtered / total` startups in view.

## Top-bar search

Free-text search across all startups (~8k) and all 7 regions, deduplicated by section. Picking a startup zooms to its City View and selects it; picking a region selects it inside Global View.

## Architecture

```
src/
  main.tsx, App.tsx, styles.css   Light-theme global styles
  types.ts                        Domain types: Startup, Round, NewsEvent, Founder, Investor, InvestmentEdge, FilterState, Mode, RegionId
  store/useAppStore.ts            zustand: mode, region, selection, hover, search, 15 filters
  data/
    regions.ts                    7 regions with bbox, simplified outline, HQ anchor cities, ISO3 codes
    sectors.ts                    Vertical -> sub-sector map
    stages.ts                     Stage list + light-theme palette
    investors.ts                  Top 50 investors + types + home country
    universities.ts               Top 30 universities
    isoNumericToAlpha3.ts         UN M49 -> ISO3 lookup for the 7 regions
    worldAtlas.ts                 Lazy import of world-atlas TopoJSON, enriched with region tags
    generateFakeData.ts           Seeded RNG -> ~8.2k startups across 7 regions, with rounds, founders, events
    aggregates.ts                 Filter-aware per-region aggregates + cross-border investment edges
    regionFlowColors.ts             Arc origin palette (shared with Legend + FlowArcs)
  lib/
    rng.ts                        seedrandom + log-normal/gaussian/weighted helpers
    projection.ts                 lat/lng -> world(x,z): equirectangular for Global, region-bbox for City
    encoding.ts                   KPI -> visual size/colour (single source of truth)
    filters.ts                    Apply 15-slicer filters + time-period window
    useFilteredDataset.ts         Memoised hook returning filtered startups, aggregates, top edges
  scene/
    Scene.tsx                     <Canvas>, light-theme background, soft lights, subtle Bloom, OrbitControls + camera rig
    city/
      CityScene.tsx, CityGround.tsx
      Buildings.tsx               1 InstancedMesh per shape group (Startup/VC/Angel/Other)
      buildingShader.ts           GLSL window grid (dark dots on light facade, density+intensity per instance)
      Spires.tsx, GlowBase.tsx, SelectionRing.tsx, NewsFireworks.tsx, OutcomeMarkers.tsx, ExitOutcomeSparkles.tsx
    global/
      GlobalScene.tsx
      WorldBasemap.tsx            Grey polygons for non-data countries
      RegionPolys.tsx             Choropleth + extrusion for the 7 regions (click + hover)
      FlowArcs.tsx                GPU-shader animated arcs between regions
      geoUtils.ts                 GeoJSON -> THREE.Shape / ExtrudeGeometry helpers
  ui/
    Topbar.tsx                    Mode switch + global search dropdown
    SidePanel.tsx                 Right panel container (slicers vs detail)
    SlicerControls.tsx            All 15 slicer widgets + reset
    DetailPanel.tsx               Building detail / region detail
    HoverTooltip.tsx              Mouse-following tooltip
    Legend.tsx                    Bottom-left encoding legend (mode-aware)
```

## Performance

- All buildings render via 4 `THREE.InstancedMesh` calls regardless of region size.
- Custom GLSL shader draws windows with a per-instance density/intensity attribute; no per-frame work.
- Flow arcs each have their own shader material with a single `uTime` uniform; ~24 arcs typical.
- World-atlas TopoJSON is `import()`-lazy-loaded into a separate ~108 KB chunk and only fetched on first Global View mount.
- Filter pipeline is memoised on the slicer state, not on every render.
- Light-theme bloom kept at intensity `0.18` so the encoding stays the dominant signal.

## Tuning the visuals

All KPI -> visual mapping lives in **[`src/lib/encoding.ts`](src/lib/encoding.ts)** — d3-scale domains/ranges in one place. The light-theme palette lives in [`src/data/stages.ts`](src/data/stages.ts) and [`src/styles.css`](src/styles.css).

Fake-data distributions (stage weights, raised log-normal, ARR multiplier, event probability) are in [`src/data/generateFakeData.ts`](src/data/generateFakeData.ts).

## Non-negotiables

- One visual element ↔ one KPI (no reuse).
- Stage **only** via base ring colour.
- News = signal only (last 7 days, capped at 60 visible, priority fundraise > exit > product > partnership).
- Right panel is either slicers OR detail — never both.
- No time slider (the Time Period slicer replaces it).
