/**
 * FastAPI 백엔드 호출 클라이언트
 * Next.js → FastAPI (8000) 통신
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ── 토큰 관리 ────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setToken(token: string): void {
  localStorage.setItem("access_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("access_token");
}

// ── 공통 fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("세션이 만료됐습니다. 다시 로그인해주세요.");
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API 오류");
  }
  return res.json() as Promise<T>;
}

// ── 인증 ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  access_token: string;
  token_type: string;
  is_admin: boolean;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "로그인 실패");
  }
  const data = (await res.json()) as LoginResult;
  setToken(data.access_token);
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<void> {
  await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export function logout(): void {
  removeToken();
}

// ── 유저 ─────────────────────────────────────────────────────────────────────

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export const getMe = () => apiFetch<UserInfo>("/api/users/me");
export const listUsers = () => apiFetch<UserInfo[]>("/api/users");
export const deactivateUser = (id: number) =>
  apiFetch<void>(`/api/users/${id}`, { method: "DELETE" });
export const activateUser = (id: number) =>
  apiFetch<UserInfo>(`/api/users/${id}/activate`, { method: "POST" });

// ── 컨테이너 ──────────────────────────────────────────────────────────────────

export interface ContainerStatus {
  name: string;
  honeypot: string;
  username: string;
  status: string;
  id: string | null;
}

export const getMyContainers = () =>
  apiFetch<ContainerStatus[]>("/api/containers");
export const getAllContainers = () =>
  apiFetch<Record<string, ContainerStatus[]>>("/api/admin/containers");
export const controlContainer = (name: string, action: "start" | "stop" | "restart") =>
  apiFetch<unknown>(`/api/containers/${name}/${action}`, { method: "POST" });
export const getContainerLogs = (name: string, tail = 100) =>
  apiFetch<{ name: string; logs: string }>(`/api/containers/${name}/logs?tail=${tail}`);

// ── 시나리오 ──────────────────────────────────────────────────────────────────

export interface ScenarioStatus {
  id: string;
  name: string;
  label: string;
  state: string;
  started_at: string | null;
  finished_at: string | null;
  output?: string;
}

export const listScenarios = () =>
  apiFetch<ScenarioStatus[]>("/api/scenarios");
export const runScenario = (id: string) =>
  apiFetch<ScenarioStatus>(`/api/scenarios/${id}/run`, { method: "POST" });
export const getScenario = (id: string) =>
  apiFetch<ScenarioStatus>(`/api/scenarios/${id}`);
export const listAllScenarios = () =>
  apiFetch<unknown>("/api/admin/scenarios");

export interface BatchStatus {
  running: boolean;
  cancel: boolean;
  current: string | null;
  done: string[];
  failed: string[];
  ids: string[];
}

export const runAllScenarios = () =>
  apiFetch<{ started: boolean; total: number }>("/api/scenarios/run-all", { method: "POST" });
export const getBatchStatus = () =>
  apiFetch<BatchStatus>("/api/scenarios/batch-status");
export const cancelBatch = () =>
  apiFetch<{ cancelled: boolean }>("/api/scenarios/cancel-batch", { method: "POST" });

// ── 히스토리 ──────────────────────────────────────────────────────────────────

export interface ScenarioRun {
  id: number;
  scenario_id: string;
  scenario_name: string;
  label: string;
  state: string;
  started_at: string | null;
  finished_at: string | null;
  output: string | null;
}

export const getHistory = (limit = 50) =>
  apiFetch<ScenarioRun[]>(`/api/history?limit=${limit}`);
export const getAllHistory = (limit = 100) =>
  apiFetch<ScenarioRun[]>(`/api/admin/history?limit=${limit}`);

// ── 데이터셋 ──────────────────────────────────────────────────────────────────

export interface DatasetStatus {
  [filename: string]: { exists: boolean; size: number; mtime: number | null };
}

export const generateDataset = () =>
  apiFetch<unknown>("/api/dataset/generate", { method: "POST" });
export const getDatasetStatus = () =>
  apiFetch<DatasetStatus>("/api/dataset/status");
export const getDatasetDownloadUrl = (filename = "dataset.csv") =>
  `${API_BASE}/api/dataset/download?filename=${filename}`;

// ── 통계 ─────────────────────────────────────────────────────────────────────

export interface Stats {
  row_count: number;
  generated_at: string;
  distributions: Record<string, Record<string, number>>;
  timeline: { hour: string; count: number }[];
}

export const getStats = () => apiFetch<Stats>("/api/stats");
export const getAdminStats = () => apiFetch<unknown>("/api/admin/stats");

// ── WebSocket 로그 스트리밍 ───────────────────────────────────────────────────

export function createLogSocket(
  containerName: string,
  onMessage: (line: string) => void,
  onClose?: () => void
): WebSocket {
  const token = getToken() ?? "";
  const wsBase = API_BASE.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/ws/logs/${containerName}?token=${token}`);
  ws.onmessage = (e) => onMessage(e.data as string);
  ws.onclose = () => onClose?.();
  return ws;
}
