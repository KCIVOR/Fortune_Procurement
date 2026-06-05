import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };

export type AdminAuthResult = {
  userId: string;
  serviceClient: ReturnType<typeof createClient>;
};

export async function requireAdminJwt(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AdminAuthResult | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, ...jsonHeaders } },
    );
  }

  const token = authHeader.slice(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, ...jsonHeaders } },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, ...jsonHeaders } },
    );
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('roles(name)')
    .eq('id', user.id)
    .maybeSingle();

  const roles = (profile as { roles?: { name: string } | { name: string }[] } | null)?.roles;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;

  if (roleName !== 'admin') {
    return new Response(
      JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
      { status: 403, headers: { ...corsHeaders, ...jsonHeaders } },
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { userId: user.id, serviceClient };
}
