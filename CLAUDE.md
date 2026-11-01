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
Caçada contínua (Aventura > Caçar): Mapa do Reino (`assets/mapa-reino.webp`, medalhões e fundos em `assets/regioes/`),
escolha de 1–3 monstros, busca automática ("Caçada em andamento"), encontro com 3 s para lutar sozinho, "lutar sempre"
(chefe sempre pergunta), velocidade normal/2x, poção automática 10%/5%, vida mínima >5%, resumo e últimos combates.
Tempo/chance da busca em `CACADA` (dados.js): 3/4/5 s do mais fraco ao mais forte, caindo até 2/2,5/3 s com
Rastreio (Velocidade + Sorte) na região; o mais fraco aparece 3x mais no começo, iguala com a evolução.
Músicas por cena (`FAIXAS` em app.js, `assets/musica/`): entrada, jogo (Brumas do Reino + Luz das Brumas em revezamento),
masmorra (Halls Below), arena (Arena e Glória), chefe (Eldrin of Fate). Botão ⚙ = configurações (música, volumes), à direita;
chat à esquerda. Raça/classe no feminino (`nomeF` em dados.js, `nomeRaca`/`nomeClasse` em app.js). Mochila: seta verde
(`R.itemMelhor`, pelo Poder) e botão direito equipa (menu do navegador bloqueado no jogo). Caçada: opção Chefes
(perguntar/fugir/lutar). Floresta com metade do dano (masmorra Toca compensada com ataque 8).
Habilidades (Herói > Habilidades): `TALENTOS`, `HABILIDADE_INICIAL`, `SEGUNDAS_CLASSES` em dados.js; regras em regras.js
(`talentos`, `kitHabilidades`, `novoLutador`, `vezComHabilidades`, masmorra em `simularMasmorra`). Inicial antes do 10;
segunda classe no 10 (4 pontos +1/level, máx. 10 por habilidade, 1 ponto libera); uma habilidade por vez (1ª pronta da
ordem); reforços não gastam a vez; atordoar em chefe máx. 1; Pergaminho das Habilidades (500 rep).
Arena com habilidades no servidor (schema.sql: `arena_kit`, `arena_passiva`, `arena_vez`, passiva em `tanka_status`; sem
crítico na Arena: bônus de crítico viram dano, Sombra = próximo golpe vale o 20, evasão vira esquiva). Falta: Coletor na
masmorra, segunda classe nas listas do servidor (ranking/amigos).

## Pendências e ideias conversadas
- **Curva de exp**: do 25 ao 40 ficou longa demais (simulação: ~2.700 h até o 40 para Cavaleiro, muito mais para Mago).
  Sugestão feita: crescimento de +50% para +25–30% por level, e dar exp em missões/masmorras. Esperando ele escolher.
- Mago fraco nas áreas altas; dano novo dos monstros deixou o começo bem mais difícil (ele pediu assim).
- Ranking só atualiza ao abrir a aba ou clicar em Atualizar (ofereci atualizar sozinho).
- Rodapé ainda mostra `tankaarena.com`; trocar quando houver domínio novo do Eldrin.
- Ideias: arma secundária (mão esquerda), música céltica "Vale Sereno" (prompt feito, ainda não gerada), Fase 2 anti-trapaça
  (servidor conferir lutas/ouro/itens), avisos do jogo no Discord por webhook.
