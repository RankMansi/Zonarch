const DOF_SALES_BASE = 'https://data.cityofnewyork.us/resource/w2pb-icbu.json';

export async function fetchNeighborhoodComps(borough: string, neighborhood: string) {
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const dateFilter = eighteenMonthsAgo.toISOString().split('T')[0];

  const url = `${DOF_SALES_BASE}?` + new URLSearchParams({
    $where: `borough='${borough}' AND sale_date>='${dateFilter}' AND sale_price>100000`,
    $order: 'sale_date DESC',
    $limit: '25',
  });

  const headers: HeadersInit = { Accept: 'application/json' };
  if (process.env.NYCOPENDATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.NYCOPENDATA_APP_TOKEN;
  }
  const response = await fetch(url, { headers });
  return response.json();
}

export function calcCompStats(comps: Array<{ sale_price: string; gross_square_feet: string }>) {
  const valid = comps.filter(c => parseFloat(c.gross_square_feet) > 0 && parseFloat(c.sale_price) > 0);
  if (!valid.length) return { avgPSF: 850, medianPSF: 850, count: 0 };
  const psfs = valid.map(c => parseFloat(c.sale_price) / parseFloat(c.gross_square_feet)).sort((a, b) => a - b);
  return {
    avgPSF: psfs.reduce((a, b) => a + b, 0) / psfs.length,
    medianPSF: psfs[Math.floor(psfs.length / 2)],
    count: valid.length,
  };
}
