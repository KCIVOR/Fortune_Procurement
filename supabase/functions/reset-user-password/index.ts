import { requireAdminJwt } from '../_shared/admin-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResetPasswordRequest {
  user_id: string;
  new_password: string;
  admin_id?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const auth = await requireAdminJwt(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json() as ResetPasswordRequest;

    const { user_id, new_password } = body;

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = auth.serviceClient;
    const adminId = auth.userId;

    const { error: updateError } = await admin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: `Password update failed: ${updateError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: targetUser } = await admin.auth.admin.getUserById(user_id);
    const targetEmail = targetUser?.user?.email || 'unknown';

    await admin.from('audit_logs').insert({
      actor_id: adminId,
      action: 'USER_PASSWORD_RESET',
      document_type: 'USER',
      document_id: user_id,
      payload: {
        target_user_id: user_id,
        target_user_email: targetEmail,
      },
    });

    const response: ResetPasswordResponse = {
      success: true,
      message: 'Password reset successfully',
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: `Server error: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
