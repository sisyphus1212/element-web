/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import AccessibleButton from "../elements/AccessibleButton";

interface ThreadItem {
    codex_thread_id: string;
    title: string;
    archived: boolean;
}

interface IProps {
    nodeId: string;
    items: ThreadItem[];
    activeThreadId: string;
    selectedThreadId: string;
    busy?: boolean;
    error?: string;
    onSelectThread: (threadId: string) => void;
    onCreateThread: () => void;
    onApplySwitch: () => void;
    onFinished: (ok?: boolean) => void;
}

const NodeThreadManagerDialog: React.FC<IProps> = ({
    nodeId,
    items,
    activeThreadId,
    selectedThreadId,
    busy = false,
    error = "",
    onSelectThread,
    onCreateThread,
    onApplySwitch,
    onFinished,
}) => {
    return (
        <BaseDialog
            className="mx_NodeThreadManagerDialog"
            onFinished={() => onFinished(false)}
            title={`${_t("common|people")} Codex Threads - ${nodeId}`}
            fixedWidth={true}
        >
            <div className="mx_Dialog_content" style={{ maxHeight: 420, overflowY: "auto" }}>
                {items.length === 0 ? (
                    <div className="mx_InlineNotice">{_t("common|no_results")}</div>
                ) : (
                    <div role="listbox" aria-label="Codex thread list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {items.map((it) => {
                            const tid = String(it.codex_thread_id || "");
                            const selected = Boolean(tid && tid === selectedThreadId);
                            const active = Boolean(tid && tid === activeThreadId);
                            const archived = Boolean(it.archived);
                            const title = String(it.title || "").trim() || tid;
                            return (
                                <AccessibleButton
                                    key={tid}
                                    role="option"
                                    aria-selected={selected}
                                    disabled={archived || busy}
                                    onClick={() => onSelectThread(tid)}
                                    style={{
                                        padding: 10,
                                        borderRadius: 8,
                                        border: selected ? "1px solid var(--cpd-color-border-interactive-accent)" : "1px solid var(--cpd-color-border-subtle-primary)",
                                        background: selected ? "var(--cpd-color-bg-subtle-secondary)" : "var(--cpd-color-bg-canvas-default)",
                                        textAlign: "left",
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
                            );
                        })}
                    </div>
                )}
                {error ? <div className="mx_InlineError" style={{ marginTop: 12 }}>{error}</div> : null}
            </div>
            <DialogButtons
                primaryButton={busy ? _t("common|loading") : _t("action|apply")}
                onPrimaryButtonClick={onApplySwitch}
                primaryDisabled={busy || !selectedThreadId || selectedThreadId === activeThreadId}
                hasCancel={true}
                onCancel={() => onFinished(false)}
            >
                <AccessibleButton onClick={onCreateThread} disabled={busy}>
                    {_t("action|create")}
                </AccessibleButton>
            </DialogButtons>
        </BaseDialog>
    );
};

export default NodeThreadManagerDialog;
