// ============================================================
// KONFIGURASI SUPABASE
// Ambil dari: Supabase Dashboard > Project Settings > API
//   - Project URL        -> url
//   - anon / public key  -> anonKey
// Anon key AMAN dipublikasikan di GitHub selama RLS aktif
// (sudah diatur di supabase/schema.sql). JANGAN pernah
// memasukkan "service_role" key di sini.
// ============================================================
const SUPABASE_CONFIG = {
    url: 'https://uuzgozhfxvwqvybwdohc.supabase.co',
    anonKey: 'sb_publishable_6PqLUC_d9qVL330l62mX6A_kzA93t1d'
};
