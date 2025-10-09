export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus = "pending" | "processing" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          input_image_url: string;
          output_image_url: string;
          prompt: string | null;
          status: ProjectStatus | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          input_image_url: string;
          output_image_url: string;
          prompt?: string | null;
          status?: ProjectStatus | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["projects"]["Insert"], "user_id">> & {
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
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
