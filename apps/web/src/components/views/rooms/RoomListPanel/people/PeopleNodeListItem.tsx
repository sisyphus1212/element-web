/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import BaseAvatar from "../../../avatars/BaseAvatar";
import type { PeopleNodeItem } from "./types";

type Props = {
    item: PeopleNodeItem;
    selected: boolean;
    pending: boolean;
    index: number;
    count: number;
    onSelect: (nodeId: string) => void;
};

function isOnline(status: string): boolean {
    return String(status || "").toLowerCase() === "online";
}

export const PeopleNodeListItem: React.FC<Props> = ({ item, selected, pending, index, count, onSelect }) => {
    return (
        <button
            type="button"
            role="option"
            aria-posinset={index + 1}
            aria-setsize={count}
            aria-selected={selected}
            aria-label={`Select node ${item.display_name}`}
            data-people-node-id={item.node_id}
            className="mx_PeopleNodeListItem"
            onMouseDown={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            }}
            onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                onSelect(item.node_id);
            }}
            style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                border: "none",
                borderRadius: 8,
                background: selected ? "var(--cpd-color-bg-canvas-default)" : "transparent",
                textAlign: "left",
                cursor: "pointer",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: isOnline(item.status) ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.display_name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        @{item.node_id}
                    </div>
                </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{pending ? "Loading…" : item.status}</div>
        </button>
    );
};
