export type PeopleFilter = "all" | "online" | "offline";

export interface PeopleNodeItem {
    node_id: string;
    display_name: string;
    status: string;
    matrix_user_id: string;
}

export interface NodeControlState {
    active_node_session_id: string;
    active_codex_thread_id: string;
    active_runtime_profile_id: string;
    matrix_route?: { matrix_room_id?: string; matrix_thread_id?: string };
}

export interface RuntimeProfileItem {
    runtime_profile_id: string;
    version: number;
    is_default: boolean;
    config?: Record<string, unknown>;
}

export interface NodeDetailItem {
    node_id: string;
    display_name: string;
    status: string;
    last_seen: number;
    matrix_user_id: string;
    threads_total?: number;
    threads_archived?: number;
    runtime_profiles_total?: number;
    runtime_profiles_default?: number;
    control_state?: NodeControlState;
}

export interface NodeBundle {
    controlState: NodeControlState | null;
    threadItems: Array<{ codex_thread_id: string; title: string; archived: boolean }>;
    runtimeProfiles: RuntimeProfileItem[];
    nodeDetail: NodeDetailItem | null;
}
