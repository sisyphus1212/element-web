/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import { type RoomListItemSnapshot, RoomListItemView, RoomNotifState, type RoomItemViewModel } from "@element-hq/web-shared-components";

import BaseAvatar from "../../avatars/BaseAvatar";
import { _t } from "../../../../languageHandler";

type PeopleFilter = "all" | "online" | "offline";

interface PeopleNodeItem {
    node_id: string;
    display_name: string;
    status: string;
    last_room_route: string;
    matrix_user_id: string;
}

interface NodeControlState {
    active_node_session_id: string;
    active_codex_thread_id: string;
    active_runtime_profile_id: string;
    matrix_route?: { matrix_room_id?: string; matrix_thread_id?: string };
}

interface RuntimeProfileItem {
    runtime_profile_id: string;
    version: number;
    is_default: boolean;
    config?: Record<string, unknown>;
}

interface NodeDetailItem {
    node_id: string;
    display_name: string;
    status: string;
    last_seen: number;
    matrix_user_id: string;
    threads_total?: number;
    threads_archived?: number;
    runtime_profiles_total?: number;
    runtime_profiles_default?: number;
    control_state?: NodeControlState;
}

async function ensureManagerToken(): Promise<string> {
    const readToken = (): string => {
        try {
            return String(window.localStorage.getItem("mgr_web_token") || "").trim();
        } catch {
            return "";
        }
    };
    const writeToken = (token: string): void => {
        try {
            window.localStorage.setItem("mgr_web_token", token);
        } catch {}
    };
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

function authHeaders(): Record<string, string> {
    try {
        const t = String(window.localStorage.getItem("mgr_web_token") || "").trim();
        if (!t) return {};
        return { Authorization: `Bearer ${t}` };
    } catch {
        return {};
    }
}

function normalizeRoute(route: string): string {
    const text = String(route || "").trim();
    if (!text) return "";
    return text.startsWith("#") ? text : `#${text}`;
}

function isOnline(status: string): boolean {
    return String(status || "").toLowerCase() === "online";
}

function matchesFilter(item: PeopleNodeItem, filter: PeopleFilter): boolean {
    if (filter === "all") return true;
    if (filter === "online") return isOnline(item.status);
    return !isOnline(item.status);
}

function makeSnapshot(item: PeopleNodeItem, pending: boolean): RoomListItemSnapshot {
    return {
        id: item.node_id,
        room: item,
        name: item.display_name,
        isBold: isOnline(item.status),
        messagePreview: pending ? _t("common|loading") : `@${item.node_id}`,
        notification: {
            hasAnyNotificationOrActivity: false,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: false,
            isNotification: false,
            hasUnreadCount: false,
            count: 0,
            muted: !isOnline(item.status),
        },
        showMoreOptionsMenu: false,
        showNotificationMenu: false,
        isFavourite: false,
        isLowPriority: false,
        canInvite: false,
        canCopyRoomLink: false,
        canMarkAsRead: false,
        canMarkAsUnread: false,
        roomNotifState: RoomNotifState.AllMessages,
    };
}

function makeVm(snapshot: RoomListItemSnapshot, onOpen: () => void): RoomItemViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => undefined,
        onOpenRoom: onOpen,
        onMarkAsRead: () => undefined,
        onMarkAsUnread: () => undefined,
        onToggleFavorite: () => undefined,
        onToggleLowPriority: () => undefined,
        onInvite: () => undefined,
        onCopyRoomLink: () => undefined,
        onLeaveRoom: () => undefined,
        onSetRoomNotifState: () => undefined,
    };
}

export const PeopleRoomListView: React.FC = (): JSX.Element => {
    const [items, setItems] = useState<PeopleNodeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [resolvingNodeId, setResolvingNodeId] = useState<string>("");
    const [filter, setFilter] = useState<PeopleFilter>("all");
    const [error, setError] = useState<string>("");
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string>("");
    const [controlState, setControlState] = useState<NodeControlState | null>(null);
    const [threadItems, setThreadItems] = useState<Array<{ codex_thread_id: string; title: string; archived: boolean }>>([]);
    const [runtimeProfiles, setRuntimeProfiles] = useState<RuntimeProfileItem[]>([]);
    const [nodeDetail, setNodeDetail] = useState<NodeDetailItem | null>(null);
    const [detailOpen, setDetailOpen] = useState<boolean>(false);

    const publishNodeDetailToHome = useCallback((detail: NodeDetailItem): void => {
        try {
            window.localStorage.setItem("mx_people_selected_node_detail", JSON.stringify(detail || {}));
        } catch {}
        window.dispatchEvent(new CustomEvent("mx_people_node_detail_changed", { detail }));
    }, []);

    const reloadNodes = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/public/nodes", {
                method: "GET",
                cache: "no-store",
                headers: authHeaders(),
            });
            const body = await response.json();
            if (!body?.ok || !Array.isArray(body.items)) {
                throw new Error(String(body?.error || "invalid_nodes_payload"));
            }
            const rows = body.items
                .map((it: any): PeopleNodeItem => ({
                    node_id: String(it?.node_id || ""),
                    display_name: String(it?.display_name || it?.node_id || ""),
                    status: String(it?.status || "offline"),
                    last_room_route: normalizeRoute(String(it?.last_room_route || "")),
                    matrix_user_id: String(it?.matrix_user_id || ""),
                }))
                .filter((it: PeopleNodeItem) => it.node_id);
            setItems(rows);
        } catch (e) {
            const message = `People nodes load failed: ${String((e as Error)?.message || e)}`;
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reloadNodes();
    }, [reloadNodes]);

    const visibleItems = useMemo(() => {
        return items
            .filter((it) => matchesFilter(it, filter))
            .sort((a, b) => {
                const ao = isOnline(a.status);
                const bo = isOnline(b.status);
                if (ao !== bo) return ao ? -1 : 1;
                return a.display_name.localeCompare(b.display_name);
            });
    }, [items, filter]);

    const onSelectNode = useCallback(
        async (nodeId: string) => {
            const id = String(nodeId || "");
            if (!id) return;
            setResolvingNodeId(id);
            setSelectedNodeId(id);
            setError("");
            try {
                const token = await ensureManagerToken();
                const [stRes, thRes, rpRes] = await Promise.all([
                    fetch(`/api/nodes/${encodeURIComponent(id)}/control-state`, {
                        method: "GET",
                        cache: "no-store",
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`/api/nodes/${encodeURIComponent(id)}/codex-threads`, {
                        method: "GET",
                        cache: "no-store",
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`/api/nodes/${encodeURIComponent(id)}/runtime-profiles`, {
                        method: "GET",
                        cache: "no-store",
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);
                const stBody = await stRes.json().catch(() => ({} as any));
                const thBody = await thRes.json().catch(() => ({} as any));
                const rpBody = await rpRes.json().catch(() => ({} as any));
                if (stBody?.ok && stBody?.state) {
                    setControlState(stBody.state as NodeControlState);
                } else {
                    setControlState(null);
                }
                if (thBody?.ok && Array.isArray(thBody.items)) {
                    setThreadItems(
                        thBody.items.map((x: any) => ({
                            codex_thread_id: String(x?.codex_thread_id || ""),
                            title: String(x?.title || ""),
                            archived: Boolean(x?.archived),
                        })).filter((x: any) => x.codex_thread_id),
                    );
                } else {
                    setThreadItems([]);
                }
                if (rpBody?.ok && Array.isArray(rpBody.items)) {
                    setRuntimeProfiles(
                        rpBody.items.map((x: any) => ({
                            runtime_profile_id: String(x?.runtime_profile_id || ""),
                            version: Number(x?.version || 0),
                            is_default: Boolean(x?.is_default),
                            config: (x?.config && typeof x.config === "object") ? x.config : {},
                        })).filter((x: any) => x.runtime_profile_id),
                    );
                } else {
                    setRuntimeProfiles([]);
                }
                const detRes = await fetch(`/api/nodes/${encodeURIComponent(id)}/details`, {
                    method: "GET",
                    cache: "no-store",
                    headers: { Authorization: `Bearer ${token}` },
                });
                const detBody = await detRes.json().catch(() => ({} as any));
                if (detBody?.ok && detBody?.item) {
                    const detail = detBody.item as NodeDetailItem;
                    setNodeDetail(detail);
                    publishNodeDetailToHome(detail);
                } else {
                    setNodeDetail(null);
                }
            } catch (e) {
                setError(`Load node details failed: ${String((e as Error)?.message || e)}`);
            } finally {
                setResolvingNodeId("");
            }
        },
        [publishNodeDetailToHome],
    );

    const renderAvatar = useCallback((roomLike: unknown): React.ReactNode => {
        const node = roomLike as PeopleNodeItem;
        return <BaseAvatar name={String(node?.display_name || "node")} idName={String(node?.node_id || "node")} size="32px" />;
    }, []);

    return (
        <>
            <div>
                <div
                    data-testid="primary-filters"
                    style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", gap: "var(--cpd-space-3x)" }}
                >
                    <IconButton
                        kind="secondary"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse filter list" : "Expand filter list"}
                        size="28px"
                        onClick={() => setIsExpanded((v) => !v)}
                    >
                        <ChevronDownIcon />
                    </IconButton>
                    <div
                        role="listbox"
                        aria-label="Room list filters"
                        style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", flexWrap: isExpanded ? "wrap" : "nowrap", overflowX: "auto" }}
                    >
                        <ChatFilter role="option" selected={filter === "all"} onClick={() => setFilter("all")}>All</ChatFilter>
                        <ChatFilter role="option" selected={filter === "online"} onClick={() => setFilter("online")}>Online</ChatFilter>
                        <ChatFilter role="option" selected={filter === "offline"} onClick={() => setFilter("offline")}>Offline</ChatFilter>
                    </div>
                </div>
            </div>

            {error && <div className="mx_InlineError">{error}</div>}

            <div data-testid="room-list" role="listbox" aria-label={_t("room_list|list_title")} style={{ height: "100%", overflowY: "auto" }}>
                {loading ? (
                    <div className="mx_RoomSublist_empty">{_t("common|loading")}</div>
                ) : visibleItems.length === 0 ? (
                    <div className="mx_RoomSublist_empty">{_t("common|no_results")}</div>
                ) : (
                    visibleItems.map((it, index) => {
                        const selected = selectedNodeId !== "" && it.node_id === selectedNodeId;
                        const pending = resolvingNodeId === it.node_id;
                        const snapshot = makeSnapshot(it, pending);
                        const vm = makeVm(snapshot, () => {
                            void onSelectNode(it.node_id);
                        });
                        return (
                            <RoomListItemView
                                key={it.node_id}
                                vm={vm}
                                isSelected={selected}
                                isFocused={false}
                                onFocus={() => undefined}
                                roomIndex={index}
                                roomCount={visibleItems.length}
                                renderAvatar={renderAvatar}
                            />
                        );
                    })
                )}
            </div>
            {selectedNodeId && (
                <div style={{ marginTop: 12, padding: 8, borderTop: "1px solid var(--cpd-color-border-subtle-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontWeight: 600 }}>Node Controls: {selectedNodeId}</div>
                        <button
                            type="button"
                            onClick={() => setDetailOpen((v) => !v)}
                            style={{
                                padding: "2px 6px",
                                borderRadius: 8,
                                border: "1px solid var(--cpd-color-border-subtle-primary)",
                                background: "transparent",
                            }}
                        >
                            {detailOpen ? "Hide Details" : "View Details"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                        session={String(controlState?.active_node_session_id || "-")} thread={String(controlState?.active_codex_thread_id || "-")}
                    </div>
                    {detailOpen && (
                        <div
                            style={{
                                marginBottom: 10,
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid var(--cpd-color-border-subtle-primary)",
                                background: "var(--cpd-color-bg-subtle-secondary)",
                                fontSize: 12,
                                lineHeight: 1.45,
                            }}
                        >
                            <div>node_id: {String(nodeDetail?.node_id || selectedNodeId)}</div>
                            <div>display_name: {String(nodeDetail?.display_name || "-")}</div>
                            <div>status: {String(nodeDetail?.status || "-")}</div>
                            <div>last_seen: {nodeDetail?.last_seen ? new Date(nodeDetail.last_seen).toLocaleString() : "-"}</div>
                            <div>matrix_user_id: {String(nodeDetail?.matrix_user_id || "-")}</div>
                            <div>threads: {Number(nodeDetail?.threads_total || 0)} (archived {Number(nodeDetail?.threads_archived || 0)})</div>
                            <div>
                                runtime_profiles: {Number(nodeDetail?.runtime_profiles_total || 0)} (default {Number(nodeDetail?.runtime_profiles_default || 0)})
                            </div>
                        </div>
                    )}
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Threads</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {threadItems.length === 0 ? <span style={{ opacity: 0.7 }}>No threads</span> : threadItems.map((t) => (
                                <button
                                    key={t.codex_thread_id}
                                    type="button"
                                    disabled={t.archived}
                                    onClick={async () => {
                                        try {
                                            const token = await ensureManagerToken();
                                            const nsid = String(controlState?.active_node_session_id || "").trim();
                                            if (!nsid) throw new Error("missing_active_node_session_id");
                                            const rep = await fetch(`/api/node-sessions/${encodeURIComponent(nsid)}/switch-codex-thread`, {
                                                method: "POST",
                                                cache: "no-store",
                                                headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
                                                body: JSON.stringify({ codex_thread_id: t.codex_thread_id }),
                                            });
                                            const body = await rep.json().catch(() => ({} as any));
                                            if (!body?.ok) throw new Error(String(body?.error || "switch_thread_failed"));
                                            setControlState((prev) => ({ ...(prev || ({} as NodeControlState)), active_codex_thread_id: t.codex_thread_id }));
                                        } catch (e) {
                                            setError(`Switch thread failed: ${String((e as Error)?.message || e)}`);
                                        }
                                    }}
                                    style={{
                                        padding: "2px 6px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cpd-color-border-subtle-primary)",
                                        background:
                                            String(controlState?.active_codex_thread_id || "") === t.codex_thread_id
                                                ? "var(--cpd-color-bg-canvas-default)"
                                                : "transparent",
                                    }}
                                >
                                    {t.title || t.codex_thread_id.slice(0, 8)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Runtime Profiles</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {runtimeProfiles.length === 0 ? <span style={{ opacity: 0.7 }}>No runtime profiles</span> : runtimeProfiles.map((rp) => (
                                <button
                                    key={rp.runtime_profile_id}
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const token = await ensureManagerToken();
                                            const rep = await fetch(
                                                `/api/nodes/${encodeURIComponent(selectedNodeId)}/runtime-profiles/${encodeURIComponent(rp.runtime_profile_id)}/apply`,
                                                {
                                                    method: "POST",
                                                    cache: "no-store",
                                                    headers: { Authorization: `Bearer ${token}` },
                                                },
                                            );
                                            const body = await rep.json().catch(() => ({} as any));
                                            if (!body?.ok) throw new Error(String(body?.error || "apply_runtime_profile_failed"));
                                            setRuntimeProfiles((prev) => prev.map((x) => ({ ...x, is_default: x.runtime_profile_id === rp.runtime_profile_id })));
                                        } catch (e) {
                                            setError(`Apply runtime profile failed: ${String((e as Error)?.message || e)}`);
                                        }
                                    }}
                                    style={{
                                        padding: "2px 6px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cpd-color-border-subtle-primary)",
                                        background: rp.is_default ? "var(--cpd-color-bg-canvas-default)" : "transparent",
                                    }}
                                >
                                    {rp.runtime_profile_id.slice(0, 8)} v{rp.version}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
