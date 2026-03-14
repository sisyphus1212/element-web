/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";

type PeopleFilter = "all" | "online" | "offline";

interface PeopleNodeItem {
    node_id: string;
    display_name: string;
    status: string;
    last_room_route: string;
}

function currentHashRoute(): string {
    const raw = String(window.location.hash || "").trim();
    if (!raw) return "";
    return raw.startsWith("#") ? raw : `#${raw}`;
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

export const PeopleRoomListView: React.FC = (): JSX.Element => {
    const [items, setItems] = useState<PeopleNodeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [resolvingNodeId, setResolvingNodeId] = useState<string>("");
    const [filter, setFilter] = useState<PeopleFilter>("all");
    const [error, setError] = useState<string>("");
    const [activeRoute, setActiveRoute] = useState<string>(currentHashRoute());

    useEffect(() => {
        const onHashChange = (): void => setActiveRoute(currentHashRoute());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const reloadNodes = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/public/nodes", { method: "GET", cache: "no-store" });
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

    const onOpenNode = useCallback(async (nodeId: string) => {
        const id = String(nodeId || "");
        if (!id) return;
        setResolvingNodeId(id);
        setError("");
        try {
            const response = await fetch(`/api/public/nodes/resolve-route?node_id=${encodeURIComponent(id)}`, {
                method: "GET",
                cache: "no-store",
            });
            const body = await response.json();
            if (!body?.ok || !body?.route) {
                throw new Error(String(body?.error || "resolve_route_failed"));
            }
            const route = normalizeRoute(String(body.route || ""));
            if (!route) {
                throw new Error("empty_route");
            }
            window.location.hash = route;
            setActiveRoute(route);
            void reloadNodes();
        } catch (e) {
            setError(`Open node failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setResolvingNodeId("");
        }
    }, [reloadNodes]);

    const filterButton = (name: PeopleFilter, label: string): JSX.Element => {
        const selected = filter === name;
        return (
            <button
                key={name}
                type="button"
                role="option"
                className={classNames("mx_AccessibleButton", { mx_AccessibleButton_hasKind: selected })}
                aria-selected={selected}
                onClick={() => setFilter(name)}
            >
                {label}
            </button>
        );
    };

    return (
        <>
            <div data-testid="primary-filters" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div role="listbox" aria-label="Room list filters" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {filterButton("all", "All")}
                    {filterButton("online", "Online")}
                    {filterButton("offline", "Offline")}
                </div>
            </div>

            {error && <div className="mx_InlineError">{error}</div>}

            <div
                data-testid="room-list"
                role="listbox"
                aria-label={_t("room_list|list_title")}
                className="mx_AutoHideScrollbar"
                style={{ height: "100%", overflowY: "auto" }}
            >
                {loading ? (
                    <div className="mx_RoomSublist_empty">{_t("common|loading")}</div>
                ) : visibleItems.length === 0 ? (
                    <div className="mx_RoomSublist_empty">{_t("common|no_results")}</div>
                ) : (
                    visibleItems.map((it, index) => {
                        const selected = normalizeRoute(it.last_room_route) !== "" && normalizeRoute(it.last_room_route) === activeRoute;
                        const pending = resolvingNodeId === it.node_id;
                        return (
                            <button
                                key={it.node_id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                aria-posinset={index + 1}
                                aria-setsize={visibleItems.length}
                                aria-label={`Open person ${it.display_name}`}
                                className={classNames("mx_RoomListItemView", {
                                    mx_RoomListItemView_selected: selected,
                                })}
                                onClick={() => void onOpenNode(it.node_id)}
                            >
                                <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div data-testid="room-name" title={it.display_name}>
                                            {it.display_name}
                                        </div>
                                        <div className="mx_RoomTile_subtitle">@{it.node_id}</div>
                                    </div>
                                    <div aria-hidden="true" style={{ opacity: 0.7, fontSize: "12px" }}>
                                        {pending ? _t("common|loading") : isOnline(it.status) ? "online" : "offline"}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </>
    );
};
