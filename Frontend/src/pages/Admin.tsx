import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, fileUrl, type AdminUser, type PendingRegistration } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  Shield, Users, FileText, Briefcase, Clock, ExternalLink,
  Check, X, Search, Trash2, KeyRound, ShieldCheck, ShieldOff, Mail,
  GraduationCap, IdCard, AlertTriangle, BadgeCheck, BarChart3,
  Activity, Server, Database, Cpu, RefreshCw, TrendingUp, UserCheck,
  PieChart as PieIcon, Zap, CheckCircle2, Wifi,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Tab = "pending" | "users" | "analytics" | "health";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [pendingStatus, setPendingStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);

  // ─── Stats ──────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    refetchInterval: 30_000,
  });

  // ─── Pending registrations ──────────────────────────────
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["admin-pending", pendingStatus],
    queryFn: () => adminApi.pending(pendingStatus),
    enabled: tab === "pending",
  });

  // ─── Users ──────────────────────────────────────────────
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminApi.users(search),
    enabled: tab === "users",
  });

  const [activitySearch, setActivitySearch] = useState("");

  // ─── Analytics ──────────────────────────────────────────
  const { data: analytics, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.analytics(),
    enabled: tab === "analytics",
    refetchInterval: 30_000,
  });

  // ─── Health Report & Activity ───────────────────────────
  const { data: healthReport, isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.healthReport(),
    enabled: tab === "health",
    refetchInterval: 15_000,
  });

  const handleRefreshAnalytics = async () => {
    setIsRefreshingAnalytics(true);
    try {
      await refetchAnalytics();
      toast.success("Analytics data refreshed successfully");
    } catch (err) {
      toast.error("Failed to refresh analytics");
    } finally {
      setTimeout(() => setIsRefreshingAnalytics(false), 500);
    }
  };

  const handleRefreshHealth = async () => {
    setIsRefreshingHealth(true);
    try {
      await refetchHealth();
      toast.success("Live system health diagnostics completed");
    } catch (err) {
      toast.error("Failed to run health diagnostics");
    } finally {
      setTimeout(() => setIsRefreshingHealth(false), 500);
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pending"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin-health"] });
  };

  const approve = async (id: string) => {
    try {
      const r = await adminApi.approve(id);
      toast.success(`Approved as ${r.username}.`);
      if (r.email_mode === "console") {
        toast.message("SMTP not configured — credentials were logged to the server console.");
      }
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const reject = async () => {
    if (!rejectingId) return;
    try {
      await adminApi.reject(rejectingId, rejectReason);
      toast.success("Application rejected.");
      setRejectingId(null);
      setRejectReason("");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setAdminFlag = async (u: AdminUser, makeAdmin: boolean) => {
    try {
      await adminApi.setAdmin(u.id, makeAdmin);
      toast.success(makeAdmin ? `${u.full_name || u.username} promoted to admin.` : `Admin removed from ${u.full_name || u.username}.`);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const resetPwd = async (u: AdminUser) => {
    if (!confirm(`Generate a new temporary password for ${u.full_name || u.username} and email it?`)) return;
    try {
      await adminApi.resetUserPassword(u.id);
      toast.success("Password reset and emailed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const removeUser = async (u: AdminUser) => {
    if (!confirm(`Permanently delete ${u.full_name || u.email}? This cannot be undone.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      toast.success("User deleted.");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h2 className="font-heading font-bold text-2xl text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Admin Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.is_super_admin ? "Super Admin" : "Admin"} controls
            </p>
          </div>
        </div>

        {/* ── Stats cards ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: Users, label: "Users", value: stats?.total_users ?? "—", color: "text-primary", bg: "bg-primary/10" },
            { icon: Clock, label: "Pending", value: stats?.pending_signups ?? "—", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: FileText, label: "Posts", value: stats?.total_posts ?? "—", color: "text-secondary", bg: "bg-secondary/10" },
            { icon: Briefcase, label: "Open jobs", value: stats?.open_jobs ?? "—", color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: Users, label: "Communities", value: stats?.total_communities ?? "—", color: "text-accent", bg: "bg-accent/10" },
          ].map((s, i) => (
            <div key={s.label} className={`glass-card rounded-xl p-4 animate-fade-up delay-${(i + 1) * 100}`}>
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="font-heading font-bold text-2xl text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {[
            { k: "pending" as const, label: "Sign-up Approvals", icon: Clock },
            { k: "users" as const, label: "Users Directory", icon: Users },
            { k: "analytics" as const, label: "Platform Analytics", icon: BarChart3 },
            { k: "health" as const, label: "System & API Health", icon: Activity },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[2px] whitespace-nowrap transition-colors ${
                tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Pending tab ──────────────────────────────── */}
        {tab === "pending" && (
          <>
            <div className="flex items-center gap-2 mb-3">
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <button key={s} onClick={() => setPendingStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    pendingStatus === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}>
                  {s}
                </button>
              ))}
            </div>

            {loadingPending ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : pending.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center">
                <p className="text-sm text-muted-foreground">No {pendingStatus} applications.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((p: PendingRegistration) => (
                  <div key={p.id} className="glass-card rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
                          {p.full_name}
                          <span className="text-xs text-muted-foreground font-normal">{p.email}</span>
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          {p.graduation_year && <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> Class of {p.graduation_year}</span>}
                          {p.course && <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> {p.course}</span>}
                          {p.student_id && <span className="flex items-center gap-1"><IdCard className="w-3.5 h-3.5" /> {p.student_id}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                        </div>
                        {p.reason && (
                          <p className="text-sm text-muted-foreground mt-3 bg-muted/30 rounded-lg p-3">
                            <span className="font-medium text-foreground">Reason: </span>{p.reason}
                          </p>
                        )}
                        {p.rejection_reason && (
                          <p className="text-sm text-destructive mt-3 bg-destructive/5 rounded-lg p-3">
                            <span className="font-medium">Rejection note: </span>{p.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <a href={fileUrl(p.verification_doc_url) || "#"} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1.5 text-xs bg-secondary/10 text-secondary px-3 py-2 rounded-lg font-medium hover:bg-secondary/20 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> View document
                        </a>
                        {p.status === "pending" && (
                          <>
                            <button onClick={() => approve(p.id)}
                              className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button onClick={() => { setRejectingId(p.id); setRejectReason(""); }}
                              className="flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive px-3 py-2 rounded-lg font-medium hover:bg-destructive/20 transition-colors">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Users tab ────────────────────────────────── */}
        {tab === "users" && (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {loadingUsers ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : users.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center">
                <p className="text-sm text-muted-foreground">No users found.</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: AdminUser) => (
                      <tr key={u.id} className="border-t border-border/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                              ) : (
                                <span className="text-primary text-xs font-bold">
                                  {(u.full_name || u.username || "A")[0].toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{u.full_name || "—"}</p>
                              {u.graduation_year && <p className="text-[11px] text-muted-foreground">{u.graduation_year}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          {u.is_super_admin ? (
                            <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-2 py-1 rounded-md">Super Admin</span>
                          ) : u.is_admin ? (
                            <span className="text-[11px] bg-secondary/10 text-secondary font-semibold px-2 py-1 rounded-md">Admin</span>
                          ) : (
                            <span className="text-[11px] bg-muted text-muted-foreground font-medium px-2 py-1 rounded-md">User</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {user?.is_super_admin && !u.is_super_admin && (
                              u.is_admin ? (
                                <button onClick={() => setAdminFlag(u, false)} title="Demote"
                                  className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                  <ShieldOff className="w-4 h-4" />
                                </button>
                              ) : (
                                <button onClick={() => setAdminFlag(u, true)} title="Promote to admin"
                                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              )
                            )}
                            <button onClick={() => resetPwd(u)} title="Reset password"
                              className="p-2 text-muted-foreground hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            {user?.is_super_admin && !u.is_super_admin && (
                              <button onClick={() => removeUser(u)} title="Delete user"
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Analytics Tab ────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-xl text-foreground">Platform Intelligence & Analytics</h3>
                <p className="text-xs text-muted-foreground">Comprehensive insights into alumni engagement, distribution, and growth</p>
              </div>
              <button
                onClick={handleRefreshAnalytics}
                disabled={isRefreshingAnalytics || loadingAnalytics}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted/60 transition-all shadow-sm active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshingAnalytics ? "animate-spin" : ""}`} />
                {isRefreshingAnalytics ? "Refreshing Data..." : "Refresh Analytics"}
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">
                Loading analytics data...
              </div>
            ) : !analytics ? (
              <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">
                No analytics data available right now.
              </div>
            ) : (
              <>
                {/* Executive KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass-card rounded-2xl p-5 border-l-4 border-l-primary">
                    <p className="text-xs font-medium text-muted-foreground">Verified Alumni Users</p>
                    <p className="font-heading font-bold text-3xl text-foreground mt-1.5">{analytics.summary.total_users}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600">
                      <TrendingUp className="w-3.5 h-3.5" /> Approved Accounts
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5 border-l-4 border-l-amber-500">
                    <p className="text-xs font-medium text-muted-foreground">Pending Review Queue</p>
                    <p className="font-heading font-bold text-3xl text-foreground mt-1.5">{analytics.summary.pending_signups}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                      <Clock className="w-3.5 h-3.5" /> Requires Action
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5 border-l-4 border-l-emerald-500">
                    <p className="text-xs font-medium text-muted-foreground">Active Users (24h)</p>
                    <p className="font-heading font-bold text-3xl text-foreground mt-1.5">{analytics.summary.active_users_24h}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600">
                      <UserCheck className="w-3.5 h-3.5" /> Recent Online Activity
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5 border-l-4 border-l-secondary">
                    <p className="text-xs font-medium text-muted-foreground">Uploaded Resumes</p>
                    <p className="font-heading font-bold text-3xl text-foreground mt-1.5">{analytics.summary.total_resumes}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-secondary">
                      <IdCard className="w-3.5 h-3.5" /> Searchable Profiles
                    </div>
                  </div>
                </div>

                {/* Interactive Visual Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Graduation Batches Bar Chart */}
                  <div className="glass-card rounded-2xl p-6">
                    <h4 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-4">
                      <GraduationCap className="w-5 h-5 text-primary" /> Graduation Batches Chart
                    </h4>
                    {analytics.graduation_years.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-12 text-center">No graduation year data recorded yet.</p>
                    ) : (
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.graduation_years} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "#fff" }}
                              formatter={(value: any) => [`${value} Alumni`, "Count"]}
                            />
                            <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Academic Programs Donut Chart */}
                  <div className="glass-card rounded-2xl p-6">
                    <h4 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-4">
                      <PieIcon className="w-5 h-5 text-secondary" /> Top Programs & Courses Breakdown
                    </h4>
                    {analytics.top_courses.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-12 text-center">No course distribution recorded yet.</p>
                    ) : (
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "#fff" }}
                              formatter={(value: any) => [`${value} Members`, "Count"]}
                            />
                            <Pie
                              data={analytics.top_courses}
                              dataKey="count"
                              nameKey="course"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              label={({ course }) => (course.length > 18 ? `${course.substring(0, 16)}...` : course)}
                            >
                              {analytics.top_courses.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Platform Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card rounded-2xl p-5">
                    <h5 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-600" /> Job Board Breakdown
                    </h5>
                    <div className="space-y-2.5">
                      {analytics.job_types.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No job listings currently posted.</p>
                      ) : (
                        analytics.job_types.map((j) => (
                          <div key={j.job_type} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/30">
                            <span className="font-medium capitalize">{j.job_type || 'Unspecified'}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">{j.count} posts</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5">
                    <h5 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" /> Application Review Pipeline
                    </h5>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 text-emerald-900">
                        <span>Approved Alumni</span>
                        <span className="font-bold">{analytics.registration_status.approved}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-amber-50 text-amber-900">
                        <span>Pending Signups</span>
                        <span className="font-bold">{analytics.registration_status.pending}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50 text-rose-900">
                        <span>Rejected Applications</span>
                        <span className="font-bold">{analytics.registration_status.rejected}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5">
                    <h5 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" /> Administration & Security
                    </h5>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p className="flex justify-between p-2 rounded-lg bg-muted/30">
                        <span>Active Admins</span>
                        <span className="font-bold text-foreground">{analytics.summary.admin_count}</span>
                      </p>
                      <p className="flex justify-between p-2 rounded-lg bg-muted/30">
                        <span>Total Communities</span>
                        <span className="font-bold text-foreground">{analytics.summary.total_communities}</span>
                      </p>
                      <p className="flex justify-between p-2 rounded-lg bg-muted/30">
                        <span>Total Discussions & Posts</span>
                        <span className="font-bold text-foreground">{analytics.summary.total_posts}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Health Report & User Activity Tab ────────── */}
        {tab === "health" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-xl text-foreground">System Diagnostics & API Health</h3>
                <p className="text-xs text-muted-foreground">Real-time status of backend microservices, database performance, and user activity audit</p>
              </div>
              <button
                onClick={handleRefreshHealth}
                disabled={isRefreshingHealth || loadingHealth}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted/60 transition-all shadow-sm active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshingHealth ? "animate-spin" : ""}`} />
                {isRefreshingHealth ? "Running Diagnostics..." : "Run Health Check"}
              </button>
            </div>

            {loadingHealth ? (
              <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">
                Running live diagnostics across all endpoints...
              </div>
            ) : !healthReport ? (
              <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">
                Unable to retrieve health report.
              </div>
            ) : (
              <>
                {/* System Overview Banner Card */}
                <div className="glass-card rounded-2xl p-6 bg-gradient-to-r from-emerald-500/10 via-background to-primary/10 border border-emerald-500/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                        <Server className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-lg text-foreground">GEU Alumni Backend Engine</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {healthReport.system_health.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Node {healthReport.system_health.environment.node_version} • {healthReport.system_health.environment.env.toUpperCase()} mode • Email Engine: {healthReport.system_health.environment.email_delivery_mode.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">DB Latency</p>
                        <p className="font-heading font-bold text-emerald-600">{healthReport.system_health.db_latency_ms} ms</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Server Uptime</p>
                        <p className="font-heading font-bold text-foreground">
                          {Math.floor(healthReport.system_health.uptime_seconds / 3600)}h {Math.floor((healthReport.system_health.uptime_seconds % 3600) / 60)}m
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Heap Used</p>
                        <p className="font-heading font-bold text-foreground">
                          {healthReport.system_health.memory_usage.heap_used_mb} MB / {healthReport.system_health.memory_usage.heap_total_mb} MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Endpoints Live Health Grid */}
                <div>
                  <h4 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-3">
                    <Wifi className="w-4 h-4 text-primary" /> API Microservices Real-Time Latency
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {healthReport.api_endpoints_status.map((ep) => (
                      <div key={ep.name} className="glass-card rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{ep.name}</p>
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {ep.status}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-muted/50 text-foreground">
                          {ep.latency_ms} ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Activity & Audit Table */}
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-heading font-semibold text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" /> Live User Directory & Activity Log
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Monitoring presence, roles, and academic profiles of up to 100 recent users
                      </p>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)}
                        placeholder="Search users..."
                        className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground font-medium">
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Alumnus Name & Email</th>
                          <th className="py-3 px-3">Academic Program</th>
                          <th className="py-3 px-3">Role</th>
                          <th className="py-3 px-3">IP Address</th>
                          <th className="py-3 px-3">Last Active</th>
                          <th className="py-3 px-3">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {healthReport.user_activity_log
                          .filter(u =>
                            u.full_name.toLowerCase().includes(activitySearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(activitySearch.toLowerCase()) ||
                            u.course.toLowerCase().includes(activitySearch.toLowerCase()) ||
                            (u.ip_address && u.ip_address.toLowerCase().includes(activitySearch.toLowerCase()))
                          )
                          .map(u => (
                            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-3">
                                {u.is_online ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-700">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Offline
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <p className="font-semibold text-foreground">{u.full_name}</p>
                                <p className="text-[11px] text-muted-foreground">{u.email}</p>
                              </td>
                              <td className="py-3 px-3">
                                <p className="font-medium text-foreground">{u.course}</p>
                                <p className="text-[11px] text-muted-foreground">Class of {u.graduation_year || 'N/A'}</p>
                              </td>
                              <td className="py-3 px-3">
                                {u.is_super_admin ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-semibold text-[11px]">
                                    Super Admin
                                  </span>
                                ) : u.is_admin ? (
                                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold text-[11px]">
                                    Admin
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px]">
                                    Member
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-[11px] px-2 py-1 rounded-md bg-muted/60 text-foreground">
                                  {u.ip_address || '127.0.0.1 (Local)'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-muted-foreground">
                                {u.last_seen ? formatDistanceToNow(new Date(u.last_seen), { addSuffix: true }) : 'Never'}
                              </td>
                              <td className="py-3 px-3 text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Reject modal ─────────────────────────────── */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">Reject application</h3>
                  <p className="text-xs text-muted-foreground">The user will be emailed with the reason below.</p>
                </div>
              </div>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                placeholder="Reason for rejection (optional but recommended)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30 mb-4" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRejectingId(null)}
                  className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                  Cancel
                </button>
                <button onClick={reject}
                  className="bg-destructive text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                  Reject application
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Admin;
