# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Eldrin (antigo Tanka) — anotações para o Claude

RPG medieval místico de navegador, em português (PT-BR). Repositório `danieelozorio/TANKA`.
Jogo publicado: **https://eldrinonline.com.br** (GitHub Pages, branch `main`; endereço antigo:
https://danieelozorio.github.io/TANKA/). O e-mail interno do login continua `@jogador.tankaarena.com`: NÃO mudar,
senão os jogadores perdem a conta.
Prévia no Claude (Artifact): REMOVIDA a pedido do Daniel (nov/2026) para economizar créditos. Não recriar sem ele pedir.

## Quem trabalha no projeto
São duas pessoas, cada uma com o seu Claude: **Daniel** (dono) e **Henri** (amigo, colaborador).
No começo da conversa, se não estiver claro quem está falando, perguntar: "Você é o Daniel ou o Henri?".

### Daniel (dono)
- Assistente se chama **Claudia/Claudinha**. Toda resposta começa com um **"Bom dia! ☀️"** caloroso.
- **Não** mandar ideias de livro (ele pediu para parar).
- Ele não é programador: explicar em português simples, com o que mudou "para o jogador".
- Prompts para ele levar a outras IAs (Gemini, Suno): **em inglês**, num bloco de notas `.txt` sem acentos.
- Para economizar: **não mandar prints nem vídeos** (ele pediu para parar); testar no navegador por conta própria só se
  precisar, sem mandar a imagem. Nada de simulação se ele já deu o número.
- **Não resumir o que o Henri fez** (gasta créditos à toa). Só dar `git fetch`/`merge` em silêncio quando for trabalhar
  ou publicar; contar algo do Henri só se mexer no que o Daniel pediu ou se precisar rodar o schema.

### Henri (colaborador)
- Falar em português simples, como com o Daniel (o jeito "Claudia" e o "Bom dia!" são preferências do Daniel;
  seguir o que o Henri preferir).
- Henri trabalha no branch dele (`henri/<assunto>`, ex.: `henri/arena-ranking`), faz commit e push nesse branch.
  Nunca mexer no branch do Daniel.
- Henri tem **autonomia total para publicar** o que quiser, sem precisar avisar nem pedir licença ao Daniel.
  O Claude do Henri mostra prints e publica quando o **Henri** disser "pode publicar".
- Botão de publicar (pedido do Henri): ao terminar uma mudança pronta para publicar, perguntar com as opções clicáveis
  (AskUserQuestion) "Publicar agora" / "Ainda não". Clicar em "Publicar agora" vale como "pode publicar".
- Para publicar (Henri): `git fetch origin && git merge origin/main` no branch dele (trazer o que o Daniel publicou),
  resolver conflitos, rodar os testes, e então `git push origin HEAD:main` (precisa ser avanço normal, nunca `--force`).

## Regras de trabalho (IMPORTANTE)
1. Claude do Daniel: trabalhar no branch local `trabalho-local`. Fazer commit e
   `git push origin trabalho-local:claude/amazing-volta-b0x1fb`.
2. **Daniel e Henri têm autonomia total: cada um publica o que quiser, sem precisar avisar o outro.** O Claude só
   publica quando a pessoa com quem está falando disser "pode publicar". Antes, explicar o que muda e perguntar.
3. Quando o Daniel pedir para juntar o trabalho do Henri: `git fetch origin`, ver os branches `henri/*`, revisar o que
   mudou, `git merge` no `trabalho-local`, rodar os testes, resolver conflitos e explicar o que muda antes de publicar.
4. Ao ouvir "pode publicar" (Daniel):
   - Antes: `git fetch origin && git merge origin/main` no `trabalho-local` (pode ter coisa que o Henri publicou),
     rodar os testes.
   - `git checkout main && git merge --ff-only origin/main && git merge --ff-only trabalho-local && git push origin main && git checkout trabalho-local`
5. A cada mudança de JS/CSS, subir o `?v=N` em `jogar/index.html` e em `ferramentas/artifact.html` (cache do navegador).
   Se os dois mudarem o número ao mesmo tempo, na junção ficar com o maior + 1.
6. Se mudar `supabase/schema.sql`, avisar que alguém com acesso ao Supabase (Daniel, ou o Henri se for convidado) precisa **rodar o schema de novo** no SQL Editor do Supabase, no projeto **cwlcdeqvwzpveduzhaol** (o do `js/config.js`; o Daniel tem outro projeto e já rodou lá por engano)
   (o arquivo é idempotente; o aviso de RLS pode ser aceito no botão verde).
7. Segurança: nunca pedir, guardar ou mandar senha do banco nem a chave `service_role`/`sb_secret`.
   A URL e a chave *publishable* em `js/config.js` são públicas. Acesso ao Supabase é por convite (Team), nunca por senha.
8. Para não dar conflito: combinar quem mexe em qual parte do jogo (ex.: Henri na Arena, Daniel nas caçadas).
   `js/app.js` é um arquivo grande; evitar os dois mexerem na mesma tela ao mesmo tempo.

## Estrutura
Sem build e sem npm: HTML + CSS + JS puro, tudo pendurado no objeto global `Tanka`. O `jogar/index.html` carrega os scripts
nesta ordem: `dados.js` → `historia.js` → `regras.js` → `config.js` → `contas.js` → `retratos.js` → `dado3d.js` → `app.js`.
`sw.js` é o service worker (cache `eldrin-v1`) do app no celular.
Fluxo: `app.js` (tela) lê os números de `Tanka.dados`, calcula com `Tanka.regras` e salva pelo `Tanka.contas`. O que
vale dinheiro ou disputa (Arena, clã, leilão, oficinas, chat) é decidido no servidor, nas funções do `schema.sql`; por
isso alguns números vivem nos dois lados (ver `tanka_dados()` abaixo).
- `index.html` — página de apresentação (botão Jogar). `jogar/index.html` — página do jogo (endereço /jogar/; usa
  `<base href="../">`, então js/css/assets continuam na raiz). `js/config.js` (Supabase), `js/contas.js` (login e chamadas ao servidor via REST/RPC),
  `js/contas-local.js` (versão sem servidor, para a prévia).
- `js/historia.js` — capítulos da história (regiões, chefes, prêmios).
- `js/dados.js` — **todos os números do jogo** (`Tanka.dados`): classes, raças, itens, raridades, preços, monstros e áreas
  (`dano` em faixa), encantamento, VIDA, ARENA, ALIANCA, MISSOES, SKINS_DADO, RECOMECO.
- `js/regras.js` — regras puras sem tela (`Tanka.regras`): status, poder, batalha, drops, encantar, mochila
  (ordenar/filtrar/travar/vender em lote), missões, masmorra, admin. Testado em `testes/regras.test.js`.
- `js/app.js` — toda a interface (um arquivo grande): telas de entrada/personagens/jogo, abas (Herói, Aventura,
  Arena, Mercado, Social), Arena com D20, forja do encanto, alianças, painel de missões, chat, música e sons.
- `js/dado3d.js` — D20 em 3D (Three.js r128 via cdnjs) com skins; `js/retratos.js` — imagens de personagens/itens/monstros.
- `css/estilo.css` — estilo base (interface Clássica); por cima, só se o jogador escolher a interface Zealot na ⚙,
  `css/tema-sombrio-cores.css` + `css/tema-sombrio.css` (tema escuro "Pedra Sombria").
- `supabase/schema.sql` — banco inteiro (tabelas, RLS, funções `arena_*`, `alianca_*`, `grupo_*`, ranking, chat).
  O bloco `tanka_dados()` é gerado: rodar `node ferramentas/gerar_dados_sql.js` depois de mudar ARENA/ALIANCA em dados.js.
- `supabase/bots.sql` / `remover_bots.sql` — 40 bots de teste da Arena (gerados por `ferramentas/gerar_bots.js`).
- `assets/` — `itens/` (webp sem fundo), `monstros/`, `personagens/`, `aliancas/` (escudos com miolo pintável +
  símbolos), `musica/tema-eldrin.mp3`, `fundo-entrada.*` (vídeo da tela de entrada), `logo-eldrin.webp`.
- `ferramentas/recortar_fundo.py` e `recortar_grade.py` — tirar fundo/recortar artes geradas.

## Testes
- `node testes/regras.test.js` — regras do jogo (rodar sempre antes de commitar). Não tem filtro por teste: para ver só
  as falhas, `node testes/regras.test.js | grep -v '^ok'`. O arquivo carrega `dados.js`/`regras.js` num `vm` e cada
  `teste('nome', fn)` imprime `ok`/`FALHA`. Um teste de conjuntos ("segundas classes") falha às vezes por arredondamento.
- `node testes/arena.test.js` — Arena no banco (depois do `banco.test.sh`; precisa de `npm install pg` e `PGHOST`/`PGPORT`).
- `sh testes/banco.test.sh` — schema num PostgreSQL local (precisa de um Postgres rodando; usa `testes/supabase_falso.sql`).
- Teste no navegador: servir a pasta (`python3 -m http.server 8123`) e usar o Playwright já instalado; para testar com
  servidor, interceptar as chamadas ao Supabase e responder com um Postgres local (era uma "ponte" no scratchpad).
- O container não alcança supabase.co nem cdnjs: para o 3D, servir o three.min.js local.

## Skills do projeto (`.claude/skills/`)
- `sem-limite` — estilo de resposta do Daniel (direto, frases curtas, problema → passos, termo técnico explicado).
- `pdf-eldrin` — PDFs do jogo no visual escuro/dourado (molde, exemplos e `gerar_pdf.js` com o Playwright).

## Detalhes técnicos (ler só quando precisar)
O que já existe no jogo, pendências, regras de itens/armas/encanto/conjuntos, consumíveis, leilão, app no celular e as
mudanças do Henri estão em `docs/notas-tecnicas.md`. **Antes de mexer numa parte do jogo, ler só a seção dela** (use grep).
Ao terminar uma mudança, anotar lá (não aqui) o que for técnico; aqui só regras de trabalho.
