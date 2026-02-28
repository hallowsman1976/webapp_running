// src/api.ts
// HTTP client wrapper → GAS Web App

import { CONFIG } from './config';
import { Store } from './store';
import type { ApiResponse, RegisterFormData } from './types';

// ─────────────────────────────────────────────────────────────
// Base fetch
// ─────────────────────────────────────────────────────────────

async function gasRequest<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
  requireAuth: 'line' | 'admin' | 'none' = 'none'
): Promise<ApiResponse<T>> {

  const url = new URL(CONFIG.GAS_WEBAPP_URL);
  url.searchParams.set('path', path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  let payload: Record<string, unknown> = body ? { ...body } : {};

  // Inject auth
  if (requireAuth === 'line') {
    const token = Store.getState().lineToken;
    if (!token) throw new Error('No LINE token');
    payload._lineToken = token;
  } else if (requireAuth === 'admin') {
    const session = Store.getAdminSession();
    if (!session) throw new Error('No admin session');
    payload._userId     = session.userId;
    payload._adminToken = session.adminToken;
  }

  const options: RequestInit = {
    method,
    headers,
    redirect: 'follow'
  };

  if (method === 'POST') {
    options.body = JSON.stringify(payload);
  } else if (Object.keys(payload).length > 0) {
    // GET: append params
    Object.entries(payload).forEach(([k, v]) => {
      url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), options);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json() as ApiResponse<T>;
  return json;
}

// ─────────────────────────────────────────────────────────────
// API methods
// ─────────────────────────────────────────────────────────────

export const Api = {

  // ── User ────────────────────────────────────────────────────
  async syncProfile(profile: {
    displayName: string;
    pictureUrl: string;
    email?: string;
  }) {
    return gasRequest('users/sync', 'POST', profile, 'line');
  },

  // ── PDPA ────────────────────────────────────────────────────
  async getPdpaStatus(userId: string) {
    return gasRequest(`users/${userId}/pdpa`, 'GET', {}, 'line');
  },

  async recordConsent(action: 'accepted' | 'declined', consentVersion: string) {
    return gasRequest('pdpa/consent', 'POST', {
      action,
      consentVersion,
      userAgent: navigator.userAgent
    }, 'line');
  },

  // ── Events ──────────────────────────────────────────────────
  async listEvents() {
    return gasRequest<import('./types').Event[]>('events', 'GET');
  },

  async getEvent(eventId: string) {
    return gasRequest<{
      event: import('./types').Event;
      distances: import('./types').EventDistance[];
    }>(`events/${eventId}`, 'GET');
  },

  // ── Registrations ───────────────────────────────────────────
  async register(data: RegisterFormData) {
    return gasRequest('registrations', 'POST', data as unknown as Record<string, unknown>, 'line');
  },

  async getRegistration(registrationId: string) {
    return gasRequest(`registrations/${registrationId}`, 'GET', {}, 'line');
  },

  async getMyRegistrations(userId: string) {
    return gasRequest(`users/${userId}/registrations`, 'GET', {}, 'line');
  },

  // ── Check-in ────────────────────────────────────────────────
  async selfCheckin(qrPayload: string) {
    return gasRequest('checkins', 'POST', { qrPayload }, 'line');
  },

  async getCheckinStats(eventId: string) {
    return gasRequest(`checkins/${eventId}/stats`, 'GET',
      { _userId: Store.getAdminSession()?.userId }, 'admin');
  },

  // ── Admin ───────────────────────────────────────────────────
  async getDashboard(eventId: string) {
    return gasRequest<import('./types').DashboardStats>(
      'admin/dashboard', 'GET', { eventId }, 'admin');
  },

  async listAdminRegistrations(params: {
    eventId?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    distanceId?: string;
  }) {
    return gasRequest('admin/registrations', 'GET',
      params as Record<string, unknown>, 'admin');
  },

  async approveRegistration(registrationId: string) {
    return gasRequest('admin/registrations/approve', 'POST',
      { registrationId }, 'admin');
  },

  async bulkApprove(registrationIds: string[]) {
    return gasRequest('admin/registrations/bulk-approve', 'POST',
      { registrationIds }, 'admin');
  },

  async staffCheckin(registrationId: string, checkpointId?: string) {
    return gasRequest('admin/checkin', 'POST',
      { registrationId, checkpointId }, 'admin');
  },

  async listAdminEvents() {
    return gasRequest('events', 'GET', {}, 'none');
  },

  async createEvent(data: Record<string, unknown>) {
    return gasRequest('events', 'POST', data, 'admin');
  },

  async updateEvent(eventId: string, data: Record<string, unknown>) {
    return gasRequest(`events/${eventId}/update`, 'POST', data, 'admin');
  },

  async deleteEvent(eventId: string) {
    return gasRequest(`events/${eventId}/delete`, 'POST', {}, 'admin');
  },

  async upsertDistance(data: Record<string, unknown>) {
    return gasRequest('events/distances', 'POST', data, 'admin');
  },

  async listQrCheckpoints(eventId: string) {
    return gasRequest(`qr-checkpoints/${eventId}`, 'GET', {}, 'admin');
  },

  async createQrCheckpoint(data: { eventId: string; checkpointName: string; allowMultiCheckin: boolean }) {
    return gasRequest('qr-checkpoints', 'POST', data as unknown as Record<string, unknown>, 'admin');
  },

  async deleteQrCheckpoint(checkpointId: string) {
    return gasRequest(`qr-checkpoints/${checkpointId}/delete`, 'POST', {}, 'admin');
  },

  async listAdminUsers(params: { page?: number; search?: string }) {
    return gasRequest('admin/users', 'GET', params as Record<string, unknown>, 'admin');
  }
};
