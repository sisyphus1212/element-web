/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import BaseAvatar from "../../../avatars/BaseAvatar";
import roomListItemStyles from "../../../../../../../../packages/shared-components/src/room-list/RoomListItemView/RoomListItemView.module.css";
import type { PeopleNodeItem } from "./types";

type Props = {
    item: PeopleNodeItem;
    selected: boolean;
    pending: boolean;
    index: number;
    count: number;
    onSelect: (nodeId: string) => void;
    selectedClassName?: string;
    unselectedClassName?: string;
    firstClassName?: string;
    lastClassName?: string;
    containerClassName?: string;
    contentClassName?: string;
    ellipsisClassName?: string;
    roomNameClassName?: string;
    hoverMenuClassName?: string;
    notificationDecorationClassName?: string;
};

export const PeopleNodeListItem: React.FC<Props> = ({
    item,
    selected,
    pending,
    index,
    count,
    onSelect,
    selectedClassName,
    unselectedClassName,
    firstClassName,
    lastClassName,
    containerClassName,
    contentClassName,
    ellipsisClassName,
    roomNameClassName,
    hoverMenuClassName,
    notificationDecorationClassName,
}) => {
    const nodeId = String(item.node_id || "").trim();
    const hostLabel = String(item.display_name || "").trim();
    const showHostLabel = Boolean(hostLabel && hostLabel !== nodeId);
    const rowLabel = showHostLabel ? `${nodeId} · ${hostLabel}` : nodeId;
    const rowClass = classNames(
        roomListItemStyles.roomListItem,
        "mx_RoomListItemView",
        {
            [roomListItemStyles.selected]: selected,
            [roomListItemStyles.firstItem]: index === 0,
            [roomListItemStyles.lastItem]: index === count - 1,
            mx_RoomListItemView_selected: selected,
        },
        selected ? selectedClassName : unselectedClassName,
    );

    return (
        <button
            type="button"
            role="option"
            aria-posinset={index + 1}
            aria-setsize={count}
            aria-selected={selected}
            aria-label={showHostLabel ? `Select node ${nodeId} (${hostLabel})` : `Select node ${nodeId}`}
            data-people-node-id={item.node_id}
            className={rowClass}
            onMouseDown={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            }}
            onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                onSelect(item.node_id);
            }}
        >
            <div
                className={classNames(roomListItemStyles.container, containerClassName)}
                style={{ display: "flex", alignItems: "center", minWidth: 0 }}
            >
                <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />
                <div
                    className={classNames(roomListItemStyles.content, contentClassName)}
                    style={{ display: "flex", alignItems: "center", minWidth: 0 }}
                >
                    <div className={classNames(roomListItemStyles.ellipsis, ellipsisClassName)}>
                        <div
                            className={classNames(roomListItemStyles.roomName, roomNameClassName)}
                            title={showHostLabel ? `${nodeId} (${hostLabel})` : nodeId}
                            data-testid="room-name"
                            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                        >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowLabel}</span>
                        </div>
                    </div>
                    <div className={classNames(roomListItemStyles.hoverMenu, hoverMenuClassName)} />
                    <div className={classNames(roomListItemStyles.notificationDecoration, notificationDecorationClassName)} aria-hidden={true}>
                        {pending ? <span style={{ fontSize: 11, opacity: 0.7 }}>Loading…</span> : null}
                    </div>
                </div>
            </div>
        </button>
    );
};
