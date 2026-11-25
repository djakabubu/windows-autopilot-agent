/// <reference types="vite/client" />

interface DesktopApi {
  get_status: () => Promise<{ configured: boolean; busy: boolean; model: string }>;
  poll_events: () => Promise<AgentEvent[]>;
  start_task: (prompt: string) => Promise<{ ok: boolean; error?: string }>;
  respond_to_approval: (
    approvalId: string,
    approved: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  new_conversation: () => Promise<{ ok: boolean; error?: string }>;
}

interface AgentEvent {
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

interface Window {
  pywebview?: { api: DesktopApi };
}
