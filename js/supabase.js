const SUPABASE_URL = 'https://aegegftulhxchgekwbrj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_axEMWoydIfpJlX-iqNHTIA_A79umgFV';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
