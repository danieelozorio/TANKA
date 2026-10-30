# Remove o fundo escuro das artes de item e salva uma versão .webp com transparência ao lado do .jpg.
# Uso: python3 ferramentas/recortar_fundo.py                 (todas as artes de assets/itens)
#      python3 ferramentas/recortar_fundo.py anel-comum ...  (só estas)
# Se sobrar fundo numa arte, aumente passo/limite para ela (ex.: AJUSTES abaixo).
import sys, numpy as np
from collections import deque
from PIL import Image, ImageFilter

def recortar(origem, destino, passo=7, limite=60, minimo_mancha=120):
    im = np.asarray(Image.open(origem).convert('RGB')).astype(np.int32)
    h, w, _ = im.shape
    borda = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    fundo = np.median(borda, axis=0)
    dist_fundo = np.sqrt(((im - fundo) ** 2).sum(axis=2))
    sat = im.max(axis=2) - im.min(axis=2)
    visto = np.zeros((h, w), bool)
    fila = deque()
    for x in range(w):
        for y in (0, h - 1):
            fila.append((y, x)); visto[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            fila.append((y, x)); visto[y, x] = True
    # Cresce pelo fundo: vizinho parecido com o pixel atual, perto da cor do fundo e pouco saturado.
    while fila:
        y, x = fila.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visto[ny, nx]:
                d = np.sqrt(((im[ny, nx] - im[y, x]) ** 2).sum())
                if d < passo and dist_fundo[ny, nx] < limite and sat[ny, nx] < 40:
                    visto[ny, nx] = True
                    fila.append((ny, nx))
    # Fundo preso dentro do item (miolo do anel, entre a corda e o arco): manchas grandes com a
    # cor do fundo que não encostam na borda também somem. Manchas pequenas ficam (são detalhes do item).
    parecido = (dist_fundo < limite) & (sat < 40) & ~visto
    for y0, x0 in zip(*np.nonzero(parecido)):
        if not parecido[y0, x0]:
            continue
        mancha = [(y0, x0)]
        parecido[y0, x0] = False
        fila = deque(mancha)
        while fila:
            y, x = fila.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and parecido[ny, nx] and np.sqrt(((im[ny, nx] - im[y, x]) ** 2).sum()) < passo:
                    parecido[ny, nx] = False
                    mancha.append((ny, nx))
                    fila.append((ny, nx))
        if len(mancha) >= minimo_mancha:
            for y, x in mancha:
                visto[y, x] = True
    alfa = np.where(visto, 0, 255).astype(np.uint8)
    # Borda suave: desfoca a máscara um pouco.
    mascara = Image.fromarray(alfa).filter(ImageFilter.GaussianBlur(1.2))
    rgba = Image.open(origem).convert('RGBA')
    rgba.putalpha(mascara)
    rgba.resize((192, 192), Image.LANCZOS).save(destino, quality=86, method=6)

# Artes com moldura ou fundo texturizado precisam de mais tolerância.
AJUSTES = {'anel-comum': (9, 95), 'anel-lendaria': (9, 95), 'mago-botas-epica': (10, 110), 'mago-botas-lendaria': (10, 110), 'mago-peitoral-lendaria': (10, 110)}

if __name__ == '__main__':
    import os
    pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'itens')
    nomes = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(pasta) if f.endswith('.jpg'))
    for nome in nomes:
        passo, limite = AJUSTES.get(nome, (7, 60))
        # Fundo preso por dentro só existe em itens vazados (anel, colar, arco); nos outros a regra
        # apagaria partes escuras do próprio item.
        vazado = nome.startswith(('anel-', 'colar-', 'arma-arqueiro-'))
        recortar(os.path.join(pasta, nome + '.jpg'), os.path.join(pasta, nome + '.webp'), passo, limite,
                 minimo_mancha=120 if vazado else 10 ** 9)
        print('ok', nome)
