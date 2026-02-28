// src/types.ts
// TypeScript interfaces ทั้งหมด (สอดคล้องกับ GAS schema)

export interface LiffProfile {
  userId:      string;
  displayName: string;
  pictureUrl:  string;
  statusMessage?: string;
}

export interface User {
  userId:        string;
  displayName:   string;
  pictureUrl:    string;
  email:         string;
  pdpaConsented: boolean;
  pdpaVersion:   string;
  status:        'active' | 'banned';
  isNew:         boolean;
}

export interface PdpaStatus {
  consented:       boolean;
  currentVersion:  string;
  userVersion:     string | null;
  needReconsent:   boolean;
  pdpaText:        string;
}

export interface Event {
  eventId:              string;
  eventName:            string;
  eventDate:            string;
  eventLocation:        string;
  coverImageUrl:        string;
  description:          string;
  registrationOpenAt:   string;
  registrationCloseAt:  string;
  maxParticipants:      number;
  status:               'draft' | 'published' | 'closed' | 'cancelled';
  requireApproval:      boolean;
}

export interface EventDistance {
  distanceId:       string;
  eventId:          string;
  distanceName:     string;
  distanceKm:       number;
  quota:            number;
  price:            number;
  registeredCount:  number;
  status:           'active' | 'closed';
  sortOrder:        number;
}

export interface Registration {
  registrationId:   string;
  eventId:          string;
  distanceId:       string;
  userId:           string;
  bibNumber:        string;
  firstName:        string;
  lastName:         string;
  gender:           'M' | 'F' | 'Other';
  birthDate:        string;
  shirtSize:        'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  emergencyContact: string;
  emergencyPhone:   string;
  status:           'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedAt:       string;
  approvedBy:       string;
  paymentStatus:    'unpaid' | 'paid' | 'waived';
  checkinStatus:    'not_checked' | 'checked';
  checkinAt:        string;
  createdAt:        string;
  updatedAt:        string;
  // enriched
  event?:           Event;
  distance?:        EventDistance;
}

export interface CheckinRecord {
  checkinId:      string;
  registrationId: string;
  eventId:        string;
  userId:         string;
  bibNumber:      string;
  checkinAt:      string;
  checkinMethod:  'qr_self' | 'staff_manual' | 'staff_qr';
  checkpointId:   string;
}

export interface QrCheckpoint {
  checkpointId:     string;
  eventId:          string;
  checkpointName:   string;
  qrPayload:        string;
  qrImageUrl:       string;
  allowMultiCheckin: boolean;
  status:           'active' | 'inactive';
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success:    boolean;
  data?:      T;
  error?:     string;
  total?:     number;
  page?:      number;
  limit?:     number;
  totalPages?: number;
}

// Route names
export type RouteName =
  | 'loading'
  | 'consent'
  | 'events'
  | 'event-detail'
  | 'register'
  | 'bib-card'
  | 'my-registrations'
  | 'checkin'
  | 'admin-dashboard'
  | 'admin-events'
  | 'admin-registrations'
  | 'admin-checkin'
  | 'admin-qr-print'
  | 'error';

export interface RouteState {
  name:   RouteName;
  params: Record<string, string>;
}

// Form types
export interface RegisterFormData {
  eventId:          string;
  distanceId:       string;
  firstName:        string;
  lastName:         string;
  gender:           'M' | 'F' | 'Other';
  birthDate:        string;
  shirtSize:        'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  emergencyContact: string;
  emergencyPhone:   string;
}

export interface AdminSession {
  userId:     string;
  adminToken: string;
  role:       'superadmin' | 'admin' | 'staff';
  displayName: string;
}

export interface DashboardStats {
  event:   Event;
  summary: {
    totalRegistrations: number;
    pending:   number;
    approved:  number;
    checkedIn: number;
    absent:    number;
    checkinRate: number;
  };
  byDistance: Array<{
    distanceId:   string;
    distanceName: string;
    quota:        number;
    total:        number;
    approved:     number;
    pending:      number;
    checked:      number;
  }>;
  updatedAt: string;
}
