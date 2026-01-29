import { apiRequest } from './http';

export type ServiceStatus = {
  ok: boolean;
  latency_ms: number | null;
  error?: string | null;
};

export type ServiceStatusResponse = {
  ok: boolean;
  timestamp: string;
  services: {
    smtp: ServiceStatus;
    s3: ServiceStatus;
  };
};

export function getServiceStatus() {
  return apiRequest<ServiceStatusResponse>('/admin/status/services', { method: 'GET' });
}

export type ServiceHistoryEntry = {
  ok: boolean;
  checked_at: string;
  services: {
    smtp: ServiceStatus;
    s3: ServiceStatus;
  };
};

export type ServiceStatusHistoryResponse = {
  ok: boolean;
  count: number;
  history: ServiceHistoryEntry[];
};

export function getServiceStatusHistory(limit = 20) {
  const query = new URLSearchParams({ limit: String(limit) });
  return apiRequest<ServiceStatusHistoryResponse>(`/admin/status/services/history?${query.toString()}`, {
    method: 'GET'
  });
}
