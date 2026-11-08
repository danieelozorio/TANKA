---
name: pdf-eldrin
description: Fazer um PDF sobre o Eldrin (regras, raças, classes, itens, materiais, propostas, lore) no visual dos PDFs "Os Anões: Mestres da Forja" e "Materiais de Eldrin". Usar quando o Daniel ou o Henri pedirem um PDF do jogo, ou digitarem /pdf-eldrin.
---

# PDF do Eldrin

Todo PDF do jogo sai com o mesmo visual: A4, fundo escuro de pedra, letras douradas, fonte EB Garamond e as artes do jogo.

## Antes de começar
1. Se não estiver claro, pergunte o assunto e o tipo de PDF:
   - **Guia**: explica o que já está no jogo, como no PDF dos Materiais. Não tem capa e é feito de tabelas com ícones.
   - **Proposta**: uma ideia nova, como no PDF dos Anões. Tem capa, partes numeradas e a frase "não está no jogo ainda".
2. Tire **todos os números** do código: `js/dados.js` (`Tanka.dados`) e `js/regras.js`. Nunca invente números.
   Numa proposta, deixe claro o que é sugestão.
3. Para a parte do jogo, leia só a seção dela em `docs/notas-tecnicas.md`.

## Como montar
1. Copie `.claude/skills/pdf-eldrin/modelo.html` para o scratchpad. Ele já tem todas as peças: capa, título de parte,
   subtítulo, lista, caixa de dica, caixa de aviso, citação, tabela, tabela com ícone, retratos lado a lado, passos
   numerados e rodapé.
2. Veja os exemplos prontos em `exemplos/anoes.html` (proposta) e `exemplos/materiais.html` (guia).
3. Use as imagens de `assets/` com caminho relativo à raiz do repositório: `assets/itens/...`, `assets/monstros/...`,
   `assets/personagens/...` e `assets/logo-eldrin.webp`. Antes, confira com `ls` que o arquivo existe.
4. Cada `<div class="pg">` é uma página. Se o texto não couber, abra outra página em vez de espremer.
5. Gere o PDF:
   ```bash
   node .claude/skills/pdf-eldrin/gerar_pdf.js arquivo.html Eldrin-Assunto.pdf
   ```
   O script avisa se alguma imagem não carregou.
6. Confira o PDF. Abra cada página como imagem (Read no PDF) e veja se algum texto foi cortado. Não mande prints ao Daniel.
7. Mande só o PDF final pelo SendUserFile.

## Regras de texto
- Escreva em português simples, pensando no jogador. Siga o estilo da skill `sem-limite`.
- Use o nome do arquivo `Eldrin-Assunto.pdf` e salve no scratchpad. Não faça commit do PDF.
- O rodapé de cada página é: `Eldrin · Título do PDF`.
