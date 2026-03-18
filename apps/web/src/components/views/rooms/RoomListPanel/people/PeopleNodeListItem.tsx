/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo } from "react";
import {
    MockViewModel,
    RoomListItemView,
    RoomNotifState,
    type RoomItemViewModel,
    type RoomListItemSnapshot,
} from "@element-hq/web-shared-components";

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

function buildSnapshot(item: PeopleNodeItem): RoomListItemSnapshot {
    return {
        id: item.node_id,
        room: item,
        name: item.display_name,
        isBold: false,
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
        roomNotifState: RoomNotifState.MentionsAndKeywordsOnly,
        messagePreview: pending ? "Loading…" : undefined,
    };
}

export const PeopleNodeListItem: React.FC<Props> = ({ item, selected, pending, index, count, onSelect }) => {
    const vm = useMemo(() => {
        const base = new MockViewModel<RoomListItemSnapshot>(buildSnapshot(item));
        const roomVm: RoomItemViewModel = {
            ...base,
            onOpenRoom: () => onSelect(item.node_id),
            onMarkAsRead: () => undefined,
            onMarkAsUnread: () => undefined,
            onToggleFavorite: () => undefined,
            onToggleLowPriority: () => undefined,
            onInvite: () => undefined,
            onCopyRoomLink: () => undefined,
            onLeaveRoom: () => undefined,
            onSetRoomNotifState: () => undefined,
        };
        return roomVm;
    }, [item, onSelect, pending]);

    return (
        <RoomListItemView
            vm={vm}
            isSelected={selected}
            isFocused={false}
            roomIndex={index}
            roomCount={count}
            onFocus={() => undefined}
            renderAvatar={() => <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />}
        />
    );
};
