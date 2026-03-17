/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { _t } from "../../../../languageHandler";
import { applyRuntimeProfile, fetchPeopleNodes, loadNodeBundle, switchCodexThread } from "./people/api";
import { PeopleNodeListItem } from "./people/PeopleNodeListItem";
import type { NodeControlState, NodeDetailItem, PeopleFilter, PeopleNodeItem, RuntimeProfileItem } from "./people/types";

function isOnline(status: string): boolean {
    return String(status || "").toLowerCase() === "online";
}

function matchesFilter(item: PeopleNodeItem, filter: PeopleFilter): boolean {
    if (filter === "all") return true;
    if (filter === "online") return isOnline(item.status);
    return !isOnline(item.status);
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
            const rows = await fetchPeopleNodes();
            setItems(rows);
        } catch (e) {
            setError(`People nodes load failed: ${String((e as Error)?.message || e)}`);
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
                const bundle = await loadNodeBundle(id);
                setControlState(bundle.controlState);
                setThreadItems(bundle.threadItems);
                setRuntimeProfiles(bundle.runtimeProfiles);
                setNodeDetail(bundle.nodeDetail);
                if (bundle.nodeDetail) publishNodeDetailToHome(bundle.nodeDetail);
            } catch (e) {
                setError(`Load node details failed: ${String((e as Error)?.message || e)}`);
            } finally {
                setResolvingNodeId("");
            }
        },
        [publishNodeDetailToHome],
    );

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
                    visibleItems.map((it, index) => (
                        <PeopleNodeListItem
                            key={it.node_id}
                            item={it}
                            selected={selectedNodeId === it.node_id}
                            pending={resolvingNodeId === it.node_id}
                            index={index}
                            count={visibleItems.length}
                            onSelect={(id) => void onSelectNode(id)}
                        />
                    ))
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
                                            const nsid = String(controlState?.active_node_session_id || "").trim();
                                            if (!nsid) throw new Error("missing_active_node_session_id");
                                            await switchCodexThread(nsid, t.codex_thread_id);
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
                                            await applyRuntimeProfile(selectedNodeId, rp.runtime_profile_id);
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
