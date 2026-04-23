import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { auth_user_id, aluno_id, delete_aluno } = await req.json();
    if (!auth_user_id) return new Response(JSON.stringify({ error: 'auth_user_id is required' }), { status: 400, headers: corsHeaders });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Get and delete storage files
    const { data: docFiles } = await supabaseAdmin
      .from('student_documents')
      .select('storage_path')
      .eq('auth_user_id', auth_user_id);

    if (docFiles && docFiles.length > 0) {
      const paths = docFiles.map((d: { storage_path: string }) => d.storage_path);
      await supabaseAdmin.storage.from('student-docs').remove(paths);
    }

    // 2. Delete student_documents records
    await supabaseAdmin.from('student_documents').delete().eq('auth_user_id', auth_user_id);

    // 3. Delete student_profiles
    await supabaseAdmin.from('student_profiles').delete().eq('auth_user_id', auth_user_id);

    // 4. Optionally delete alunos entry
    if (delete_aluno && aluno_id) {
      await supabaseAdmin.from('alunos').delete().eq('id', aluno_id);
    }

    // 5. Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
