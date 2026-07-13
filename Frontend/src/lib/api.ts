// src/lib/api.ts — Centralized API client

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:3001';
  }
  return (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
}

const BASE = resolveBaseUrl();

// ─── Token storage ──────────────────────────────────────────────────────────
function getToken(): string | null { return localStorage.getItem('geu_token'); }
export function saveToken(token: string) { localStorage.setItem('geu_token', token); }
export function clearToken() { localStorage.removeItem('geu_token'); }

function buildHeaders(isFormData = false): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (!isFormData) h['Content-Type'] = 'application/json';

  // Bypass Dev Tunnels & Ngrok warning pages which break JSON parsing
  h['X-DevTunnel-Skip'] = 'true';
  h['ngrok-skip-browser-warning'] = 'true';

  return h;
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...buildHeaders(isFormData), ...(options.headers || {}) },
  });
  // Empty 204 etc — return null
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data as T;
}

// Build absolute URL for files served from the backend (uploads/...).
export function fileUrl(p?: string | null): string | null {
  if (!p) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${BASE}${p.startsWith('/') ? '' : '/'}${p}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  is_super_admin?: boolean;
  must_change_password: boolean;
}
export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  graduation_year: number | null;
  course?: string | null;
  student_id?: string | null;
  avatar_url: string | null;
  resume_url: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProfileUpdate {
  full_name: string;
  headline: string;
  bio: string;
  graduation_year: string | number;
}
export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; headline: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
  liked_by_user: boolean;
}
export interface PostComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  full_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
}
export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
}
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}
export interface MessagingContact extends Profile {
  last_seen: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_mine: boolean | null;
  unread_count: number;
}
export interface Job {
  id: string;
  posted_by: string;
  title: string;
  company: string;
  location: string | null;
  job_type: string | null;
  experience: string | null;
  salary: string | null;
  description: string;
  apply_url: string | null;
  apply_email: string | null;
  is_open: boolean;
  created_at: string;
  poster_name?: string | null;
  poster_avatar?: string | null;
}
export interface PendingRegistration {
  id: string;
  email: string;
  full_name: string;
  graduation_year: number | null;
  course: string | null;
  student_id: string | null;
  reason: string | null;
  verification_doc_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}
export interface AdminUser {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  is_super_admin: boolean;
  must_change_password: boolean;
  created_at: string;
  full_name?: string | null;
  graduation_year?: number | null;
  avatar_url?: string | null;
  headline?: string | null;
}
export interface AdminStats {
  total_users: number;
  pending_signups: number;
  total_posts: number;
  open_jobs: number;
  total_communities: number;
}
export interface ComprehensiveAnalytics {
  summary: {
    total_users: number;
    pending_signups: number;
    total_posts: number;
    open_jobs: number;
    total_communities: number;
    admin_count: number;
    active_users_24h: number;
    total_resumes: number;
  };
  graduation_years: { year: number; count: number }[];
  top_courses: { course: string; count: number }[];
  job_types: { job_type: string; count: number }[];
  registration_status: { pending: number; approved: number; rejected: number };
}
export interface SystemHealthReport {
  system_health: {
    status: string;
    timestamp: string;
    db_latency_ms: number;
    uptime_seconds: number;
    memory_usage: {
      rss_mb: number;
      heap_used_mb: number;
      heap_total_mb: number;
    };
    environment: {
      node_version: string;
      env: string;
      email_delivery_mode: string;
    };
  };
  api_endpoints_status: {
    name: string;
    status: string;
    latency_ms: number;
  }[];
  user_activity_log: {
    id: string;
    email: string;
    username: string;
    full_name: string;
    headline: string;
    graduation_year: number | null;
    course: string;
    is_admin: boolean;
    is_super_admin: boolean;
    is_online: boolean;
    ip_address: string;
    last_seen: string | null;
    created_at: string;
  }[];
}
export interface CommunityPost {
  id: string;
  community_id: string;
  author_id: string;
  title: string | null;
  content: string;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
  author_role?: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_user: boolean;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (identifier: string, password: string) =>
    request<{ token: string; user: AuthUser }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ identifier, password }) }
    ),

  register: (formData: FormData) =>
    request<{ message: string }>('/api/auth/register', { method: 'POST', body: formData }),

  me: () => request<AuthUser>('/api/auth/me'),

  requestChangePassword: (current_password: string) =>
    request<{ message: string }>('/api/auth/change-password/request', {
      method: 'POST',
      body: JSON.stringify({ current_password }),
    }),

  verifyChangePassword: (otp: string, new_password: string) =>
    request<{ message: string }>('/api/auth/change-password/verify', {
      method: 'POST',
      body: JSON.stringify({ otp, new_password }),
    }),
};

// ─── Profiles ───────────────────────────────────────────────────────────────
export const profilesApi = {
  get: (userId: string) => request<Profile | null>(`/api/profiles/${userId}`),
  all: () => request<Profile[]>('/api/profiles'),
  update: (userId: string, data: Partial<ProfileUpdate>) =>
    request<Profile>(`/api/profiles/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  uploadResume: (userId: string, file: File) => {
    const fd = new FormData(); fd.append('resume', file);
    return request<{ resume_url: string }>(`/api/profiles/${userId}/resume`, { method: 'POST', body: fd });
  },
  uploadAvatar: (userId: string, file: File) => {
    const fd = new FormData(); fd.append('avatar', file);
    return request<{ avatar_url: string }>(`/api/profiles/${userId}/avatar`, { method: 'POST', body: fd });
  },
};

// ─── Posts ──────────────────────────────────────────────────────────────────
export const postsApi = {
  list: () => request<Post[]>('/api/posts'),
  create: (content: string, image?: File | null) => {
    const fd = new FormData();
    fd.append('content', content);
    if (image) fd.append('image', image);
    return request<Post>('/api/posts', { method: 'POST', body: fd });
  },
  delete: (id: string) => request<{ success: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),
  toggleLike: (id: string) => request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: 'POST' }),
  comments: (id: string) => request<PostComment[]>(`/api/posts/${id}/comments`),
  addComment: (id: string, content: string) =>
    request<PostComment>(`/api/posts/${id}/comments`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  deleteComment: (postId: string, commentId: string) =>
    request<{ success: boolean }>(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
};

// ─── Connections ────────────────────────────────────────────────────────────
export const connectionsApi = {
  list: () => request<Connection[]>('/api/connections'),
  send: (addressee_id: string) =>
    request<{ success: boolean }>('/api/connections', {
      method: 'POST', body: JSON.stringify({ addressee_id }),
    }),
  accept: (requesterId: string) =>
    request<{ success: boolean }>(`/api/connections/${requesterId}/accept`, { method: 'PUT' }),
};

// ─── Messages ───────────────────────────────────────────────────────────────
export const messagesApi = {
  contacts: () => request<MessagingContact[]>('/api/messages/contacts'),
  conversation: (userId: string) => request<Message[]>(`/api/messages/${userId}`),
  send: (receiver_id: string, content: string) =>
    request<Message>('/api/messages', {
      method: 'POST', body: JSON.stringify({ receiver_id, content }),
    }),
  markRead: (userId: string) =>
    request<{ success: boolean }>(`/api/messages/${userId}/read`, { method: 'POST' }),
  heartbeat: () => request<{ ok: boolean }>('/api/messages/heartbeat', { method: 'POST' }),
  presence: (userId: string) =>
    request<{ id: string; last_seen: string | null }>(`/api/messages/presence/${userId}`),
};

// ─── Resumes ────────────────────────────────────────────────────────────────
export const resumesApi = {
  list: () => request<Profile[]>('/api/resumes'),
};

// ─── Jobs ───────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params: { search?: string; type?: string; mine?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.type) q.set('type', params.type);
    if (params.mine) q.set('mine', '1');
    const qs = q.toString();
    return request<Job[]>(`/api/jobs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<Job>(`/api/jobs/${id}`),
  create: (data: Partial<Job>) =>
    request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Job>) =>
    request<Job>(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  toggle: (id: string) => request<{ is_open: boolean }>(`/api/jobs/${id}/toggle`, { method: 'POST' }),
};

// ─── Admin ──────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => request<AdminStats>('/api/admin/stats'),
  analytics: () => request<ComprehensiveAnalytics>('/api/admin/analytics'),
  healthReport: () => request<SystemHealthReport>('/api/admin/health-report'),
  pending: (status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    request<PendingRegistration[]>(`/api/admin/pending?status=${status}`),
  approve: (id: string) =>
    request<{ message: string; username: string; email_delivered: boolean; email_mode: string | null }>(
      `/api/admin/pending/${id}/approve`, { method: 'POST' }
    ),
  reject: (id: string, reason: string) =>
    request<{ message: string }>(`/api/admin/pending/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),

  users: (search = '') =>
    request<AdminUser[]>(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  setAdmin: (id: string, is_admin: boolean) =>
    request<{ id: string; is_admin: boolean }>(`/api/admin/users/${id}/admin`, {
      method: 'PATCH', body: JSON.stringify({ is_admin }),
    }),
  resetUserPassword: (id: string) =>
    request<{ message: string }>(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  deletePost: (id: string) =>
    request<{ success: boolean }>(`/api/admin/posts/${id}`, { method: 'DELETE' }),
  deleteJob: (id: string) =>
    request<{ success: boolean }>(`/api/admin/jobs/${id}`, { method: 'DELETE' }),
  deleteCommunity: (id: string) =>
    request<{ success: boolean }>(`/api/admin/communities/${id}`, { method: 'DELETE' }),
};

// ─── Communities ────────────────────────────────────────────────────────────
export const communitiesApi = {
  list: () => request<any[]>('/api/communities'),
  get: (id: string) => request<any>(`/api/communities/${id}`),
  create: (name: string, description: string) =>
    request<any>('/api/communities', {
      method: 'POST', body: JSON.stringify({ name, description }),
    }),
  join: (id: string) => request<any>(`/api/communities/${id}/join`, { method: 'POST' }),
  leave: (id: string) => request<any>(`/api/communities/${id}/leave`, { method: 'POST' }),
  toggleChat: (id: string) =>
    request<any>(`/api/communities/${id}/toggle-chat`, { method: 'PATCH' }),
  delete: (id: string) => request<any>(`/api/communities/${id}`, { method: 'DELETE' }),
  members: (id: string) => request<any[]>(`/api/communities/${id}/members`),
  messages: (id: string) => request<any[]>(`/api/communities/${id}/messages`),
  sendMessage: (id: string, content: string) =>
    request<any>(`/api/communities/${id}/messages`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  toggleMemberChat: (communityId: string, userId: string) =>
    request<any>(`/api/communities/${communityId}/members/${userId}/toggle-chat`, { method: 'PATCH' }),
  setMemberRole: (communityId: string, userId: string, role: 'admin' | 'moderator' | 'member') =>
    request<any>(`/api/communities/${communityId}/members/${userId}/role`, {
      method: 'PATCH', body: JSON.stringify({ role }),
    }),
  removeMember: (communityId: string, userId: string) =>
    request<any>(`/api/communities/${communityId}/members/${userId}`, { method: 'DELETE' }),

  // Posts
  posts: (id: string) => request<CommunityPost[]>(`/api/communities/${id}/posts`),
  createPost: (id: string, data: { title?: string; content: string; image?: File | null }) => {
    const fd = new FormData();
    if (data.title) fd.append('title', data.title);
    fd.append('content', data.content);
    if (data.image) fd.append('image', data.image);
    return request<CommunityPost>(`/api/communities/${id}/posts`, { method: 'POST', body: fd });
  },
  deletePost: (id: string, postId: string) =>
    request<{ success: boolean }>(`/api/communities/${id}/posts/${postId}`, { method: 'DELETE' }),
  pinPost: (id: string, postId: string) =>
    request<{ pinned: boolean }>(`/api/communities/${id}/posts/${postId}/pin`, { method: 'POST' }),
  likePost: (id: string, postId: string) =>
    request<{ liked: boolean }>(`/api/communities/${id}/posts/${postId}/like`, { method: 'POST' }),
  postComments: (id: string, postId: string) =>
    request<PostComment[]>(`/api/communities/${id}/posts/${postId}/comments`),
  addPostComment: (id: string, postId: string, content: string) =>
    request<PostComment>(`/api/communities/${id}/posts/${postId}/comments`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  deletePostComment: (id: string, postId: string, commentId: string) =>
    request<{ success: boolean }>(`/api/communities/${id}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    }),
};
