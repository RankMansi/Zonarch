import { normalizeBoroughCode } from './geocoder';

const PLUTO_SODA_BASE = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

export async function queryPLUTOByBBL(bbl: string) {
  const url = `${PLUTO_SODA_BASE}?bbl=${bbl}&$limit=1`;
  const headers: HeadersInit = { Accept: 'application/json' };
  if (process.env.NYCOPENDATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.NYCOPENDATA_APP_TOKEN;
  }
  const response = await fetch(url, { headers });
  const data = await response.json();
  return data[0];
}

export async function queryPLUTOByAddress(address: string, borough: string) {
  const cleanBorough = normalizeBoroughCode(borough);
  const url = `${PLUTO_SODA_BASE}?$where=address='${encodeURIComponent(address.toUpperCase())}'&borough='${cleanBorough}'&$limit=1`;
  const headers: HeadersInit = { Accept: 'application/json' };
  if (process.env.NYCOPENDATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.NYCOPENDATA_APP_TOKEN;
  }
  const response = await fetch(url, { headers });
  const data = await response.json();
  return data[0];
}
