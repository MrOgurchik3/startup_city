// Vertical -> Sub-sectors map. Sub-sectors are vertical-dependent.
export const VERTICALS: Record<string, string[]> = {
  FinTech: ['Payments', 'Lending', 'Wealth', 'Insurance', 'Banking', 'Crypto'],
  HealthTech: ['Diagnostics', 'Telehealth', 'BioPharma', 'Devices', 'Mental Health'],
  DeepTech: ['Robotics', 'Materials', 'Quantum', 'Semiconductors', 'Space'],
  CleanTech: ['Energy', 'Mobility', 'Carbon', 'Storage', 'Agriculture'],
  AI: ['Foundation', 'Tooling', 'Vertical AI', 'Agents', 'Data'],
  SaaS: ['HR', 'Sales', 'Marketing', 'Analytics', 'DevOps', 'Security'],
  Consumer: ['Marketplaces', 'Social', 'Gaming', 'Creator', 'Subscription'],
  Logistics: ['Last Mile', 'Freight', 'Supply Chain', 'Warehouse'],
  Education: ['K-12', 'Higher Ed', 'Workforce', 'Skills'],
  PropTech: ['Residential', 'Commercial', 'Construction', 'Smart Buildings'],
};

export const VERTICAL_LIST: string[] = Object.keys(VERTICALS);

export const VERTICAL_WEIGHTS: Record<string, number> = {
  SaaS: 0.18,
  AI: 0.16,
  FinTech: 0.14,
  HealthTech: 0.11,
  Consumer: 0.1,
  CleanTech: 0.08,
  DeepTech: 0.07,
  Logistics: 0.06,
  PropTech: 0.05,
  Education: 0.05,
};

export const VERTICAL_GLYPH: Record<string, string> = {
  FinTech: '£',
  HealthTech: '+',
  DeepTech: '◇',
  CleanTech: '✿',
  AI: '∆',
  SaaS: '☷',
  Consumer: '★',
  Logistics: '⇆',
  Education: 'A',
  PropTech: '⌂',
};

export function subSectorsOf(vertical: string): string[] {
  return VERTICALS[vertical] ?? [];
}
