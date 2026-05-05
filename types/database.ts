export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums / Literals ────────────────────────────────────────────────────────

export type ApprovalInstanceStatus = 'active' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalActionType = 'approved' | 'rejected' | 'noted';
export type NotificationType = 'action_required' | 'info' | 'approved' | 'rejected';
export type DocumentType = 'PR1' | 'PR2' | 'RFQ' | 'PO' | 'GRN';

// ─── Database Types ───────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {

      // ── Identity & Governance ──────────────────────────────────────────────

      departments: {
        Row: { id: string; name: string; code: string; active: boolean; created_at: string };
        Insert: { id?: string; name: string; code: string; active?: boolean; created_at?: string };
        Update: { id?: string; name?: string; code?: string; active?: boolean; created_at?: string };
      };

      roles: {
        Row: { id: string; name: string; active: boolean; created_at: string };
        Insert: { id?: string; name: string; active?: boolean; created_at?: string };
        Update: { id?: string; name?: string; active?: boolean; created_at?: string };
      };

      positions: {
        Row: { id: string; title: string; role_id: string; active: boolean; created_at: string };
        Insert: { id?: string; title: string; role_id: string; active?: boolean; created_at?: string };
        Update: { id?: string; title?: string; role_id?: string; active?: boolean; created_at?: string };
      };

      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role_id: string | null;
          position_id: string | null;
          department_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string;
          role_id?: string | null;
          position_id?: string | null;
          department_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role_id?: string | null;
          position_id?: string | null;
          department_id?: string | null;
          created_at?: string;
        };
      };

      // ── Controlled Form Versioning ─────────────────────────────────────────

      controlled_form_templates: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string;
          active?: boolean;
          created_at?: string;
        };
      };

      controlled_form_versions: {
        Row: {
          id: string;
          template_id: string;
          version: number;
          effective_from: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version?: number;
          effective_from?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          version?: number;
          effective_from?: string;
          active?: boolean;
          created_at?: string;
        };
      };

      // ── Approval Workflow Definitions (static) ─────────────────────────────

      approval_workflows: {
        Row: {
          id: string;
          code: string;
          name: string;
          form_template_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          form_template_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          form_template_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };

      approval_steps: {
        Row: {
          id: string;
          workflow_id: string;
          step_order: number;
          role_required: string;
          position_required: string | null;
          action_label: string;
          is_final: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          step_order: number;
          role_required: string;
          position_required?: string | null;
          action_label: string;
          is_final?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          step_order?: number;
          role_required?: string;
          position_required?: string | null;
          action_label?: string;
          is_final?: boolean;
          created_at?: string;
        };
      };

      // ── Approval Runtime (live instances) ─────────────────────────────────

      approval_instances: {
        Row: {
          id: string;
          workflow_id: string;
          document_type: string;
          document_id: string;
          current_step: number;
          status: ApprovalInstanceStatus;
          started_by: string;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          document_type: string;
          document_id: string;
          current_step?: number;
          status?: ApprovalInstanceStatus;
          started_by: string;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          document_type?: string;
          document_id?: string;
          current_step?: number;
          status?: ApprovalInstanceStatus;
          started_by?: string;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
      };

      approval_actions: {
        Row: {
          id: string;
          instance_id: string;
          step_order: number;
          action: ApprovalActionType;
          actor_id: string;
          actor_name_snapshot: string;
          actor_position_snapshot: string;
          actor_department_snapshot: string;
          remarks: string | null;
          acted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          step_order: number;
          action: ApprovalActionType;
          actor_id: string;
          actor_name_snapshot: string;
          actor_position_snapshot: string;
          actor_department_snapshot: string;
          remarks?: string | null;
          acted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          step_order?: number;
          action?: ApprovalActionType;
          actor_id?: string;
          actor_name_snapshot?: string;
          actor_position_snapshot?: string;
          actor_department_snapshot?: string;
          remarks?: string | null;
          acted_at?: string;
          created_at?: string;
        };
      };

      // ── Notifications ──────────────────────────────────────────────────────

      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: NotificationType;
          document_type: string | null;
          document_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string;
          type?: NotificationType;
          document_type?: string | null;
          document_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: NotificationType;
          document_type?: string | null;
          document_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };

      // ── PR1 ───────────────────────────────────────────────────────────────

      pr1_requests: {
        Row: {
          id: string;
          pr1_number: string;
          requisitioner_id: string;
          requisitioner_name_snapshot: string;
          department_id: string;
          department_name_snapshot: string;
          purpose: string;
          date_required: string;
          status: string;
          submitted_at: string | null;
          prepared_by_id: string | null;
          prepared_by_name_snapshot: string | null;
          prepared_by_position_snapshot: string | null;
          prepared_at: string | null;
          priority: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pr1_number: string;
          requisitioner_id: string;
          requisitioner_name_snapshot?: string;
          department_id: string;
          department_name_snapshot?: string;
          purpose?: string;
          date_required: string;
          status?: string;
          submitted_at?: string | null;
          prepared_by_id?: string | null;
          prepared_by_name_snapshot?: string | null;
          prepared_by_position_snapshot?: string | null;
          prepared_at?: string | null;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pr1_number?: string;
          requisitioner_id?: string;
          requisitioner_name_snapshot?: string;
          department_id?: string;
          department_name_snapshot?: string;
          purpose?: string;
          date_required?: string;
          status?: string;
          submitted_at?: string | null;
          prepared_by_id?: string | null;
          prepared_by_name_snapshot?: string | null;
          prepared_by_position_snapshot?: string | null;
          prepared_at?: string | null;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      pr1_items: {
        Row: {
          id: string;
          pr1_id: string;
          item_order: number;
          item_code: string;
          description: string;
          unit_of_measure: string;
          stock_on_hand: number;
          quantity_requested: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          pr1_id: string;
          item_order?: number;
          item_code?: string;
          description?: string;
          unit_of_measure?: string;
          stock_on_hand?: number;
          quantity_requested?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          pr1_id?: string;
          item_order?: number;
          item_code?: string;
          description?: string;
          unit_of_measure?: string;
          stock_on_hand?: number;
          quantity_requested?: number;
          created_at?: string;
        };
      };

      // ── Audit Logs ─────────────────────────────────────────────────────────

      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          document_type: string | null;
          document_id: string | null;
          payload: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          document_type?: string | null;
          document_id?: string | null;
          payload?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          document_type?: string | null;
          document_id?: string | null;
          payload?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };

    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ─── Convenience row types ────────────────────────────────────────────────────

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ApprovalWorkflow = Database['public']['Tables']['approval_workflows']['Row'];
export type ApprovalStep = Database['public']['Tables']['approval_steps']['Row'];
export type ApprovalInstance = Database['public']['Tables']['approval_instances']['Row'];
export type ApprovalAction = Database['public']['Tables']['approval_actions']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type ControlledFormTemplate = Database['public']['Tables']['controlled_form_templates']['Row'];
