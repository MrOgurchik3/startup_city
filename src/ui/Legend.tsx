import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { REGION_IDS } from '../data/regions';
import { REGION_FLOW_ORIGIN_COLORS } from '../data/regionFlowColors';
import { STAGE_COLORS } from '../data/stages';

function Swatch({ hex, title }: { hex: string; title?: string }) {
  return (
    <span
      className="legend-swatch"
      style={{ backgroundColor: hex }}
      title={title ?? hex}
      aria-hidden
    />
  );
}

function EncodingRow({ channel, kpi }: { channel: string; kpi: string }) {
  return (
    <div className="legend-enc-row">
      <span className="legend-enc-channel">{channel}</span>
      <span className="legend-enc-kpi">{kpi}</span>
    </div>
  );
}

export function Legend() {
  const mode = useAppStore((s) => s.mode);
  const [open, setOpen] = useState(true);

  if (mode === 'global') {
    return (
      <div className="legend">
        <h5>Global</h5>
        <div className="legend-enc">
          <EncodingRow channel="Region fill" kpi="Capital deployed" />
          <EncodingRow channel="Region height" kpi="Deal flow" />
          <EncodingRow channel="Arc thickness" kpi="Capital" />
          <EncodingRow channel="Arc speed" kpi="Deals" />
          <EncodingRow channel="Arc glow" kpi="Round size" />
        </div>
        <div className="legend-arc-grid">
          {REGION_IDS.map((id) => (
            <div key={id} className="legend-arc-row">
              <Swatch hex={REGION_FLOW_ORIGIN_COLORS[id]} />
              <span>{id}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="legend legend--city">
      <button
        type="button"
        className="legend-collapse-head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h5>City</h5>
        <span className="legend-chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="legend-body">
          <div className="legend-enc">
            <EncodingRow channel="Building shape" kpi="Vertical / entity type" />
            <EncodingRow channel="Building height" kpi="Total raised · Avg cheque (inv)" />
            <EncodingRow channel="Building width" kpi="ARR · Deals LTM (inv)" />
            <EncodingRow channel="Lot ring" kpi="Stage" />
            <EncodingRow channel="Roof spire" kpi="Val ÷ raised · Unicorn rate (inv)" />
            <EncodingRow channel="Roof lamp" kpi="Visitors × ARR" />
            <EncodingRow channel="News bubble" kpi="Last-7d event" />
          </div>
          <div className="legend-stage-row">
            <Swatch hex={STAGE_COLORS.pre} title="Pre-Seed / Seed" /> pre
            <Swatch hex={STAGE_COLORS.growth} title="Series A" /> A
            <Swatch hex={STAGE_COLORS.scale} title="Series B / Bridge" /> B
            <Swatch hex={STAGE_COLORS.late} title="Series C+" /> C+
          </div>
        </div>
      )}
    </div>
  );
}
