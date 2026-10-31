# Eldrin (antigo Tanka) — anotações para o Claude

RPG medieval místico de navegador, em português (PT-BR). Repositório `danieelozorio/TANKA`.
Jogo publicado: https://danieelozorio.github.io/TANKA/ (GitHub Pages, branch `main`).
Prévia no Claude (Artifact, modo sem servidor): https://claude.ai/artifact/VuX81TkgHJXZovvQSqQy8r

## Como falar com o dono (Daniel)
- Assistente se chama **Claudia/Claudinha**. Toda resposta começa com um **"Bom dia! ☀️"** caloroso.
- **Não** mandar ideias de livro (ele pediu para parar).
- Ele não é programador: explicar em português simples, com o que mudou "para o jogador".
- Prompts para ele levar a outras IAs (Gemini, Suno): **em inglês**, num bloco de notas `.txt` sem acentos.
- Para economizar: só mandar print/vídeo quando a mudança é visual; nada de simulação se ele já deu o número.

## Regras de trabalho (IMPORTANTE)
1. Trabalhar no branch local `trabalho-local`. Fazer commit e `git push origin trabalho-local:claude/amazing-volta-b0x1fb`.
2. **Nunca publicar sem ele dizer "pode publicar".** Antes, mostrar prints/vídeo e perguntar.
3. Ao ouvir "pode publicar":
   - `git checkout main && git merge --ff-only trabalho-local && git push origin main && git checkout trabalho-local`
   - Republicar o Artifact: copiar `ferramentas/artifact.html` para o scratchpad (igual ao `index.html`, mas usa
     `js/contas-local.js` no lugar de `config.js` + `contas.js`) e publicar com o mesmo URL acima, mandando em
     `files` os arquivos que mudaram (ex.: `js/app.js`, `css/estilo.css`, assets novos).
4. A cada mudança de JS/CSS, subir o `?v=N` em `index.html` e em `ferramentas/artifact.html` (cache do navegador).
5. Se mudar `supabase/schema.sql`, avisar que ele precisa **rodar o schema de novo** no SQL Editor do Supabase
   (o arquivo é idempotente; o aviso de RLS pode ser aceito no botão verde).
6. Segurança: nunca pedir, guardar ou mandar senha do banco nem a chave `service_role`/`sb_secret`.
   A URL e a chave *publishable* em `js/config.js` são públicas.

## Estrutura
- `index.html` — página do jogo. `js/config.js` (Supabase), `js/contas.js` (login e chamadas ao servidor via REST/RPC),
  `js/contas-local.js` (versão sem servidor, para a prévia).
- `js/dados.js` — **todos os números do jogo** (`Tanka.dados`): classes, raças, itens, raridades, preços, monstros e áreas
  (`dano` em faixa), encantamento, VIDA, ARENA, ALIANCA, MISSOES, SKINS_DADO, RECOMECO.
- `js/regras.js` — regras puras sem tela (`Tanka.regras`): status, poder, batalha, drops, encantar, mochila
  (ordenar/filtrar/travar/vender em lote), missões, masmorra, admin. Testado em `testes/regras.test.js`.
- `js/app.js` — toda a interface (um arquivo grande): telas de entrada/personagens/jogo, abas (Herói, Aventura,
  Arena, Mercado, Social), Arena com D20, forja do encanto, alianças, painel de missões, chat, música e sons.
- `js/dado3d.js` — D20 em 3D (Three.js r128 via cdnjs) com skins; `js/retratos.js` — imagens de personagens/itens/monstros.
- `css/estilo.css` — estilo "Pergaminho Real" (azul-marinho + dourado).
- `supabase/schema.sql` — banco inteiro (tabelas, RLS, funções `arena_*`, `alianca_*`, `grupo_*`, ranking, chat).
  O bloco `tanka_dados()` é gerado: rodar `node ferramentas/gerar_dados_sql.js` depois de mudar ARENA/ALIANCA em dados.js.
- `supabase/bots.sql` / `remover_bots.sql` — 40 bots de teste da Arena (gerados por `ferramentas/gerar_bots.js`).
- `assets/` — `itens/` (webp sem fundo), `monstros/`, `personagens/`, `aliancas/` (escudos com miolo pintável +
  símbolos), `musica/tema-eldrin.mp3`, `fundo-entrada.*` (vídeo da tela de entrada), `logo-eldrin.webp`.
- `ferramentas/recortar_fundo.py` e `recortar_grade.py` — tirar fundo/recortar artes geradas.

## Testes
- `node testes/regras.test.js` — regras do jogo (rodar sempre antes de commitar).
- `sh testes/banco.test.sh` — schema num PostgreSQL local (precisa de um Postgres rodando; usa `testes/supabase_falso.sql`).
- Teste no navegador: servir a pasta (`python3 -m http.server 8123`) e usar o Playwright já instalado; para testar com
  servidor, interceptar as chamadas ao Supabase e responder com um Postgres local (era uma "ponte" no scratchpad).
- O container não alcança supabase.co nem cdnjs: para o 3D, servir o three.min.js local.

## Já existe no jogo
Contas e até 3 personagens; 5 raças, 4 classes; level até 40; atributos com + e − e Confirmar (resetar só com o
Pergaminho do Recomeço, 500 de reputação); 7 áreas de caça com monstros liberados em sequência (vencer o anterior)
e chefes surpresa; dano dos monstros em faixa; vida com o tempo, acampar, 2 poções por dia; mochila de 32 com
ordenar/filtrar/travar/vender vários; mercado (armas, armaduras, pergaminhos, skins de dado, itens especiais);
encantamento até +10 na Forja (barra enche, sons); masmorras em grupo de 3; Arena PvP com D20 3D (escada por faixa
de level, entradas, saque, revanche, jackpot, perfil do adversário antes de desafiar); alianças (sigla, brasão,
cargos, tesouro, bônus, chat); missões diárias e semanais (painel na direita); ranking por level e poder; amigos;
chat global; admin completo; tela de entrada com vídeo, logo e música.

## Pendências e ideias conversadas
- **Curva de exp**: do 25 ao 40 ficou longa demais (simulação: ~2.700 h até o 40 para Cavaleiro, muito mais para Mago).
  Sugestão feita: crescimento de +50% para +25–30% por level, e dar exp em missões/masmorras. Esperando ele escolher.
- Mago fraco nas áreas altas; dano novo dos monstros deixou o começo bem mais difícil (ele pediu assim).
- Ranking só atualiza ao abrir a aba ou clicar em Atualizar (ofereci atualizar sozinho).
- Rodapé ainda mostra `tankaarena.com`; trocar quando houver domínio novo do Eldrin.
- Ideias: arma secundária (mão esquerda), músicas de Arena e aventura (prompts do Suno já feitos), Fase 2 anti-trapaça
  (servidor conferir lutas/ouro/itens), avisos do jogo no Discord por webhook.
