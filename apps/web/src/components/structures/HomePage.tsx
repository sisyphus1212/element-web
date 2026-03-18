/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { useCallback, useContext, useEffect, useState } from "react";
import { ChatSolidIcon, ExploreIcon, GroupIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import AutoHideScrollbar from "./AutoHideScrollbar";
import { getHomePageUrl } from "../../utils/pages";
import { _t, _tDom } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import BaseAvatar from "../views/avatars/BaseAvatar";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import MatrixClientContext, { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import MiniAvatarUploader, { AVATAR_SIZE } from "../views/elements/MiniAvatarUploader";
import PosthogTrackers from "../../PosthogTrackers";
import EmbeddedPage from "./EmbeddedPage";

const onClickSendDm = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateChatButton", ev);
    dis.dispatch({ action: Action.CreateChat });
};

const onClickExplore = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeExploreRoomsButton", ev);
    dis.fire(Action.ViewRoomDirectory);
};

const onClickNewRoom = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateRoomButton", ev);
    dis.dispatch({ action: Action.CreateRoom });
};

interface IProps {
    justRegistered?: boolean;
}

interface PeopleSelectedNodeDetail {
    node_id: string;
    display_name: string;
    status: string;
    last_seen: number;
    matrix_user_id: string;
    threads_total?: number;
    threads_archived?: number;
    runtime_profiles_total?: number;
    runtime_profiles_default?: number;
    control_state?: {
        active_node_session_id?: string;
        active_codex_thread_id?: string;
        session_key?: string;
        active_runtime_profile_id?: string;
        matrix_route?: { matrix_room_id?: string; matrix_thread_id?: string };
    };
}

const loadSelectedNodeDetail = (): PeopleSelectedNodeDetail | null => {
    try {
        const raw = String(window.localStorage.getItem("mx_people_selected_node_detail") || "").trim();
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== "object") return null;
        const nodeId = String((obj as any).node_id || "").trim();
        if (!nodeId) return null;
        return obj as PeopleSelectedNodeDetail;
    } catch {
        return null;
    }
};

const getOwnProfile = (
    userId: string,
): {
    displayName: string;
    avatarUrl?: string;
} => ({
    displayName: OwnProfileStore.instance.displayName || userId,
    avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10)) ?? undefined,
});

const UserWelcomeTop: React.FC = () => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId()!;
    const [ownProfile, setOwnProfile] = useState(getOwnProfile(userId));
    useEventEmitter(OwnProfileStore.instance, UPDATE_EVENT, () => {
        setOwnProfile(getOwnProfile(userId));
    });

    return (
        <div>
            <MiniAvatarUploader
                hasAvatar={!!ownProfile.avatarUrl}
                hasAvatarLabel={_t("onboarding|has_avatar_label")}
                noAvatarLabel={_t("onboarding|no_avatar_label")}
                setAvatarUrl={(url) => cli.setAvatarUrl(url)}
                isUserAvatar
                onClick={(ev) => PosthogTrackers.trackInteraction("WebHomeMiniAvatarUploadButton", ev)}
            >
                <BaseAvatar
                    idName={userId}
                    name={ownProfile.displayName}
                    url={ownProfile.avatarUrl}
                    size={AVATAR_SIZE}
                />
            </MiniAvatarUploader>

            <h1>{_tDom("onboarding|welcome_user", { name: ownProfile.displayName })}</h1>
            <h2>{_tDom("onboarding|welcome_detail")}</h2>
        </div>
    );
};

const HomePage: React.FC<IProps> = ({ justRegistered = false }) => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);
    const [selectedNodeDetail, setSelectedNodeDetail] = useState<PeopleSelectedNodeDetail | null>(loadSelectedNodeDetail());

    const clearSelectedNodeDetail = useCallback((): void => {
        try {
            window.localStorage.removeItem("mx_people_selected_node_detail");
        } catch {}
        setSelectedNodeDetail(null);
    }, []);

    useEffect(() => {
        const onNodeDetailChanged = (ev: Event): void => {
            const ce = ev as CustomEvent<PeopleSelectedNodeDetail | null>;
            if (ce?.detail && typeof ce.detail === "object") {
                setSelectedNodeDetail(ce.detail);
                return;
            }
            setSelectedNodeDetail(loadSelectedNodeDetail());
        };
        const onStorage = (ev: StorageEvent): void => {
            if (ev.key !== "mx_people_selected_node_detail") return;
            setSelectedNodeDetail(loadSelectedNodeDetail());
        };
        window.addEventListener("mx_people_node_detail_changed", onNodeDetailChanged as EventListener);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("mx_people_node_detail_changed", onNodeDetailChanged as EventListener);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    if (selectedNodeDetail) {
        const st = String(selectedNodeDetail.status || "").toLowerCase() === "online" ? "online" : "offline";
        const lastSeen = Number(selectedNodeDetail.last_seen || 0);
        return (
            <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
                <div className="mx_HomePage_default_wrapper">
                    <div>
                        <h1>{_t("common|people")} Node Details</h1>
                        <h2>{selectedNodeDetail.node_id}</h2>
                        <div style={{ fontSize: 13, opacity: 0.8 }}>
                            Hostname: {selectedNodeDetail.display_name || "-"}
                        </div>
                    </div>
                    <div style={{ width: "min(920px, 100%)", textAlign: "left", border: "1px solid var(--cpd-color-border-subtle-primary)", borderRadius: 12, padding: 16 }}>
                        <div><b>node_id (System ID):</b> {selectedNodeDetail.node_id}</div>
                        <div><b>display_name (Hostname):</b> {selectedNodeDetail.display_name || "-"}</div>
                        <div><b>status:</b> {st}</div>
                        <div><b>matrix_user_id (MXID):</b> {selectedNodeDetail.matrix_user_id || "-"}</div>
                        <div><b>last_seen:</b> {lastSeen > 0 ? new Date(lastSeen).toLocaleString() : "-"}</div>
                        <div><b>active_node_session_id:</b> {selectedNodeDetail.control_state?.active_node_session_id || "-"}</div>
                        <div><b>active_codex_thread_id:</b> {selectedNodeDetail.control_state?.active_codex_thread_id || "-"}</div>
                        <div><b>session_key:</b> {selectedNodeDetail.control_state?.session_key || "-"}</div>
                        <div><b>matrix_room_id:</b> {selectedNodeDetail.control_state?.matrix_route?.matrix_room_id || "-"}</div>
                        <div><b>matrix_thread_id:</b> {selectedNodeDetail.control_state?.matrix_route?.matrix_thread_id || "-"}</div>
                        <div><b>threads:</b> {Number(selectedNodeDetail.threads_total || 0)} (archived {Number(selectedNodeDetail.threads_archived || 0)})</div>
                        <div><b>runtime_profiles:</b> {Number(selectedNodeDetail.runtime_profiles_total || 0)} (default {Number(selectedNodeDetail.runtime_profiles_default || 0)})</div>
                    </div>
                    <div className="mx_HomePage_default_buttons">
                        <AccessibleButton onClick={clearSelectedNodeDetail} className="mx_HomePage_button_explore">
                            {_t("action|close")}
                        </AccessibleButton>
                    </div>
                </div>
            </AutoHideScrollbar>
        );
    }

    let introSection: JSX.Element;
    if (justRegistered || !OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10))) {
        introSection = <UserWelcomeTop />;
    } else {
        const brandingConfig = SdkConfig.getObject("branding");
        const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo.svg";

        introSection = (
            <React.Fragment>
                <img src={logoUrl} alt={config.brand} />
                <h1>{_tDom("onboarding|intro_welcome", { appName: config.brand })}</h1>
                <h2>{_tDom("onboarding|intro_byline")}</h2>
            </React.Fragment>
        );
    }

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                {introSection}
                <div className="mx_HomePage_default_buttons">
                    <AccessibleButton onClick={onClickSendDm} className="mx_HomePage_button_sendDm">
                        <ChatSolidIcon />
                        {_tDom("onboarding|send_dm")}
                    </AccessibleButton>
                    <AccessibleButton onClick={onClickExplore} className="mx_HomePage_button_explore">
                        <ExploreIcon />
                        {_tDom("onboarding|explore_rooms")}
                    </AccessibleButton>
                    <AccessibleButton onClick={onClickNewRoom} className="mx_HomePage_button_createGroup">
                        <GroupIcon />
                        {_tDom("onboarding|create_room")}
                    </AccessibleButton>
                </div>
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;
