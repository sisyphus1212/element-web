/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { mediaFromMxc } from "../../../../customisations/Media";
import Modal from "../../../../Modal";
import ImageView from "../../../views/elements/ImageView";
import SdkConfig from "../../../../SdkConfig";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { type Member } from "../../../views/right_panel/UserInfo";
import { useUserTimezone } from "../../../../hooks/useUserTimezone";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";

export interface PresenceInfo {
    lastActiveAgo: number | undefined;
    currentlyActive: boolean | undefined;
    state: string | undefined;
}

export interface TimezoneInfo {
    timezone: string;
    friendly: string;
}

export interface UserInfoHeaderState {
    /**
     * callback function when selected user avatar is clicked in user info
     */
    onMemberAvatarClick: () => void;
    /**
     * Object containing information about the precense of the selected user
     */
    precenseInfo: PresenceInfo;
    /**
     * Boolean that show or hide the precense information
     */
    showPresence: boolean;
    /**
     *  Timezone object
     */
    timezoneInfo: TimezoneInfo | null;
    /**
     * Displayed identifier for the selected user
     */
    userIdentifier: string | null;
}
interface UserInfoHeaderViewModelProps {
    member: Member;
    roomId?: string;
}

interface ManagerNodeItem {
    node_id: string;
    status: string;
    matrix_user_id?: string;
}

function normalizeMatrixId(value: string | undefined): string {
    return String(value || "").trim().toLowerCase();
}

function extractLocalpart(userId: string): string {
    const raw = String(userId || "").trim();
    if (!raw.startsWith("@")) return raw.toLowerCase();
    const idx = raw.indexOf(":");
    const local = idx > 1 ? raw.slice(1, idx) : raw.slice(1);
    return local.toLowerCase();
}

function parseNodeRows(body: any): ManagerNodeItem[] {
    if (!body?.ok || !Array.isArray(body?.items)) return [];
    return body.items
        .map((it: any) => ({
            node_id: String(it?.node_id || "").trim(),
            status: String(it?.status || "offline").trim().toLowerCase(),
            matrix_user_id: String(it?.matrix_user_id || "").trim(),
        }))
        .filter((it: ManagerNodeItem) => it.node_id);
}

/**
 * View model for the userInfoHeaderView
 * props
 * @see {@link UserInfoHeaderState} for more information about what this view model returns.
 */
export function useUserfoHeaderViewModel({ member, roomId }: UserInfoHeaderViewModelProps): UserInfoHeaderState {
    const cli = useContext(MatrixClientContext);
    const [nodeRows, setNodeRows] = useState<ManagerNodeItem[]>([]);

    let showPresence = true;

    const precenseInfo: PresenceInfo = {
        lastActiveAgo: undefined,
        currentlyActive: undefined,
        state: undefined,
    };

    const enablePresenceByHsUrl = SdkConfig.get("enable_presence_by_hs_url");

    const timezoneInfo = useUserTimezone(cli, member.userId);

    const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier?.(member.userId, {
        roomId,
        withDisplayName: true,
    });

    const onMemberAvatarClick = useCallback(() => {
        const avatarUrl = (member as RoomMember).getMxcAvatarUrl
            ? (member as RoomMember).getMxcAvatarUrl()
            : (member as User).avatarUrl;

        const httpUrl = mediaFromMxc(avatarUrl).srcHttp;
        if (!httpUrl) return;

        const params = {
            src: httpUrl,
            name: (member as RoomMember).name || (member as User).displayName,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }, [member]);

    useEffect(() => {
        let canceled = false;
        const refresh = async (): Promise<void> => {
            try {
                const rep = await fetch("/api/public/nodes", {
                    method: "GET",
                    cache: "no-store",
                });
                const body = await rep.json().catch(() => ({} as any));
                if (!canceled) setNodeRows(parseNodeRows(body));
            } catch {
                if (!canceled) setNodeRows([]);
            }
        };
        refresh();
        const timer = setInterval(refresh, 10000);
        return () => {
            canceled = true;
            clearInterval(timer);
        };
    }, []);

    if (member instanceof RoomMember && member.user) {
        precenseInfo.state = member.user.presence;
        precenseInfo.lastActiveAgo = member.user.lastActiveAgo;
        precenseInfo.currentlyActive = member.user.currentlyActive;
    }

    const nodeStatus = useMemo(() => {
        const targetUserId = normalizeMatrixId(member?.userId || "");
        const targetLocalpart = extractLocalpart(member?.userId || "");
        if (!targetUserId) return null;
        const matched =
            nodeRows.find((it) => {
                const mid = normalizeMatrixId(it.matrix_user_id);
                return mid && mid !== "-" && mid === targetUserId;
            }) ||
            nodeRows.find((it) => extractLocalpart(`@${it.node_id}`) === targetLocalpart) ||
            null;
        return matched ? matched.status : null;
    }, [member?.userId, nodeRows]);

    if (nodeStatus === "online") {
        precenseInfo.state = "online";
        precenseInfo.currentlyActive = true;
        precenseInfo.lastActiveAgo = 0;
    } else if (nodeStatus === "offline") {
        precenseInfo.state = "offline";
        precenseInfo.currentlyActive = false;
    }

    if (enablePresenceByHsUrl && enablePresenceByHsUrl[cli.baseUrl] !== undefined) {
        showPresence = enablePresenceByHsUrl[cli.baseUrl];
    }

    return {
        onMemberAvatarClick,
        showPresence,
        precenseInfo,
        timezoneInfo,
        userIdentifier,
    };
}
