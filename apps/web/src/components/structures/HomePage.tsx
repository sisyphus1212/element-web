/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { useCallback, useContext, useEffect, useState } from "react";
import { ChatSolidIcon, ExploreIcon, GroupIcon, OverflowHorizontalIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";

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
import {
    activateCodexThread,
    createCodexThread,
    deleteCodexThread,
    fetchNodeModels,
    loadNodeBundle,
    updateCodexThread,
} from "../views/rooms/RoomListPanel/people/api";

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

interface ThreadItem {
    codex_thread_id: string;
    title: string;
    archived: boolean;
}

interface ThreadRowActionsMenuProps {
    item: ThreadItem;
    active: boolean;
    busy: boolean;
    onInfo: () => void;
    onRename: () => void;
    onSetActive: () => void;
    onToggleArchive: () => void;
    onModify: () => void;
    onDelete: () => void;
}

const ThreadRowActionsMenu: React.FC<ThreadRowActionsMenuProps> = ({
    item,
    active,
    busy,
    onInfo,
    onRename,
    onSetActive,
    onToggleArchive,
    onModify,
    onDelete,
}) => {
    const archived = Boolean(item.archived);
    const disabled = Boolean(busy);

    return (
        <Menu
            align="start"
            side="bottom"
            title="More Options"
            trigger={
                <IconButton aria-label="More Options" size="24px" disabled={disabled}>
                    <OverflowHorizontalIcon />
                </IconButton>
            }
        >
            <MenuItem label="Info" onSelect={onInfo} />
            <MenuItem label="Rename" onSelect={onRename} disabled={disabled} />
            <MenuItem label="Set Active" onSelect={onSetActive} disabled={disabled || archived || active} />
            <MenuItem label={archived ? "Unarchive" : "Archive"} onSelect={onToggleArchive} disabled={disabled} />
            <MenuItem label="Modify" onSelect={onModify} disabled={disabled} />
            <MenuItem label="Delete" onSelect={onDelete} kind="critical" disabled={disabled} />
        </Menu>
    );
};

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
    const [threadItems, setThreadItems] = useState<Array<{ codex_thread_id: string; title: string; archived: boolean }>>([]);
    const [activeThreadId, setActiveThreadId] = useState<string>("");
    const [selectedThreadId, setSelectedThreadId] = useState<string>("");
    const [threadDialogBusy, setThreadDialogBusy] = useState<boolean>(false);
    const [threadDialogError, setThreadDialogError] = useState<string>("");
    const [showNodeDetailPanel, setShowNodeDetailPanel] = useState<boolean>(false);
    const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
    const [threadFormMode, setThreadFormMode] = useState<"create" | "modify">("create");
    const [threadFormFromId, setThreadFormFromId] = useState<string>("");
    const [threadInfoTid, setThreadInfoTid] = useState<string>("");
    const [newThreadTitle, setNewThreadTitle] = useState<string>("");
    const [newThreadCwd, setNewThreadCwd] = useState<string>("");
    const [newThreadModel, setNewThreadModel] = useState<string>("");
    const [newThreadModelOptions, setNewThreadModelOptions] = useState<string[]>([]);
    const [newThreadSandbox, setNewThreadSandbox] = useState<string>("danger-full-access");
    const [newThreadApprovalPolicy, setNewThreadApprovalPolicy] = useState<string>("on-failure");
    const [newThreadPersonality, setNewThreadPersonality] = useState<string>("");
    const [newThreadSetActive, setNewThreadSetActive] = useState<boolean>(true);

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

    const refreshSelectedNodeBundle = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        if (!nodeId) return;
        const bundle = await loadNodeBundle(nodeId);
        const nextActiveTid = String(bundle.controlState?.active_codex_thread_id || "");
        setThreadItems(Array.isArray(bundle.threadItems) ? bundle.threadItems : []);
        setActiveThreadId(nextActiveTid);
        setSelectedThreadId(nextActiveTid);
        if (bundle.nodeDetail) {
            try {
                window.localStorage.setItem("mx_people_selected_node_detail", JSON.stringify(bundle.nodeDetail || {}));
            } catch {}
            setSelectedNodeDetail(bundle.nodeDetail);
        }
    }, [selectedNodeDetail?.node_id]);

    useEffect(() => {
        void refreshSelectedNodeBundle();
    }, [refreshSelectedNodeBundle]);

    useEffect(() => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        if (!nodeId) {
            setNewThreadModelOptions([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            const rows = await fetchNodeModels(nodeId).catch(() => []);
            if (cancelled) return;
            setNewThreadModelOptions(rows);
            if (!String(newThreadModel || "").trim() && rows.length > 0) {
                setNewThreadModel(rows[0]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [newThreadModel, selectedNodeDetail?.node_id]);

    const onCreateThread = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        if (!nodeId) return;
        const title = String(newThreadTitle || "").trim();
        if (!title) return;
        setThreadDialogBusy(true);
        setThreadDialogError("");
        try {
            await createCodexThread(nodeId, {
                title,
                set_active: newThreadSetActive,
                cwd: String(newThreadCwd || "").trim() || undefined,
                model: String(newThreadModel || "").trim() || undefined,
                sandbox: String(newThreadSandbox || "").trim() || undefined,
                approval_policy: String(newThreadApprovalPolicy || "").trim() || undefined,
                personality: String(newThreadPersonality || "").trim() || undefined,
            });
            await refreshSelectedNodeBundle();
            setShowCreateForm(false);
            setNewThreadTitle("");
            setNewThreadCwd("");
            setNewThreadModel("");
            setNewThreadSandbox("danger-full-access");
            setNewThreadApprovalPolicy("on-failure");
            setNewThreadPersonality("");
            setNewThreadSetActive(true);
        } catch (e) {
            setThreadDialogError(`Create thread failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setThreadDialogBusy(false);
        }
    }, [
        newThreadApprovalPolicy,
        newThreadCwd,
        newThreadModel,
        newThreadPersonality,
        newThreadSandbox,
        newThreadSetActive,
        newThreadTitle,
        refreshSelectedNodeBundle,
        selectedNodeDetail?.node_id,
    ]);

    const openCreateThreadForm = useCallback((): void => {
        setThreadFormMode("create");
        setThreadFormFromId("");
        setShowCreateForm(true);
    }, []);

    const openModifyThreadForm = useCallback(
        (thread: ThreadItem): void => {
            const tid = String(thread.codex_thread_id || "").trim();
            const title = String(thread.title || "").trim();
            setThreadFormMode("modify");
            setThreadFormFromId(tid);
            setNewThreadTitle(title ? `${title}-copy` : "");
            setShowCreateForm(true);
        },
        [setNewThreadTitle],
    );

    const onApplyThreadSwitch = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        const nextTid = String(selectedThreadId || "").trim();
        if (!nodeId || !nextTid || nextTid === activeThreadId) return;
        setThreadDialogBusy(true);
        setThreadDialogError("");
        try {
            await activateCodexThread(nodeId, nextTid);
            await refreshSelectedNodeBundle();
        } catch (e) {
            setThreadDialogError(`Switch thread failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setThreadDialogBusy(false);
        }
    }, [activeThreadId, refreshSelectedNodeBundle, selectedNodeDetail?.node_id, selectedThreadId]);

    const onRenameThread = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        const tid = String(selectedThreadId || "").trim();
        if (!nodeId || !tid) return;
        const current = threadItems.find((it) => String(it.codex_thread_id || "") === tid);
        const nextTitle = window.prompt("Thread title", String(current?.title || tid));
        if (nextTitle === null) return;
        setThreadDialogBusy(true);
        setThreadDialogError("");
        try {
            await updateCodexThread(nodeId, tid, { title: String(nextTitle || "").trim() });
            await refreshSelectedNodeBundle();
        } catch (e) {
            setThreadDialogError(`Rename thread failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setThreadDialogBusy(false);
        }
    }, [refreshSelectedNodeBundle, selectedNodeDetail?.node_id, selectedThreadId, threadItems]);

    const onToggleArchiveThread = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        const tid = String(selectedThreadId || "").trim();
        if (!nodeId || !tid) return;
        const cur = threadItems.find((it) => String(it.codex_thread_id || "") === tid);
        const nextArchived = !Boolean(cur?.archived);
        setThreadDialogBusy(true);
        setThreadDialogError("");
        try {
            await updateCodexThread(nodeId, tid, { archived: nextArchived });
            await refreshSelectedNodeBundle();
        } catch (e) {
            setThreadDialogError(`${nextArchived ? "Archive" : "Unarchive"} thread failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setThreadDialogBusy(false);
        }
    }, [refreshSelectedNodeBundle, selectedNodeDetail?.node_id, selectedThreadId, threadItems]);

    const onDeleteThread = useCallback(async (): Promise<void> => {
        const nodeId = String(selectedNodeDetail?.node_id || "").trim();
        const tid = String(selectedThreadId || "").trim();
        if (!nodeId || !tid) return;
        if (!window.confirm(`Delete thread ${tid}?`)) return;
        setThreadDialogBusy(true);
        setThreadDialogError("");
        try {
            await deleteCodexThread(nodeId, tid);
            await refreshSelectedNodeBundle();
            setSelectedThreadId("");
        } catch (e) {
            setThreadDialogError(`Delete thread failed: ${String((e as Error)?.message || e)}`);
        } finally {
            setThreadDialogBusy(false);
        }
    }, [refreshSelectedNodeBundle, selectedNodeDetail?.node_id, selectedThreadId]);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    if (selectedNodeDetail) {
        const st = String(selectedNodeDetail.status || "").toLowerCase() === "online" ? "online" : "offline";
        const lastSeen = Number(selectedNodeDetail.last_seen || 0);
        return (
            <AutoHideScrollbar
                className="mx_HomePage mx_HomePage_default"
                element="main"
                style={{ maxWidth: "none", width: "100%" }}
            >
                <div
                    className="mx_HomePage_default_wrapper"
                    style={{
                        width: "100%",
                        maxWidth: "none",
                        margin: 0,
                        padding: "24px clamp(16px, 3vw, 36px)",
                        boxSizing: "border-box",
                    }}
                >
                    <div>
                        <h1>{_t("common|people")} Node Details</h1>
                        <h2>{selectedNodeDetail.node_id}</h2>
                        <div style={{ fontSize: 13, opacity: 0.8 }}>
                            Hostname: {selectedNodeDetail.display_name || "-"}
                        </div>
                    </div>
                    <div
                        style={{
                            width: "100%",
                            maxWidth: "none",
                            textAlign: "left",
                            border: "1px solid var(--cpd-color-border-subtle-primary)",
                            borderRadius: 12,
                            padding: 16,
                            minHeight: "clamp(520px, 74vh, 1040px)",
                            boxSizing: "border-box",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 16 }}>
                                Codex Threads
                            </div>
                            <div className="mx_Dialog_buttons">
                                <AccessibleButton
                                    element="button"
                                    kind="secondary"
                                    onClick={() => setShowNodeDetailPanel(true)}
                                >
                                    View Node Details
                                </AccessibleButton>
                                <AccessibleButton element="button" kind="secondary" onClick={openCreateThreadForm}>
                                    Create Thread
                                </AccessibleButton>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, marginBottom: 10 }}>
                            active_codex_thread_id: {activeThreadId || "-"}
                        </div>
                        {threadItems.length === 0 ? (
                            <div className="mx_InlineNotice">{_t("common|no_results")}</div>
                        ) : (
                            <div
                                role="listbox"
                                aria-label="Codex thread list"
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: "auto",
                                    paddingRight: 4,
                                }}
                            >
                                {threadItems.map((it) => {
                                    const tid = String(it.codex_thread_id || "");
                                    const selected = Boolean(tid && tid === selectedThreadId);
                                    const active = Boolean(tid && tid === activeThreadId);
                                    const archived = Boolean(it.archived);
                                    const title = String(it.title || "").trim() || tid;
                                    return (
                                        <div
                                            key={tid}
                                            style={{
                                                padding: "10px 12px",
                                                borderRadius: 8,
                                                border: selected
                                                    ? "1px solid var(--cpd-color-border-interactive-accent)"
                                                    : "1px solid var(--cpd-color-border-subtle-primary)",
                                                background: selected
                                                    ? "var(--cpd-color-bg-subtle-secondary)"
                                                    : "var(--cpd-color-bg-canvas-default)",
                                                width: "100%",
                                                boxSizing: "border-box",
                                                display: "flex",
                                                gap: 8,
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <AccessibleButton
                                                element="button"
                                                role="option"
                                                aria-selected={selected}
                                                onClick={() => setSelectedThreadId(tid)}
                                                style={{
                                                    textAlign: "left",
                                                    minWidth: 0,
                                                    flex: 1,
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                                    <span style={{ fontWeight: 600 }}>{title}</span>
                                                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                                                        {active ? "active" : archived ? "archived" : ""}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 12, opacity: 0.78 }}>{tid}</div>
                                            </AccessibleButton>
                                            <div>
                                                <ThreadRowActionsMenu
                                                    item={it}
                                                    active={active}
                                                    busy={threadDialogBusy}
                                                    onInfo={() => setThreadInfoTid(tid)}
                                                    onRename={() => {
                                                        setSelectedThreadId(tid);
                                                        void onRenameThread();
                                                    }}
                                                    onSetActive={() => {
                                                        setSelectedThreadId(tid);
                                                        void onApplyThreadSwitch();
                                                    }}
                                                    onToggleArchive={() => {
                                                        setSelectedThreadId(tid);
                                                        void onToggleArchiveThread();
                                                    }}
                                                    onModify={() => openModifyThreadForm(it)}
                                                    onDelete={() => {
                                                        setSelectedThreadId(tid);
                                                        void onDeleteThread();
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {threadDialogError ? (
                            <div className="mx_InlineError" style={{ marginTop: 12 }}>
                                {threadDialogError}
                            </div>
                        ) : null}
                    </div>
                    {threadInfoTid ? (
                        <div className="mx_Dialog_wrapper">
                            <div className="mx_Dialog_background" onClick={() => setThreadInfoTid("")} />
                            <div className="mx_Dialog_border">
                                <div className="mx_Dialog mx_Dialog_fixedWidth">
                                    <div className="mx_Dialog_header">
                                        <h1 className="mx_Heading_h3 mx_Dialog_title">Codex Thread Info</h1>
                                    </div>
                                    <div className="mx_Dialog_content">
                                        {(() => {
                                            const row = threadItems.find((it) => String(it.codex_thread_id || "") === threadInfoTid);
                                            return (
                                                <div style={{ display: "grid", gap: 8 }}>
                                                    <div><b>title:</b> {String(row?.title || row?.codex_thread_id || "-")}</div>
                                                    <div><b>codex_thread_id:</b> {threadInfoTid}</div>
                                                    <div><b>state:</b> {row?.archived ? "archived" : "normal"}</div>
                                                    <div><b>active:</b> {threadInfoTid === activeThreadId ? "yes" : "no"}</div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="mx_Dialog_buttons">
                                        <AccessibleButton element="button" kind="secondary" onClick={() => setThreadInfoTid("")}>
                                            Close
                                        </AccessibleButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    {showCreateForm ? (
                        <div className="mx_Dialog_wrapper">
                            <div className="mx_Dialog_background" onClick={() => setShowCreateForm(false)} />
                            <div className="mx_Dialog_border">
                                <div className="mx_Dialog mx_Dialog_fixedWidth">
                                    <div className="mx_Dialog_header">
                                        <h1 className="mx_Heading_h3 mx_Dialog_title">
                                            {threadFormMode === "modify" ? "Modify (Create Derived Thread)" : "Create Codex Thread"}
                                        </h1>
                                    </div>
                                    <div className="mx_Dialog_content">
                                        {threadFormMode === "modify" ? (
                                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
                                                Source thread: {threadFormFromId || "-"}
                                            </div>
                                        ) : null}
                                        <div style={{ display: "grid", gap: 10 }}>
                                            <div>
                                                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Title</div>
                                                <input
                                                    value={newThreadTitle}
                                                    onChange={(e) => setNewThreadTitle(e.target.value)}
                                                    placeholder="e.g. debug-session"
                                                    style={{
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        padding: 10,
                                                        borderRadius: 8,
                                                        border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>CWD (optional)</div>
                                                <input
                                                    value={newThreadCwd}
                                                    onChange={(e) => setNewThreadCwd(e.target.value)}
                                                    placeholder="/root/work/project"
                                                    style={{
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        padding: 10,
                                                        borderRadius: 8,
                                                        border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Model (optional)</div>
                                                {newThreadModelOptions.length > 0 ? (
                                                    <select
                                                        value={newThreadModel}
                                                        onChange={(e) => setNewThreadModel(e.target.value)}
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: 10,
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                            background: "var(--cpd-color-bg-canvas-default)",
                                                        }}
                                                    >
                                                        {newThreadModelOptions.map((m) => (
                                                            <option key={m} value={m}>
                                                                {m}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        value={newThreadModel}
                                                        onChange={(e) => setNewThreadModel(e.target.value)}
                                                        placeholder="gpt-5-codex"
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: 10,
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Sandbox</div>
                                                    <select
                                                        value={newThreadSandbox}
                                                        onChange={(e) => setNewThreadSandbox(e.target.value)}
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: 10,
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                            background: "var(--cpd-color-bg-canvas-default)",
                                                        }}
                                                    >
                                                        <option value="danger-full-access">danger-full-access</option>
                                                        <option value="workspace-write">workspace-write</option>
                                                        <option value="read-only">read-only</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Approval policy</div>
                                                    <select
                                                        value={newThreadApprovalPolicy}
                                                        onChange={(e) => setNewThreadApprovalPolicy(e.target.value)}
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: 10,
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                            background: "var(--cpd-color-bg-canvas-default)",
                                                        }}
                                                    >
                                                        <option value="on-failure">on-failure</option>
                                                        <option value="on-request">on-request</option>
                                                        <option value="never">never</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Personality (optional)</div>
                                                <input
                                                    value={newThreadPersonality}
                                                    onChange={(e) => setNewThreadPersonality(e.target.value)}
                                                    placeholder="default"
                                                    style={{
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        padding: 10,
                                                        borderRadius: 8,
                                                        border: "1px solid var(--cpd-color-border-subtle-primary)",
                                                    }}
                                                />
                                            </div>
                                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={newThreadSetActive}
                                                    onChange={(e) => setNewThreadSetActive(Boolean(e.target.checked))}
                                                />
                                                Set as active after create
                                            </label>
                                        </div>
                                    </div>
                                    <div className="mx_Dialog_buttons">
                                        <AccessibleButton element="button" kind="secondary" onClick={() => setShowCreateForm(false)}>
                                            {_t("action|cancel")}
                                        </AccessibleButton>
                                        <AccessibleButton
                                            element="button"
                                            kind="primary"
                                            onClick={() => void onCreateThread()}
                                            disabled={threadDialogBusy || !String(newThreadTitle || "").trim()}
                                        >
                                            {threadDialogBusy ? _t("common|loading") : _t("action|create")}
                                        </AccessibleButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    {showNodeDetailPanel ? (
                        <div className="mx_Dialog_wrapper">
                            <div className="mx_Dialog_background" onClick={() => setShowNodeDetailPanel(false)} />
                            <div className="mx_Dialog_border" style={{ marginLeft: "auto", marginRight: 0, height: "100%" }}>
                                <div className="mx_Dialog" style={{ width: "min(720px, 100vw)", height: "100%", overflowY: "auto" }}>
                                    <div className="mx_Dialog_header">
                                        <h1 className="mx_Heading_h3 mx_Dialog_title">Node Details - {selectedNodeDetail.node_id}</h1>
                                    </div>
                                    <div className="mx_Dialog_content" style={{ lineHeight: 1.7 }}>
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
                                    <div className="mx_Dialog_buttons">
                                        <AccessibleButton element="button" kind="secondary" onClick={() => setShowNodeDetailPanel(false)}>
                                            {_t("action|close")}
                                        </AccessibleButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="mx_Dialog_buttons">
                        <AccessibleButton element="button" kind="secondary" onClick={clearSelectedNodeDetail}>
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
