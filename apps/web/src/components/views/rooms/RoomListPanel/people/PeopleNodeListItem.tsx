/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo } from "react";

import BaseAvatar from "../../../avatars/BaseAvatar";
import { RoomListItemView, RoomNotifState, type RoomListItemSnapshot, type RoomItemViewModel } from "@element-hq/web-shared-components";
import type { PeopleNodeItem } from "./types";

type Props = {
    item: PeopleNodeItem;
    selected: boolean;
    pending: boolean;
    index: number;
    count: number;
    onSelect: (nodeId: string) => void;
};

export const PeopleNodeListItem: React.FC<Props> = ({
    item,
    selected,
    pending,
    index,
    count,
    onSelect,
}) => {
    const nodeId = String(item.node_id || "").trim();
    const hostLabel = String(item.display_name || "").trim();
    const showHostLabel = Boolean(hostLabel && hostLabel !== nodeId);
    const rowLabel = showHostLabel ? `${nodeId} · ${hostLabel}` : nodeId;
    const snapshot = useMemo<RoomListItemSnapshot>(
        () => ({
            id: item.node_id,
            room: { name: rowLabel },
            name: rowLabel,
            isBold: false,
            messagePreview: undefined,
            notification: {
                hasAnyNotificationOrActivity: false,
                isUnsentMessage: false,
                invited: false,
                isMention: false,
                isActivityNotification: false,
                isNotification: false,
                hasUnreadCount: false,
                count: 0,
                muted: false,
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
        }),
        [item.node_id, rowLabel],
    );

    const vm = useMemo<RoomItemViewModel>(
        () =>
            ({
                getSnapshot: () => snapshot,
                subscribe: () => () => undefined,
                onOpenRoom: () => onSelect(item.node_id),
                onMarkAsRead: () => undefined,
                onMarkAsUnread: () => undefined,
                onToggleFavorite: () => undefined,
                onToggleLowPriority: () => undefined,
                onInvite: () => undefined,
                onCopyRoomLink: () => undefined,
                onLeaveRoom: () => undefined,
                onSetRoomNotifState: () => undefined,
            }) as RoomItemViewModel,
        [snapshot, onSelect, item.node_id],
    );

    return (
        <RoomListItemView
            vm={vm}
            isSelected={selected}
            isFocused={false}
            onFocus={() => undefined}
            roomIndex={index}
            roomCount={count}
            renderAvatar={() => <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />}
            data-people-node-id={item.node_id}
        />
    );
};
