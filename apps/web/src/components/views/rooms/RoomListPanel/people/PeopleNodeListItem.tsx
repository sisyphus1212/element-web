/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { RoomListItemView, type RoomItemViewModel, type RoomListItemSnapshot } from "@element-hq/web-shared-components";

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

export const PeopleNodeListItem: React.FC<Props> = ({
    item,
    selected,
    pending,
    index,
    count,
    onSelect,
}) => {
    const snapshot: RoomListItemSnapshot = {
        id: item.node_id,
        room: { roomId: item.node_id },
        name: item.display_name,
        isBold: false,
        notification: {
            count: 0,
            hasUnreadCount: false,
            hasUnreadIcon: false,
            isMention: false,
            invited: false,
            isUnsentMessage: false,
        },
        showMoreOptionsMenu: false,
        showNotificationMenu: false,
        isFavourite: false,
        isLowPriority: false,
        canInvite: false,
        canCopyRoomLink: false,
        canMarkAsRead: false,
        canMarkAsUnread: false,
        roomNotifState: "all_messages",
    };

    const vm: RoomItemViewModel = {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
        onOpenRoom: () => onSelect(item.node_id),
        onMarkAsRead: () => {},
        onMarkAsUnread: () => {},
        onToggleFavorite: () => {},
        onToggleLowPriority: () => {},
        onInvite: () => {},
        onCopyRoomLink: () => {},
        onLeaveRoom: () => {},
        onSetRoomNotifState: () => {},
    };

    return (
        <div
            data-people-node-id={item.node_id}
            onMouseDown={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            }}
            className={rowClass}
        >
            <RoomListItemView
                vm={vm}
                isSelected={selected}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={index}
                roomCount={count}
                onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onSelect(item.node_id);
                }}
                renderAvatar={() => <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />}
            />
        </div>
    );
};
