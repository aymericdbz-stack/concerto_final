export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RegistrationStatus = "pending" | "paid" | "cancelled";

export interface Database {
  public: {
    Tables: {
      registrations: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          event_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          amount: number;
          currency: string;
          status: RegistrationStatus;
          stripe_payment_intent_id: string | null;
          stripe_checkout_session_id: string | null;
          qr_code_data_url: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          event_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          amount: number;
          currency?: string;
          status?: RegistrationStatus;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          qr_code_data_url?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["registrations"]["Insert"], "user_id">> & {
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      client: {
        Row: {
          id: string;
          created_at: string;
          nom_prenom: string;
          email: string;
          message: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nom_prenom: string;
          email: string;
          message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
