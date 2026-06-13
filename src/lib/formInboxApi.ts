// Client for the Form Inbox (core-engine /api/form-inbox) — the open user tasks
// for the tenant (e.g. "Review Submission"), each linked to its submission.
import { authed, tenantInit } from "./authApi";

const seg = (s: string) => encodeURIComponent(s);

export type InboxTask = {
  taskId: string;
  name?: string;
  created?: number;
  assignee?: string | null;
  processInstanceId?: string;
  processDefinitionKey?: string;
  /** The FormInstance id this task is about (the process business key). */
  instanceId?: string | null;
};

export function getInbox(tenant: string): Promise<InboxTask[]> {
  return authed("/api/form-inbox", tenantInit(tenant));
}

export function completeTask(tenant: string, taskId: string): Promise<{ ok: boolean; taskId: string }> {
  return authed(`/api/form-inbox/${seg(taskId)}/complete`, tenantInit(tenant, { method: "POST" }));
}
