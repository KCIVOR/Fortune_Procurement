export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums / Literals ────────────────────────────────────────────────────────

export type ApprovalInstanceStatus = 'active' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalActionType = 'approved' | 'rejected' | 'revision_requested';
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

      role_position_module_visibility: {
        Row: {
          id: string;
          role_id: string;
          position_id: string | null;
          module_key: string;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role_id: string;
          position_id?: string | null;
          module_key: string;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role_id?: string;
          position_id?: string | null;
          module_key?: string;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role_id: string | null;
          position_id: string | null;
          department_id: string | null;
          payment_terms: string | null;
          is_vat_registered: boolean;
          supplier_supply_type: 'raw_material' | 'normal' | 'service' | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string;
          role_id?: string | null;
          position_id?: string | null;
          department_id?: string | null;
          payment_terms?: string | null;
          is_vat_registered?: boolean;
          supplier_supply_type?: 'raw_material' | 'normal' | 'service' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role_id?: string | null;
          position_id?: string | null;
          department_id?: string | null;
          payment_terms?: string | null;
          is_vat_registered?: boolean;
          supplier_supply_type?: 'raw_material' | 'normal' | 'service' | null;
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
          action_url: string | null;
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
          action_url?: string | null;
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
          action_url?: string | null;
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
          /** Phase 1 (Raw Mats): NOT NULL DEFAULT false in DB. */
          is_raw_material: boolean;
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
          /** Phase 1 (Raw Mats): omit to fall back to DB default (false). */
          is_raw_material?: boolean;
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
          /** Phase 1 (Raw Mats): nullable update — flag is locked once PR1 leaves draft. */
          is_raw_material?: boolean;
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

      // ── Supplier Accreditation (Phase 1) ───────────────────────────────────

      supplier_accreditations: {
        Row: {
          id: string;
          supplier_id: string;
          status: 'draft' | 'submitted' | 'under_review' | 'missing_documents' | 'approved' | 'rejected' | 'withdrawn' | 'expired';
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          missing_documents_note: string | null;
          approved_at: string | null;
          rejected_at: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          status?: 'draft' | 'submitted' | 'under_review' | 'missing_documents' | 'approved' | 'rejected' | 'expired';
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          missing_documents_note?: string | null;
          approved_at?: string | null;
          rejected_at?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          status?: 'draft' | 'submitted' | 'under_review' | 'missing_documents' | 'approved' | 'rejected' | 'withdrawn' | 'expired';
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          missing_documents_note?: string | null;
          approved_at?: string | null;
          rejected_at?: string | null;
          valid_until?: string | null;
          updated_at?: string;
        };
      };

      system_dropdown_options: {
        Row: {
          id: string;
          category: string;
          option_value: string;
          option_label: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          option_value: string;
          option_label: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          option_value?: string;
          option_label?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      supplier_products: {
        Row: {
          id: string;
          supplier_id: string;
          accreditation_id: string | null;
          product_name: string;
          product_code: string | null;
          category: string | null;
          description: string | null;
          specifications: string | null;
          item_type: 'goods' | 'services';
          status: 'draft' | 'submitted' | 'under_review' | 'pending_tsqa' | 'verified' | 'rejected' | 'inactive' | 'withdrawn' | 'expired';
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          verified_at: string | null;
          rejected_at: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          accreditation_id?: string | null;
          product_name: string;
          product_code?: string | null;
          category?: string | null;
          description?: string | null;
          specifications?: string | null;
          item_type?: 'goods' | 'services';
          status?: 'draft' | 'submitted' | 'under_review' | 'pending_tsqa' | 'verified' | 'rejected' | 'inactive' | 'expired';
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          verified_at?: string | null;
          rejected_at?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          accreditation_id?: string | null;
          product_name?: string;
          product_code?: string | null;
          category?: string | null;
          description?: string | null;
          specifications?: string | null;
          item_type?: 'goods' | 'services';
          status?: 'draft' | 'submitted' | 'under_review' | 'pending_tsqa' | 'verified' | 'rejected' | 'inactive' | 'withdrawn' | 'expired';
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          verified_at?: string | null;
          rejected_at?: string | null;
          valid_until?: string | null;
          updated_at?: string;
        };
      };

      supplier_documents: {
        Row: {
          id: string;
          supplier_id: string;
          accreditation_id: string | null;
          supplier_product_id: string | null;
          document_type: string;
          file_name: string;
          file_path: string;
          mime_type: string | null;
          file_size: number | null;
          uploaded_by: string;
          uploaded_at: string;
          expires_at: string | null;
          status: 'uploaded' | 'accepted' | 'rejected' | 'expired' | 'needs_revision';
          revision_note: string | null;
          notified_60d_at: string | null;
          notified_30d_at: string | null;
          notified_15d_at: string | null;
          notified_0d_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          accreditation_id?: string | null;
          supplier_product_id?: string | null;
          document_type: string;
          file_name: string;
          file_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_by: string;
          uploaded_at?: string;
          expires_at?: string | null;
          status?: 'uploaded' | 'accepted' | 'rejected' | 'expired' | 'needs_revision';
          revision_note?: string | null;
          notified_60d_at?: string | null;
          notified_30d_at?: string | null;
          notified_15d_at?: string | null;
          notified_0d_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          accreditation_id?: string | null;
          supplier_product_id?: string | null;
          document_type?: string;
          file_name?: string;
          file_path?: string;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string;
          uploaded_at?: string;
          expires_at?: string | null;
          status?: 'uploaded' | 'accepted' | 'rejected' | 'expired' | 'needs_revision';
          revision_note?: string | null;
          notified_60d_at?: string | null;
          notified_30d_at?: string | null;
          notified_15d_at?: string | null;
          notified_0d_at?: string | null;
          updated_at?: string;
        };
      };

      rse_records: {
        Row: {
          id: string;
          rse_number: string;
          supplier_id: string;
          accreditation_id: string | null;
          supplier_product_id: string;
          status: 'created' | 'assigned' | 'under_review' | 'passed' | 'failed' | 'cancelled';
          created_by: string;
          assigned_to: string | null;
          assigned_at: string | null;
          reason: string | null;
          procurement_notes: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rse_number?: string;
          supplier_id: string;
          accreditation_id?: string | null;
          supplier_product_id: string;
          status?: 'created' | 'assigned' | 'under_review' | 'passed' | 'failed' | 'cancelled';
          created_by: string;
          assigned_to?: string | null;
          assigned_at?: string | null;
          reason?: string | null;
          procurement_notes?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rse_number?: string;
          supplier_id?: string;
          accreditation_id?: string | null;
          supplier_product_id?: string;
          status?: 'created' | 'assigned' | 'under_review' | 'passed' | 'failed' | 'cancelled';
          created_by?: string;
          assigned_to?: string | null;
          assigned_at?: string | null;
          reason?: string | null;
          procurement_notes?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
      };

      tsqa_reviews: {
        Row: {
          id: string;
          rse_id: string;
          reviewer_id: string;
          result: 'passed' | 'failed' | null;
          remarks: string | null;
          test_findings: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rse_id: string;
          reviewer_id: string;
          result?: 'passed' | 'failed' | null;
          remarks?: string | null;
          test_findings?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rse_id?: string;
          reviewer_id?: string;
          result?: 'passed' | 'failed' | null;
          remarks?: string | null;
          test_findings?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
      };

      // ── Messaging ──────────────────────────────────────────────────────────

      conversations: {
        Row: {
          id: string;
          user_a_id: string;
          user_b_id: string;
          last_message_at: string | null;
          last_message_preview: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_a_id: string;
          user_b_id: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_a_id?: string;
          user_b_id?: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          is_deleted: boolean | null;
          read_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          edited_at: string | null;
          attachment_count: number | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          is_deleted?: boolean | null;
          read_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          edited_at?: string | null;
          attachment_count?: number | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          is_deleted?: boolean | null;
          read_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          edited_at?: string | null;
          attachment_count?: number | null;
        };
      };

      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          conversation_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          message_id: string;
          conversation_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          message_id?: string;
          conversation_id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          uploaded_by?: string;
          created_at?: string | null;
        };
      };

    };
    Views: Record<string, never>;
    Functions: {
      create_or_get_conversation: {
        Args: { other_user_id: string };
        Returns: string;
      };
      mark_messages_as_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
    };
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

// ── Phase 1: Supplier Accreditation + RSE + TSQA convenience types ───────────
export type SupplierAccreditation  = Database['public']['Tables']['supplier_accreditations']['Row'];
export type SupplierProduct        = Database['public']['Tables']['supplier_products']['Row'];
export type SupplierDocument       = Database['public']['Tables']['supplier_documents']['Row'];
export type RseRecord              = Database['public']['Tables']['rse_records']['Row'];
export type TsqaReview             = Database['public']['Tables']['tsqa_reviews']['Row'];

// ── Messaging convenience types ──────────────────────────────────────────────
export type Conversation       = Database['public']['Tables']['conversations']['Row'];
export type Message            = Database['public']['Tables']['messages']['Row'];
export type MessageAttachment  = Database['public']['Tables']['message_attachments']['Row'];
