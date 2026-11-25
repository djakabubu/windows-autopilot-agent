export interface AgentEvent {
  type: string;
  status?: string;
  text?: string;
  id?: string;
  command?: string;
  reason?: string;
  risk?: string;
  reasons?: string[];
  stdout?: string;
  stderr?: string;
  code?: number;
  duration?: number;
}

interface OperationResult {
  ok: boolean;
  error?: string;
}

interface DesktopStatus {
  configured: boolean;
  busy: boolean;
  model: string;
}

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? `Richiesta non riuscita (${response.status}).`);
  }
  return result;
}

async function operation(path: string, body?: object): Promise<OperationResult> {
  try {
    return await request<OperationResult>(path, body);
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export const desktopApi = {
  get_status: () => request<DesktopStatus>("/api/status"),
  poll_events: () => request<AgentEvent[]>("/api/events"),
  start_task: (prompt: string) => operation("/api/task", { prompt }),
  respond_to_approval: (approvalId: string, approved: boolean) =>
    operation("/api/approval", { approvalId, approved }),
  new_conversation: () => operation("/api/conversation", {}),
};
