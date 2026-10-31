"""Recorta uma grade de ícones (ex.: 2x2 ou 4x4) gerada por IA em arquivos separados.

Uso: python3 ferramentas/recortar_grade.py IMAGEM LINHAS COLUNAS NOME_L1C1 NOME_L1C2 ...
Os nomes vão da esquerda para a direita, de cima para baixo, sem extensão.
Cada ícone é salvo em assets/itens/<nome>.jpg com 256x256 px.
"""
import sys
from PIL import Image, ImageStat


def separacoes(img, n, eixo):
    """Acha as linhas mais escuras entre as células (perto de cada divisão esperada)."""
    cinza = img.convert('L')
    tamanho = cinza.width if eixo == 'x' else cinza.height
    cortes = [0]
    for i in range(1, n):
        alvo = tamanho * i // n
        faixa = range(alvo - tamanho // (n * 6), alvo + tamanho // (n * 6))
        def brilho(k):
            caixa = (k, 0, k + 1, cinza.height) if eixo == 'x' else (0, k, cinza.width, k + 1)
            return ImageStat.Stat(cinza.crop(caixa)).mean[0]
        cortes.append(min(faixa, key=brilho))
    cortes.append(tamanho)
    return cortes


def recortar(caminho, linhas, colunas, nomes, margem=6, lado=256):
    img = Image.open(caminho).convert('RGB')
    xs, ys = separacoes(img, colunas, 'x'), separacoes(img, linhas, 'y')
    for i in range(linhas):
        for j in range(colunas):
            cel = img.crop((xs[j] + margem, ys[i] + margem, xs[j + 1] - margem, ys[i + 1] - margem))
            q = min(cel.size)
            cel = cel.crop(((cel.width - q) // 2, (cel.height - q) // 2, (cel.width - q) // 2 + q, (cel.height - q) // 2 + q))
            cel.resize((lado, lado), Image.LANCZOS).save(f'assets/itens/{nomes[i * colunas + j]}.jpg', quality=88, optimize=True)
    return xs, ys


if __name__ == '__main__':
    caminho, linhas, colunas, *nomes = sys.argv[1:]
    linhas, colunas = int(linhas), int(colunas)
    assert len(nomes) == linhas * colunas, f'esperados {linhas * colunas} nomes, recebidos {len(nomes)}'
    print('cortes:', recortar(caminho, linhas, colunas, nomes))
