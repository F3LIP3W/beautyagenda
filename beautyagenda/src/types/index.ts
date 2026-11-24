export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface BusinessSettings {
  id: number;
  name: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  welcome_message: string | null;
  min_advance_minutes: number;
  max_advance_days: number;
  slot_interval_minutes: number;
  auto_confirm: boolean;
  timezone: string;
}

export interface WorkingHour {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface Professional {
  id: string;
  name: string;
  phone: string | null;
  specialties: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
}

export interface ProfessionalHour {
  professional_id: string;
  weekday: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface ProfessionalWithDetails extends Professional {
  service_ids: string[];
  hours: ProfessionalHour[];
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
}

export interface ServiceWithProfessionals extends Service {
  professional_ids: string[];
}

export interface ClientOverview {
  id: string;
  name: string;
  whatsapp: string;
  notes: string | null;
  created_at: string;
  total_appointments: number;
  completed_appointments: number;
  total_spent: number;
  last_visit: string | null;
  next_appointment: string | null;
}

export interface AppointmentDetail {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: 'online' | 'admin';
  price: number;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  client_id: string;
  client_name: string;
  client_whatsapp: string;
  professional_id: string;
  professional_name: string;
  service_id: string;
  service_name: string;
  service_category: string;
}

export interface TimeBlock {
  id: string;
  professional_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface ScheduleException {
  id: string;
  exception_date: string;
  professional_id: string | null;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

/* ---------- Página pública ---------- */
export interface PublicSettings {
  name: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  welcome_message: string | null;
  min_advance_minutes: number;
  max_advance_days: number;
  timezone: string;
}

export interface PublicService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_minutes: number;
}

export interface PublicProfessional {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: string | null;
  service_ids: string[] | null;
}

export interface BookingCatalog {
  settings: PublicSettings;
  services: PublicService[];
  professionals: PublicProfessional[];
  working_hours: { weekday: number; is_open: boolean; open_time: string; close_time: string }[];
}

export interface AvailableSlot {
  slot_start: string;
  slot_label: string;
  professional_ids: string[];
}

export interface BookingResult {
  id: string;
  code: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  price: number;
  duration_minutes: number;
  service_id: string;
  service_name: string;
  professional_id: string;
  professional_name: string;
  client_id: string;
  client_name: string;
  client_whatsapp: string;
}

/* ---------- Painel ---------- */
export interface DashboardStats {
  date: string;
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  expected_revenue: number;
  realized_revenue: number;
  clients_count: number;
  upcoming: {
    id: string;
    code: string;
    starts_at: string;
    ends_at: string;
    status: AppointmentStatus;
    price: number;
    client_name: string;
    client_whatsapp: string;
    professional_name: string;
    service_name: string;
  }[];
  top_services: { name: string; total: number }[];
}

export interface RankingRow {
  name: string;
  whatsapp?: string;
  completed: number;
  booked: number;
  revenue: number;
}

export interface ReportData {
  from: string;
  to: string;
  group: 'day' | 'week' | 'month';
  summary: {
    realized_revenue: number;
    forecast_revenue: number;
    average_ticket: number;
    total: number;
    completed: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    no_show: number;
  };
  series: { period: string; realized: number; forecast: number; completed: number; appointments: number }[];
  services: RankingRow[];
  professionals: RankingRow[];
  clients: RankingRow[];
}
