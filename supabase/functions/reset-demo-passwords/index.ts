import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// UUIDs from the live DB (roles, positions, departments)
const R_EMPLOYEE    = 'e430e783-4a66-4d30-a091-1c6263b216b0';
const R_WAREHOUSE   = 'a03b8a29-5377-4a65-819b-9b23dc45d7f2';
const R_PROCUREMENT = '5395d331-228c-49f2-8b88-3b65b62d5ded';
const R_APPROVER    = '7b2b2518-522d-4461-b87e-a6eeba85fe7a';
const R_SUPPLIER    = '8f47295a-8088-4a65-980a-511b9e1fc54c';

const P_STAFF        = 'b1b154a5-8591-449a-a9b8-8a451d862291';
const P_WH_STAFF     = '1dc1f307-18c1-4610-aa62-f065312c0167';
const P_WH_MANAGER   = '855f91f0-5bd0-4fa9-a0e6-705673cda361';
const P_PROC_STAFF   = 'f27bf437-d834-40f9-bcf6-f72119c9158a';
const P_BUYER        = 'cf5b9f12-e2be-46dd-b698-0ce6c50c11f5';
const P_PROC_MANAGER = '5290f6d8-ec49-4495-8c11-764ef98a0cdb';
const P_SUPERVISOR   = '2f93cc61-c01d-4961-b78a-16f50c558c1b';
const P_DEPT_HEAD    = '9097c5b8-bf90-4ded-9c2c-2a2397c9c1a4';
const P_DIRECTOR     = '708619cc-5bf8-4604-a788-4a11913d5fb9';
const P_FIN_DIRECTOR = '2de9ca21-b8fd-49cb-b27c-cb288479da2e';
const P_SUPPLIER_REP = 'c94957a9-bd6e-4f90-976f-58f63bf41647';

const D_OPS  = '8e2fe4dd-4f61-4c25-88e7-136413d1c325';
const D_WH   = '6efef3db-87e9-4665-b071-3063b710c126';
const D_PROC = '4f51d342-404e-40a9-9d52-f9d121c70844';
const D_EXEC = 'fe262a7b-5f1b-4577-b568-7491adb1f411';
const D_FIN  = '2a3039ec-722c-4b22-b091-340d67a1f62d';
const D_GS   = '9c3f3c83-8886-4734-99c2-8088b8621244';

const DEMO_USERS = [
  { email: 'employee@fortune.com',         full_name: 'Juan dela Cruz',    role_id: R_EMPLOYEE,    position_id: P_STAFF,        department_id: D_OPS  },
  { email: 'warehouse@fortune.com',        full_name: 'Pedro Santos',      role_id: R_WAREHOUSE,   position_id: P_WH_STAFF,     department_id: D_WH   },
  { email: 'wh.manager@fortune.com',       full_name: 'Maria Reyes',       role_id: R_WAREHOUSE,   position_id: P_WH_MANAGER,   department_id: D_WH   },
  { email: 'procurement@fortune.com',      full_name: 'Ana Gomez',         role_id: R_PROCUREMENT, position_id: P_PROC_STAFF,   department_id: D_PROC },
  { email: 'buyer@fortune.com',            full_name: 'Carlos Mendoza',    role_id: R_PROCUREMENT, position_id: P_BUYER,        department_id: D_PROC },
  { email: 'proc.manager@fortune.com',     full_name: 'Rosa Fernandez',    role_id: R_PROCUREMENT, position_id: P_PROC_MANAGER, department_id: D_PROC },
  { email: 'supervisor@fortune.com',       full_name: 'Roberto Lim',       role_id: R_APPROVER,    position_id: P_SUPERVISOR,   department_id: D_OPS  },
  { email: 'dept.head@fortune.com',        full_name: 'Luisa Castro',      role_id: R_APPROVER,    position_id: P_DEPT_HEAD,    department_id: D_OPS  },
  { email: 'director@fortune.com',         full_name: 'Eduardo Torres',    role_id: R_APPROVER,    position_id: P_DIRECTOR,     department_id: D_EXEC },
  { email: 'finance.director@fortune.com', full_name: 'Gloria Navarro',    role_id: R_APPROVER,    position_id: P_FIN_DIRECTOR, department_id: D_FIN  },
  { email: 'supplier@fortune.com',         full_name: 'Ace Supply Corp',   role_id: R_SUPPLIER,    position_id: P_SUPPLIER_REP, department_id: D_GS   },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Record<string, string> = {};

    for (const user of DEMO_USERS) {
      // Sign up via GoTrue HTTP — the only path proven to work on this project
      const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
        body: JSON.stringify({ email: user.email, password: 'Fortune2024!' }),
      });

      const data = await res.json();

      if (!data.user?.id) {
        results[user.email] = `signup failed: ${data.error_code ?? data.msg ?? JSON.stringify(data)}`;
        continue;
      }

      const newId: string = data.user.id;

      // Insert profile row with the GoTrue-assigned UUID
      const { error: profileErr } = await admin.from('profiles').insert({
        id: newId,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
        position_id: user.position_id,
        department_id: user.department_id,
      });

      if (profileErr) {
        results[user.email] = `user ok (${newId}) but profile failed: ${profileErr.message}`;
      } else {
        results[user.email] = `ok — id: ${newId}`;
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
