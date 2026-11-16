# Conversa com o WebView do app (DevTools do Android) e aperta "Atualizar agora". Imprime o que acontece.
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

ws = websocket.create_connection(pagina(), timeout=10)
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
for _ in range(15):
    if js('!!document.querySelector("#app-atualizar button")'): break
    time.sleep(2)
print('caixa:', js('(document.querySelector("#app-atualizar")||{}).innerText'))
js('document.querySelector("#app-atualizar button") && document.querySelector("#app-atualizar button").click(), 1')
ws.settimeout(5)
fim = time.time() + 150
while time.time() < fim:
    try:
        m = json.loads(ws.recv())
        if m.get('method') == 'Runtime.consoleAPICalled':
            print('console.' + m['params']['type'] + ':', ' '.join(str(a.get('value', a.get('description', ''))) for a in m['params']['args']))
        if m.get('method') == 'Runtime.executionContextsCleared':
            print('>>> a página recarregou (atualização aplicada?)')
            break
    except websocket.WebSocketTimeoutException:
        txt = js('(document.querySelector("#app-atualizar")||{}).innerText')
        print('caixa agora:', txt)
        if txt and 'Não deu' in txt: break
    except Exception as e:
        print('ws:', e); break
time.sleep(8)
try:
    ws = websocket.create_connection(pagina(), timeout=10); n[0] = 0
    print('depois — ELDRIN_APP:', js('JSON.stringify(window.ELDRIN_APP)'))
    print('depois — updater atual:', js('Capacitor.Plugins.CapacitorUpdater.current().then(r=>JSON.stringify(r))'))
except Exception as e:
    print('depois:', e)
