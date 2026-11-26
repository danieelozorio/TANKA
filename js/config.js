// Tanka — endereço do servidor (Supabase). A chave "publishable" é pública por natureza:
// ela só permite o que as regras de segurança do banco (supabase/schema.sql) deixam.
// NUNCA coloque aqui a chave secreta (sb_secret_... / service_role).
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};
Tanka.config = {
  supabaseUrl: 'https://ayccftokfrzmvgawrkxr.supabase.co',
  supabaseChave: 'sb_publishable_Zb9F63kEl01AA0bQ23NxZQ_zf9JPSpQ',
};
