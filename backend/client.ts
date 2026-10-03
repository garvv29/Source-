import {createClient} from '@supabase/supabase-js';

export function createSupabaseClient()
{
    return createClient(
        "https://scpfsnpftfbwbzfyzitb.supabase.co",
        process.env.SECRET_KEY!
    )
}