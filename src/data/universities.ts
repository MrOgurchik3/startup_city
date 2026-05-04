import type { RegionId } from '../types';

interface University {
  name: string;
  region: RegionId;
  prestige: number; // 0-1, biases founder distribution
}

export const UNIVERSITIES: University[] = [
  // US
  { name: 'Stanford University', region: 'US', prestige: 1.0 },
  { name: 'MIT', region: 'US', prestige: 0.99 },
  { name: 'Harvard University', region: 'US', prestige: 0.97 },
  { name: 'UC Berkeley', region: 'US', prestige: 0.93 },
  { name: 'Princeton University', region: 'US', prestige: 0.9 },
  { name: 'Carnegie Mellon University', region: 'US', prestige: 0.88 },
  { name: 'Yale University', region: 'US', prestige: 0.86 },
  { name: 'Columbia University', region: 'US', prestige: 0.84 },
  { name: 'Caltech', region: 'US', prestige: 0.92 },
  { name: 'University of Pennsylvania', region: 'US', prestige: 0.82 },
  // UK
  { name: 'University of Oxford', region: 'UK', prestige: 0.97 },
  { name: 'University of Cambridge', region: 'UK', prestige: 0.97 },
  { name: 'Imperial College London', region: 'UK', prestige: 0.92 },
  { name: 'UCL', region: 'UK', prestige: 0.86 },
  { name: 'LSE', region: 'UK', prestige: 0.86 },
  { name: 'University of Edinburgh', region: 'UK', prestige: 0.78 },
  // DE
  { name: 'TU Munich', region: 'DE', prestige: 0.86 },
  { name: 'LMU Munich', region: 'DE', prestige: 0.82 },
  { name: 'RWTH Aachen', region: 'DE', prestige: 0.82 },
  // FR
  { name: 'École Polytechnique', region: 'FR', prestige: 0.92 },
  { name: 'HEC Paris', region: 'FR', prestige: 0.86 },
  { name: 'INSEAD', region: 'FR', prestige: 0.88 },
  // Nordics
  { name: 'KTH Royal Institute', region: 'NORDICS', prestige: 0.84 },
  { name: 'Aalto University', region: 'NORDICS', prestige: 0.78 },
  { name: 'University of Copenhagen', region: 'NORDICS', prestige: 0.78 },
  // WE
  { name: 'ETH Zürich', region: 'WE', prestige: 0.95 },
  { name: 'EPFL', region: 'WE', prestige: 0.88 },
  { name: 'TU Delft', region: 'WE', prestige: 0.84 },
  { name: 'Trinity College Dublin', region: 'WE', prestige: 0.78 },
  // IN
  { name: 'IIT Bombay', region: 'IN', prestige: 0.92 },
  { name: 'IIT Delhi', region: 'IN', prestige: 0.9 },
  { name: 'IIM Ahmedabad', region: 'IN', prestige: 0.86 },
  { name: 'IISc Bangalore', region: 'IN', prestige: 0.86 },
  // 'Other' bucket option for the slicer
  { name: 'Other', region: 'US', prestige: 0.4 },
];

export const UNIVERSITY_NAMES = UNIVERSITIES.map((u) => u.name);

export function universitiesForRegion(region: RegionId): University[] {
  return UNIVERSITIES.filter((u) => u.region === region);
}
