export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

console.log(
  '[SupabaseConfig]',
  !!supabaseConfig.url,
  !!supabaseConfig.anonKey
);