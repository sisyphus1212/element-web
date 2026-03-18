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
            aria-label={`Select node ${item.display_name}`}
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
            <div className={classNames(roomListItemStyles.container, containerClassName)}>
                <BaseAvatar name={item.display_name} idName={item.node_id} size="32px" />
                <div className={classNames(roomListItemStyles.content, contentClassName)}>
                    <div className={classNames(roomListItemStyles.ellipsis, ellipsisClassName)}>
                        <div className={classNames(roomListItemStyles.roomName, roomNameClassName)} title={item.display_name} data-testid="room-name">
                            {item.display_name}
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
