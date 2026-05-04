// world-atlas TopoJSON identifies countries by ISO 3166-1 numeric (UN M49) codes.
// We only need ISO3 codes for the countries that map to one of our 7 regions —
// any other entry stays null and is rendered as a grey basemap polygon.
// Source: ISO 3166-1.
export const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  // United Kingdom
  '826': 'GBR',
  // United States
  '840': 'USA',
  // Germany
  '276': 'DEU',
  // France
  '250': 'FRA',
  // Nordics
  '752': 'SWE',
  '578': 'NOR',
  '208': 'DNK',
  '246': 'FIN',
  '352': 'ISL',
  // Western Europe (NL, BE, LUX, CH, AT, IE, PT, ES, IT)
  '528': 'NLD',
  '056': 'BEL',
  '442': 'LUX',
  '756': 'CHE',
  '040': 'AUT',
  '372': 'IRL',
  '620': 'PRT',
  '724': 'ESP',
  '380': 'ITA',
  // India
  '356': 'IND',
};
