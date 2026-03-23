/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { _t } from "../../../../languageHandler";
import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { fetchPeopleNodes, loadNodeBundle } from "./people/api";
import { PeopleNodeListItem } from "./people/PeopleNodeListItem";
import type { NodeDetailItem, PeopleFilter, PeopleNodeItem } from "./people/types";

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

    const publishNodeDetailToHome = useCallback((detail: NodeDetailItem): void => {
        try {
            window.localStorage.setItem("mx_people_selected_node_detail", JSON.stringify(detail || {}));
        } catch {}
        window.dispatchEvent(new CustomEvent("mx_people_node_detail_changed", { detail }));
        dis.dispatch({ action: Action.ViewHomePage, context_switch: true });
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
        const norm = (v: string): string => String(v || "").trim().toLowerCase();
        return items
            .filter((it) => matchesFilter(it, filter))
            .sort((a, b) => {
                const ad = norm(a.display_name);
                const bd = norm(b.display_name);
                if (ad && !bd) return -1;
                if (!ad && bd) return 1;
                const byDisplay = ad.localeCompare(bd);
                if (byDisplay !== 0) return byDisplay;
                return norm(a.node_id).localeCompare(norm(b.node_id));
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

            <div data-testid="people-list" role="listbox" aria-label={_t("common|people")} style={{ height: "100%", overflowY: "auto" }}>
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
        </>
    );
};
