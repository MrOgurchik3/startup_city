import { useState, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { REGION_IDS } from '../data/regions';
import { REGION_FLOW_ORIGIN_COLORS } from '../data/regionFlowColors';
import { CITY_PALETTE } from '../theme/cityPalette';
import { STAGE_COLORS } from '../data/stages';

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="legend-swatch"
      style={{ backgroundColor: hex }}
      title={hex}
      aria-hidden
    />
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row">
      <span className="legend-k">{label}</span>
      <span className="legend-v">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legend-section">
      <h6 className="legend-section-title">{title}</h6>
      {children}
    </section>
  );
}

export function Legend() {
  const mode = useAppStore((s) => s.mode);
  const [cityOpen, setCityOpen] = useState(true);

  if (mode === 'global') {
    return (
      <div className="legend">
        <h5>Global</h5>
        <Row label="Fill" value="capital (slice)" />
        <Row label="Height" value="deal flow" />
        <Row label="Arc" value="origin colour" />
        <div className="legend-arc-grid">
          {REGION_IDS.map((id) => (
            <div key={id} className="legend-arc-row">
              <Swatch hex={REGION_FLOW_ORIGIN_COLORS[id]} />
              <span>{id}</span>
            </div>
          ))}
        </div>
        <Row label="Thick" value="capital" />
        <Row label="Speed" value="deals" />
        <Row label="Glow" value="round size" />
        <Row label="Floor" value="single ocean plane · grey land (raised)" />
        <Row label="Horizon" value="fog matches sky · soft vignette" />
        <Row label="View" value="north default" />
      </div>
    );
  }

  return (
    <div className="legend legend--city">
      <button
        type="button"
        className="legend-collapse-head"
        onClick={() => setCityOpen(!cityOpen)}
        aria-expanded={cityOpen}
      >
        <h5>Startup City</h5>
        <span className="legend-chev">{cityOpen ? '−' : '+'}</span>
      </button>
      {cityOpen && (
        <div className="legend-body">
          <Section title="Colours (startups)">
            <Row
              label="Tower body"
              value={
                <span className="legend-inline">
                  <Swatch hex={CITY_PALETTE.activeNav} /> blue (Active/Unicorn) ·{' '}
                  <Swatch hex={CITY_PALETTE.startupFlopped} /> black (Flopped) · IPO/M&A = teal/purple tint on blue
                </span>
              }
            />
            <Row
              label="Lot glow = stage"
              value={
                <span className="legend-inline">
                  <Swatch hex={STAGE_COLORS.pre} /> pre · <Swatch hex={STAGE_COLORS.growth} /> A ·{' '}
                  <Swatch hex={STAGE_COLORS.scale} /> B/bridge · <Swatch hex={STAGE_COLORS.late} /> C+
                </span>
              }
            />
            <Row
              label="Unicorn"
              value={
                <span className="legend-inline">
                  large animated rainbow spire on roof (Bloom makes it pop)
                </span>
              }
            />
          </Section>

          <Section title="Colours (investors by type)">
            <Row
              label="Tower body"
              value={
                <span className="legend-inline">
                  <Swatch hex={CITY_PALETTE.investorVc} /> VC ·{' '}
                  <Swatch hex={CITY_PALETTE.investorAngel} /> angel ·{' '}
                  <Swatch hex={CITY_PALETTE.investorOther} /> other
                </span>
              }
            />
            <Row
              label="Lot glow"
              value={
                <span className="legend-inline">
                  VC <Swatch hex={CITY_PALETTE.tealBright} /> · angel <Swatch hex={CITY_PALETTE.amber} /> · other{' '}
                  <Swatch hex={CITY_PALETTE.purpleMain} />
                </span>
              }
            />
          </Section>

          <Section title="Tower encoding">
            <p className="legend-encode-intro">
              Each line names a part of the tower and the number it encodes.
            </p>
            <h6 className="legend-encode-h">Startups</h6>
            <dl className="legend-dl">
              <dt>Tower height</dt>
              <dd>Total raised</dd>
              <dt>Footprint</dt>
              <dd>ARR</dd>
              <dt>Windows</dt>
              <dd>Traffic vs ARR</dd>
              <dt>Roof spire</dt>
              <dd>Valuation ÷ raised</dd>
            </dl>
            <h6 className="legend-encode-h">Investors</h6>
            <dl className="legend-dl">
              <dt>Tower height</dt>
              <dd>Avg portfolio cheque</dd>
              <dt>Footprint</dt>
              <dd>Deals (LTM)</dd>
              <dt>Windows</dt>
              <dd>Co-invest frequency</dd>
              <dt>Roof spire</dt>
              <dd>Portfolio unicorn rate</dd>
            </dl>
            <p className="legend-encode-foot">
              District labels sit beyond the grid edge. Tap a building for detail, news, and exits.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
