import type { NodeBundle, NodeControlState, NodeDetailItem, PeopleNodeItem, RuntimeProfileItem } from "./types";

function readToken(): string {
    try {
        return String(window.localStorage.getItem("mgr_web_token") || "").trim();
    } catch {
        return "";
    }
}

function writeToken(token: string): void {
    try {
        window.localStorage.setItem("mgr_web_token", token);
    } catch {}
}

export function authHeaders(): Record<string, string> {
    const token = readToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function ensureManagerToken(): Promise<string> {
    const cur = readToken();
    if (cur) {
        try {
            const meRes = await fetch("/api/auth/me", {
                method: "GET",
                cache: "no-store",
                headers: { Authorization: `Bearer ${cur}` },
            });
            if (meRes.ok) return cur;
        } catch {}
    }

    const rep = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "manager", password: "admin" }),
    });
    const body = await rep.json().catch(() => ({} as any));
    const tok = String((body as any)?.token || "").trim();
    if (!tok) throw new Error(String((body as any)?.error || "auth_login_failed"));
    writeToken(tok);
    return tok;
}

function parseNodeRows(body: any): PeopleNodeItem[] {
    if (!body?.ok || !Array.isArray(body.items)) throw new Error(String(body?.error || "invalid_nodes_payload"));
    return body.items
        .map((it: any): PeopleNodeItem => ({
            node_id: String(it?.node_id || ""),
            display_name: String(it?.display_name || it?.node_id || ""),
            status: String(it?.status || "offline"),
            matrix_user_id: String(it?.matrix_user_id || ""),
        }))
        .filter((it: PeopleNodeItem) => it.node_id);
}

export async function fetchPeopleNodes(): Promise<PeopleNodeItem[]> {
    const response = await fetch("/api/public/nodes", {
        method: "GET",
        cache: "no-store",
        headers: authHeaders(),
    });
    const body = await response.json();
    return parseNodeRows(body);
}

export async function loadNodeBundle(nodeId: string): Promise<NodeBundle> {
    const token = await ensureManagerToken();
    const [stRes, thRes, rpRes, detRes] = await Promise.all([
        fetch(`/api/nodes/${encodeURIComponent(nodeId)}/control-state`, {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/nodes/${encodeURIComponent(nodeId)}/codex-threads`, {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/nodes/${encodeURIComponent(nodeId)}/runtime-profiles`, {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/nodes/${encodeURIComponent(nodeId)}/details`, {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
        }),
    ]);

    const stBody = await stRes.json().catch(() => ({} as any));
    const thBody = await thRes.json().catch(() => ({} as any));
    const rpBody = await rpRes.json().catch(() => ({} as any));
    const detBody = await detRes.json().catch(() => ({} as any));

    const controlState: NodeControlState | null = stBody?.ok && stBody?.state ? (stBody.state as NodeControlState) : null;
    const threadItems =
        thBody?.ok && Array.isArray(thBody.items)
            ? thBody.items
                  .map((x: any) => ({
                      codex_thread_id: String(x?.codex_thread_id || ""),
                      title: String(x?.title || ""),
                      archived: Boolean(x?.archived),
                  }))
                  .filter((x: any) => x.codex_thread_id)
            : [];
    const runtimeProfiles: RuntimeProfileItem[] =
        rpBody?.ok && Array.isArray(rpBody.items)
            ? rpBody.items
                  .map((x: any) => ({
                      runtime_profile_id: String(x?.runtime_profile_id || ""),
                      version: Number(x?.version || 0),
                      is_default: Boolean(x?.is_default),
                      config: x?.config && typeof x.config === "object" ? x.config : {},
                  }))
                  .filter((x: any) => x.runtime_profile_id)
            : [];
    const nodeDetail: NodeDetailItem | null = detBody?.ok && detBody?.item ? (detBody.item as NodeDetailItem) : null;

    return { controlState, threadItems, runtimeProfiles, nodeDetail };
}

export async function switchCodexThread(nodeSessionId: string, codexThreadId: string): Promise<void> {
    const token = await ensureManagerToken();
    const rep = await fetch(`/api/node-sessions/${encodeURIComponent(nodeSessionId)}/switch-codex-thread`, {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ codex_thread_id: codexThreadId }),
    });
    const body = await rep.json().catch(() => ({} as any));
    if (!body?.ok) throw new Error(String(body?.error || "switch_thread_failed"));
}

export async function applyRuntimeProfile(nodeId: string, runtimeProfileId: string): Promise<void> {
    const token = await ensureManagerToken();
    const rep = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/runtime-profiles/${encodeURIComponent(runtimeProfileId)}/apply`, {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await rep.json().catch(() => ({} as any));
    if (!body?.ok) throw new Error(String(body?.error || "apply_runtime_profile_failed"));
}
