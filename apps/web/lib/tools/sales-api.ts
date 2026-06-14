import type { SalesComp } from '@/types/zone-draft';

const DOF_SALES_BASE = 'https://data.cityofnewyork.us/resource/w2pb-icbu.json';

function salesHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'User-Agent': 'Zone-Draft/1.0 (NYC underwriting hackathon)',
  };
  const token = process.env.NYCOPENDATA_APP_TOKEN?.trim();
  const tokenLooksValid =
    token &&
    token.length > 12 &&
    !token.includes('register_free') &&
    !token.includes('your_');
  if (tokenLooksValid) headers['X-App-Token'] = token;
  return headers;
}

export async function fetchNeighborhoodComps(
  borough: string,
  neighborhood: string,
  _buildingClassCategory = '01 ONE FAMILY DWELLINGS'
): Promise<SalesComp[]> {
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const dateFilter = eighteenMonthsAgo.toISOString().split('T')[0];

  const whereClause = neighborhood
    ? `borough='${borough}' AND neighborhood='${neighborhood.toUpperCase()}' AND sale_date>='${dateFilter}' AND sale_price>100000`
    : `borough='${borough}' AND sale_date>='${dateFilter}' AND sale_price>100000`;

  const url =
    `${DOF_SALES_BASE}?` +
    new URLSearchParams({
      $where: whereClause,
      $order: 'sale_date DESC',
      $limit: '25',
      $select:
        'address,sale_price,gross_square_feet,sale_date,building_class_category,neighborhood',
    });

  const response = await fetch(url, { headers: salesHeaders() });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function calcCompStats(comps: SalesComp[]): {
  avgPSF: number;
  medianPSF: number;
  count: number;
} {
  const validComps = comps.filter(
    (c) => parseFloat(c.gross_square_feet) > 0 && parseFloat(c.sale_price) > 0
  );
  if (validComps.length === 0) {
    return { avgPSF: 850, medianPSF: 850, count: 0 };
  }
  const psfs = validComps.map(
    (c) => parseFloat(c.sale_price) / parseFloat(c.gross_square_feet)
  );
  psfs.sort((a, b) => a - b);
  return {
    avgPSF: psfs.reduce((a, b) => a + b, 0) / psfs.length,
    medianPSF: psfs[Math.floor(psfs.length / 2)],
    count: validComps.length,
  };
}
