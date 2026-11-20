// Notificações no app (Henri, 19/11/2026): manda pelo Firebase (FCM v1) os avisos da fila (public.push_fila).
// Chamada pelo banco (push_avisar, via pg_net) sem corpo: pega os avisos ainda não enviados e manda para os
// aparelhos da conta (public.push_tokens). Quem chama não escolhe nada, então pode ser pública (--no-verify-jwt).
// Segredo: FIREBASE_CONTA = o JSON da conta de serviço do Firebase (Configurações do projeto > Contas de serviço >
// Gerar nova chave privada). Fica só nos segredos das funções do Supabase.
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cab = { apikey: SRV, Authorization: 'Bearer ' + SRV, 'Content-Type': 'application/json' };

function b64url(dados: ArrayBuffer | string) {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
let tokenCache: { token: string; ate: number } | null = null;
async function tokenGoogle(conta: { client_email: string; private_key: string }) {
  if (tokenCache && tokenCache.ate > Date.now() + 60000) return tokenCache.token;
  const agora = Math.floor(Date.now() / 1000);
  const cabeca = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({ iss: conta.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 }));
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(cabeca + '.' + corpo));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + cabeca + '.' + corpo + '.' + b64url(assinatura) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google: ' + JSON.stringify(j).slice(0, 200));
  tokenCache = { token: j.access_token, ate: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

export async function tratar(_req: Request): Promise<Response> {
  const bruto = Deno.env.get('FIREBASE_CONTA') ?? '';
  if (!bruto || !SRV) return new Response(JSON.stringify({ ok: false, motivo: 'sem FIREBASE_CONTA' }), { status: 200 });
  const conta = JSON.parse(bruto);
  const fila = await (await fetch(URL_ + '/rest/v1/push_fila?enviado_em=is.null&criado_em=gt.' + new Date(Date.now() - 3600000).toISOString()
    + '&select=id,conta_id,titulo,corpo&order=id&limit=50', { headers: cab })).json();
  if (!Array.isArray(fila) || !fila.length) return new Response(JSON.stringify({ ok: true, enviados: 0 }));
  const token = await tokenGoogle(conta);
  let enviados = 0;
  for (const av of fila) {
    // marca antes de mandar: duas chamadas ao mesmo tempo não mandam duas vezes
    const marcou = await (await fetch(URL_ + '/rest/v1/push_fila?id=eq.' + av.id + '&enviado_em=is.null', {
      method: 'PATCH', headers: { ...cab, Prefer: 'return=representation' }, body: JSON.stringify({ enviado_em: new Date().toISOString() }) })).json();
    if (!Array.isArray(marcou) || !marcou.length) continue;
    const aparelhos = await (await fetch(URL_ + '/rest/v1/push_tokens?conta_id=eq.' + av.conta_id + '&select=token', { headers: cab })).json();
    for (const ap of aparelhos || []) {
      const r = await fetch('https://fcm.googleapis.com/v1/projects/' + conta.project_id + '/messages:send', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: ap.token, notification: { title: '🔔 ' + av.titulo, body: av.corpo },   // sino amarelo (Henri, 20/11/2026)
          android: { priority: 'high', notification: { channel_id: 'eldrin', sound: 'default', icon: 'ic_stat_eldrin', color: '#C62828' } } } }) });
      if (r.ok) { enviados++; continue; }
      const erro = await r.text();
      if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(erro)) {   // aparelho desinstalou ou token velho
        await fetch(URL_ + '/rest/v1/push_tokens?token=eq.' + encodeURIComponent(ap.token), { method: 'DELETE', headers: cab });
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, enviados }), { headers: { 'Content-Type': 'application/json' } });
}

if (import.meta.main) Deno.serve(tratar);
