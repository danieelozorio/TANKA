# Conversa com o WebView do app (DevTools do Android): espera a versão nova baixar em segundo plano, sai do app e volta.
import json, time, urllib.request, websocket

def pagina():
    for _ in range(20):
        try:
            lista = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
            for p in lista:
                if p.get('type') == 'page' and p.get('webSocketDebuggerUrl'):
                    return p['webSocketDebuggerUrl']
        except Exception as e:
            print('esperando o WebView:', e)
        time.sleep(2)
    raise SystemExit('WebView não apareceu')

ws = websocket.create_connection(pagina(), timeout=30, suppress_origin=True)
n = [0]
def cmd(metodo, **params):
    n[0] += 1
    ws.send(json.dumps({'id': n[0], 'method': metodo, 'params': params}))
    while True:
        m = json.loads(ws.recv())
        if m.get('method') == 'Runtime.consoleAPICalled':
            print('console.' + m['params']['type'] + ':', ' '.join(str(a.get('value', a.get('description', ''))) for a in m['params']['args']))
        if m.get('id') == n[0]:
            return m
def js(expr):
    r = cmd('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
    return r.get('result', {}).get('result', {}).get('value')

cmd('Runtime.enable')
print('ELDRIN_APP:', js('JSON.stringify(window.ELDRIN_APP)'))
print('plugins:', js('Object.keys((window.Capacitor||{}).Plugins||{}).join(",")'))
print('updater atual:', js('Capacitor.Plugins.CapacitorUpdater.current().then(r=>JSON.stringify(r))'))
# Firebase (19/11/2026): o app registra no Firebase sem cair e recebe um token
print('firebase:', js('new Promise(function(ok){var P=Capacitor.Plugins.PushNotifications;P.addListener("registration",function(t){ok("token "+String(t.value).slice(0,12)+"…")});P.addListener("registrationError",function(e){ok("erro "+JSON.stringify(e))});P.register().catch(function(e){ok("erro "+e.message)});setTimeout(function(){ok("sem resposta em 20 s")},20000)})'))
# notificações locais (19/11/2026): agenda o boss do clã às 20h e confere a lista do Android
print('notificações:', js('window.EldrinNativo ? EldrinNativo.bossCla({boss:{hora:21}}) || new Promise(r=>setTimeout(r,2500)).then(()=>Capacitor.Plugins.LocalNotifications.getPending()).then(x=>JSON.stringify(x.notifications.map(n=>[n.id,n.title,n.schedule&&n.schedule.at]))) : "sem EldrinNativo"'))
# 22/11/2026: a versão nova baixa em segundo plano (aviso pequeno #app-baixando) e entra quando o app vai para o fundo.
import subprocess
def esperar_pronta(segundos):
    for _ in range(segundos // 2):
        txt = js('(document.querySelector("#app-baixando")||{}).textContent || ""')
        print('aviso:', txt, '| tela cheia:', js('!!document.querySelector("#app-atualizar")'))
        if txt and 'pronta' in txt: return True
        time.sleep(2)
    return False
def sair_e_voltar():
    global ws
    subprocess.run(['adb', 'shell', 'input', 'keyevent', 'KEYCODE_HOME'])
    time.sleep(10)
    subprocess.run(['adb', 'shell', 'am', 'start', '-n', 'br.com.eldrinonline.app/.MainActivity'])
    time.sleep(10)
    ws = websocket.create_connection(pagina(), timeout=10, suppress_origin=True); n[0] = 0
pronta = esperar_pronta(120)
print('1ª abertura — versão nova pronta em segundo plano:', pronta)
if not pronta:
    sair_e_voltar()
    pronta = esperar_pronta(90)
    print('depois de voltar — pronta:', pronta)
subprocess.run(['adb', 'shell', 'input', 'keyevent', 'KEYCODE_HOME'])   # vai para o fundo: troca a versão
time.sleep(12)
subprocess.run(['adb', 'shell', 'am', 'start', '-n', 'br.com.eldrinonline.app/.MainActivity'])
time.sleep(8)
subprocess.run(['adb', 'shell', 'am', 'start', '-n', 'br.com.eldrinonline.app/.MainActivity'])
time.sleep(8)
try:
    ws = websocket.create_connection(pagina(), timeout=10, suppress_origin=True); n[0] = 0
    print('depois — ELDRIN_APP:', js('JSON.stringify(window.ELDRIN_APP)'))
    print('depois — updater atual:', js('Capacitor.Plugins.CapacitorUpdater.current().then(r=>JSON.stringify(r))'))
except Exception as e:
    print('depois:', e)
