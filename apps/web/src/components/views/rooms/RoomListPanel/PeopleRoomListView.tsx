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
    const [activeRoute, setActiveRoute] = useState<string>(currentHashRoute());
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    useEffect(() => {
        const onHashChange = (): void => setActiveRoute(currentHashRoute());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
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

    const onOpenNode = useCallback(
        async (nodeId: string) => {
            const id = String(nodeId || "");
            if (!id) return;
            setResolvingNodeId(id);
            setError("");
            try {
                const token = await ensureManagerToken();
                const response = await fetch(`/api/public/nodes/resolve-route?node_id=${encodeURIComponent(id)}`, {
                    method: "GET",
                    cache: "no-store",
                    headers: { Authorization: `Bearer ${token}` },
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
        },
        [reloadNodes],
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
                        const route = normalizeRoute(it.last_room_route);
                        const selected = route !== "" && route === activeRoute;
                        const pending = resolvingNodeId === it.node_id;
                        const snapshot = makeSnapshot(it, pending);
                        const vm = makeVm(snapshot, () => {
                            void onOpenNode(it.node_id);
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
        </>
    );
};
