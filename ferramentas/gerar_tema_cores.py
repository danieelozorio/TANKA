# Gera css/tema-sombrio-cores.css (carregado entre estilo.css e tema-sombrio.css) com as regras que trocam os azuis-escuros antigos de estilo.css
# por tons de pedra quente (mesmo claro/escuro). Rodar de novo se estilo.css ganhar painéis azulados novos:
#   python3 ferramentas/gerar_tema_cores.py
import re
CSS = 'css/estilo.css'; SAIDA = 'css/tema-sombrio-cores.css'
MARCA = '/* ===== cores convertidas automaticamente (ferramentas/gerar_tema_cores.py) ===== */'

def azulado(r, g, b): return b > r + 5 and max(r, g, b) < 110
def quente(r, g, b):
    l = .3 * r + .59 * g + .11 * b
    return round(min(255, l * 1.07)), round(l), round(l * .9)
def trocar(valor):
    def hexa(m):
        h = m.group(1)
        if len(h) == 3: h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        return '#%02x%02x%02x' % quente(r, g, b) if azulado(r, g, b) else m.group(0)
    def rgba(m):
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not azulado(r, g, b): return m.group(0)
        return 'rgba(%d, %d, %d%s' % (quente(r, g, b) + (m.group(4),))
    v = re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', hexa, valor)
    return re.sub(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(\s*[,)])', rgba, v)

css = re.sub(r'/\*.*?\*/', '', open(CSS).read(), flags=re.S)
saida = []
def varrer(bloco, media=None):
    i = 0
    while i < len(bloco):
        a = bloco.find('{', i)
        if a < 0: break
        sel = bloco[i:a].strip()
        if sel.startswith('@media'):
            prof, j = 1, a + 1
            while prof: prof += {'{': 1, '}': -1}.get(bloco[j], 0); j += 1
            varrer(bloco[a + 1:j - 1], sel); i = j; continue
        f = bloco.find('}', a)
        corpo = bloco[a + 1:f]; i = f + 1
        if sel.startswith('@') or sel.startswith(':root') or 'keyframes' in sel or re.match(r'^(from|to|\d+%)', sel): continue
        novos = []
        for d in corpo.split(';'):
            if ':' not in d: continue
            p, v = d.split(':', 1)
            if p.strip().startswith('--'): continue
            nv = trocar(v)
            if nv != v: novos.append('%s: %s' % (p.strip(), nv.strip()))
        if novos:
            regra = '%s { %s; }' % (' '.join(sel.split()), '; '.join(novos))
            saida.append('%s { %s }' % (media, regra) if media else regra)
varrer(css)
open(SAIDA, 'w').write(MARCA + '\n/* Não editar à mão: rode o script de novo. */\n' + '\n'.join(saida) + '\n')
print(len(saida), 'regras')
