# City building GLBs

The city loader (`src/scene/city/glbBuildingLoader.ts`) looks for one GLB per
archetype in this directory. Drop files in by exact filename — the loader
auto-picks them up at next page load. Until a file is present, the procedural
fallback in `cityArchetypes.ts` is used.

## Filenames

| File | Vertical / role |
|---|---|
| `fintech.glb` | FinTech (sleek glass tower) |
| `healthtech.glb` | HealthTech (campus / cross / medical) |
| `deeptech.glb` | DeepTech (lab / reactor / dome) |
| `cleantech.glb` | CleanTech (slab + solar / wind) |
| `ai.glb` | AI (obelisk / needle / monolith) |
| `saas.glb` | SaaS (modular block tower) |
| `consumer.glb` | Consumer (retail / marquee / signage) |
| `logistics.glb` | Logistics (warehouse / containers) |
| `education.glb` | Education (colonnade / classical) |
| `proptech.glb` | PropTech (mixed-use podium + tower) |
| `fallback.glb` | Generic block (used when vertical is unknown) |
| `investor-vc.glb` | VC entity (HQ tower) |
| `investor-angel.glb` | Angel entity (slim tower) |
| `investor-other.glb` | Other / family office entity (column) |

## Sizing — don't worry about scale

The loader normalizes every GLB on import:

- recenters footprint at `(0, 0)` in X/Z,
- moves base to `y = 0`,
- scales so the largest XZ extent fits within `[-0.5, 0.5]` and the height becomes `1.0`.

The per-instance scale matrix in `Buildings.tsx` then multiplies by the startup's `(width, height, width)` from the KPI encoding. **Author at any size.**

A GLB with multiple sub-meshes is fine — they're all baked into one merged geometry. UVs are re-projected cylindrically so the building shader's window grid still draws sensibly on whatever silhouette you provide.

## Recommended CC0 packs

Browse, pick one building per vertical, export each as an individual GLB, drop in here.

- **Kenney — City Kit (Commercial)** — `https://kenney.nl/assets/city-kit-commercial` — 18 stylized commercial buildings, low-poly, CC0. Best fit for FinTech / Consumer / SaaS / Education / PropTech.
- **Kenney — City Kit (Suburban)** — `https://kenney.nl/assets/city-kit-suburban` — houses, garages. Useful for the `fallback`.
- **Quaternius — Ultimate Modular Buildings** — `https://quaternius.com/packs/ultimatemodularbuildings.html` — 50+ pieces, CC0. Strong for HealthTech / Logistics / Education.
- **KayKit — City Builder Bits** — `https://kaylousberg.itch.io/kaykit-citybuilder-bits` — name-your-price (free), CC0. Includes industrial / sci-fi pieces good for DeepTech / AI / CleanTech.
- **Poly.pizza** — `https://poly.pizza` — searchable archive of CC0 GLBs (formerly Google Poly). Direct GLB download per model. Useful for one-off finds (reactor, solar farm, server racks).

## Workflow tip

If you grab a multi-building Blender file from a pack, the simplest pipeline is:

1. Open in Blender.
2. Select one building, `File → Export → glTF 2.0`, choose `.glb`, set "Selection Only".
3. Save here with the right name.

Re-exports overwrite cleanly — no code change needed.
