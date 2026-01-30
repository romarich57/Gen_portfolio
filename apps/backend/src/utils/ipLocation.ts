import geoip from 'geoip-lite';

function normalizeIp(value: string): string {
  if (value.startsWith('::ffff:')) {
    return value.replace('::ffff:', '');
  }
  return value;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

export type IpLocation = {
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
};

export function getIpLocation(ip?: string | null): IpLocation | null {
  if (!ip) return null;
  const normalized = normalizeIp(ip);
  if (isPrivateIp(normalized)) {
    return {
      label: 'Local',
      city: null,
      region: null,
      country: null,
      timezone: null
    };
  }

  const geo = geoip.lookup(normalized);
  if (!geo) {
    return {
      label: 'Inconnue',
      city: null,
      region: null,
      country: null,
      timezone: null
    };
  }

  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  const label = parts.length > 0 ? parts.join(', ') : geo.country ?? 'Inconnue';

  return {
    label,
    city: geo.city ?? null,
    region: geo.region ?? null,
    country: geo.country ?? null,
    timezone: geo.timezone ?? null
  };
}
