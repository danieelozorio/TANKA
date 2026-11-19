# Eldrin — notas técnicas

Detalhes que antes ficavam no CLAUDE.md. Ler só a seção do assunto em que for mexer.

## Já existe no jogo
Contas e até 3 personagens; 5 raças, 4 classes; level até 40; atributos com + e − e Confirmar (resetar só com o
Pergaminho do Recomeço, 2.000 de ouro); 7 áreas de caça com monstros liberados em sequência (vencer o anterior)
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
(perguntar/fugir/lutar). Fugir/evitar chefe zera a presença dele (`evitarChefe`). Floresta com metade do dano (masmorra Toca compensada com ataque 8).
Habilidades (Herói > Habilidades): `TALENTOS`, `HABILIDADE_INICIAL`, `SEGUNDAS_CLASSES` em dados.js; regras em regras.js
(`talentos`, `kitHabilidades`, `novoLutador`, `vezComHabilidades`, masmorra em `simularMasmorra`). Inicial antes do 10;
segunda classe no 10 (4 pontos +1/level, máx. 10 por habilidade, 1 ponto libera); uma habilidade por vez (1ª pronta da
ordem); reforços não gastam a vez; atordoar em chefe máx. 1; Pergaminho das Habilidades (2.000 de ouro). Arqueiro: Double Shot (id antigo `pes-ligeiros`, tipo `multiplo`,
2 flechas de 100% +3%/ponto, `TALENTOS.multiplo`) na caçada, masmorra e Arena (`arena_vez`). Retratos das
segundas classes em `assets/personagens/<raca>-<classe2>[-f].jpg` (`classeRetrato` em app.js).
Arena com habilidades no servidor (schema.sql: `arena_kit`, `arena_passiva`, `arena_vez`, passiva em `tanka_status`; sem
crítico na Arena: bônus de crítico viram dano, Sombra = próximo golpe vale o 20, evasão vira esquiva). Ordem própria `defesa` (Arena · Defesa) usada quando o personagem é desafiado. Falta: Coletor na
masmorra, segunda classe nas listas do servidor (ranking/amigos).
Salvamento com trava de versão (nov/2026, caso legolaspreto 14 -> 12): `salvarPersonagem` (contas.js) grava `dados.versao`
+1 e o PATCH filtra `dados->>versao=eq.<anterior>` (ou `is.null`); se nenhuma linha muda, outra aba/aparelho salvou antes:
`erro.conflito`, as próximas gravações param e o app (`C.aoConflito`) avisa e recarrega a página. O servidor nunca
escreve em `personagens.dados`, por isso a trava é só no cliente (sem mudar o schema). Se um dia uma função do banco
gravar em `dados`, ela precisa manter/subir a `versao`.

## Pendências e ideias conversadas
- **Curva de exp**: FEITO (Henri, nov/2026): `EXP_FAIXAS` em dados.js: +50% por level até o 19 (igual), +30% do 20 ao 29,
  +12% do 30 em diante (`expNecessaria`). Com o 2º monstro da área do level: 113–420 monstros por level do 20 ao 39
  (antes chegava a 32 mil no 39).
- Mago fraco nas áreas altas; dano novo dos monstros deixou o começo bem mais difícil (ele pediu assim).
- Ranking só atualiza ao abrir a aba ou clicar em Atualizar (ofereci atualizar sozinho).
- Ideias: arma secundária (mão esquerda), música céltica "Vale Sereno" (prompt feito, ainda não gerada), Fase 2 anti-trapaça
  (servidor conferir lutas/ouro/itens), avisos do jogo no Discord por webhook.

## Atributos (rebalanceados) e armas (em andamento)
- +1 de dano a cada `PONTOS_POR_DANO` (3) do `atributoDano` da classe: FOR (Cavaleiro/Artesão), DES (Caçador = id `arqueiro`),
  INT (Mago). Crítico físico = (SOR + DES) × 0,5%; crítico mágico = SOR × 1%. RES = 3 de vida por ponto; 10 de vida por level.
  Monstros com `ajusteVida` por área (compensa o dano maior). Presente: 1 Pergaminho do Recomeço (`recomecoPresente`).
- Nomes: classe base `arqueiro` aparece como **Caçador**; segunda classe `cacador` aparece como **Arqueiro** (ids não mudam).
- Rodapé: Eldrinonline.com.br (o e-mail interno do login continua @jogador.tankaarena.com — NÃO mudar).
- Parte 2 (armas) FEITA: `TIPOS_ARMA` (vel/fator/duasMaos/proibe), `MAO_ESQUERDA`, `ARMAS_CLASSE` (base e segundas classes),
  `ARMA_PADRAO` (armas antigas sem `arma`), `SUFIXOS_ARMA`, `RARIDADE_ARMA` (rara +atributo, épica +10% PvE, lendária +10% PvP).
  Item novo: arma com `arma: <tipo>`; mão esquerda = `tipo: 'secundaria'`, `mao: <tipo>`, espaço `equipados.secundaria`.
  Regras: `podeUsar`/`motivoNaoEquipa` (incompatível fica equipada até tirar), `sortearTipoArma`/`sortearMao` nos drops,
  tipos de segunda classe só a partir de rara. Servidor (tanka_status) replica fator, velocidade, mão esquerda, atributo e PvP
  (conferido com 40 personagens). Ícones: `assets/itens/arma-<tipo>-<raridade>` e `mao-<tipo>-<raridade>` (prompts mandados,
  20 imagens 2x2; enquanto não chegam, desenho SVG).
- Parte 3 FEITA: armaduras, joias e mão esquerda caem com `bonus` sorteado (80–120% do valor da raridade, mín. 1) e, da rara
  em diante, +1 atributo extra (`VARIACAO_ITEM`). Itens antigos sem `bonus` usam o valor fixo. Servidor lê `it.bonus`.

## App no celular
- PWA: `manifest.webmanifest`, `sw.js` (cache: mídia primeiro do cache, js/css/html da rede primeiro; trocar `CACHE` se
  uma imagem mudar sem mudar de nome), ícones em `assets/app/` (recorte do logo; dá para trocar por um ícone próprio).
- APK (nov/2026, feito aqui pelo Claude do Daniel): TWA gerado com `@bubblewrap/core` + Android SDK (dl.google.com e
  repo.maven.apache.org liberados; trocar `jcenter()` por repo.maven.apache.org e `minSdkVersion` 24). Pacote
  `br.com.eldrinonline.jogo`, abre `https://eldrinonline.com.br/jogar/`. A chave (keystore) e a senha ficaram SÓ com o
  Daniel (não estão no repositório). `.well-known/assetlinks.json` tem a impressão SHA-256 da chave (tela cheia, sem
  barra do navegador; precisa do `.nojekyll` para a pasta com ponto ser publicada). App novo = mesma chave, `appVersionCode` maior.
- APK para baixar: `baixar/Eldrin.apk` (botão "Baixar app Android (APK)" no `botaoInstalar()`: tela de login e ⚙;
  some no iPhone e dentro do app). App novo: gerar com a mesma chave e trocar esse arquivo.
- (antigo) APK: precisa do Android SDK (dl.google.com está bloqueado neste ambiente). Caminhos: liberar dl.google.com na rede do
  ambiente e montar um TWA aqui, ou o Daniel gerar no PWABuilder.com com a URL do jogo.
- Rolagem no celular (nov/2026): `telaJogo` e `atualizarFicha` passam por `manterRolagem` (app.js): marca um elemento
  visível (o focado, o último tocado ou o primeiro na tela), redesenha e rola para ele voltar ao mesmo lugar; também
  guarda o `scrollTop` de caixas com rolagem própria (caçada na Zealot) e prende a altura do `#app` até as imagens novas
  carregarem. Na caçada, a `.cacada-arena` fica com a maior altura que já teve (`c.alturaArena`) e o `#registro` existe
  desde o começo, para nada abaixo pular entre "procurando / monstro achado / luta".
- Sub-abas no celular (≤720px) rolam de lado: antes passavam da tela (4 botões = 460px) e o navegador alargava a página
  inteira (toques caíam no lugar errado). Para conferir: `innerWidth` no Playwright com aparelho de celular tem que ser a
  largura do aparelho em todas as abas.
- Opções da caçada (chefe / poção automática) são botões (`data-acao="cacada-opcao"`), não `<select>`: a lista se
  fechava sozinha a cada redesenho. Barrinha fina de exp embaixo da vida na caçada: `expFinaHtml` (`.exp-fina`).
- Drops da caçada (arma/armadura) abrem a mesma ficha flutuante da mochila, só para ver (`data-acao="drop-ver"`,
  `estado.dropFoco`, `fichaItemHtml(item, true)` sem botões; os objetos ficam em `dropsCacada`). Seta verde quando é
  melhor que o equipado (`dropMelhor`: `R.itemMelhor`, pondo o item na mochila de mentira se ele já saiu dela).
  Pergaminho continua com a fichinha de texto.
- Zealot no celular (≤700px): barra de ícones embaixo igual à Clássica (`navBaixoHtml`, `#abas-baixo`, último filho do
  `#app` em coluna); o menu de cima fica só com Trocar personagem/Som/Sair. Sub-abas da Zealot no celular rolam de lado
  (`justify-content: flex-start`: com `center` a parte da esquerda ficava inalcançável) e a escolhida é rolada até ficar
  à vista no `telaJogo`. Bug corrigido: `width: max-content` nas sub-abas empurrava o botão Menu para fora da tela.
- "JWT expired" (nov/2026): `contas.js` renova o passe sozinho. `pedir` tenta de novo uma vez depois de um 401/JWT
  (`renovarSessao`, uma renovação só para vários pedidos ao mesmo tempo) e `sessaoValida` usa o relógio do servidor
  (`agora()`) com 5 min de folga, porque o relógio do celular pode estar errado.

## Itens por nível (parte 1 FEITA)
- `ITEM_NIVEL` (dados.js): nível 1–60; drop = level ±3 (35+: 35–60); raridade = qualidade (faixaQualidade); arma
  `danoDoNivel`, armadura/joia/mão `bonusDoNivel` (valor raro da tabela, dobra a cada 10 níveis desde o 15).
  Mercado por tipo (`comprar(p, tipo, especifico)` → `comprarNoNivel`): nível ±3, comum/rara, preço `precoDoNivel`.
  Venda = 10% do preço do nível × raridade. Itens antigos ganham `nivel` = level do herói (status iguais).
  Joia da masmorra vem do servidor sem nível: `completarItem`. Chefes com a velocidade do 3º monstro.
- Parte 2 FEITA: `EXTRAS_ARMA` → `item.extras` {atributos, pve, pvp, hab:{i,n}} (armas por nível; antigas seguem RARIDADE_ARMA).
  `pontosEm` = distribuídos + `pontosDaArma` (passa de 10); servidor: `arena_pontos_arma`, extras em tanka_status.
- Parte 3 FEITA: `CONJUNTOS` (dados.js): peça de armadura de quem tem 2ª classe ganha `conjunto` '<classe2>-<faixa 1..6>'
  (`marcarConjunto` nos drops/Mercado/admin); `bonusConjuntos` (2/3/4 peças, só da própria 2ª classe) em `comConjunto`/
  `atributosTotais`; servidor soma igual (crítico de conjunto vira dano na Arena).
  Peça de conjunto: só cai na caçada, 10% das armaduras de quem tem 2ª classe (`CONJUNTO_CHANCE`), na RARIDADE sorteada
  (comum a lendária; sem cor verde: `corItem` = raridade, `nomeRaridadeItem` = "Rara · Conjunto"). Mercado não vende;
  "Vender vários" não seleciona peça de conjunto. Arte própria (1 por peça, a raridade fica na borda):
  `assets/itens/conjunto-<classe2>-<elmo|peitoral|luvas|botas>.webp` (`arquivoConjunto` em retratos.js; sem ela, usa a
  armadura normal). Artes dos 8 conjuntos FEITAS (Gemini, 8 grades 2x2); para refazer, recortar com `recortar_grade.py IMG 2 2 conjunto-<c2>-elmo
  conjunto-<c2>-peitoral conjunto-<c2>-luvas conjunto-<c2>-botas` e depois `recortar_fundo.py`.
- Armaduras (elmo/peitoral/luvas/botas) novas têm `variacao` e nome "<tipo da peça> <SUFIXOS_ARMA>" (8 por raridade, iguais
  aos das armas); antigas sem `variacao` mantêm `nomes[raridade]`; peça de conjunto mantém o nome do conjunto.
- Ícones das habilidades: `assets/habilidades/<id da habilidade>.webp` (quadrado COM fundo, não tirar o fundo), mostrados no
  cartão (`iconeHab` em app.js; sem a arte, some; sem ponto fica cinza). Os 36 ícones FEITOS (Gemini, 9 grades 2x2 (iniciais na ordem cavaleiro,
  arqueiro, mago, artesao; depois cada segunda classe na ordem das habilidades em dados.js), recortados direto para
  assets/habilidades em .webp 192x192 (margem de 8 px da linha da grade).

## Mudanças do Henri (nov/2026)
- Defesa do herói em PORCENTAGEM, igual à dos monstros (`DEFESA` em dados.js): dano recebido x 100 / (100 + defesa), mínimo 1
  (`R.danoComDefesa`, `R.cortePct`), na caçada, masmorra e Arena (`arena_vez`). Para valer o mesmo de antes, a defesa e a defesa
  mágica de todos os itens (inclusive os já salvos, em `R.bonusItem`), a da RES (10 = 3) e o bônus de conjunto (+15) valem x3
  (`DEFESA.fator`); servidor igual (tanka_status). Poder e força dos itens compensam o x3 (`poder`, `PESO_BONUS`).
- Drops da caçada iguais em todas as áreas (`DROPS_CACADA`): 1º monstro 5%/5%, 2º 8%/8%, 3º 10%/10%; pergaminho
  2% / 4% / 10% (1º/2º/3º, nov/2026; antes só 5% no 3º);
  qualidade 70/22/7/1 (Sorte só aumenta a chance). Chefes não mudaram.
- Pergaminho de encantamento fora do Mercado; masmorra: 50% por herói na vitória (servidor: `sortear_raridade_drop`).
- Penalidade de área baixa (`EXP_REDUZIDA`, `R.fatorExp`): conta os mapas liberados (pelo level) depois da área; até 1 à
  frente nada, 2 à frente 50%, 3+ 10%. Com penalidade: exp e ouro reduzidos e nenhum drop (itens, pergaminhos, chefe).
- Consumíveis (Herói > Mochila > aba Consumíveis): `p.consumiveis` = itens empilhados {id: '<tipo>-<raridade>', tipo, raridade, qtd},
  sem limite, fora dos 32 da mochila (`D.CONSUMIVEIS`, `R.consumiveis/qtdConsumivel/mudarConsumivel`, `R.qtdPergaminho/
  mudarPergaminho/pergaminhos`). O contador antigo `p.pergaminhos` vira item sozinho em `R.consumiveis` (e é apagado);
  NÃO usar `p.pergaminhos` em código novo. Cristais: item que quebra na Forja vira cristais da raridade dele
  (`CRISTAIS_QUEBRA`: tentando +7/+8/+9/+10 = 100/150/200/500); ainda sem uso. Arte: `assets/itens/pergaminho-<raridade>.webp`
  (FEITA, Gemini, 4 imagens; .jpg 512px + recortar_fundo.py) e `cristal-<raridade>.webp` (FEITA também; cristal-comum com ajuste (4, 25) no recortar_fundo.py). Sem arte, desenho SVG em retratos.js.
- Leilão do servidor (Mercado > Leilão, level 10+): `LEILAO` em dados.js (copiado para tanka_dados). Faixas l1 10–19 (mínimos
  1k/5k/10k/50k), l2 20–29 (x10), l3 30+ (x40, sem comum). 12 lotes por rodada: 1 arma e 1 armadura de cada classe base,
  2 joias, 2 pacotes de pergaminho (10 comuns/5 raros/3 épicos/1 lendário); garantias: arma épica+, armadura épica+, joia rara+.
  Rodada de 4 h, sempre rodando (`leilao_garantir` fecha e abre outra quando alguém abre a tela); fase mostrada, nunca o relógio;
  "Muito curto" começa 1–4 min antes do fim (sorteado). Lance +5% (`R.proximoLance`); cobrança = crédito negativo, lance
  coberto volta como crédito (aplicarCreditos); vencedor recebe em `recompensas` {leilao:true, semente...} e o jogo gera o
  item com `R.itemDoLote` (resgatarRecompensas). Tabelas `leiloes`, `leilao_lotes`; funções `leilao_*`; testes no banco.
- Mercado: troca de pergaminhos de encantamento (`TROCA_PERGAMINHO`, `R.trocarPergaminho`): 10 de uma raridade = 1 da seguinte.
- Forja: botão +1 depois do sucesso. Listas do servidor (ranking, arena, amigos, aliança, grupo, chat) mandam `classe2`.
- (SUBSTITUÍDO pelo encanto em %, abaixo) Encanto mais forte em armas 20+. Seção Atividades (tempo logado/caçando) no painel do herói.

## Raridade e encanto (Daniel, nov/2026): "roxo +0 tem que ganhar de azul +4"
- Força por raridade no mesmo nível: `ITEM_NIVEL.multRaridade` (comum 0,7–0,8; rara 0,95–1,05; épica 1,27–1,37;
  lendária 1,6–1,7), `multQualidade` em regras.js mapeia a qualidade dentro da faixa da raridade. Só itens novos (o dano/bônus
  fica salvo no item).
- Encanto em %: `encantamento.pctPorNivel` = 5. Arma: dano x(1 + 5% x encanto) (`multEncanto`/`danoArmaComEncanto`);
  armadura/joia/mão: bônus principal +5% por nível, sem mínimo desde nov/2026 (`bonusComEncanto`). Servidor igual
  (`encantoPct` em tanka_dados, tanka_status). Testes: regras.test.js e banco.test.sql.
- Tipos de arma equilibrados: o `fator` do tipo vale para o GOLPE INTEIRO (arma + dano do herói + mão esquerda), em
  `status` e no tanka_status (`fat`). Fatores: rápida 0,83 (x1,2 ataques = normal), lenta de uma mão 1,25 (x0,8 = normal),
  lenta de duas mãos 1,4 (x0,8 = +12%, paga a mão esquerda).
  Henri (nov/2026): Martelo virou NORMAL (fator 1) e Balestra NORMAL de duas mãos (fator 1,12 = os mesmos +12%). `danoArma` mostrado na ficha continua com o fator só na arma.
- **Arena: Top 5 para baixo, ataque pelo Ranking, repetição e revanche (nov/2026).** `arena_lutas.tipo` = escada | top5 | livre | revanche
  e `arena_lutas.reputacao`. Do 1º ao 4º lugar dá para atacar para baixo até o 5º (`arena_desafiar` decide: 'top5'); o 5º só para cima.
  No Ranking (Social) o botão "Atacar" chama `arena_atacar` ('livre', qualquer personagem level 5+, gasta 1 entrada).
  Só a escada muda posição/jackpot. Fora da escada: alvo em arena abaixo = sem reputação e sem ouro; mesma arena e alvo em posição
  inferior = metade da reputação; arena acima = tudo. O mesmo atacante contra o mesmo alvo na semana (segunda 00:00, horário de
  Brasília, `arena_inicio_semana`): ouro 100% / 50% / 25% / 0 (a reputação continua). Revanche sempre que o defensor quiser (mesmo
  tendo vencido a defesa), uma por luta. Janela de ataque mostra a recompensa esperada (`recompensaDesafioHtml`); histórico mostra o tipo
  e a reputação ganha. `ranking()` agora devolve `id`. Testes em `testes/banco.test.sql` (bloco "Top 5 ataca para baixo").
- **Caçada: velocidade dos monstros e acerto (nov/2026).** Velocidade do monstro = velocidade do herói (arma normal) no level
  mínimo da área x `MONSTRO.velocidadeHeroi` [0,7; 0,8; 0,9] (chefe = 3º). O dano dos monstros NÃO mudou (Henri pediu só a
  velocidade); vale também para a masmorra, que usa esses monstros. Herói acerta
  monstros no mínimo `ACERTO_PVE_MINIMO` = 95% (até 100% com precisão), em `calcularGolpe` (caçada e masmorra). Arena não mudou.
- **Sorte (nov/2026):** a Sorte NÃO aumenta mais o drop (itens, pergaminhos da caçada, joia da masmorra no servidor;
  `bonusDrop` foi removido) nem o crítico físico (`chanceCritico` = DES x 0,5 + itens). Continua: encantamento 0,5% por ponto
  (`SORTE.encanto`, `chanceEncantar`), crítico e dano crítico mágico 1% por ponto, craft 1%, quebrar armadura (Artesão).
- **Anéis novos (nov/2026):** `D.ANEL` + `R.sortearBonusAnel`: dano = 15% do dano médio de uma arma do mesmo nível/qualidade
  (mín. 1); rara+ defesa mágica (`bonusDoNivel(2)`); épica 1 atributo e lendária 2 atributos diferentes (valores de
  VARIACAO_ITEM.extra); épica+ `regen` = +1% da vida por minuto (soma em `regenPorMinuto`, x3 acampado, 2 anéis somam);
  lendária + vida (`bonusDoNivel(15)`). Encanto do anel vai no dano (`bonusPorNivel.anel`). Anéis antigos (Sorte, sem `bonus.dano`)
  viram novos em `normalizar` (mantêm raridade, nível e encanto). Servidor soma dano/vida/defesaMagica do `it.bonus` (regen não
  importa na Arena); tanka_dados regenerado.
- **Esqueci a senha (nov/2026):** o login do Supabase usa e-mail interno (`usuario@jogador...`), então a recuperação é pelo admin.
  Entrada > "Esqueci a senha": `senha_pedir(u, e)` (anon; só cria pedido se usuário e e-mail conferem, 1 pendente por conta,
  resposta sempre igual). Admin > "Pedidos de senha": `admin_pedidos_senha`, `admin_senha_temporaria(pedido)` (10 caracteres,
  grava `auth.users.encrypted_password` com `extensions.crypt`/bcrypt, marca `contas.trocar_senha`) e `admin_recusar_pedido_senha`;
  o painel mostra a senha uma vez e um botão "Abrir e-mail" (mailto para o e-mail do cadastro). No login com `trocar_senha`,
  `telaTrocarSenha(true)` obriga a criar senha nova (`PUT /auth/v1/user` + `senha_trocada()`). "Trocar senha" também na tela
  de personagens. Tabela `pedidos_senha` (RLS sem regras). Testes no banco (bloco "Esqueci a senha").
- **Defesa 50% mais eficaz (nov/2026):** `DEFESA.fator` 3 -> 4,5 (itens, RES, também os já salvos); arredonda por item e na RES
  (`Math.round`; servidor `round`). Bônus de 2 peças de conjunto 15 -> 23. Poder/força dos itens compensam (`PESO_BONUS` = 8/fator).
  Arena igual (tanka_dados regenerado + tanka_status). A fórmula continua dano x 100 / (100 + defesa).
- **Caçador ataca com Força (nov/2026):** `classes.arqueiro.atributoDano` 'des' -> 'for' (vale para Arqueiro e Assassino;
  servidor pelo tanka_dados). DES continua: chance de crítico, precisão, evasão. Arma antiga rara+ do Caçador agora dá FOR.
  Presente único: Caçador com level > 1 ganha 1 Pergaminho do Recomeço (`presenteForcaCacador`: 1 = falta avisar, 2 = feito).
- **Comparar sem encanto (nov/2026):** botão na ficha do item e no zoom (`estado.compararSemEncanto`, `semEncanto(item)`):
  os dois itens comparados viram +0 só na conta; o zoom mostra nome/ícone/venda do item real (`cartaZoom(..., orig)`).
- **Fila da masmorra (nov/2026):** sem grupo, "Entrar na fila" em cada masmorra (`fila_entrar`). Tabela `masmorra_fila`;
  o jogo chama `fila_ping` a cada 4 s (antes do `grupo_estado`), que chama `fila_casar(m)`: 3 jogadores na mesma masmorra
  entram juntos; se o mais antigo esperou 30 s, entram os que houver + bots ("Mercenário/a ..."), cópias dos dados de um
  jogador do grupo (mesmo poder; `bot: true`, id `bot-...`). Run com `grupo_id` null, `lider` = o mais antigo, `membros` só
  jogadores (bots sem prêmio e sem entrada). Qualquer membro de luta da fila pode chamar `masmorra_concluir` (o 1º vale;
  `assistirLuta` chama sozinho). Sem ping há 20 s sai da fila; entrar/montar grupo tira da fila. `grupo_estado` traz `fila`
  e `run.lider`/`run.fila`. Testes no banco (bloco "Fila da masmorra").

## Tema "Pedra Sombria" (Daniel, nov/2026)
- Visual escuro aprovado pelo Daniel a partir de uma imagem do Gemini. Só aparência; regras e telas iguais.
- `css/tema-sombrio.css` (escrito à mão) carrega depois de `css/estilo.css`; `css/tema-sombrio-cores.css` (gerado) fica
  entre os dois e troca os azuis-escuros antigos por pedra quente: `python3 ferramentas/gerar_tema_cores.py` de novo se
  `estilo.css` ganhar painéis azulados.
- Henri (nov/2026): o tema virou opção na engrenagem ⚙ > Interface: **Clássica** (padrão, visual antigo) ou **Zealot** (Pedra
  Sombria). Guardado em `localStorage['eldrin.interface']`; um script no `<head>` do index.html (e do artifact.html) põe
  `data-interface` no `<html>` e só escreve os dois `<link>` do tema quando é 'zealot'. Trocar recarrega a página
  (`interfaceAtual()` em app.js).
- Letras: IM Fell English (texto) e IM Fell English SC (títulos/abas/botões), "ELDRIN" em Cinzel Decorative (Google Fonts).
  Os algarismos e o % vêm de `assets/fontes/ebgaramond.woff2` (fonte "Numeros Eldrin", `unicode-range`), porque os números
  do IM Fell são tortos.
- Arte em `assets/interface/`: `fundo.webp` (parede gótica, Gemini), `rocha.webp` (pedra rachada dos painéis, gerada por
  código), `canto-tl/tr/bl/br.webp` (enfeite dourado nos cantos de `.caixa`, Gemini). Faíscas só em CSS (`body::after`).
- Itens: fundo da raridade bem leve; brilho do encanto (`aura-eN`) com a mesma ordem de cores, tons mais frios e médio.
- Herói > Personagem: `abaPersonagem` agora embrulha em `.personagem-grade` > `.pg-equipamento` + `.pg-mochila`; a partir
  de 1450px a mochila vai para uma 3ª coluna (ficha | equipamento | mochila). Abaixo disso fica como antes.
- Daniel pediu: sem barras coloridas nos atributos (só números, como já era) e sem caveiras.
- Celular (Zealot, até 860px): a ficha fica limitada a `min(24dvh, 9rem)` com `.conteudo > .jogo > .ficha`; a regra
  `.jogo > :is(.ficha, section.caixa) { max-height: 100% }` é mais forte que `.jogo > .ficha` e fazia a ficha crescer e
  esmagar a tela da aba (Aventura/Mercado/Social ficavam com ~40px, parecia que o menu não funcionava).
- Celular (Zealot, até 860px): a ficha some em todas as abas; só aparece em Herói > Personagem na vista "Atributos"
  (`.jogo:not([data-personagem-vista]) > .ficha { display: none }`). Pedido do Daniel.
- **Correção (nov/2026):** Bênção (Curandeiro, reforço `grupo: true`) travava a caçada: `aplicarReforco` recebia `alvos` null
  na caçada. Agora reforço de grupo sem grupo vale só para o próprio herói. Teste em regras.test.js.
- **Drop dos chefes (nov/2026):** todos iguais (`D.chefe.drop`, `D.chefe.pergaminho`): 4% lendário, 20% épico (1 arma, armadura
  ou mão esquerda da classe; senão nada) e 80% de chance de 1 pergaminho com a qualidade da caçada (70/22/7/1), sem depender da
  arma (`dropChefe`, `concluirBatalha`). Os campos por chefe (dropItem/drops/dropPadrao/pergaminhos) saíram.

## História: "A Crônica de Eldrin — Os Sete Selos" (Daniel, nov/2026)
- Aventura > História (sub-aba `historia`). Texto em `js/historia.js` (`D.HISTORIA`: PERSONAGENS e 7 capítulos, um por
  região, com abertura, 3 objetivos, fechamento e prêmio). Carregado depois de dados.js (index, artifact e testes).
- NÃO trava regiões (pedido do Daniel): o capítulo só pede o level da região dele (`areas[].nivelMin`).
- Regras (regras.js): `historiaEstado`, `registrarHistoria(p, 'abate'|'masmorra', id)`, `concluirCapitulo`,
  `premioHistoriaTexto`, `marcarHistoriaVista`. Progresso em `p.historia = { cap, prog, visto, lidos }`; só conta no capítulo
  atual. Objetivos: abate (criaturas comuns da região), chefe (o da região, na caçada), masmorra (a da região).
- Ganchos em app.js: `encerrar()` (vitória na caçada) e `assistirLuta()` (masmorra vencida, uma vez por run).
- Objetivos (pedido do Daniel): criaturas 100/200/350/700/1100/2000/3000, chefe 3/5/9/15/25/40/70, masmorra 3/4/6/8/10/12/15.
  Os chefes cabem nas criaturas (média de abates por chefe pela `chanceChefe`: 13, 16, 19, 24, 29, 33, 40).
- Prêmios: ouro, 10% da exp do level, pergaminhos (c3, c5, c6), arma épica do level (c4; espera mochila com espaço),
  título "Guardião/Guardiã dos Selos" (`p.titulo`, aparece na ficha) e skin de dado `selos` (c7; `historia: true` em
  SKINS_DADO, não se compra; cores em dado3d.js e `.d20g.skin-selos`).
- Retratos das falas: `assets/historia/<id>.webp` (aldric, capuz, kael — 320x320, do Gemini). Sem a imagem, aparece a
  inicial; monstros usam o retrato do monstro; narrador = 📜.

- Lore das raças (Daniel, nov/2026): `lema` e `lore` em `D.racas` (dados.js), mostrados na criação de personagem
  (`.lore-raca`, abaixo das cartas de raça). Cada raça guardou um selo: Humanos = Areias (Amenreth) e Dravenhold;
  Elfos = Floresta (raízes de Velgrath); Elfos Negros = Pântano; Orcs = Vale (pacto com Vhar'kesh; o resto dos povos
  esqueceu, por isso a surpresa de Aldric no c5); Anões = Torre Carmesim (era a forja deles; o Guardião da Torre é uma
  armadura anã) + correntes e chaves; Cume = todas as raças juntas (origem da Ordem dos Guardiões).

## Guia do Aventureiro (tutorial; Daniel, nov/2026)
- Só personagens criados depois desta versão (`criarPersonagem` grava `guia: { passo: 0, abates: 0 }`); os antigos não têm.
- Texto em `js/historia.js` (`D.GUIA`): boas-vindas, caçar 3 criaturas, equipar o presente (Elmo do Aprendiz raro do
  level, `item.nome` próprio), abrir o Mercado, aceitar o capítulo 1 da História, lutar 1 vez na Arena (level 5).
  Prêmio final: 1.000 de ouro + 2 pergaminhos raros. Pular = sem prêmio (pede 2 cliques).
- Regras: `guiaEstado`, `registrarGuia(p, 'abate'|'aba'|'arena', alvo)`, `verificarGuia` (avança quantos passos estiverem
  feitos; eventos fora de ordem ficam guardados), `comecarGuia`, `pularGuia`.
- Tela: `guiaHtml()` no topo do painel (cartão com o Aldric, Ir / Pular), `conferirGuia()` no começo de `telaJogo()`
  (aviso a cada passo), a aba do passo pisca (`.guia-alvo`, também o menu do Zealot). Ganchos: `encerrar()`, `abrirAba()`
  e o fim da luta na Arena.
- Menu (Zealot): botão maior com escudo + "MENU" (`.menu-rotulo`, borda dourada e brilho); abas de cima (sub-abas) com
  ícones (`ICONES_SUB` em app.js, `.sub-ico`), nas duas interfaces.
- **Masmorra: 5 entradas por dia (nov/2026):** `MASMORRA.entradasPorDia` 5 e `masmorra_entradas_dia()` no schema (substitui o
  `>= 2` fixo em `grupo_iniciar`/`fila_casar`/`fila_entrar`). Para devolver as entradas do dia a todos:
  `delete from public.masmorra_entradas where dia = public.dia_jogo();`


## Boss da aliança (Daniel, nov/2026)
- Aba Social > Aliança > botão "⚔ Boss da aliança" (`estado.aliancaVista = 'boss'`, `bossAliancaHtml` em app.js).
- Regras do Daniel: 1 boss por dia; o **líder** escolhe a hora (0–23, Brasília) e o boss abre sozinho todo dia nessa
  hora por 60 min (`BOSS_ALIANCA.duracaoMin`); ataques **ilimitados**; grupo de até **4** membros da aliança; se não
  morrer na hora, no dia seguinte é o **mesmo boss com a vida cheia**; se morrer, sobe 1 nível (mais forte).
- Números em `BOSS_ALIANCA` (dados.js). Nível n: a cada 3 níveis troca de chefe (Varnok → Guardião → Faraó → Vhar'kesh
  → Ignaroth; títulos "Desperto"/"Furioso"); vida = vida do chefe da caçada × `vida` (30) × 1,3^(nível dentro do chefe);
  depois do Ignaroth a vida e o ataque continuam crescendo. Calibrado por simulação: grupo de 4 no level do chefe com
  itens raros/épicos +3/+4 vence o 1º nível de cada boss em ~13–20 investidas (depois das raças do Henri) (≈3.000 de dano por investida no nível 1).
- Investida = luta da masmorra (`simularSalas`, motor separado de `simularMasmorra`) com 1 sala só (o boss com a vida
  que falta); acaba quando o grupo cai ou o boss ataca `limiteAtaques` (15) vezes. `R.simularBossAlianca` devolve
  `danos` por herói. Quem começa (sozinho ou o líder do grupo) já informa o dano no início (`alianca_boss_concluir`);
  os outros do grupo veem a investida no `alianca_boss_estado` (`run`) e assistem junto (90 s).
- Prêmios (servidor, `alianca_boss_premiar`) para quem deu dano no dia: ouro via `creditar`; exp (`recompensas`
  tipo `exp`, o jogo limita a `expMaxPct` 20% da exp do level), 2 pergaminhos (raridade pelo chefe, `boss: true`);
  maior dano: `bossItem` (10% lendário, 90% épico; o item é gerado no jogo, `R.itemBossAlianca`); aliança: exp =
  ouro do prêmio × 2. Resgate em `resgatarRecompensas` (app.js).
- Servidor (schema.sql, fim do arquivo): tabelas `alianca_boss`, `alianca_boss_dano`, `alianca_boss_salas`,
  `alianca_boss_sala_membros`, `alianca_boss_runs`; abrir/fechar é preguiçoso em `alianca_boss_atualizar` (chamada por
  todas as funções). Vida/prêmios por nível vêm de `tanka_dados()->'BOSS_ALIANCA'->'niveis'` (60 níveis gerados por
  `ferramentas/gerar_dados_sql.js` com `R.tabelaBossAlianca`): **mudou BOSS_ALIANCA → rodar a ferramenta e o schema**.
  Sair/ser expulso da aliança tira do grupo do boss (`alianca_registrar_saida`, agora plpgsql).
- Atualização: a cada 4 s na tela do boss ou com o boss aberto; senão a cada 32 s (selo "!" na aba e prêmios).
- Testes: regras.test.js (2 testes "boss da aliança") e banco.test.sql (bloco "Boss da aliança").
## Chefe Mundial: "O Despertar de Ignaroth" (Henri, nov/2026)
- Servidor (`supabase/schema.sql`): tabelas `boss_mundial` e `boss_mundial_dano` (RLS sem políticas, só via funções).
  Números em `boss_cfg()` (hora 20, 60 min, 50 mil de vida por conta ativa nos últimos 3 dias sem bots/admins,
  15 s entre ataques, dano máx. 200 mil por ataque, 5% lendário / 30% épico no top 10, consolação 70%, aliança 1%).
- Tudo é preguiçoso: `boss_garantir()` (chamado por `boss_estado`/`boss_atacar`) cria o despertar do dia a partir das 20h
  (anuncia no chat com `classe = 'sistema'`; o trigger `validar_mensagem` deixa passar quando `tanka.aviso_sistema = '1'`)
  e encerra os que passaram da hora (`dormindo` + `boss_premiar(id, false)`).
- `boss_atacar(meu, dano, chefe)`: o cliente luta e informa o dano (confiança no cliente, igual à caçada); quem zera dá
  o golpe final → `boss_premiar(id, true)`. Prêmios vão para `recompensas` com `origem = 'boss'`:
  `boss_premio {ataques, fator, chefe}`, `boss_item {raridade}`, `pergaminho`, `titulo {nome}`. Tesouro da aliança é direto.
- `admin_boss_invocar(meu, vida, minutos)`: botão no painel de admin (dia null, começa agora).
- Cliente: aba `mundial` (Aventura › Chefe Mundial), barra `#boss-barra` no topo quando ativo, consulta a cada 5 s
  (ativo/na aba) ou 60 s. Ataque = `R.iniciarBatalha(p, R.chefeDoNivel(p))` com a vida do reino e no máx.
  `D.CHEFE_MUNDIAL.acoesPorAtaque` (30) ações; `encerrarMundial` usa a vida/poções reais e não tira exp ao cair.
  Prêmios aplicados em `resgatarRecompensas` (`R.premioChefeMundial`, `R.itemDoChefeMundial`, `p.titulo`/`p.titulos`).

## Mercado entre jogadores (Henri, nov/2026)
- Mercado › Loja, seção "Itens dos jogadores" (`#mercado-jogadores`, redesenho parcial com `redesenharMercado`).
  Filtro por categoria (arma | armadura | joia | pergaminho) e ordem (recentes | nivel | raridade | preco | preco_desc),
  30 por página. Botão Vender abre a lista da mochila (sem equipados/travados) e pergaminhos (com quantidade).
- Servidor: tabela `mercado_anuncios`; `mercado_cfg()` (taxa 10%, 7 dias, 10 anúncios por vendedor).
  `mercado_anunciar` confere o item no personagem SALVO (cliente salva antes) e tira dele (inventário ou pilha de
  pergaminhos) sem mudar `versao`; o cliente tira igual na memória e salva.
  `mercado_comprar`: `ouro_real` ≥ preço → crédito −preço para o comprador, +preço×90% para o vendedor, item em
  `recompensas` (origem 'mercado'). Cancelar ou vencer (`mercado_expirar`, chamado no `mercado_estado`) devolve por recompensa.
- Pergaminho em recompensa agora aceita `qtd`. `grupo_estado` e `leilao_estado` passaram a mandar `origem` das recompensas.

## Poder dos itens: +6 de uma raridade ≈ +0 da seguinte (Henri, nov/2026)
- Arma já seguia a regra (+5%/nível no dano; cada raridade ~30% acima). Armadura/joia/mão esquerda tinham "no mínimo
  +1 por nível", que nos níveis baixos/médios deixava comum +6 acima de épica +0. Agora é só +5%/nível
  (`bonusComEncanto` sem arredondar; defesa arredonda depois do x4,5). Vale para todos os itens já existentes.
- `tanka_status` (Arena) arredonda igual ao cliente (defesa: `round(b0*m*fator)/fator`). Teste novo em regras.test.js.

## Raças e classes rebalanceadas (Henri + Daniel, nov/2026)
- Classes com 70 pontos (Cavaleiro +5 SOR, Caçador −5 SOR, Mago +5 SOR, Artesão igual). Raças não mudam mais os
  atributos (elevados/reduzidos vazios): cada uma tem `tracos` em dados.js, aplicados em `R.comRaca` (depois da passiva,
  antes do conjunto) e no `tanka_status` (Arena; crítico e dano crítico da raça viram dano, como a passiva).
  Humano {} · Elfo crit +5, vel +10%, vida −10%, dano −10% · Elfo Negro dano crít +10, dano +5%, vida −10% ·
  Orc vida +20%, dano +10%, crit −5, vel −10%, esquiva −50% · Anão vida +10%, dano +5%, crit −3, vel −5%.
- RES: vida = +3 por ponto acima de `RES_SEM_VIDA` (10), inclusive os da classe; defesa = RES x 0,45 (cada ponto conta).
- SOR: +0,2% sobre a chance base de cada drop por ponto (`SORTE.drop`, em `rolarRaridade`).
- Personagens antigos: `R.normalizar` (flag `atributosV2`) e um `do $$` no schema convertem uma vez: atributos += novo
  inicial − antigo inicial (pontos distribuídos mantidos). O trigger `validar_personagem` não mexe em `atualizado_em`
  quando `tanka.migracao = '1'` (para o Chefe Mundial não contar todo mundo como ativo).
- **Bosses próprios da aliança ("Os Libertos", nov/2026):** `BOSS_ALIANCA.bosses` (Thalgor, Nyxara, Sylvaris, Korvath,
  Azhgar; `feminino` troca Desperto/Furioso por Desperta/Furiosa) dão nome, descrição e imagem (`assets/monstros/boss-*.jpg`);
  os números continuam vindo de `BOSS_ALIANCA.chefes` (chefe da caçada da mesma fase). Entram em `D.monstros` no fim de
  dados.js (sem área). Chefe Mundial usa `D.monstros['ignaroth-mundial']` (imagem `boss-mundial.jpg`); o Ignaroth da caçada
  continua com a imagem dele. Imagens de 500x621, do Gemini (Daniel).
- **Golpe em área dos bosses da aliança (Daniel, nov/2026, "para valorizar os healers"):** do 2º boss (Nyxara) em diante,
  `BOSS_ALIANCA.bosses[i].area = { nome, cada, vidaPct }`: a cada `cada` (5, pedido do Daniel) ataques de verdade do boss
  (atordoado não conta), ele acerta todos os heróis vivos e tira `vidaPct`% da vida máxima de cada um (Nyxara 60,
  Sylvaris 60, Korvath 65, Azhgar 70; defesa não reduz, esquiva/Sombra evitam). Sem aviso na tela (Daniel pediu para
  tirar); aparece só no registro da luta ("💥 ... em todo o grupo!"). No motor (`simularSalas`): evento `{tipo:'habM'}` e
  golpes com `area: true`. Para caber 2–3 golpes em área por investida: `limiteAtaques` 15 -> 25 e `vida` 30 -> 45
  (mesmo nº de investidas: ~11–18 por boss com grupo de 4). Simulação: sem Curandeiro ~2 dos 4 caem; com Curandeiro
  ninguém cai (dano parecido: o Curandeiro cura em vez de bater).

## Clã (antiga Aliança) — skills, doação e missões (Daniel, nov/2026)
- **Nome:** na tela tudo virou "Clã" (textos de app.js e mensagens do servidor). Por dentro continua `alianca` (tabelas,
  funções, `estado.alianca`, ids de botão `al-*`), para não quebrar nada.
- **Doação:** no máximo `ALIANCA.doacaoMaxDia` (3.000) de ouro por jogador por dia (`alianca_doacoes`, conferido em
  `alianca_doar`; `alianca_estado` manda `doado_hoje`). Continua virando exp do clã + tesouro.
- **Skills (substituem os bônus de 7 dias, que só aparecem se ainda estiverem ativos):** `ALIANCA.skills` (10: exp, ouro,
  dano, critico, danoCritico, resistencia, vida, velocidade, esquiva, fortuna; `porNivel`) e `ALIANCA.skillPrecos`
  (25k, 40k, 65k, 100k, 150k, 225k, 325k, 475k, 700k, 1M). Só o líder compra (`alianca_skill_comprar`, tesouro), nível da
  skill <= nível do clã, permanentes (`alianca_skills`). O jogo copia as skills para `p.cla = { id, skills }`
  (`sincronizarCla` em app.js, ao carregar o clã; sai do clã = apaga), então masmorra e boss calculam igual em todos.
  Regras: `status(p, true)` (pve) soma `comCla` — usado em `iniciarBatalha` (caçada e Chefe Mundial) e `simularSalas`
  (masmorra e boss do clã). `status(p)` normal (ficha, poder, ranking, Arena) NÃO muda. exp/ouro em `bonusAlianca()`
  (app.js); Fortuna multiplica a chance em `rolarRaridade`. Ícones redondos: `assets/cla/skill-<id>.webp` (prompts com o
  Daniel; sem a arte aparece o símbolo do `simbolo`).
- **Missões do clã:** `ALIANCA.missoes.diarias/semanais` ({tipo, meta, ouro, buff}); progresso somado em
  `alianca_missoes` (periodo dia|semana, chave = dia_jogo() ou `alianca_semana()` = segunda 00:00). O jogo junta e manda a
  cada 30 s (`missaoCla`/`enviarMissoesCla`; tipos monstros, encantar, arena, masmorra; teto por envio
  `missoesMaxEnvio`); `bossCla` é contado pelo servidor quando o boss do clã morre. Cumpriu = ouro no tesouro x (1 + 0,2 x
  (nível-1)). Semanais cumpridas somam `buff`% de dano contra o boss do clã (`alianca_boss_buff`, vai em
  `alianca_boss_runs.buff` e no `simularBossAlianca(..., buff)` via `opc.buffDano`).
- Telas: Clã | ✦ Skills | 📜 Missões | ⚔ Boss do clã (`estado.aliancaVista`). Testes: regras.test.js ("skills do clã") e
  banco.test.sql (doação por dia, skills, missões, buff, boss conta na semanal).
- **Ajustes (Daniel, nov/2026):** ouro das missões pela metade (diárias 3.000/2.000/2.000/2.500; semanais
  20.000/15.000/15.000/25.000, x1,2 por nível do clã acima do 1) e buff de 2,5% por semanal (as 4 = +10%; `buff` agora é
  numeric no banco: `alianca_boss_buff` e `alianca_boss_runs.buff`).
- **Vice-líder (cargo `vice`, 1 por clã):** o líder nomeia ("Tornar vice-líder"; o vice antigo vira oficial). O vice compra
  skills, escolhe a hora do boss, muda o brasão, promove/rebaixa e expulsa oficiais e membros; não mexe no líder nem desfaz o
  clã. Se o líder some, o vice assume primeiro (`alianca_conferir_lider`). Check do cargo trocado com `alter table ... drop/add
  constraint alianca_membros_cargo_check`. Ícone 🛡️ (lista, chat). Ícones das skills: Daniel vai mandar uma folha 5x2
  (prompt no scratchpad); cortar em `assets/cla/skill-<id>.webp` na ordem de `ALIANCA.skills`.

- Ícones das skills do clã: cortados da folha 5x2 do Daniel (Gemini) em `assets/cla/skill-<id>.webp` (160 px, redondos com transparência).

## Craft dos Anões — etapas 1 a 3 (Daniel, nov/2026; PDF "Os Anões: Mestres da Forja", versão 4)
- **Encanto:** `encantamento.teto` por nível (+4 85 · +5 75 · +6 65 · +7 55 · +8 42 · +9 30 · +10 20%) vale para TODOS;
  Anão +`encantamento.anao` (3%) em `chanceEncantar`. **Pergaminho de Proteção** (consumível `protecao`, por raridade):
  `R.encantar(p, id, rng, true)` gasta 1 da raridade do item e, se falhar, o item fica como estava (`res.protegido`).
  Tela Encantar: caixa "🛡 Usar Pergaminho de Proteção" (`estado.usarProtecao`).
- **Materiais** (`D.CRAFT.materiais`, consumível `material` com `raridade` = id): 1 por região (cai do 1º/2º/3º monstro com
  6/8/10%) e 1 por chefe (sempre 1); `gema` (Pedra Preciosa) só nas Minas. Coletor: +50% (`coletorBonus`).
  `R.rolarMaterial` em `concluirBatalha` (`res.material`; não cai com penalidade de área).
- **Minas** (qualquer herói): `p.minas = { inicio, fim, opcao, area }`; 1 h (3–5) ou 4 h (12–18) do material da região mais alta
  liberada; 8% de cada unidade vira Pedra Preciosa; Coletor +50%. `R.iniciarMinas`/`recolherMinas`.
- **Coletor** fabrica Receita da região (`receita`, raridade = id da área; 10 materiais + ouro) e Proteção (cristais + materiais,
  `CRAFT.protecao`). **Ferreiro** forja (`R.forjar`): 1 receita + 5 materiais + ouro, para QUALQUER classe base e tipo (arma,
  4 armaduras, mão esquerda), item level = nível da região + 2; chances 60/35/5/0 + extras (até 3 do material do chefe da
  região: +3% épica/+0,5% lendária cada; até 3 gemas: +2%/+0,5%); obra-prima 2% (+1% Anão) = uma raridade acima;
  `item.forjadoPor`, `item.obraPrima`. Tela Herói › Oficina (`abaOficina`, selects `data-forja`).
- **Mercado:** categoria nova `craft`; `mercado_anunciar(..., pergaminho = 'material:<id>' | 'receita:<área>' | 'protecao:<rar>')`
  tira da pilha do consumível e entrega por recompensa (`resgatarRecompensas`, `TIPOS_CRAFT`).
- Ícones dos materiais ainda são emojis (⛏ 🔥 💎 📜 🛡); prompt da folha 6x3 entregue ao Daniel.

## Oficinas e Relíquia Rúnica — etapas 4 e 5 (Daniel, nov/2026)
- Tela **Mercado › Oficinas** (`abaOficinas`, `cliqueOficinas` com ações `of-*`, formulário `estado.contratar` com `data-contratar`).
  Ferreiro oferece encantar / forjar / relíquia; Coletor oferece receita / proteção (`CRAFT.oficina.servicos[*].de`).
- Servidor (fim do schema): `oficinas` (preços, `bonus_encanto` = Sorte x 0,5 + Anão e `sorte`, que o jogo do artesão
  atualiza sozinho), `oficina_pedidos`, `reliquias` (nome único). `oficina_pedir` tira do personagem SALVO o item e os insumos
  (`oficina_insumos`) e cobra preço + ouro da forja/receita (`oficina_ouro_extra`); o jogo tira igual na memória com o que volta.
  `oficina_fazer` joga a sorte no servidor (encanto com teto e Proteção; forja com as chances de `CRAFT.forja`, devolve
  `{tipo:'forjado', spec}` e o jogo monta o item com `R.itemForjado(spec)` pela semente; relíquia com `reliquia.base +
  sorte x porSorte` até `maxima`) e paga o artesão (preço − 10%). Cancelar ou 24 h sem fazer (`oficina_expirar`) devolve tudo.
  Taxa de acerto calculada dos pedidos feitos (encantos, acertos, +10). Sem estrelas.
- **Relíquia:** item lendário +7 do cliente + 3 Escamas + 2 Brasas do Ignaroth + 1 **Fragmento de Selo** (cai para quem dá
  mais dano no boss do clã). Só Anão Ferreiro level 30+, 1 por semana (`oficina_semana_reliquias`). Sucesso: `item.nome`
  (escolhido), `item.runa` (sorteada de `CRAFT.reliquia.runas`), `reliquia: true`, `forjadoPor`. Runas valem só contra
  monstros (`comRunas` dentro de `status(p, true)`). Ficha do item mostra runa e "Forjado por" (`craftItemHtml`).
  A força da runa sobe com o encanto do item (`reliquia.porEncanto` 0,25: +7 = 100%, +8 = 125%, +9 = 150%, +10 = 175%;
  `R.forcaRuna`, `bonusRuna`, `textoRuna`). Relíquia não pode mais ser encantada (`R.encantar` devolve null; `oficina_pedir` recusa).
- Testes: regras.test.js ("oficinas: ...") e banco.test.sql (bloco "Oficinas e Relíquia Rúnica").

- Ícones de craft: cortados da folha 6x3 do Daniel em `assets/itens/material-<id>.webp`, `receita.webp`, `protecao.webp` (128 px, fundo transparente) e `material-fragmento.webp` (Fragmento de Selo, imagem à parte).
- **Ajuste (Daniel, nov/2026):** material do chefe agora cai com `CRAFT.dropChefe` (15%, Coletor x1,5), não sempre; material
  da região cai mesmo com penalidade de área (para farmar Ferro etc. depois); Minas: o jogador escolhe a região
  (`R.iniciarMinas(p, opcao, agora, areaId)`, qualquer uma liberada; select `data-forja="minas"`).

- **Herói › Oficina nova (Daniel, nov/2026):** `abaOficina` com dois cartões (Forja / Bancada, `estado.oficinaVista`,
  ação `oficina-vista`) com retrato (`retratoArtesao`: o do herói se ele é dessa classe, senão o anão da classe, no sexo
  do herói). Materiais num `<details>` fechado (`estado.oficinaMateriais`). Forja em 4 passos com botões (`forja-op`:
  área, classe, tipo; `forja-qtd`: reforços 0–3), barra de chance e custos com ícone (`custoChips`, `iconeCusto`).
  `forjaAtual(p)` dá as mesmas escolhas para a tela e para o botão Forjar (antes o botão usava a área das Minas quando o
  jogador não mexia na região, diferente da tela). Sem a classe: aviso + botão para Mercado › Oficinas.

- **Mercado › Oficinas novo (Daniel, nov/2026):** `abaOficinas` com topo (retrato do anão ferreiro), "Meus pedidos" primeiro
  (`seloPedido`: esperando/bom/ruim/devolvido), "Minha oficina" com o retrato do herói, selo Aberta/Fechada, números em
  quadrinhos (`statsLoja`; acerto no encanto e +10 só para Ferreiro), preços em linhas e "Pedidos para fazer" com o que o
  artesão recebe (preço − taxa). Lista com filtro por serviço (`estado.ofFiltro`, ação `of-filtro`) e cartas com retrato
  (`retratoOficina`: raça/2ª classe/sexo do artesão) e serviços em botões (`ICONE_SERVICO`). Custos do formulário com
  `custoChips`. **Correção:** a peça da forja contratada usava o campo `tipo` (o mesmo do serviço): escolher a peça
  quebrava o formulário e o pedido ia com a peça "forjar". Agora é `estado.contratar.peca`. Nome do item sem o encanto
  repetido ("+5 Espada +5").
- **Balão "onde conseguir" (Henri, nov/2026):** em `custoChips`, todo chip que falta (exceto ouro) vira `.dica-custo`
  com um `.dica-balao` montado por `ondeConseguir(c)` (material da região: drop + Mineração; do chefe: chefe e `dropChefe`;
  gema: Mineração; fragmento: boss do clã; cristal: quebra na Forja com `CRISTAIS_QUEBRA`; receita: Coletor/Mercado).
  Números lidos de `D.CRAFT`. Toque/clique abre e fecha (classe `aberta`, listener global logo abaixo de `custoChips`);
  hover só em telas com mouse (`@media (hover: hover)`). O balão é empurrado para dentro da tela se passar da borda.

- **Quebrar item, amigo na hora e oficina parada (Henri, nov/2026):** serviço `quebrar` do Ferreiro
  (`CRAFT.oficina.servicos.quebrar`, `porNivel: true`): o preço do Ferreiro vale **por level do item** (`R.precoServico`;
  no servidor, `oficina_pedir` multiplica). O item vira cristais da raridade dele: `CRAFT.quebrar` (`R.cristaisQuebrar` e
  `oficina_cristais_quebrar` no SQL; Lv 1–9: 2, 30: 10, 45: 20, 60: 30). Relíquias não quebram.
  **Amigo:** se o artesão é amigo (amizade aceita, `sao_amigos`), `oficina_pedir` já chama `oficina_fazer_pedido` (a parte de
  `oficina_fazer` sem conferir o dono) e devolve `{feito, resultado}`; a lista marca `amigo` (selo "🤝 Amigo · faz na hora").
  **24 h:** artesão que não salva o jogo há `CRAFT.oficina.sumirHoras` (24) sai da lista e `oficina_pedir` recusa (`oficina_ativa`).

## Arena: só o dado decide (Henri, nov/2026)
- `arena_vez`: tirado o sorteio de esquiva (passiva/conjunto); na Arena só o 1 do dado erra. Exceção: a Sombra
  (`furtivo`) continua desviando do próximo golpe e garantindo o 20 no golpe seguinte (`critEm`) — Henri testou sem
  o desvio e pediu de volta. Precisão nunca contou na Arena.
- Nevasca (Bruxo) congela 2 turnos (`atordoa: 2`), na caçada, masmorra e Arena (chefes seguem limitados a 1).

## Mão esquerda x duas mãos (Henri, nov/2026)
- `MAO_ESQUERDA` ganhou `fixos`: bônus que valem pela raridade e NÃO crescem com o nível do item (`sortearBonus`).
  Aljava: dano % 4/7/10/14 + crítico 1/2/3/5 (saiu a precisão). Manopla: defesa (cresce) + dano % 4/7/10/14 (saiu FOR).
  Orbe: dano mágico 4/7/10/14 + dano crítico mágico 5/10/15/20. Livro: INT (cresce) + dano mágico 4/7/10/14.
  Escudo: defesa % 6/10/13/16 + vida % 3/5/7/9 (calibrado para o Poder ficar 97–104% do de duas mãos).
  Adaga/Shuriken: só o crítico ficou fixo. Encanto: escudo `defesaPct`, aljava/manopla `danoPct`, orbe/livro `danoMagico`.
- Chaves novas em `D.bonus`: `danoPct` (dano % para todos, somado ao `danoMagico` em `danoComMao`), `vidaPct`, `defesaPct`
  (multiplicam vida e defesa/defesa mágica em `statusBase`, antes da passiva). `tanka_status` igual.
- Itens antigos de mão esquerda continuam com os bônus que tinham (Henri: personagens serão apagados para o teste do zero).

## Mineração em Aventura (Henri, nov/2026)
- Aba `mineracao` (Aventura › Mineração, `abaMineracao`); as Minas saíram de Herói › Oficina (a Oficina ficou com
  receitas, proteção e forja). Tempos em `CRAFT.minas.opcoes`: 30 min (1–3), 1 h (3–5), 2 h (6–10), 4 h (12–18),
  8 h (24–32), 24 h (60–84). Mapa igual ao da caçada (`data-acao="minas-area"`) com janelinha `janelaMinaHtml`
  (material, Pedra Preciosa e a média do tempo escolhido, `R.mediaMinas`).
- `p.minas` guarda `minutos` e `qtd` (faixa) no começo. `R.pararMinas`: com `metadeDesde` (50%) do tempo ou mais, metade;
  antes, nada. `R.recolherMinas` no fim. Histórico em `p.historicoMinas[area] = { minutos, qtd, gemas, vezes }`.
- Ocupado: `R.minerando(p, agora)` barra `iniciarCacada` e a Arena (`bloqueadoMinerando` no jogo; no servidor,
  `arena_comecar_tipo` recusa se `dados.minas.fim` > agora).

## Habilidades do level 20 e 30 (Daniel, Henri e Rafael, nov/2026; PDF "Novas Habilidades" v4)
- **Passivas fixas** (Daniel): TODAS as passivas (as de sempre e as do 20/30) ficam sempre ligadas com o valor de 1 ponto
  (`PTS_PASSIVA` em regras.js; `arena_passiva`/`arena_extras`/`arena_milagre` com n = 1) e não recebem pontos
  (`mudarPontoHabilidade` recusa). `talentos()` apaga os pontos que estavam nelas (voltam livres). Sede de Sangue: 5%
  (`rouboVida: [4, 1]`). A tela mostra a passiva sem os botões. Pontos de arma numa passiva não fazem nada.
- **Valem em todo lugar** (Daniel): a do 20 tem `foco: 'cacada'` (mais forte caçando) e a do 30 `foco: 'arena'`, mas as
  duas entram em todas as ordens (`ordemNiveis2`). Cliente: `extrasNivel` (antes extrasPve) em `L.ex` também com
  `milagrePct`; golpes do 30 contra monstros (`opcoesNivel`, `depoisDoGolpeNivel`, `tickQueima`, `alvo.defQuebra`,
  `alvo.cego`, `reflete` em `aoReceber`, Milagre em `depoisDeReceber`). Servidor: `arena_extras` (ex no lutador),
  `arena_curar` (metade com a cura cortada), veneno (`veneno` no outro), escudo, Têmpera, roubo, Bolso e regeneração em
  `arena_vez`. O texto abaixo que fala "só contra monstros"/"só na Arena" é da primeira versão.
- Dados: 2 habilidades a mais por segunda classe em `SEGUNDAS_CLASSES` (no fim da lista), com `nivel` (20/30) e `modo`
  ('pve' = caçada e masmorra; 'arena' = Arena). Valores novos em `[base, porPonto]` (`R.valorNivel`). Pontos:
  `TALENTOS.pontosDepois` = +2 por level do 21 em diante (14 no 20, 34 no 30); servidor em `arena_pontos_ok`.
- `R.passiva` / `arena_passiva` continuam pegando só a passiva de sempre (sem `nivel`). `R.habLiberada`, `R.habNoModo`;
  `kitHabilidades` filtra por modo e nível; `talentos()` põe as novas UMA vez no começo da ordem do modo (`ordemNiveis`).
- Level 20 (regras.js, caçada `passo/ataqueMonstro/golpeJogador` e masmorra `simularSalas`): `extrasPve` (regenPct,
  rouboVida, reducaoDano, danoPvEPct, curaEmergencia+limiar) em `L.pve`; tipos novos `dot` (veneno/sangramento, `tickDot`
  no começo da vez; `pula` para o próximo monstro vivo) e `escudo` (`aoReceber`, pode congelar quem bate), ambos sem gastar
  a vez (`ehReforco`). Bolso de Poções: `depoisDeReceber` (1x por luta). Números calibrados por simulação (400 caçadas por
  classe nas Areias, conjunto raro +3): todas ganham ~+20% a +90% de abates por barra de vida (Arqueiro ganha menos, já era o melhor).
- Level 30 (schema.sql, `arena_vez`): Defesa Suprema (reforço com `defesaPct` + `reflete`), Golpe Apocalíptico
  (`vidaFaltando`), Tiro Silenciador (`silenciado`, `ignoraDefesaPct`), Execução (`garantido` = 20 do dado, `semEsquiva`
  passa pela Sombra, `executa`), Maldição (`queima` no começo da vez + `cortaCura`), Milagre (`arena_milagre` no lutador,
  `arena_milagre_usar`), Martelo das Correntes (`atordoa` + `defQuebra`), Pó nos Olhos (tipo `cegar`: `cego`/`cegoPct`).
  `arena_avancar`/`arena_jogar` agora também terminam a luta se quem age cai na própria vez (queimadura, dano devolvido).
  Testes: banco.test.sql ("arena: ..." level 30) e regras.test.js ("habilidades do level 20/30", "level 20 na caçada").
- Tela: `efeitoNivel` (texto com os valores), cadeado "Libera no level N" (`.trancada`), etiqueta do modo (`.hab-nivel`);
  mensagens novas na caçada (☠️ veneno, 🧪 bolso), masmorra e Arena (queima, calado, Milagre, devolve, cego, executa).
- Ícones: os 16 FEITOS (2ª folha do Daniel, Gemini, 4x4 limpa), cortados com `separacoes` de recortar_grade.py (margem 8)
  (só a pintura, sem o nome) em `assets/habilidades/<id>.webp` 192x192.

## Caixa de entrada e sininho (Henri, nov/2026)
- Botões ✉ e 🔔 no fim da barra de recursos (`botoesAvisosHtml`), com selo de não lidas; painel `#painel-topo` no body.
- Caixa: `p.caixa` (até 80, mais novo primeiro, `{t, o, x}`) e `p.caixaVista`. Entra pelos avisos de `resgatarRecompensas`
  (`avisarCaixa`, origem da recompensa → boss/leilao/mercado/oficina/cla/masmorra) e de `aplicarCreditos` (menos os
  que o próprio jogador fez: lance, compra, fundação/doação do clã, pedido na oficina). "Mochila cheia" não entra.
  Prêmios da masmorra (itens e "mochila cheia" dela) e pergaminhos ganhos não entram (16/11/2026): só no sininho
  (`avisarSemMasmorra`; masmorra = origem que `origemCaixa` não conhece).
- Sininho: todo `avisar` (`guardarNotificacao`), até 60, no localStorage por personagem (`eldrin.notificacoes.<id>`).

## Ficha do item flutuante (Henri, nov/2026)
- Saiu o painel `#ficha-item` ao lado dos equipados (mudava de tamanho e empurrava a mochila) e o "passar o mouse".
  Um clique em item/consumível abre `#ficha-flutuante` (dentro do #app, `position: fixed`, ao lado do item) com
  `fichaItemHtml` + botão "Ampliar e comparar" (`item-ampliar` → o zoom de antes). Fecha clicando fora, no ✕, no mesmo
  item ou Esc. `telaJogo` foi embrulhada para reabrir a ficha presa ao item depois de redesenhar.

## Anti-trapaça — etapa 1: caçada no servidor (Henri, nov/2026)
- Plano completo: https://claude.ai/artifact/MCf7AJMvDfvfjccGQc2PVy (etapas 2–5 ainda não feitas).
- Regra única em `js/servidor-cacada.js` (`Tanka.servidorCacada`: `encontro`, `lutar`, `fugir`). Roda na Edge Function
  `supabase/functions/cacada/index.ts` e, na prévia sem servidor, dentro de `contas-local.js`.
- `ferramentas/gerar_servidor.js` junta dados/historia/regras/servidor-cacada em `supabase/functions/_shared/tanka.js`
  (gerado, fora do git). O GitHub (`.github/workflows/funcao-cacada.yml`) gera, testa e envia a função a cada push no
  main que mexe nas regras. Precisa do segredo `SUPABASE_ACCESS_TOKEN` no repositório; sem ele só avisa.
- A função: confere o login (`/auth/v1/user`), lê o personagem com o login do jogador (RLS), pega o bônus do clã em
  `cacada_bonus(meu)` (schema.sql), roda a regra com o relógio/sorteio do servidor e grava com a proteção de versão
  (409 = outra aba). Publicada com `--no-verify-jwt` (chaves novas do Supabase); não usa a chave secreta.
- Ritmo: `p.encontro.prontoEm` (metade do tempo de busca) e `p.cacadaLivreEm` (fim da luta no modo rápido). Pedir de
  novo devolve o mesmo encontro (não sorteia outro chefe); fugir não acelera.
- Cliente (`app.js`, `CACA_SERVIDOR`): a luta vem pronta (`eventos` com vida/poder depois de cada um) e é animada pelo
  `turno()` com `b.replay`; sem poção/habilidade manual no meio da luta (poção automática pela opção da caçada).
  "Caçar de novo" vira caçada contínua de um monstro. `C.cacada` entra na fila das gravações e troca o personagem em
  uso pelo do servidor (o mesmo objeto); `salvarPersonagem` copia na hora de gravar. Se a função não existir (404),
  volta ao jeito antigo.
- Testes: `node testes/regras.test.js` (regra) e `deno run --allow-read --allow-env testes/cacada_servidor.test.ts`
  (função, com Supabase de mentira; antes rodar `node ferramentas/gerar_servidor.js`).

## Página inicial e endereço do jogo (Henri, nov/2026)
- `index.html` (raiz) é a página de apresentação, com o botão Jogar. O jogo saiu da raiz para `jogar/index.html`
  (endereço `/jogar/`), com `<base href="../">`: js, css, assets, sw.js e manifest continuam na raiz.
- `manifest.webmanifest`: `start_url` = `./jogar/` (o app instalado no celular abre direto no jogo).
- O ?v=N dos scripts agora se sobe em `jogar/index.html`.
- APK/app instalado: a página inicial (`index.html`) manda direto para `jogar/` quando aberta pelo app (referrer
  `android-app://` ou display-mode standalone/fullscreen). `.nojekyll` na raiz deixa o GitHub Pages publicar a pasta
  `.well-known/` (para o `assetlinks.json` do APK novo, gerado no PWABuilder com https://eldrinonline.com.br/jogar/).

## Música no iPhone/iPad (Henri, nov/2026)
- No iOS o `audio.volume` não muda por código (fica 1). O `sumir()` só pausava quando o volume chegava a 0, então ao
  trocar de cena (entrada → jogo, arena, chefe) a música velha nunca parava e desligar só pausava a atual.
  Agora `sumir()` pausa por tempo (~1,2 s), desligar chama `pararTodas()` (lista `audios`) e volume 0 vira `muted`.

## Troca de interface no iPhone (Henri, nov/2026)
- No iPhone a troca Zealot → Clássica recarregava e voltava Zealot (o localStorage não gravava a tempo antes do
  `location.reload()`). Agora a escolha também vai num cookie `eldrin_interface` (lido primeiro em `jogar/index.html` e
  `ferramentas/artifact.html`) e a página recarrega 150 ms depois.

## Monstro ataca primeiro (Henri, nov/2026)
- `iniciarBatalha` (caçada): o monstro só começa com a barra cheia (golpe garantido primeiro) nas 2 primeiras zonas
  (Floresta Sombria, Pântano de Brumafria) — `monstroComeca(m)` pela ordem de `D.areas`. Da 3ª zona em diante os dois
  começam com a barra vazia e age primeiro o mais rápido.

## Vitalidade (Henri, nov/2026)
- **DESLIGADA** desde 10/11/2026 (teste do progresso sem ela): `D.VITALIDADE.ligada = false`. Para voltar: `ligada: true`
  em js/dados.js (sobe o ?v=); a regra, a barra e os testes voltam sozinhos.
- `D.VITALIDADE` = { maximo 100, maximoVip 200 (p.vip, futuro), porHora 5, multiplicador 2, fuso -3 }.
- `p.vitalidade = { pts, dia, em }`, atualizada sem pressa por `R.atualizarVitalidade(p, agora)`: dia novo (meia-noite
  de Brasília) = cheia; senão +porHora a cada hora cheia desde `em` (cheia não acumula horas).
- `concluirBatalha`: vitória fora de área penalizada gasta 1 ponto e dobra exp e ouro (depois dos bônus de clã/Coletor);
  `res.vitalidade = true`. Drops não mudam. Como a caçada roda no servidor (função `cacada`), lá também vale.
- Tela: barra branca "Vitalidade" embaixo da Experiência na ficha (com dica) e barrinha branca embaixo da exp na caçada;
  "(Vitalidade x2)" na linha da vitória.

## Chapéu do mago com defesa (Henri, nov/2026)
- `armaduras.mago.elmo.bonus.defesa` = [1, 3, 6, 12] (igual ao capuz do arqueiro, menos que elmo do cavaleiro/artesão).
  Chapéus antigos ganham a defesa no `normalizar` (pelo nível/qualidade ou raridade). `tanka_dados()` regerado.

## Leilão: fase sempre do servidor ao abrir (Henri, nov/2026)
- `abrirAba('leilao')` apaga `estado.leilao` antes de desenhar: mostra "Carregando…" e pega a fase do servidor (antes
  mostrava a fase guardada da última visita, ex.: "Médio" de 10 min atrás, e o jogador perdia o fim).
- `redesenharLeilao`: atualiza a cada 20 s, e a cada 5 s nas fases Curto e Muito curto.

## Estamina (Daniel/Henri, nov/2026) — PDF "Estamina: o fôlego do caçador"
- `D.ESTAMINA` = { maximo 240, minutosAcampado 30, minutosSemAcampar 90, custo [1,2,3], custoChefe 5, pote { enche 240,
  precos [40, 60] de reputação } }. `p.estamina = { pts, em, potes }`.
- `R.atualizarTempo`: reset da meia-noite (estamina cheia, potes do dia zerados, poções = pelo menos 2) e recarga pela
  hora (`em`); fora da luta a vida fica sempre cheia. Acampar = estamina 3x mais rápido (não caça acampado).
- Vida cheia a cada luta (`iniciarBatalha` começa com hpMax). Por isso a caçada usa `danoCacada` de cada monstro
  (`D.monstros[id].ataqueCacada`, em `b.ataque`); o `dano` antigo (`ataque`) continua valendo na masmorra, no boss do clã
  e no Chefe Mundial. Calibrado com `node ferramentas/simular_cacada.js`: herói típico da área perde ~60% da vida no 3º
  monstro e o forte ~55% no chefe; 1º e 2º são seguros; o típico precisa de poção para o chefe.
- 11/11/2026: o 3º monstro de Torre, Areias, Vale e Cume estava forte demais (típico vencia 21–63%; a Múmia batia mais
  que o Faraó). `danoCacada` baixado para o típico vencer ~88% como nas 3 primeiras áreas: Espectro 70–97, Múmia 114–154,
  Cavaleiro Dracônico 224–301, Elemental 379–513. Ao recalibrar, mirar a % de vitórias do 3º, não só a vida perdida.
- `concluirBatalha`: toda luta gasta `R.custoEstamina(monstro)` (vitória, derrota, fuga); derrota = perde a estamina da
  luta e 5% da exp (não fica mais sem vida). `servidor-cacada.js`: só sorteia monstro (e chefe) que a estamina paga;
  sem estamina a caçada para.
- Poção de vida: 2 de graça por dia; compra no Mercado por ouro (`D.POCAO.precos`: 100 / 500 / 5.000 / 10.000 pelos
  levels 1–9 / 10–19 / 20–29 / 30+), guarda no máximo 2 (VIP 4, `p.vip`). Só na caçada (o botão "Usar" de fora saiu).
- Pote de estamina: Mercado › Poções, `R.comprarPoteEstamina` (40 e 60 de reputação, 2 por dia, pode passar de 240).
- Missões: diária da Arena 40 de reputação, bônus de todas as diárias 60 (paga os 2 potes).
- Anel: a regeneração de vida saiu (anéis antigos perdem `bonus.regen` no `normalizar`).
- Chefe Mundial: `iniciarBatalha(..., { mundial: true })` (vida cheia, sem poção, sem estamina) e no máximo 5 ataques por
  despertar (`boss_cfg.entradas` + trava em `boss_atacar`; `D.CHEFE_MUNDIAL.entradas`).
- Tela: barra de Estamina na ficha e na caçada (⚡), custo ⚡ na carta de cada monstro, admin "Estamina e poções".
- Teste do banco: o preço do clã mudou (6.000/100) e o teste foi acertado para continuar rodando.

- **3º monstro e chefe mais duros (Daniel, nov/2026):** `danoCacada` do 3º monstro recalibrado para o herói "forte" da
  simulação perder ~40% da vida (Cume ~17%) e o "típico" vencer só parte das lutas sem poção (Floresta/Pântano/Ruínas
  ~85–90%, Vale ~70%, Cume ~55%, Areias ~45%, Torre ~30%) e ~100% com 2 poções. Chefes: forte perde ~60% (Ruínas e Vale
  não mudaram). 3º: urso 14–23, troll 15–20, gárgula 58–78, espectro 100–138, múmia 163–220, cavaleiro dracônico 261–351,
  elemental 450–610. Chefes: Velgrath 17–21, Morgath 17–19, Guardião 86–115, Faraó 143–193, Ignaroth 612–825.

- **Caçada: luta em etapas, poção na hora e exp só no fim (Daniel, nov/2026).** `servidor-cacada.js`: com
  `opcoes.etapas`, `lutar` só começa a luta (`p.luta` = { monstro, normal, chefe, semente, inicio, pocoes, auto, bonus,
  heroi (cópia do herói com só os itens equipados), primeiraVez, total }) e devolve os eventos SEM prêmio. A luta é
  refeita sempre com `sorteioSemente(semente)` (mulberry32), a poção automática e as poções do jogador
  (`luta.pocoes` = turnos; a poção entra antes do evento daquele turno). Ações novas: `pocao` (turno = próximo evento da
  tela; recusa vida cheia, sem poção, já bebendo, turno repetido/anterior ou depois do fim) e `fim` (só depois de
  `inicio + eventos x 275 ms`; aplica `concluirBatalha`, missões, história, e já manda o próximo encontro). Poções
  compradas no meio da luta não se perdem. Luta largada (fechou o jogo) é terminada sozinha por `fecharPendente` no
  começo de `encontro`/`lutar`/`fugir` (com espera se o tempo dela não passou). Sem `etapas` (jogo antigo no cache)
  continua a luta inteira de uma vez. Função `cacada` (index.ts) e `contas-local.js` aceitam `pocao`/`fim`.
- Cliente (`app.js`): `lutarNoServidor` manda `etapas: true`; `b.replay.etapas` com `res` nulo; ao acabar os eventos,
  `fimNoServidor` pede o resultado e só então `encerrar`. Botão de poção (`podeBeberPocao`, `beberNoServidor`) pausa
  a animação, pede `pocao` e troca os eventos dali em diante. Parar no meio da luta em etapas: a luta termina e a
  caçada para depois. Barra de exp da caçada mostra o herói de antes (`b.replay.antes`) até o fim, com o número
  (`.exp-fina > b`). Botão de poção menor (`.btn.cacada-pocao`).

## Exp dos monstros (Henri, nov/2026)
- `D.MONSTRO.expMonstros` = [1, 2.5, 5]: exp do 1º, 2º e 3º monstro = `base.exp` da área x isso (antes 1, 2, 4).
  Floresta 2/5/10, Pântano 10/25/50, Ruínas 30/75/150, Torre 90/225/450, Areias 270/675/1350, Vale 800/2000/4000,
  Cume 2400/6000/12000. Chefe = 5x o 3º (Velgrath 50). Por ponto de estamina: 1º = 1x a base, 2º = 1,25x, 3º = 1,67x,
  chefe = 5x (o 2º rende mais que o 1º e menos que o 3º).

## Atualização automática (Henri, nov/2026)
- **DESLIGADA** em 10/11/2026 (`ATUALIZAR_SOZINHO = false` em app.js): causou problema. Suspeita: o GitHub Pages guarda o
  HTML por até 10 min; o recarregar pegava a página velha e o jogo recarregava de novo a cada 2 min.
- `app.js` (fim): a cada 2 min e ao voltar para a aba, baixa `jogar/index.html` sem cache e compara os `?v=` dos js/css
  com os da página aberta. Mudou = versão nova publicada: aviso "Saiu uma versão nova…" e recarrega em 4 s, esperando a
  luta na tela acabar (batalha, masmorra, Arena ou pedido de luta da caçada). Depende de subir o `?v=` a cada publicação
  (regra 5 do CLAUDE.md), o que já é feito.

## Pergaminho da masmorra 90% (Henri, nov/2026)
- `D.MASMORRA.pergaminho` = 90 (antes 50). O servidor (`masmorra_concluir`) agora lê a chance de
  `tanka_dados() -> MASMORRA -> pergaminho` (antes era 0.5 fixo no SQL): mudar só em dados.js e rodar gerar_dados_sql.

## Leilão: item que a classe não usa (Henri, nov/2026)
- `abaLeilao`: com `R.podeUsar(p, item)` falso, o nome do lote ganha um ✖ vermelho e a linha "Sua classe não usa este
  item" (igual ao Mercado). Pacotes de pergaminho nunca mostram.

## Entrega segura dos prêmios (Henri, nov/2026)
- Bug: `resgatarRecompensas` chamava `recompensa_resgatar` (marca no servidor) ANTES de gravar o personagem. Se a gravação
  falhava (conflito "jogado em outra aba"), o jogo recarregava sem o item e o prêmio já estava marcado: sumia (caso do
  anel lendário do Aladin no leilão, 11/11).
- Agora: aplica o prêmio usando `rec.item` (o mesmo que o servidor devolveria), guarda o id em `p.recebidas` (últimos
  200), grava (`await C.salvarPersonagem`) e só então marca no servidor. Gravação falhou = o prêmio volta na próxima
  vez; marcação falhou = `p.recebidas` impede entrega dupla.

## Página inicial: seção Sobre (Henri, nov/2026)
- `index.html`: menu no topo (Sobre, Arena, Classes, Jogar), botão "Sobre ↓" ao lado do Jogar, e as seções: o que é
  Eldrin, números (5 raças, 4 classes, 8 especializações, 7 regiões, 7 masmorras, +10), herói (print), Leilão (print),
  Arena com o D20 3D de verdade (`js/dado3d.js`, skin dourada; a 1ª rolada cai no 20, depois sorteia; sem WebGL mostra
  "20"), cartas (Caçadas, Masmorras, Chefe Mundial, Alianças), fala do Aldric (historia.js) e as classes.
- Prints em `assets/site/` (perfil.webp, leilao.webp), tirados do jogo com um herói montado no teste local.

## Ouro das últimas áreas (Henri/Daniel, nov/2026)
- O ouro pulava x16 da Torre para as Areias (67 -> 1.067 por estamina no 3º monstro) e o fim do jogo rendia ~5 mi/dia.
  Agora cresce ~x3 por área, como a exp: Areias 150/300/600 (chefe 3.000), Vale 450/900/1.800 (9.000),
  Cume 1.350/2.700/5.400 (27.000). Prêmios do boss do clã e do Chefe Mundial (feitos do ouro dos chefes) caem junto.
- Próximo passo combinado (parte 2, ainda não feito): gastos de ouro que crescem com o jogador (encanto custar ouro etc.).

## Ajustes de 11/11/2026 (Henri)
- Estamina: `minutosAcampado: 120`, `minutosSemAcampar: 0` (0 = sem acampar não recupera; `estaminaPorMinuto` devolve 0,
  `atualizarTempo` só avança `e.em`, `minutosParaEstaminaCheia` devolve null). Meia-noite e pote continuam enchendo.
- Caçador: `atributoDano` voltou para 'des' (estava 'for' desde 03/11). Presente de 1 Recomeço: `p.presenteDestrezaCacador`
  (quem ainda não tinha visto o da Força ganha os 2 numa mensagem só). tanka_dados regenerado.
- Caçada: `CACADA.tempoInicio`/`tempoFinal` = [2000, 2000] (monstro novo sempre em 2 s).
- **Caçada com o jogo fechado** (Henri, 11/11/2026): `p.cacadaAuto` = { alvos, chefe, lutarSempre, pocao, em }, ligado pelo
  `encontro`/`fim` com `auto` (as opções da caçada) e desligado por `parar` (botão Parar/fechar a caçada), derrota ou sem
  estamina. Ação `retomar` (servidor-cacada.js): faz as lutas que caberiam no tempo fora, no ritmo normal da tela (busca
  inteira + contagem de 3 s sem "lutar sempre", turno 550 ms, pausa 900 ms); chefe só luta com "sempre lutar", senão foge.
  App: aba escondida/app no fundo = `cacadaParaFundo` (para os timers); ao voltar (`visibilitychange`) ou ao entrar no
  jogo com `cacadaAuto`, `retomarCacada` pede o `retomar`, avisa o resumo ("Enquanto você esteve fora…") e continua a
  caçada na tela (troca o objeto `estado.cacada` para respostas atrasadas não mexerem). Testes: cacada_servidor.test.ts.
- Acampar desligado (Henri, 11/11/2026, noite): `ESTAMINA.acampar: false`, `minutosSemAcampar: 90` (enche sozinha em 1h30; era 2 h).
  Sem botão Acampar; `R.acampar` não acampa e `normalizar` tira o `p.acampado` antigo. Para religar: `acampar: true` e
  acertar `minutosSemAcampar`/`minutosAcampado`.

## Casca do celular (Daniel, nov/2026)
- Ligada no começo de `jogar/index.html` (e `ferramentas/artifact.html`): toque (`pointer: coarse`) + tela de até 820 px.
  **Não tem escolha** (Daniel, nov/2026): celular é sempre a casca; Clássica e Zealot só no computador (a opção Tela e o
  `eldrin.tela` saíram; a ⚙ > Interface do celular só explica isso). Põe `html[data-celular]`
  e força o tema Zealot (a opção Interface some no celular). Estilo só em `css/celular.css` (tudo com `html[data-celular]`).
- `app.js`: `CELULAR`; no celular o Leilão entra no grupo Mercado (barra de baixo com 5). `telaJogo` usa `cascaTopoHtml`
  (retrato → Herói, nome, Lv, exp; ícones 💬 `casca-chat`, 📜 `casca-missoes` com selos `#casca-chat-selo` /
  `#casca-missoes-selo`, atualizados em `desenharChat` / `desenharMissoes`; menu com Trocar / Som(⚙) / Sair) e as
  sub-abas em `.casca-subabas` acima do conteúdo. Chat, missões e ⚙ não flutuam mais (os botões deles somem; abrem
  pelos ícones). Caçada: Velocidade e Parar numa barra fixa embaixo. Vibração (`vibrar`) em golpe forte e level up.
- **Herói no celular:** ficha do item (`#ficha-flutuante`) vira folha que sobe de baixo (CSS com `!important` por cima do
  left/top do `desenharFlutuante`, fundo escurecido). Mochila com 5 por linha; ordenar/filtrar numa gaveta
  (`.mochila-ferramentas`, `estado.mochilaFerramentas`, ação `mochila-ferramentas`) e "Vender vários" ao lado.
  Espaços do equipamento maiores (`--slot`).
- **Mercado e Arena no celular:** a Loja foi separada em partes (`mercadoPartes`: jogadores, reino, pocoes, especiais,
  troca, skins; no PC `mercadoPartesTudo` junta todas como antes); no celular uma parte por vez (`SECOES_LOJA`,
  `estado.lojaSecao`, ação `loja-secao`). Textos longos de regra (mercado dos jogadores, Leilão, Arena e "quem posso
  desafiar") ficam numa gaveta `.regras-celular` ("ⓘ Como funciona"). Arena: retrato em cada linha (`.arena-retrato`,
  raça/sexo/2ª classe que o `arena_estado` já manda), linhas na horizontal, abas e categorias deslizando de lado.
  Linhas da Loja (`.item-com-icone`) com o botão largo embaixo.
- **Social (Daniel, nov/2026):** ordem das abas Clã, Ranking, Amigos (no PC também). Ranking com a opção **Clãs**:
  `public.ranking_clas()` (schema.sql; top 50 por level do clã, empate exp e poder somado; membros e líder), cliente
  `C.rankingClas`, tela `rankingClasHtml` (brasão `.cla-brasao`, meu clã destacado). No celular o ranking de jogadores
  vira cartões com retrato (`linhaRanking`). `alianca_estado` manda `raca` dos membros (retrato no celular). Topo da
  casca mostra o Poder ao lado do nome (`.casca-poder`). Teste no banco.test.sql ("ranking_clas").
- **Caçada no celular:** cartas de monstro deitadas (imagem à esquerda) com resumo `.monstro-resumo` (⚡ estamina, exp,
  ouro, vida, dano) e a ficha completa em `.monstro-detalhes` ("Ver detalhes"). "Iniciar caçada" (`.cacada-escolha`)
  fixo logo acima da barra de baixo. Na luta o topo não gruda mais; registro mais baixo. Fim da caçada: "Continuar" e
  "Voltar à região" na barra fixa de baixo.
- **Masmorra no celular:** explicação numa gaveta; as 3 vagas do grupo lado a lado com retrato; "Estou pronto" e
  "Entrar" grandes; masmorras bloqueadas sem os detalhes. Luta: heróis em cima e monstros embaixo, 3 por linha, e
  "Acelerar" na barra fixa de baixo (só CSS, em `css/celular.css`).
- **Masmorra: acelerar é 2x** (era 4x; `L.atraso / 2`, botão "Acelerar 2x"). **Luta da Arena no celular:** lutadores
  em cartão baixo (retrato 3,6rem ao lado do nome e da vida), mesa do dado com 150px e registro com 7,2rem: vida, dado e
  narração cabem juntos na tela (só CSS).
- **Herói › Oficina no celular:** cartões Forja/Bancada baixos (retrato ao lado), a fala sem o retrato repetido,
  regiões numa fileira que desliza, classes 2 por linha, peças 3 por linha, "Forjar" grudado embaixo (sticky).
  `telaJogo` (celular) centraliza o item escolhido nas fileiras que deslizam (sub-abas, regiões da forja, seções da
  Loja, arenas, partes do clã, categorias do mercado).
- **Encantar no celular:** pergaminhos em fichinhas com ícone (`.enc-chips`), explicação na gaveta, Proteção como chave
  grande (`.enc-protecao`), lista `.enc-lista` sem os bônus do item (`.enc-desc` escondido) e botão Encantar à direita.
  A forja (janela do encanto) já servia no celular.
- **Habilidades no celular:** escolha da 2ª classe em cartão deitado com "Ver as N habilidades" (gaveta
  `.classe2-habs`); textos de regra em gavetas; cartas numa coluna; "Confirmar pontos" grudado embaixo; ordem de uso
  numa coluna com botões maiores.
- **Avisos de item na cor da raridade:** `avisarItem(it)` (tipo `item raridade-<r>`; peça de conjunto também pela
  raridade, com "(conjunto)" no texto), também na forja e no pergaminho; o sino pinta o texto na mesma cor. (O fundo
  verde nas peças de conjunto foi tirado: o conjunto pode vir em qualquer raridade.)
- **Interface separada do Som:** `alternarPainel(fechar, 'interface')` abre a janela "🎨 Interface" (Tela e Tema;
  no celular só Tela); botão `menu-interface` no topo da Clássica e no menu da Zealot/celular. A ⚙ ficou só com o som.
- **Entrada no celular:** lista de personagens em linhas (retrato, nome, Jogar e Excluir à direita). Criação: raças e
  classes em fileiras que deslizam, história da raça na gaveta `.lore-celular`, "Criar personagem" fixo embaixo.
  Login e cadastro já serviam.

## Pedidos do beta tester (Daniel, nov/2026)
- Loja: "Ordenar por" com o estilo dos outros campos (`.mercado-ordem`). Filtro **"Só o que a minha classe usa"**
  (`filtroMercado().soClasse`, ação `mercado-so-classe`): o jogo manda `filtro` { classe, armas, maos, padrao } para
  `mercado_estado(meu, categoria, ordem, pagina, filtro jsonb default null)` (o de 4 parâmetros foi apagado; sem o
  filtro a chamada é igual à antiga) e o servidor filtra com `mercado_serve(item, filtro)`. Testes no banco.test.sql.
- Loja dos jogadores e Leilão: "▲ Melhor que o seu equipado" (`dropMelhor`).
- Mochila: passar o mouse num item mostra a ficha (`estado.fichaHover`, classe `.hover`; sai do item e da ficha =
  fecha; clicar fixa com `fixarFichaHover`). Botão direito continua equipando (pedido do Daniel); dois cliques não equipam
  mais (o `dblclick` saiu). **Comparar dois itens:** botão "⚖ Comparar com outro" na
  ficha (`estado.compararCom`), o próximo item tocado abre os dois lado a lado (`estado.comparando`, `.comparar-duas`).
- "💰 Vender vários" (já existia; só ficou mais visível).
- Celular: "⚔ INICIAR CAÇADA" menor e dourado (`.cacada-escolha .btn-iniciar` no celular.css). Janelas de item da
  loja e do leilão ganharam ✕ (`.zoom-x`); no celular o `.conteudo` (z-index 1) ficava abaixo da barra de cima e a
  escondia o topo da janela: `.conteudo:has(.zoom-fundo)` sobe para z-index 60.
- Celular › Mineração (`abaMineracao`, só com `CELULAR`): texto na gaveta "Como funciona", rótulos "Quanto tempo" /
  "Onde minerar", 6 tempos numa linha, minas em cartões baixos e a `mina-janela` logo abaixo da mina escolhida (não
  solta no mapa). "Minerar" dourado preso embaixo (`.minas-acoes` fixo). Minerando (`soAndamento`): só o andamento e
  "Parar de Minerar". Histórico em cartões (`.minas-hist`) em vez da tabela.
- Celular › Chefe Mundial (`bossPainelHtml`, só com `CELULAR`): topo deitado com arte pequena e `.boss-hora`
  (hora, duração, ataques); regras e prêmios em gavetas; "Próximo despertar" em destaque (`.boss-proximo`); meu dano,
  lugar e ataques em quadrinhos (`.boss-eu`); rankings de heróis e clãs em linhas (`.boss-linha`, 1º/2º/3º em
  ouro/prata/bronze, a minha em dourado). "Atacar Ignaroth" preso embaixo (`#boss-painel > .botoes` fixo).
- Celular › História: falas com retrato menor e letra de leitura; selos espalhados na largura; capítulos lidos numa
  fileira que desliza; na cena (`.hist-janela`) o botão fica preso no pé da janela.
- Celular › Chat: folha de baixo com fundo escurecido e "alça"; mensagens em balões (`linhaChat`/`linhaChatAlianca`
  com `CELULAR` → `.chat-balao`, a minha `.minha` à direita em dourado); campo com 16px (o iPhone não dá zoom).
- Celular › Missões: folha de baixo (82dvh, fundo cheio, alça), fundo escurecido, cartões mais baixos.
- Baú do dia (celular e computador): cartão em destaque (`.missao-bau`: borda dourada, brilho, 🎁 grande), com
  quantas diárias já foram feitas (x/4) e barra; pronto para abrir ele pulsa (`bau-brilho`/`bau-pula`).
- Artes novas (folha 3x2 do Daniel, Gemini): `assets/itens/bau-diario`, `bau-diario-aberto` (Baú do dia; aberto depois
  de resgatar), `pocao-vida`, `pote-estamina`, `recomeco`, `recomeco-habilidades` (.jpg 256 + .webp sem fundo). Na Loja
  via `arteLoja(nome)`; na luta e no registro a poção continua o `ICONE_POCAO` (SVG pequeno).
- Celular › menu do escudo (`menuCelularHtml`, troca o `menuTopo` quando `CELULAR`): painel que desce do topo com o
  herói (retrato, nome, level, poder) e grupos Jogo (Missões, Chat, Caixa de entrada, Avisos, em quadradinhos 2x2),
  Configurações (Interface, Som) e Conta (Admin, Trocar personagem, Sair em vermelho; só fora de luta). Caixa e sino
  saíram da barra de recursos no celular (`recursosHtml`) e usam os mesmos ids `btn-caixa`/`btn-sino`
  (`atualizarSelos` continua contando). Ponto vermelho no escudo (`#menu-cel-ponto`) quando há algo novo.

- **Clique num item desequipado** (Henri, 12/11/2026): a ficha fixa abre em duas colunas, "Equipado" (o item do mesmo
  lugar, `fichaItemHtml(eq, true)`, sem botões; anel: anel1 ou anel2) e "Na mochila" (com Equipar/Vender e as
  diferenças). Passar o mouse continua mostrando só o item; clicar no item do hover redesenha já com a comparação.

## Prêmios de login (Daniel, nov/2026)
- Números em `D.LOGIN`: `semana` = **semana de boas-vindas** (7 prêmios, um por dia de login, **só uma vez** por herói:
  com `p.login.semana === 7` não volta); `diario` = o que todo login dá na trilha; `trinta` = marcos 7/14/21/30 da trilha
  de 30 dias de login (repete; não é o calendário do mês). Ouro da trilha: 6.700 × level por volta (~200 mil no level 30).
  Os dias **não precisam ser seguidos**; vale por personagem; 1 vez por dia (vira às 00:00 de Brasília, `diaReset`).
- Regras: `R.loginEstado(p, agora)` (`boasVindas`, `proxSemana` null depois do 7º), `R.premiosLoginDoDia(e)`,
  `R.pegarLogin(p, agora, rng)` → `{ semana, trinta, partes: [{ de: 'semana'|'diario'|'marco', dia, texto }], itens }`
  (com itens e sem espaço na mochila devolve `{ erro }` sem pegar), `R.premioLoginTexto`. Estado: `p.login = { dia, semana, trinta }`.
  Prêmio: ouroPorNivel, reputacao, pergaminho {raridade, qtd}, item {raridade, tipo: 'arma' | 'armadura'} (da classe, no
  level do herói; armadura sorteia elmo/peitoral/luvas/botas; arma do mesmo tipo da equipada). Teste em regras.test.js ("login: ...").
- Tela: `loginHtml()` (semana de boas-vindas enquanto existir, trilha, "todo login" e próximo marco), abre sozinha ao entrar
  no jogo se o prêmio do dia está esperando (menos durante o Guia); ações `login-pegar` / `login-fechar`; cartão "Prêmio de
  login" no topo do painel de Missões (`data-missao="login"`). O número do ícone de Missões soma o login (`avisosMissoes`).
- É feito no jogo (como as missões), não no servidor. PDF do Daniel: gerado do D.LOGIN (script no scratchpad).

## Poder ⚔: peso da defesa e ganho na ficha (Daniel, nov/2026)
- `R.poder` = ataque × 10 + resistência ÷ 2 × `D.PODER_PESO_DEFESA` (1,5). Só para mostrar e para rankings/seta verde;
  não entra em nenhuma luta. Escolhido com simulação (72 heróis: 4 classes × 3 jeitos de pontos × 2 equipamentos, levels
  10/20/30; duelos justos e caçada contra chefe/3º monstro): peso 1 acertava 92,5% duelo / 98,1% caçada, peso 1,5 acerta
  94,3% / 93,6%. Com equipamento, o ataque fica ~65–70% do poder.
- `R.ganhoPoder(p, item)`: quanto o poder muda se equipar (anel: melhor dos 2 espaços; funciona para item fora da
  mochila). `R.poderItem(p, item)`: o poder do próprio item (poder com ele no espaço − com o espaço vazio; novo − atual =
  ganhoPoder). Ficha do item: `fichaPoderHtml` ("⚔ Poder do item: X (+Y)", Y = ganho; equipado mostra só X). A seta
  verde (`itemMelhor`) é o ganho > 0. Teste em regras.test.js ("poder: ...").
- O poder salvo (`p.poder`, rankings) atualiza quando cada jogador joga/salva de novo.

## Uma sessão por conta (Henri, 13/11/2026)
- Entrar com a senha chama `sessao_assumir(ap)`: grava em `contas.aparelho` o código do navegador (`localStorage
  eldrin.aparelho`, igual em todas as abas, então várias contas no mesmo PC seguem juntas). O jogo pergunta
  `sessao_vale(ap)` a cada 30 s, ao voltar para a aba, 4 s depois de abrir e num conflito de salvamento; se for false,
  `sairDaConta(motivo)` faz logout e mostra "Sua conta foi aberta em outro dispositivo". Sem a função no banco (schema
  antigo) ou sem resposta, considera válida. Conta sem aparelho gravado vale. Testes no banco.test.sql.
- **Na fila não faz outra coisa** (Henri, 13/11/2026): com `estado.gm.fila`, `naFilaMasmorra(acao)` (chamada por
  `bloqueadoMinerando` e por `minas-iniciar`) bloqueia caçar, minerar e lutar na Arena com o aviso "saia da fila". E
  `fila-entrar` não deixa entrar caçando, lutando na Arena ou minerando. **O servidor também confere** (13/11):
  `esta_na_fila(id)` (ping nos últimos 20 s) bloqueia `arena_comecar_tipo`, o gatilho `validar_personagem` (gravar
  `dados.minas` novo e ativo) e, pela RPC `na_fila(meu)`, o `encontro`/`retomar` da Edge Function `cacada`;
  `fila_entrar` recusa com `dados.minas` ativo ou `dados.cacadaAuto`. Testes no banco.test.sql e cacada_servidor.test.ts.
- **Celular, caçando (Daniel, nov/2026):** o menu do escudo mostra o grupo Conta (Trocar personagem / Sair) também com a
  caçada ligada (`cacandoAfk` em `menuCelularHtml`), sem aviso. `voltar-personagens` para só
  os relógios da tela (`pararTimersCacada`, `estado.cacada = null`); no servidor `p.cacadaAuto` segue e, ao entrar de novo
  no herói, `abrirJogo` chama `retomarCacada` (o servidor faz as lutas do tempo fora). `sair` já fazia o mesmo.
- **Comparar sempre sem encanto (Daniel, nov/2026):** `semEncanto` tira o encanto dos dois itens na comparação da ficha e
  da janela ampliada (mostra "(sem encanto)"); o botão "Comparar sem/com encanto" e `estado.compararSemEncanto` saíram.
  O "⚔ Poder do item" e a seta verde continuam com o encanto (é o poder de verdade).
- Ficha do item: saiu o botão "🔍 Ampliar e comparar" (repetia a comparação com o equipado); fica só "⚖ Comparar com outro".
- Boss do clã, hora (Henri, 13/11/2026): select com o estilo do filtro do Mercado (`.mercado-ordem`); a hora escolhida fica em `estado.bossHoraEscolhida` até salvar (a tela se redesenha e voltava para a hora salva) e `b.hora` é comparado como número.
- Forja do encanto (Henri, 13/11/2026): a barra só aparece no primeiro Encantar; o botão +1 chama `tentarEncantar(id, true)` → `abrirForja(..., rapido)`, que põe a barra já onde parou e mostra o sucesso/falha na hora (com o som).
- **Curandeiro (Henri, 13/11/2026):** a Bênção saiu; no lugar, **Luz Punitiva** (`luz-punitiva`, `unico` 150% +5/pt,
  recarga 3, `curaDano` 50 +1/pt = % do dano que vira vida) na caçada (`vezComHabilidades`, `ev.curou`), na masmorra e na
  Arena (`arena_kit` leva `v.curaDano`; `arena_vez` cura depois do golpe, `ev.curou`). `R.trocarHabilidadesAntigas`
  (`HAB_TROCADAS`, em `normalizar` e `talentos`) devolve os pontos da Bênção e troca o id na ordem. **Luz que Cura na
  Arena usa o dado:** cura x 0 (1), (d−1)/18 até 10 (10 = metade), 0,5 + (d−10)/20 acima (20 = cheia); atordoado/sem dado = cheia.
- **Level 30 sobem com pontos** (Henri, 13/11/2026): Tiro Silenciador `mult [180,5]`, Execução `[250,3]`, Maldição `[200,5]` + `queima.pct [15,1]`, Martelo `[220,5]`, Pó nos Olhos `erroPct [30,1]` (antes por ponto 0). `depoisDoGolpeNivel(def, alvo, s, pts)` e `aplicarReforco` usam `valorNivel`; `arena_kit` converte `queima.pct`/`erroPct` em array.
- **Drop sempre ±3** (Henri, 13/11/2026): `ITEM_NIVEL.altoDesde: null` (antes 35: do level 35 em diante caía de 35 a 60). Herói 40 tira de 37 a 43. O último mapa (Cume) aparece como "Lv 30–40" (até `NIVEL_MAXIMO`).

## Leva de 13/11/2026 (Henri)
- **Arena, atordoar de 2 turnos pelo dado** (`arena_vez`): 18–20 = 2, 4–17 = 1, 2–3 = só o dano (1 erra). Atordoar de 1 não muda.
- **Elfo:** `tracos { critico 5, velocidadePct 10, vidaPct -5, danoPct -5 }`.
- **Troca de pergaminho com ouro:** `TROCA_PERGAMINHO.ouro { rara 1000, epica 10000, lendaria 100000 }` (`R.precoTrocaPergaminho`).
- **Passivas recebem pontos:** valor = 1 de graça + pontos (`PTS_PASSIVA + pontosEm`), em `passiva`, `extrasNivel`, `arena_passiva`,
  `arena_milagre`, `arena_extras`. Descrições com a faixa (1 a 11 pontos).
- **Quebra-Ossos** (Destruidor, level 30, no lugar do Golpe Apocalíptico): `mult [200,0]`, `ignoraDefesaPct 100`,
  `quebraDefesaPct [25,1]`, `quebraTurnos 2`. Monstro: `alvo.quebraTemp {pct, vezes}` (conta em `tickQueima`); Arena: `quebraPct`/
  `quebraAte` no outro. `HAB_TROCADAS['golpe-apocaliptico'] = 'quebra-ossos'` (pontos voltam livres).
- **Colar em escada** (`D.COLAR`, `sortearBonusColar`, `item.colarV2`): comum vida; rara + defesa e defesa mágica; épica + `rouboVida` 3;
  lendária + `velocidadePct` 6. Colares antigos convertem no `normalizar`. Roubo vai para `extrasNivel` (e `arena_lutador.ex`);
  velocidade % no `statusBase` e no `tanka_status`. Encanto do colar agora sobe a vida (`bonusPorNivel.colar = 'vida'`).
- **Magia dos monstros da caçada** (`D.MAGIA_MONSTROS { cada 4, mult 1, nomes }`, `D.monstros[id].magia`): no `ataqueMonstro`, a cada 4
  ataques o golpe é mágico e a defesa mágica segura (`ev.magia`). Só na caçada (masmorra não). Simulação: vitórias quase iguais.
- **Relatório da Arena** (`relatorioArenaHtml`): dano (golpes, queimadura/veneno, devolvido), maior golpe, vida recuperada (pela
  vida que subiu além do dano levado), escudo, atordoamento, média do dado, críticos, erros.
- **Chat: menu do nome + sussurro:** botão direito (celular: toque) no nome → Adicionar amigo / Convidar para o clã / Sussurrar.
  Sussurro = abas `sus:<nome>` no chat, servidor `sussurro_listar/enviar/conversas` (tabela `mensagens_privadas`, sem precisar ser
  amigo; silenciado não sussurra). Quem recebe vê a aba aparecer (conversas das últimas 24 h).
- **Clã › Membros:** ações num menu em cascata (`details.menu-cascata`) com "Adicionar amigo" (`al-amigo`).
- **Mercado Negro:** aba `mercadoNegro` no grupo Mercado com o comércio entre jogadores (saiu da Loja). Faixa de nível como o Leilão:
  `mercado_nivel_max(meu)` (antes do 10: até 12; 10–19: 22; 20–29: 32; 30–39: 50; 40+: sem limite, `LEILAO.mercadoSemLimite`) filtra `mercado_estado` (os seus anúncios
  sempre aparecem) e trava `mercado_comprar`.
- **Fila da masmorra com bots de classe:** `fila_papel` (healer/guerreiro/dps) e `fila_bot_classe`; o bot é o 1º jogador com
  `botClasse2` = papel que falta (guerreiro → healer + Arqueiro/Bruxo; dps → guerreiro + healer; healer → guerreiro + Arqueiro).
  `R.converterBot` (em `simularSalas`) troca classe, atributo de ataque, habilidades (mesmos pontos), arma (tipo padrão) e armaduras.
- **Varredura do celular (Daniel, 14/11/2026)** com script no scratchpad (iPhone 13 e Galaxy S8, todas as abas, procura
  conteúdo saindo da tela / cortado / coberto por barra fixa e fotos): no celular sem os cantos dourados da `.caixa`
  (caíam no meio da tela por cima do texto); Encantar com o nome do item na largura toda e "Sem pergaminho" pequeno;
  Amigos com o campo na largura toda; abas da mochila, "Ordenar e filtrar" e "Pergaminhos" sem quebrar palavra no 360 px;
  missões: "pergaminho épico" no masculino (`premioTexto` usa `RARIDADE_M`).
- **Ascensão / Os Sete Selos (proposta, NÃO está no jogo):** depois do level 40, pontos numa árvore de 7 ramos (um por
  região/selo). PDF e números de sugestão com o Daniel (scratchpad). Arte guardada em `assets/ascensao/arvore-sete-selos.webp`
  (461x468, do Daniel; para o computador pode precisar de uma versão maior).
- **Anel: defesa mágica +25% (Daniel, 16/11/2026):** `D.joias.anel.multDefesaMagica = 1.25`, aplicado ao CALCULAR
  (`R.bonusItem` e `tanka_status` no servidor), então vale também para os anéis já existentes (o bônus do anel fica
  gravado no item). Vai no `tanka_dados` (gerar_dados_sql.js copia `multDefesaMagica`). Conferido: jogo e servidor dão a
  mesma defesa mágica. Motivo: o Mago ganhava a maioria das lutas na Arena (o golpe dele vai na defesa mágica, baixa nas
  outras classes). **Precisa rodar o schema.**

### Masmorras mais difíceis (Henri, 14/11/2026)
- `forca` de cada masmorra em `dados.js` recalibrada por simulação: 3 heróis com level = mínimo + 5 e itens épicos +5
  vencem ~60%; no level mínimo (ou +3 com épico +3) quase 0%. Ex.: Catacumbas (lv15) pede 3 heróis lv20 bem equipados.
- Novo campo `poderRecomendado` (poder por herói desse grupo), mostrado no cartão da masmorra com o poder do jogador.
- Não mexe no schema. A função `cacada` é publicada sozinha (mudou dados.js).

### Arqueiro (Caçador): passiva e veneno (Henri, 14/11/2026)
- Passiva `reflexo-rapido` agora se chama **Sede de Caça**: +5 DES e `rouboVida [0.1, 0.9]` (1% com o ponto de graça,
  10% com 10 pontos); sem esquiva. `extrasNivel` (regras.js) e `arena_extras` (schema) passaram a somar também a passiva
  sem `nivel`.
- Flecha Envenenada: `dotPct [10, 5]` (até 60%, era 140%), sem `curaMorte`, recarga 5 (era 4).

## Interface Arcane (Henri, nov/2026)
- Terceira opção de tema na ⚙ (Clássica, Zealot, **Arcane**), só no computador (no celular continua a casca Zealot).
- Usa as **telas da Clássica** (`interfaceAtual()` continua devolvendo `'classica'`); só muda o visual. O tema escolhido
  de verdade sai de `temaAtual()` (usado no painel de Interface).
- `jogar/index.html` e `ferramentas/artifact.html` carregam `css/tema-arcane.css` só quando o tema é `arcane`. Todo o CSS
  é preso a `html[data-interface="arcane"]`: não mexe na Clássica nem no Zealot.
- Base: CSS do Gemini (paleta castelo/ferro/ouro velho/arcano, Cinzel + Inter), aplicado nas classes reais (`.caixa`,
  `.abas-jogo`, `.sub-abas`, `.barra.*`, `.poder-destaque`, `.btn`, `.slot`/`.celula`, `.ranking`, `.leilao-lote`...).
- Molduras dos itens: `assets/interface/arcane/slot-<comum|rara|conjunto|epica|lendaria|vazio>.webp`, recortadas da
  referência do Henri (`--arcane-slot` em cada `.borda-*`), com a cor da raridade suavizada. Bônus dos equipamentos vira pergaminho.
- Camada "maquete" (seção 11 do CSS): artes **provisórias** recortadas da maquete do Henri (baixa resolução): paredes do
  castelo nas laterais (`lateral-esq/dir`), torres no topo, escudos nos espaços vazios (`escudo-<espaço>`, via `--arcane-escudo`),
  moldura de runas no retrato (`moldura-runas`, em `.retrato-central::before`), brasão/castelo/dragão em cima da mochila e
  dragões no rodapé. Trocar pelas versões em alta do Gemini quando chegarem (mesmos nomes de arquivo).
- Artes recortadas de novo da maquete em alta (1952x2174): escudos, laterais, topo, runas, brasão, dragões, enfeites dos
  cantos da ficha (`canto-escudo-esq/dir`, `canto-lobo`, `canto-leao`) e leão da placa de Poder (`brasao-leao`).
- **Efeitos animados** (`js/arcane-efeitos.js`, carregado só no tema Arcane junto com o CSS): um canvas fixo por cima
  (sem cliques, `#arcane-efeitos`) desenha faíscas douradas em volta de `.ficha .cabeca`, pó arcano em volta de
  `.retrato-central` e da mochila, e o fogo das tochas/velas das laterais (posições em `CHAMAS`, % da arte) com brasas.
  Só lê posições (a cada 200 ms); para com a aba escondida e não roda com "reduzir movimento". No CSS: névoa girando atrás
  do retrato e brilho que respira no quadro do nome e na placa de Poder.

- **Arcane no celular (teste):** no celular a ⚙ › Interface oferece "Zealot" (a casca do celular, padrão) ou "Arcane".
  Com Arcane, o `jogar/index.html` não liga a casca (`data-celular`): o jogo usa as telas da Clássica e a seção 14 do
  `css/tema-arcane.css` (até 760 px) as adapta. As abas viram o **menu em cascata** (`cascataHtml()` no app.js, só no tema
  Arcane; ações `cascata` e `cascata-grupo`; `estado.cascata`/`estado.cascataGrupo`): botão com grupo › aba e lista dos
  grupos com ícone, cada um abrindo as abas dele. Ficha compacta (Arma e Atividades escondidas), imagens menores, mochila em 6 colunas.
- **Lutas da caçada** (seção 15 do CSS): cartas com moldura dourada (herói com brilho arcano, monstro em vermelho, chefe pulsando), VS dourado pulsando, relato da luta em pergaminho escuro. O `arcane-efeitos.js` olha a barra de vida dos lutadores (`#lutador-jogador`/`#lutador-monstro`): quando cai, a carta treme (`.arcane-golpe`) e soltam faíscas.
- **Números curtos** (`numCurto`/`numRecurso` no app.js): na barra de recursos da Arcane, ouro e reputação aparecem como 52.4k, 2.495M, 1.25B (corta, não arredonda). O número inteiro fica no `title`. Clássica e Zealot continuam com o número inteiro.
- **Ajustes depois do teste no jogo** (seção 16 do CSS): barras redesenhadas (trilho de vidro escuro arredondado, preenchimento
  com reflexo e um brilho que passa a cada 6 s; sem as pontas de metal), brilho do encanto sem o quadrado colorido (só luz suave,
  2,6x mais lenta), tudo que pisca mais devagar, brasão da mochila recortado (sem o fundo retangular), nomes do pergaminho de
  bônus legíveis. No `arcane-efeitos.js`: pó e faíscas somem mais rápido, piscam devagar, e o fogo tremula com calma.
- **HUD dark fantasy** (seção 17 do CSS; pedido do Henri com `INSTRUCOES_PARA_CLAUDE.md` + `referencia-hud.png`): as barras
  continuam vindo da função `barra()` do app.js (sem barras novas). A `barra()` agora põe `levou-dano` quando o valor CAI em
  relação ao anterior (mesma comparação do rastro `<s>`; cura e valor igual não piscam) e `vida-baixa` na vida do herói até 25%
  (não no monstro). A Experiência da ficha ganhou o embrulho `#ficha-exp` e, no nível máximo, a classe `maximo`. Só a Arcane
  estiliza essas classes: moldura dourada, medalhão com ícone SVG (coração/raio/estrela, em `--ic-*`), ponta dourada,
  clarão de dano, borda pulsando com vida baixa, Exp roxa, nome do lutador numa faixa dourada e VS em ouro com risco de fogo.

## Reino do Pesadelo e level 60 (Henri, nov/2026)
- `D.NIVEL_MAXIMO` = 60. Pontos de habilidade: +1 por level depois do 40 (`TALENTOS.pontosDepois2`; 54 no 40, 74 no 60),
  também no SQL `arena_pontos_ok`. Arena 30+ vai até o 60 (`a4.nivel [31, 60]`).
- `D.PESADELO`: 7 chefes (`<base>-pesadelo`, montados no fim do dados.js a partir do Ignaroth da caçada × `vida`/`dano`).
  Abrem no level do chefe (40, 43, 46, 50, 53, 56, 60), custam 20 de estamina, não mexem na presença do chefe da caçada,
  material = o do chefe base. Exp por vitória = exp do level do chefe até o do próximo / `vitoriasPorFaixa` (100 ≈ 1 semana).
- Força calibrada com `node ferramentas/simular_pesadelo.js` (herói no level do chefe, tudo épico +5 do mesmo level):
  ~5 de 10 na média das 4 segundas classes do meio. A diferença entre classes é grande (Assassino/Caçador ganham quase
  sempre; Destruidor/Coletor quase nunca).
- Level 40+: o Mapa do Reino dá 10% da exp (`mapaExpPct`), ouro e drops normais. Itens acima do 40 só caem no Pesadelo
  (level do chefe até +3, `dropPesadelo` em regras.js); no mapa e no Mercado o teto é 40.
- Servidor: `novoEncontro` com alvo `*-pesadelo` faz o encontro direto (chefe: false, para a caçada automática lutar).
- Tela: portal no Mapa do Reino (`reino-pesadelo`), mapa `assets/mapa-pesadelo.webp` (x/y em `D.PESADELO.chefes`), ficha do
  chefe e ⚔ ENFRENTAR (caçada contínua só com esse chefe).
- **Revanche com confirmação (Henri, nov/2026):** o histórico da Arena traz `oponente_id`; o botão Revanche abre a mesma janela do Desafiar (`abrirDesafio(id, 'revanche')`, `estado.desafio.luta`) e o ⚔ Revanche chama `arena_revanche`. Sem `oponente_id` (schema antigo) luta direto como antes.

## App Android com Capacitor (Henri, 15/11/2026)
- App SEPARADO do APK antigo do Daniel (TWA `br.com.eldrinonline.jogo`): pacote `br.com.eldrinonline.app`, nome "Eldrin".
  O jogo inteiro (js, css, assets) vai DENTRO do APK.
- `app-android/`: package.json (Capacitor 7 + @capgo/capacitor-updater + @capacitor/app), capacitor.config.json,
  `assets/` (ícone e splash para o @capacitor/assets), `chave-teste.jks` (chave de TESTE, senha `eldrin-teste`, alias
  `eldrin`). As pastas `www/` e `android/` são geradas (não vão para o git).
- `ferramentas/montar_app.js` monta `app-android/www` a partir de `jogar/index.html` (tira o `<base>` e o service worker,
  põe `window.ELDRIN_APP = { web: N }` e `js/app-nativo.js`).
- `.github/workflows/app-android.yml` (GitHub monta tudo; aqui não dá: sem Android SDK nem npm):
  - push no main com mudança no jogo: release `app-web` com `eldrin-web.zip` (o jogo, ~45 MB) e `versao.json`
    (`web`, `webUrl`, `tamanhoMB`, `apk`, `apkUrl`, `apkMinimo`). N = número da execução do workflow.
  - APK (release `app-android`, `Eldrin-app.apk`): só quando muda `app-android/`, `js/app-nativo.js`, o workflow, ou
    no botão Run workflow. versionCode = N.
  - branch `henri/apk-*`: só monta o APK e deixa em Artifacts da execução.
  - Chave oficial: segredos `ANDROID_CHAVE_B64` e `ANDROID_CHAVE_SENHA` (só o dono do repositório cria). Sem eles,
    usa a chave de teste (aviso no log). Quem instalou um APK de teste precisa desinstalar antes do oficial.
- `js/app-nativo.js` (só dentro do app): `notifyAppReady`; confere o `versao.json` (CapacitorHttp); jogo novo →
  atualização OBRIGATÓRIA (16/11: jogo velho no app brigava com o servidor novo e dava "jogado em outra aba"): cobre a
  tela, baixa o zip (`download` com `checksum` sha256, que o plugin exige, + `set`, reinicia); se falhar, "Tentar de
  novo". APK novo → link para baixar ("Depois" vale até fechar o app). `apkMinimo` > instalado força o aviso do APK.
- Teste no celular virtual (só branch `henri/apk-*`): o workflow liga um Android 15, instala o APK (com depuração do
  WebView ligada e jogo versão 1 apontando para o release `app-teste`, que recebe um pacote versão 2), roda
  `app-android/teste-celular.sh`/`.py` (DevTools do WebView pela porta 9222) e sobe prints, `teste.txt` e `logcat.txt`
  no release `app-teste` (baixar com `gh api` + `Accept: application/octet-stream`).
- `jaInstalado()` (app.js) conta o app Capacitor: some o botão "Baixar app Android".
- **Luta da masmorra/boss do clã pelo relógio (Henri, nov/2026):** `relogioLuta(L)` avança os eventos pelo tempo real (`L.acum`, x2 se acelerado), não por timer; trocar de aba/app ou recarregar não atrasa: a luta começa em `run.criado_em` e alcança o ponto certo (também no `visibilitychange`). O resultado já era gravado no servidor no começo.

## Trava contra ficha forjada (Henri, nov/2026)
- A API é pública (normal) e o jogo grava a ficha inteira em `personagens.dados`. Antes, quem soubesse programar podia
  gravar level/ouro/itens no próprio personagem. Agora o gatilho `validar_personagem` chama `trava_ficha(old, new)` em
  toda gravação direta pela API (`current_user = 'authenticated'`, não admin); funções security definer e SQL Editor passam.
- Regras: level só sobe, até `NIVEL_MAXIMO`, e com balde (`TRAVA.niveis`); ouro com balde (`TRAVA.ouro`, ~4,6 mi é a mochila
  cheia de lendárias +10 vendida de uma vez); atributos iniciais fixos e pontos ≤ (level-1)×3 (`trava_excesso_atributos`);
  pontos de habilidade = `arena_pontos_ok`; itens com encanto 0–10 e level ≤ máximo; item existente sobe no máximo +3 de
  encanto por gravação e não muda raridade/level; itens novos lendários ou +5 com balde (`TRAVA.itensFortes`).
  Personagem novo pela API: level 1, sem ouro, só a arma comum, atributos da classe ± raça.
- Fichas que já estavam fora da regra continuam gravando (só não podem piorar). Baldes em `personagens.trava`.
  Gravações acima de `avisarOuro`/`avisarNiveis` e encanto > +1 passam, mas ficam em `suspeitas` (só o SQL Editor lê).
- É a trava rápida; a solução definitiva é passar cada ação para o servidor (plano de 5 etapas).

## Tudo no servidor — etapa 1: ações do herói (Henri, nov/2026)
- Regra única em `js/servidor-acoes.js` (`Tanka.servidorAcoes.executar(p, acao, args, agora)`), com lista fechada de
  ações: `atributos` ({for: n...}), `segundaClasse`, `pontosHabilidade` ({id: n}), `ordemHabilidade` ([modo,id,op]),
  `habilidadeAuto`, `equipar`, `desequipar`, `usarSkin`, `usarRecomeco`, `usarRecomecoHabilidades`.
- Edge Function `supabase/functions/acao/index.ts` (igual à `cacada`: confere o login, lê o personagem com RLS, roda a
  regra, grava com a proteção de versão). Recusa: `{ erro, personagem }` com a ficha do banco. Enviada pelo mesmo
  workflow (`funcao-cacada.yml`), que também roda `testes/acao_servidor.test.ts` (no Node: `node --experimental-strip-types`).
- Cliente: `C.acao(id, nome, args)` (contas.js usa a mesma fila/troca de personagem da caçada; contas-local.js roda a
  regra local). `acaoServidor(nome, args)` em app.js: a regra roda na tela na hora e o servidor confirma; sem a função
  (404) volta a `salvar()`.
- Etapa 2 (Mochila e Mercado): `vender`, `venderVarios` ([ids]), `travarItem`, `organizarMochila` ([critério, crescente]),
  `comprar` ({raridade?, tipo, especifico?}: o item é sorteado no servidor; a tela espera a resposta e acha o item novo),
  `comprarPocao`, `comprarPoteEstamina`, `trocarPergaminho`, `comprarSkin`, `comprarRecomeco`, `comprarRecomecoHabilidades`.
  `acaoServidor(nome, args, local)` devolve promessa; `local` é o jeito antigo (só sem a função). Mercado entre
  jogadores (anunciar/comprar) já é do servidor, mas o cliente ainda grava a ficha depois: na etapa 5, trocar por reler.
- Etapa 3 (Forja, Oficina, Minas): `encantar` ([id, protecao]; conta as missões), `forjar` ({area, classe, tipo, chefe,
  gemas}), `fabricarReceita`, `fabricarProtecao`, `iniciarMinas` ([opção, área]), `pararMinas`, `recolherMinas`.
  Sorteios no servidor: a ação devolve `{ resultado }` (executar(p, acao, args, agora, rng)) e a tela anima com ele
  (encantar espera a resposta antes de abrir a forja; `estado.encantando` evita clique duplo). Oficina já era do servidor.
- Etapa 4 (prêmios e progresso): `receber` (prêmios da tabela recompensas + créditos: a função lê `pendentes(meu)` do banco,
  aplica com `entregarRecompensas`/`aplicarCreditos` (p.recebidas / p.creditosRecebidos evitam repetir), grava e só
  então chama `recompensa_resgatar`/`credito_aplicar`), `sincronizarCla` (skills lidas de `cacada_bonus`), `missao`,
  `bauDiario`, `pegarLogin`, `comecarGuia`, `pularGuia`, `guiaAba`, `verificarGuia`, `historiaVista`, `concluirCapitulo`,
  `acampar`, `eventoJogo` ({tipo arena|masmorra, vitoria, alvo, run}: missões/guia/História; 1 a cada 8 s/25 s; ainda é o
  jogo que informa o resultado) e `preferencias` (só prefsCacada, caixa, caixaVista, atividade, título já ganho e os
  avisos de presente; grava sempre = marca online). Cliente: `salvarPreferencias()` (junta pedidos em 400 ms) e
  `receberPendentes()`. A função não grava se nada mudou (exceto preferências).
- Ainda gravam a ficha direto: anunciar no Mercado e pedir na Oficina (o servidor já mexeu na ficha; trocar por reler),
  caçada no jeito antigo (só sem a função `cacada`), admin e os jeitos antigos sem a função `acao`.
- Próximas etapas: 2 Mochila/Mercado, 3 Forja/Oficina/Minas, 4 Prêmios, 5 tirar o UPDATE direto da ficha (aí as
  funções do servidor precisam gravar por um caminho próprio, não pelo login do jogador).

### Tudo no servidor — etapa 5 (tranca da ficha)
- As funções `cacada` e `acao` gravam a ficha com a chave secreta do projeto (`SUPABASE_SECRET_KEYS.default`, ou
  `SUPABASE_SERVICE_ROLE_KEY`), que o Supabase põe sozinho nas funções. Ler continua com o login do jogador (RLS).
- `app.js`: `salvar()` só manda as preferências (ação `preferencias`) para quem não é admin; `salvarFichaDireto()` é o
  jeito antigo (admin, ou sem a função `acao`). Mercado/leilão/Oficina: `gravarAntesDoBanco` (só grava no jeito antigo)
  e `sincronizarFicha` (busca a ficha do servidor depois da função do banco).
- Banco: `gravacoes_papel` anota qual papel grava fichas (`authenticated` = navegador, `service_role` = funções).
  `supabase/trancar_fichas.sql` tira o "salvar os seus" (fica só admin) e marca `ajustes.fichas_trancadas`; rodar o
  schema de novo respeita a marca. `supabase/destrancar_fichas.sql` desfaz.
- Ordem segura: publicar → conferir `select * from gravacoes_papel` (service_role recente) → rodar o trancar.

### Brechas fechadas (Henri, nov/2026): o servidor refaz as lutas
- Função `acao` ganhou 3 "lutas" (não mexem na ficha): `masmorraConcluir {run}`, `bossClaConcluir {run}` e
  `bossMundial {}`. Masmorra e boss do clã: lê a run com a chave do servidor e refaz com `R.simularMasmorra` /
  `R.simularBossAlianca` (mesmos heróis e semente); Ignaroth: luta inteira no servidor (até `acoesPorAtaque` ações) e
  devolve os eventos para o navegador só mostrar (`b.replay` com `servidor`).
- Banco: `masmorra_registrar`, `alianca_boss_registrar`, `boss_atacar_servidor` (só a chave do servidor). As antigas
  (`masmorra_concluir` com vitória, `alianca_boss_concluir`, `boss_atacar`) pedem "Atualize a página".
  Sem o schema novo, a função usa as antigas com o login do jogador (`rpcServidor(..., antiga)`).
- Missões do clã contadas pelo servidor: `alianca_missao_de` (masmorra em `masmorra_registrar`, Arena em
  `arena_finalizar`) e `alianca_missao_servidor` (encanto pela `acao`, monstros pela `cacada` = abates novos).
  `alianca_missao_registrar` ficou sem efeito; o navegador não manda mais.
- `anotar_gravacao()` anota o papel da sessão (não aceita texto de fora); `meu_grupo`/`entradas_usadas` só internos.
- (nov/2026) Velgrath · Pesadelo (1º chefe, lv 40) mais fácil: vida/dano 1.62 → 1.2 (hp 5346, dano 734-990). Alvo do
  Henri: mago e arqueiro lv 40, tudo épico lv 40 +3, vencem com 1 poção (1000 lutas: caçador 97%, assassino 100%,
  bruxo 91%, curandeiro 81%). Os outros chefes do Pesadelo não mudaram.
- (16/11/2026) Quebra-Ossos (Destruidor): ignoraDefesaPct 100 → 50 (dava ~16x um ataque na Arena; agora ~3,5x, como o Tiro Silenciador).

### Grupos de itens (Henri, 16/11/2026)
- `D.GRUPOS_ITEM`: Pesado (cavaleiro/artesão → Paladino, Destruidor, Ferreiro, Coletor), Leve (arqueiro → Arqueiro,
  Assassino), Mágico (mago → Bruxo, Curandeiro). Cada um usa QUALQUER arma/mão esquerda/armadura do seu grupo
  (grupo da arma = grupo da classe em TIPOS_ARMA; mão esquerda em `GRUPOS_ITEM.mao`).
- `ARMAS_CLASSE` virou a lista das preferidas (drops vêm delas). Fora delas: habilidades com `foraPreferida` (80%) do
  dano (`R.fatorArmaHab`, `fator` no kit; Arena: `arena_kit` com `ARMAS_PREFERIDAS`). Coletor: mão preferida = manopla.
- Paladino com escudo / Coletor com manopla: +50% nos bônus (`R.multMaoForte`; `tanka_status` com `mf`).
- Armadura Pesada única: armaduras novas de artesão saem com `classe: 'cavaleiro'` (tabela do cavaleiro). As antigas
  (`classe: 'artesao'`) continuam valendo, com os números que já tinham.
- Mercado "só o que o meu grupo usa": filtro manda `classes` (do grupo); leilão compara por grupo.

### Atributos rebalanceados (Henri, 16/11/2026)
- Antes, DES era o melhor atributo para TODAS as classes (precisão, crítico e esquiva cheios para todos).
- `D.ATRIBUTOS_COMBATE`: o atributo de dano da classe (FOR Cavaleiro/Artesão, DES Caçador, INT Mago) dá `danoPct` (1%)
  de dano por ponto acima de `danoDesde` (10) e +1 de precisão por ponto (além do +1 de dano a cada 3).
  DES: crítico e esquiva cheios só no Caçador; nas outras classes `desOutros` (30%), inclusive na precisão.
  Crítico mágico (chance 0,5%/pt e dano 1%/pt) saiu da SOR e foi para a INT. SOR: só encanto (0,75%/pt), drop (0,3%/pt) e craft.
- Arena (`tanka_status`): soma o % do atributo da classe no `extra` (lá não há crítico nem precisão).
- Presente: `presenteAtributos3` = 1 Recomeço para quem tinha level (aviso no login).

### Caçadas e Pesadelo rebalanceados para os atributos novos (Henri, 16/11/2026)
- Os heróis ficaram mais fortes com o % de dano do atributo da classe. Vida dos monstros por área (`ajusteVida`)
  x1,18 (Floresta) a x2,01 (Cume) e `danoCacada` x1 a x1,24, calibrados para o perfil típico (atributo da classe 2/3 +
  RES 1/3) ter as mesmas lutas de antes (turnos e vida perdida no 3º monstro). Simuladores usam o PRINCIPAL novo.
- Pesado (Cavaleiro/Artesão) ficava para trás: `ATRIBUTOS_COMBATE.danoPctClasse` = 1,5% por ponto de FOR (outros 1%).
- Pesadelo: vida/dano de cada chefe recalibrados (o Ignaroth da caçada ficou mais forte e é a base deles); alvo: a
  mediana de vitórias de antes e o Velgrath vencível por mago/arqueiro lv 40 épico +3 com 1 poção (90%+).
- O Leve (Caçador/Assassino) continua o mais forte no PvE; Destruidor e Coletor, os mais fracos.
- (16/11/2026) Destruidor: passiva Força Bruta ganhou critico 20, vidaPct 15, defesaPct 15 (estava em 95-100% de vida perdida no 3º monstro e 0% no Pesadelo; agora perto do Paladino). Na Arena o crítico da passiva vira +20% de dano.
- (16/11/2026, tarde) Força Bruta reduzida para critico 10, vidaPct 10, defesaPct 10 (a primeira versão subiu demais o poder; agora ~+11%).
- (16/11/2026, Henri) Força Bruta: +5 FOR, danoCritico 3, defFisicaPct 5, defMagicaPct 5 (chaves novas: só a defesa / só a defesa mágica, também em tanka_status); +1% por ponto em cada %.
- **Pacto de Ascensão (NO JOGO, Daniel 16/11/2026; era a "Constelação v2"):** aba Herói › Pacto (`abaAscensao`).
  Números em `D.ASCENSAO` (6 domínios × 2 trilhas, pontes, custos 1/2/2/4, máx. 3 Pedras, limite 70 de 156, reset
  `precoRefazer` 50.000 de ouro). Regras em regras.js (`arvoreAscensao`, `motivoAscensao`, `ordenarAscensao`,
  `efeitosAscensao` com cache, `comAscensao` no `status(p, true)`, `extrasLuta` no lutador, `comprarAscensao`,
  `refazerAscensao`, `ganharExpAscensao`). Ficha: `p.ascensao = { nos, exp, extras }`; ficha forjada (pontos soltos,
  a mais) = nenhum efeito. Pontos: 1 por level 41–60; no 60 a exp vira ponto (1 a cada exp do level 59).
  Só contra monstros (caçada, masmorra, chefes; a Arena no servidor não lê). Efeitos de luta: Primeiro Golpe (barra cheia +
  1º golpe), Golpe Certeiro (contador `L.nGolpes`), Ferida Aberta (`sangrar` usa a `queima` do monstro), Execução/Sem
  Piedade (`opcoes.vidaAlvo` na caçada), Eco (habilidade 2x; `normal` marca o ataque normal), Foco (`gastarHabilidade`),
  Inabalável (`L.baixa`, `defesaExtraPct`), Sede Eterna (`beberPocao` recusa), Regeneração (poção cura metade).
  Ouro/exp no `concluirBatalha`; drop no `rolarRaridade`. Mudança da proposta: ponte Precisão⇄Bastião longe virou
  "−4% de dano recebido" (monstro não dá crítico). Servidor: ações `ascensao` ([ids]) e `refazerAscensao`.
  Tela: SVG com o desenho da proposta, centro "Pacto de Ascensão"; tocar = detalhe embaixo; pendentes em
  `estado.ascPend` (Confirmar/Cancelar); `redesenharPacto` só troca a caixa e guarda a rolagem.
  Arte: `assets/ascensao/medalhao-<pedra>.webp` e `dominio-<id>.webp`. Proposta antiga em `docs/propostas/constelacao/`.
  Aba escondida antes do level 40 (`abaVisivel`/`abasDe(g)` nas barras; `telaJogo` volta para Personagem). No 40, janela
  `pactoTutorialHtml` uma vez (depois do prêmio de login); `p.pactoVisto` vai pela ação `preferencias`.

### Masmorra com caminhos (Henri, 16/11/2026)
- Roteiro `D.MASMORRA.roteiro`: luta1 → voto → luta2 → voto → elite → voto → chefe. Lutas automáticas (`simularSalas`
  com `opc.hpInicial`: a vida passa de uma luta para a outra); `R.salaMasmorra(id, tipo)`; resumo curto `R.resumoLuta`.
- Votação: abre `resumoSeg` (5 s) depois da luta e dura `votoSeg` (10 s). Só jogadores (`run.membros`) votam
  (`masmorra_votar`); quem não vota perde o voto; empate = voto do líder (`run.lider`; na fila, o 1º); sem voto: sorteio.
- Caminhos (`MASMORRA.caminhos`, acumulam): Porta (30% baú: joia comum–épica + pergaminho p/ cada um; 70% armadilha:
  −15% da vida, não mata), Corredor (luta extra; vencendo +1 pergaminho e +5% de lendária na joia do fim), Fonte (cura
  e levanta todos; −5 pontos em cada chance de drop).
- Servidor: tudo em `R.avancarMasmorra(run, etapa, agora)` (puro) chamado pela ação `masmorraAvancar` da função `acao`,
  que grava `masmorra_runs.etapa` com a chave do servidor (filtro `versao`, sem corrida). No fim, `R.lootMasmorra`
  sorteia (joia nível −3 a +10 do herói) e `masmorra_finalizar` (só chave do servidor) gasta entrada, conta missão do
  clã e põe em `recompensas` uma vez só. A tela mostra `etapa.premios`; ao fechar, `receberPendentes` põe na mochila.
- Masmorras: níveis 15, 22, 30, 37, 45, 52, 60 (também em `masmorra_nivel_min`); forca recalibrada. História: caps.
  1–3 sem masmorra; 4–7 pedem a masmorra que já abriu no nível do capítulo.
- Runs antigas (etapa null) seguem no jeito antigo (`masmorraConcluir`); runs novas recusam esse caminho.
- Imagens: assets/masmorra/porta|corredor|fonte.webp (do Henri).
- **Missões abertas durante a caçada (Daniel, nov/2026):** `telaJogo` chama `desenharMissoes` a cada luta; agora o painel
  só é refeito quando o HTML mudou (`missoesUI.html`), guarda a rolagem de `.missoes-painel` e não redesenha com o dedo/
  mouse apertado no painel (`missoesUI.apertado`/`pendente`, refaz no `pointerup`).
- (16/11/2026) Replay de destaques: `R.quadrosLuta` guarda até `MASMORRA.quadros` (18) lances por luta (críticos, habilidades, curas, quedas, maiores golpes) com a vida de todos; cada luta tem `inicio`/`dur` (relógio do servidor) e a votação abre quando o replay acaba. A tela (`replayMas`/`arenaReplayHtml`) mostra um lance a cada `quadroMs` (0,7 s), sem acelerar; F5 continua do ponto certo.
  mouse apertado no painel (`missoesUI.apertado`/`pendente`, refaz no `pointerup`). Já aberto, troca só o conteúdo de
  `.missoes-painel` (recriar a caixa repetia a animação de abrir e parecia fechar e abrir).
- (16/11/2026) Replay: cada lance leva `dh` (dano acumulado de cada herói); a luta guarda classe/raça já convertidas (bot da fila mostra o retrato da classe que faltava). Tela mostra o dano por herói no replay, no diário e no fim.
- (16/11/2026) Arcane no celular: a ficha compacta escondia os atributos; agora a aba Personagem mostra "Atributos e status" (`atributosAbaHtml` → `fichaDetalhesHtml`, o mesmo da ficha; `atualizarFicha` também troca `.pg-atributos`). Só aparece na Arcane em tela ≤ 760px (css/tema-arcane.css).
- (16/11/2026) Botãozinho do Discord ao lado do Chat (`discordBotaoHtml`, `.chat-discord`), nas 3 interfaces do computador; escondido na casca do celular.

### Poção automática: opções 10% e 30% (Henri, 16/11/2026)
- `CACADA.pocaoAuto` = [10, 30] (era [10, 5]); quem tinha 5% vira 10% em `prefsCacada` (app.js).

### Arena: veneno, sangramento e queimadura passam pela defesa (Henri, 17/11/2026)
- `arena_vez` (schema.sql): no lançamento do `dot` (Corte Vampírico, Flecha Envenenada) e da `queima` (Maldição de
  Ignaroth), o dano por vez é multiplicado por `k / (k + defesa)` do alvo (defesa física ou mágica pelo tipo de dano de
  quem lança, com os reforços de defesa do alvo). Antes ignorava a defesa e batia ~9x um golpe normal contra quem tinha
  muita defesa. Só na Arena; na caçada continua sem defesa.

## Torre do Eclipse (Daniel, nov/2026) — etapa 1: regras e motor de turnos (ainda sem servidor nem tela)
- Grupo de 4, torre sem fim, ilimitada por dia, level 30+. Números em `D.TORRE`; motor puro em regras.js
  (`novaTorre(fichas, andar)`, `resolverTurnoTorre(t, escolhas, semente)`, `subirTorre`, `escolhaAutoTorre`,
  `habilidadesTorre`, `chanceDesviar`, `inimigosTorre`). O estado `t` é JSON (o servidor vai guardar e refazer com a semente).
- Turno: os 4 escolhem { acao: atacar|habilidade|desviar|pocao, hab, alvo, ordem 1–4 }; inválida ou sem escolha =
  automática. Heróis agem na ordem; depois os inimigos (golpe normal físico; sem ninguém provocando acerta
  `semProvocar` heróis, hoje 1); `aura` desligada (0) — Daniel preferiu só o chefe mais forte; avisos de mecânica (`mecanicas`: mortal, chuva, marca,
  escudo, invocar) com `turnos` de antecedência; stun no turno do golpe avisado interrompe a mecânica.
- Desviar = `desviar.base` + `porPonto` x MAIOR atributo do herói (`h.maiorAtr`; máx. `desviar.max`), só contra golpe avisado. Efeitos no inimigo: 100% − resistência
  (`resistencia.base` + 1/andar; stun que pega +`porStun`). Veneno/sangramento e Maldição também tentam corte de cura.
- Andar: elite (1 mecânica) ou chefe a cada 5 (`chefes`, depois revezam do `chefesRepete` em diante). Vida volta cheia
  entre andares; 2 poções por subida +1 por chefe; Fúria do chefe depois do turno 25, fim no 45. Invocação só repõe
  lacaios mortos; o chefe caindo leva os lacaios. (Daniel tirou o bônus de cura de 60%.)
- Calibragem: `node ferramentas/simular_torre.js` (subidas de bots). Chefe do andar 1: vida 7500, dano 1500–2000
  (lutas de ~11–16 turnos). Level 30 épico +3 chega ~10–12, level 40 ~22, level 60 ~32; equilibrado vai mais longe.
- **Etapa 2 (servidor, nov/2026):** tabelas `torre_runs` (estado `torre` jsonb gravado só pelo servidor, `escolhas`,
  `prazo`, `versao`) e `torre_recordes` (melhor andar e da semana). Funções: `torre_iniciar` (líder, grupo de 4 prontos,
  level 30+, começa do andar depois do menor recorde dos 4: `torre_marco()` = 1, salva andar por andar), `torre_escolher` (só na fase `escolha`), `torre_estado`, `torre_desistir`,
  `torre_registrar` (só servidor). O grupo da masmorra passou a aceitar 4 (`torre_grupo()`); a masmorra continua com 3.
  Edge `acao` → `torreAvancar` (supabase/functions/acao/index.ts): monta o andar (novaTorre), resolve quando todos os
  vivos escolheram ou o prazo acabou (semente = semente da subida + andar x 1000 + turno), fase `narrando` por
  `MS_NARRACAO(eventos)` e então sobe de andar/abre a escolha. Cliente: `C.torre.*` (contas.js) e `C.acao(id, 'torreAvancar')`.
  Testes: banco.test.sql (Torre) e acao_servidor.test.ts (torre: ...).

## Segurança (Daniel, 17/11/2026)
- Amigos acharam: (1) a API mostra a estrutura do banco (OpenAPI) — os dados continuam protegidos (RLS em todas as
  tabelas, regras só "os seus"); dá para esconder com `alter role authenticator set pgrst.openapi_mode to 'disabled'`.
  (2) Missões da Arena/masmorra sem jogar: `eventoJogo` acreditava no navegador. Agora a função `acao` confere a luta
  no banco (`arena_lutas`: atacante = o herói e luta acabada; `masmorra_runs`: membro e estado 'vitoria') e passa
  `ctx.luta`; cada luta conta uma vez (`p.eventos.<tipo>Ids`). O jogo manda `{ tipo: 'arena', luta: id }`.
- Funções de senha do admin, `masmorra_votar` e `pendentes`: tiradas do papel anon (no Supabase o anon tem permissão
  própria; `revoke ... from public` sozinho não basta). Conferência: SQL que lista tabela sem RLS, regra aberta,
  função aberta sem login, função sem conferir o dono, Storage público, tranca e GraphQL.
## Atributo das armas e da mão esquerda (Henri, 17/11/2026)
- Arma de 1 mão: faixa de `EXTRAS_ARMA` (nv20 +1–2, nv40 +5–8, nv60 +5–10). Arma de 2 mãos: x`ATRIBUTO_ARMA.duasMaos` (2).
- Mão esquerda: 1 atributo fixo do grupo (`ATRIBUTO_ARMA.mao`: escudo/manopla FOR, livro/orbe INT, aljava/adaga/garra/shuriken DES),
  na faixa de 1 atributo da arma do mesmo nível (`atributoMao` em regras.js). O Livro perdeu a INT que crescia com o nível.
- Itens antigos: `normalizar` migra uma vez (marca `atrV3`), com sorteio fixo pelo id (`hashTexto` + `rngSemente`),
  igual no servidor e no navegador. Itens novos já nascem com `atrV3`.

## Arena: Ameaça e Resumo (Henri, 17/11/2026)
- Na Arena não aparece mais o Poder (ele é da caçada: conta crítico, que na Arena não existe). Aparece a **☠ Ameaça**
  (`ARENA.ameaca` em dados.js; `arena_ameaca(dados)` no schema, com os status da Arena do `tanka_status`):
  ataque = dano médio × velocidade ÷ 10 × 100/(100 + level × defesa de referência física 18 ou mágica 10,8);
  vida = HP × (100 + média das defesas)/100 ÷ (1 − esquiva); Ameaça = √(ataque × vida) × 30. Habilidades ainda não entram.
- Vai em `arena_estado` (top5 e alvos: `ameaca`) e em `arena_perfil` (`ameaca` e `minha_ameaca`). A janela de desafiar
  compara a Ameaça (o veredito "mais forte/fraco" também). Ranking e perfil de amigo continuam com o Poder.
- Histórico da Arena: botão **📜 Resumo** em toda luta (`arena_resumo(meu, luta)`, só quem lutou). Mostra o vencedor,
  o relatório (`relatorioArenaHtml`) e todos os lances (reusa `aplicarEventoArena` com `L.tudo`, sem o corte de 60 linhas).

## Pacto no celular (Arcane) (Henri, 17/11/2026)
- Em `tema-arcane.css` (≤760px): o ponto tocado abre num cartão fixo embaixo (`.pacto-detalhe` fixed, ✕ `asc-sel-fechar`),
  só com ícone, tipo e custo em pontos, nome, efeito, custo da Pedra e o botão. Somem o texto do topo, a legenda
  (fica o Aumentar), o caminho domínio › trilha (`.pacto-caminho`) e as regras (`.pacto-regra`). Contador de pontos numa linha.
- **Mensagem do Reino (17/11/2026):** crédito com ouro 0 e reputação 0 (`creditos.motivo` = texto) vira aviso + caixa
  de entrada com origem `admin` (📜). SQL pronto no scratchpad do Daniel (insert em `public.creditos`). O jogo busca os
  pendentes ao entrar e a cada 2 min (`estado.timerPendentes`).
- **Chat global como admin:** insert em `mensagens` com `set_config('tanka.aviso_sistema','1',true)`, classe 'sistema', nivel 1, conta do admin; a tela mostra "📢 Admin:" (nivel 0 = aviso automático 🐉).
- **Leilão (17/11/2026):** lotes em que o personagem deu lance sobem para o topo (te cobriram > você lidera > o resto). Os lances ficam no navegador (`localStorage` 'eldrin.leilaoLances', por personagem, últimos 40); "Te cobriram!" em vermelho.

### Pontos de habilidade param no level 46 (Henri, 17/11/2026)
- `TALENTOS.pontosAteNivel: 46`: `pontosHabilidadeTotal` (regras.js) e `arena_pontos_ok` (schema) contam os levels só
  até o 46 = 60 pontos (dá todas as habilidades +10). Depois, só o Pacto de Ascensão. Quem já passou do 46 com mais
  de 60 pontos distribuídos fica com pontos livres negativos até refazer.

### Teste de stress (Henri, 17/11/2026)
- `ferramentas/stress/teste-stress.js` + `.github/workflows/teste-stress.yml` (Run workflow, com url e chave publishable
  de um projeto Supabase SÓ DE TESTE; recusa o cwlcdeqvwzpveduzhaol). Cria `stress0001...` (cavaleiro lv1), cada um
  caça como o jogo (encontro → 2 s → lutar → 3 s → fim), lê o chat a cada 30 s e o ranking a cada 60 s. Etapas
  (padrão 100, 250, 500, 1000 por 90 s); mede tempos (metade/95%/99%) e erros por pedido; para se passar de 30% de erros.
- Projeto de teste: rodar o schema.sql, desligar "Confirm email", subir o limite de cadastros (Auth > Rate Limits).
  O workflow envia as funções `cacada`/`acao` para ele com o SUPABASE_ACCESS_TOKEN (precisa ser da mesma conta).
- **Etapa 3 (tela, 17/11/2026):** aba Aventura › Torre (`abaTorre`, só level 30+ via `abaVisivel`). Saguão: recorde,
  regras, grupo (o mesmo da masmorra; até 4), "Estou pronto" e o líder "Subir a Torre". Luta: cabeçalho com andar/turno e
  relógio, faixa ⚠ dos avisos (`NESTE TURNO!` quando `em` = 1), inimigos (vida, resistência a stun, marcas), os 4 heróis
  (vida, poções, ✔ ação escolhida e ordem), narração do último turno (1 linha/s) e o painel da ação (atacar, desviar com a
  chance, poção, habilidades com recarga, alvo, ordem 1–4; dá para trocar até resolver). `carregarTorre` a cada 1,5 s na aba
  (5 s no saguão) e chama `torreAvancar` só quando precisa (sem torre, todos os vivos escolheram, prazo acabou, fim da
  narração). `carregarGrupo` leva para a Torre quem está no grupo de 4 quando a subida começa.
- **Etapa 4 (prêmios):** `torre_registrar` dá, por andar vencido e por membro: andar novo = 1000 x andar de ouro + 5 x andar de
  reputação (créditos "Torre do Eclipse: andar N"); repetido = 150 x andar de ouro; chefe (andar múltiplo de 5) novo =
  1 pergaminho (até 10 raro, até 25 épico, depois lendário) em `recompensas` origem 'torre'. `D.TORRE.premios` só para a
  tela (manter igual ao SQL). Caixa de entrada: origem 'torre' (🗼).
- **Torre sem lag (18/11/2026):** narração em `D.TORRE.narracao` (1,2 s + 0,45 s por linha, máx. 9 s; antes 2 s + 1,1 s, ~15 s por turno). A tela só redesenha quando muda (`assinaturaTorre`); relógio e linhas da narração andam pelo `pulsoTorre` (250 ms); o próximo pedido acompanha o prazo.
- **Torre: toque sem atraso (18/11/2026):** escolher ação/alvo/ordem só troca a marcação (`marcarEscolhaTorre`), sem redesenhar; com o dedo na tela (`T.apertado`), o redesenho que chegar do servidor espera soltar.
- **Torre (18/11/2026):** ordem exclusiva (torre_escolher recusa a ordem já tomada; a tela mostra 2º Lyra travado), cores por jogador (`CORES_TORRE`, posição no grupo: cartão e nomes na narração), prêmios do andar na narração (torre_registrar acrescenta linhas `premio` no `torre.log` e sobe a versão; a função dá +4 linhas de tempo de narração na vitória) e 🤖 Automático (`localStorage` 'eldrin.torreAuto'; `autoTorre` confirma a `escolhaAutoTorre` com uma ordem livre).
- **Torre: vida acompanha a narração (18/11/2026):** durante a narração as barras mostram a vida da última linha contada (`ev.hp` / `ev.hpI` de cada evento; `vidaNaNarracao`, `atualizarBarrasTorre` no pulso), com transição suave.
- **Torre desligada (18/11/2026):** `D.TORRE.ligada = false` esconde a aba (`abaVisivel`) e o convite automático para quem não é admin; o admin continua vendo para testar. Para ligar: `ligada: true`.
- **Torre religada e mais forte (18/11/2026):** `ligada: true`; chefe do andar 1 vida 11.000 e dano 3.300–4.300 (andar 1 desafia grupo level 40: ~11–13 turnos; lv40 trava ~10–15, lv60 ~20–24); entrada level 40 (`nivelMin` e `torre_nivel_min()`). O começo já era depois do menor recorde do grupo.
- **Torre: golpe em toda rodada (18/11/2026):** o chefe/elite dá o golpe normal toda rodada; no turno da mecânica avisada, bate primeiro e solta a mecânica depois (`golpeNormal` em resolverTurnoTorre). Atordoado continua perdendo a vez (e a mecânica).

### Torre: formação em hexágonos (2-3-2)
- `D.TORRE.formacao` (casas 0-1 frente, 2-4 meio, 5-6 trás), `golpeAreaPct` (50) e `chefesArea` (chefes 3 e 5 do ciclo batem em todos).
- Regras: golpe normal e golpes de alvo único só pegam a fileira viva mais à frente (`alcanceTorre`); trás só toma dano em área.
  Provocar continua puxando o golpe. Quem não escolheu casa é posto pelo `formarTorre` (mais defesa na frente).
- Servidor: `grupo_membros.posicao`, `torre_runs.posicoes`, `torre_posicao(meu, pos)` (null tira); `torre_iniciar` copia as casas.
  A função `acao` passa as casas para `novaTorre`.
- Tela: grade no saguão (`gradeFormacao`, toque na sua casa para tirar; artes em `assets/torre/`: hex-vazio, hex-moldura com miolo vazado, formacao-fundo) e a fileira no cartão do herói; inimigo com 💥 golpe em área.
- Simulação (grupo lv 40): andar 10 foi de ~50% para ~90-95% de vitória; andar 15 (chefe com golpe em área) segue muro.

### Torre: ícones/dicas, recarga do desviar, velocidade dos inimigos (18/11/2026)
- Painel: habilidades com o ícone (`iconeHab`) e dica (`data-dica`, mostra após 1,5 s de mouse parado ou segurando o dedo; `.dica-torre`).
- Desviar: `TORRE.desviar.recarga` (2). `h.desviarEm` = turno a partir do qual pode de novo; `podeDesviar(t, h)`. Pedido em recarga vira automático.
- Velocidade: `TORRE.velocidade` (elite 25%, chefe 40%, +1%/andar, máx 70%). `t.vezInimigos` (1-4: age antes desse herói; 5: por último),
  sorteada no fim de cada turno e mostrada no painel (⚡/🐢 na fila da ordem). Quem desvia fica pronto no começo do turno.
  O resolver agora tem `faseHerois` e `faseInimigos` (agirInimigos chamado na vez certa). Simulação lv 40, andar 10: equilibrado 93% → 73%.
- Narração: a tela continua contando mesmo se o servidor já passou para a escolha (chave = assinatura do log); `narracao.max` 9000 → 16000.
- Luta como cena (`cenaTorre`): fundo da torre, inimigo principal grande no centro (lacaios dos lados), grupo na formação 2-3-2 com
  barra mini; `efeitoCenaTorre` solta números de dano/cura (`.cena-num`) e treme quem apanha a cada linha narrada (o evento de golpe
  do herói agora leva `ai`, índice do inimigo).
- Religada (`ligada: true`). Admin: vê a aba em qualquer level, sobe sozinho sem grupo (`torre_iniciar` cria a subida só com ele,
  `grupo_id` null) ou com grupo menor que 4 (botão "teste do admin"). Jogador comum continua precisando de 4.
- Admin sozinho escolhe a casa no saguão (`estado.torreCasaSolo`, só na tela) e `torre_iniciar(meu, pos)` grava em `posicoes`.
  Sem os nomes Frente/Meio/Trás do lado das grades. Marcas do inimigo: `.buff` verde (resist. stun, golpe em área, barreira),
  `.debuff` vermelho (atordoado, corte de cura, sangrando, cego, defesa quebrada). Redesenho adiado pelo toque agora respeita o "forçar".
- Prêmios novos (18/11/2026): sem reputação. Andar novo = ouro e EXP de 60.000 + 2.500 por andar (`torre_premio()` no schema,
  `D.TORRE.premios`); repetido = 10%. Pergaminho nos andares 5, 15, 25... (andar % 10 = 5). Andares 10, 20, 30: item novo ainda
  em criação (nada por enquanto). `creditos.exp` novo: a função `acao` aplica com `R.ganharExp` ao receber.

### Painel do Grupo (18/11/2026)
- Aba lateral "👥 Grupo" (abaixo de Missões; no celular, ícone 👥 no topo e no menu): `desenharGrupo`/`cliqueGrupo`, fora do #app.
  Convites, membros (online, pronto, 👑, ✕ do líder), pronto/sair, convidar amigos e "Para que é o grupo?" (Masmorra 3 / Torre 4 /
  mais conteúdos em breve) com botão "Ir para...". Abrir um fecha o outro (Missões).
- Servidor: `grupos.objetivo`, `grupo_objetivo(meu, objetivo)` (só o líder; masmorra recusa grupo com mais de 3),
  `grupo_limite(g)` (masmorra 3, senão 4) usado em convidar/responder; `grupo_estado` devolve `objetivo`.

### Torre: monstros próprios (18/11/2026)
- `TORRE.chefesTorre` (10, andares 5 a 50; depois revezam do 6º), `elitesTorre` (25, em rodízio nos andares sem chefe/bando),
  `bandosTorre` (5; andar % 5 = 3, 2 a 4 monstros sem mecânica). Arte: `assets/torre/monstros/<id>.webp`; sem ela a tela troca pela
  `reserva` (arte do jogo) pelo `data-reserva` + listener de erro. Prompts das 40 artes: entregues ao Daniel (prompts-monstros-torre.txt).
- Mecânicas novas: pele (−50% de dano por 2 turnos; stun quebra), teia (perde a vez), eclipse (cego: 50% de erro), espelho (devolve 40%
  do dano no turno seguinte), drenar (cura o chefe com o dano), silencio (sem habilidades; `habilidadesTorre(h, t)`). Traços: `rapido`
  (+25% de velocidade), `despertar` (abaixo de 50% da vida, +30% de dano). Lacaio com nome do chefe (`lacaio`).
- Saíram `chefes`, `chefesRepete`, `mecanicaElite`, `chefesArea` (antigos).
- Mais 8 mecânicas + Falso Colapso (18/11/2026): lentidao (+2 de recarga em todas as habilidades), carregar (aviso de 2 turnos; no 1º o
  chefe só acumula, no 2º 70% da vida em todos; escudo do herói segura, cegar corta pela metade, stun cancela), iniciativa (próximo turno
  age 1º e bate 2x: `duasVezes`), selo (tranca `h.ultimaHab` 3 turnos), parasita (rouba buffs/escudo: +5% de vida e +10% de dano por
  buff, 3 turnos: `buffDano`), corrupcao (`corrompidoDe/Ate`: `curarH` vira dano em poção, cura de grupo e curaDano), camadas (−80% de dano,
  4 cargas, cada acerto gasta 1), vinculo (no turno seguinte, 50% do dano no chefe volta no herói ligado), falsoColapso (traço: ao chegar
  a 0, volta com 30%, limpa efeitos, golpe em área e só `TORRE.colapso.mecanicas`). Chefes e elites redistribuídos em `chefesTorre`/`elitesTorre`.
- Ícones das habilidades dos chefes: `icoMec(id)` → assets/torre/mecanicas/<id>.webp (25: as 19 mecânicas + colapso, despertar,
  rapido, area, resistencia, furia); sem a arte vira o emoji (`EMOJI_MEC`, `mecSemIcone`). Aparecem no aviso ⚠, nas marcas do chefe
  (com dica `dicaMec`), na fileira "o que ele sabe" (`.cena-sabe`) e nos males do herói. Prompt único (grade 5x5) entregue ao Daniel.
- Artes chegaram (18/11/2026): 40 monstros em assets/torre/monstros (420px) e 25 ícones em assets/torre/mecanicas (96px, recortados da grade sem o texto).

### Jackpot da Arena mais alto (Henri, 18/11/2026, nível "médio")
- `ARENA.arenas[].jackpotPor10min` 125 / 850 / 3.500 / 10.500 (era 50/100/150/200) e `jackpotDefesa` por arena
  100 / 500 / 2.000 / 5.000 (soma a cada ataque perdido contra o Top 1; o `jackpotPorDefesa` geral vira reserva).
  Meta: um dia inteiro no Top 1 ≈ 6 h de caçada da faixa (Arena 30+: ~1,5 milhão/dia; ~570 mil à meia-noite).

### Arena: o D20 conta no veneno, sangramento e queimadura (Henri, 18/11/2026)
- `arena_vez`: o dano por vez do `dot` (Corte Vampírico, Flecha Envenenada) e da `queima` (Maldição) é multiplicado por
  `arena_fator_efeito(dado)`, pelas faixas de `ARENA.efeitoDado`: 1 = falha (efeito não aplicado, `ev.efeitoFalhou`);
  2–6 ×0,5; 7–12 ×1; 13–17 ×1,5; 18–20 ×2 (média ≈ ×1,1). Depois vem a defesa do alvo. `ev.efeitoDano` = dano por vez;
  o histórico mostra o dado.

### Leilão: faixas 10–20, 21–39 e 40–60 (Henri, 18/11/2026)
- `LEILAO.faixas`: l1 [10,20] itens 18–22; l2 [21,39] itens 30–40; l3 [40,999] itens 40–60 (antes 10–19/20–29/30+,
  itens 18–22/28–32/42–50). Mercado Negro segue a faixa: 10–20 até 22; 21–39 até 40; 40+ sem limite.

### Baú da conta (Henri, 18/11/2026)
- Aba Herói › Baú (`abaBau`, app.js). Por conta: `bau_conta` (ouro, consumiveis {"tipo:raridade": qtd}) e
  `bau_movimentos` (histórico; id único). Só ouro e consumíveis (D.CONSUMIVEIS); itens equipáveis e poções não.
- Guardar: ação `bauDepositar` (servidor-acoes.js) tira da ficha e põe em `dados.bauSaida`; a função `acao`
  (`esvaziarBau`, index.ts) chama `bau_guardar` (só o servidor; idempotente) depois de gravar e limpa a fila. Se falhar,
  tenta de novo na próxima ação. O gatilho da ficha não deixa gravação direta mexer em `bauSaida`.
- Retirar: `bau_retirar(meu, ouro, item, qtd)` (o jogador) tira do baú e cria crédito (ouro) ou recompensa
  `{tipo:'bau', ctipo, raridade, qtd}`; o cliente chama `receber` em seguida. Tipos aceitos no SQL: lista fixa
  (pergaminho, cristal, protecao, material, receita) — tipo novo de consumível: pôr lá também.

### Eventos: Altar dos Elementos (18/11/2026)
- Sub-aba "Evento" em Aventura (só com evento aberto, ou admin). `D.EVENTO_ALTAR`: 5 elementos, mesa 3x3 de montes com 3 cartas
  (1 tipo de elemento por carta, de 1 a 3 dele), 25 rolagens por partida, 5 dados, trocar 2→1, pontos (10/elemento, combo +15 por carta seguida na mesma mão, monte +50, linha +100, mesa +300 e mesa
  nova), 5 partidas/dia, prêmios do ranking.
- Regras: `novaPartidaAltar/pagarAltar/trocarAltar/rolarAltar/altarDoDia`. Servidor (`acao`): altarEntrar (precisa de
  `evento_atual`), altarPagar, altarTrocar, altarRolar, altarEncerrar → `eventoSaida` → `evento_registrar` (só o servidor; id
  `<personagem>:<evento>:<n>`, teto 20.000 por partida). Gatilho da ficha: `altar` e `eventoSaida` só o servidor escreve.
- Banco: `eventos`, `evento_pontos`, `evento_registros`; `evento_atual()`, `evento_ranking(meu)` (sem bots/admin),
  `evento_admin(meu, acao, dias)` (ligar/desligar/religar/premiar; prêmios iguais a `D.EVENTO_ALTAR.premios`).
- Tela: `abaEventos`/`cliqueAltar` (toque no monte que brilha paga sozinho com os dados certos; marcar = guardar ao rolar ou trocar 2).
  Admin: ligar com dias, sem data, desligar, religar, dar prêmios (confirma).
- Correção (18/11/2026): `arena_finalizar` quebrava com "column reference a is ambiguous" (a variável `a` = lado do atacante e o
  alias `a` do jsonb_array_elements no jackpot por arena). Alias virou `ar_cfg`; já rodado no Supabase. Quem tinha luta abandonada
  ficava com a Arena travada (arena_estado → encerrar_abandonadas → finalizar).
- Artes do Altar (18/11/2026): assets/eventos/altar (el-<elemento>.webp 128px recortadas da fileira, banner, mesa com os 9 encaixes,
  moldura = carta do topo, verso = cartas de baixo). As cartas ficam em cima dos encaixes (centros a 27,7/49,9/72,1% da mesa).
- Altar (18/11/2026, Daniel): os elementos NÃO se gastam ao pegar carta (ficam na mão); `pt.combo` conta as cartas da mão e zera ao
  rolar; fundo da aba = arte do templo (sem preto). Página de teste avulsa gerada por scratchpad/gerar_teste.py (não vai para o repo).
- Altar 4x4 (18/11/2026): 20 rolagens, 6 cartas por monte (simulação: ~0,25% completa a mesa); `EVENTO_ALTAR.lado` = 4 (16 montes; LINHAS_ALTAR gerado: 4 linhas, 4 colunas, 2 diagonais); cartas do
  tamanho da mesa (`--tam`); a carta mostra a quantidade em bolinhas (1 meio, 2 lado a lado, 3 diagonal); os elementos guardados
  continuam marcados depois de rolar (vão para o começo da mão).
- Mesa 4x4 nova (18/11/2026): assets/eventos/altar/mesa.webp (recortada só na mesa); centros dos encaixes x 21,3/40,4/59,6/78,8 e
  y 20,8/40,3/59,8/79,6 (%), carta 17,6% (no app.js, abaEventos).
- Altar: coluna completa vale `pontos.coluna` (250); linha e diagonal continuam `pontos.linha` (100). `ehColunaAltar(li)`.

### Arena: Sombra do Assassino pelo D20 (Henri, 18/11/2026)
- `arena_vez`, tipo `furtivo`: só fica nas sombras (`furtivo` + `critEm`) com o dado >= `ARENA.sombraDado` (18).
  Abaixo, `ev.sombraFalhou` e fica só o ataque normal do turno (a Sombra não gasta a vez). Recarga gasta igual.

### Exp em % (Henri, 18/11/2026; o EXP_MULT foi desfeito no mesmo dia)
- DESFEITO: `D.EXP_MULT` voltou para null (curva antiga). O código continua aceitando o multiplicador.
- `D.EXP_MULT` (faixa pelo level atual): 1–9 ×4, 10–19 ×5, 20–29 ×6, 30–39 ×9, 40+ ×12 sobre a curva antiga em
  `R.expNecessaria(nivel)`. `R.expNecessaria(nivel, true)` = curva antiga (usada pela Ascensão, que não encareceu).
  A exp dos chefes do Pesadelo (calculada em dados.js pela curva antiga) e dos monstros não mudou.
  Caçando sem parar (160 de estamina/h): 10 em ~4 h, 20 ~1,5 dia, 30 ~6 dias, 40 ~2 semanas, 53 ~1,5 mês, 60 ~2 meses.
- Tela: barra de exp e mensagens mostram só % do level atual (`expPct(p, valor)` em app.js); os números ficam no servidor.
- testes/regras.test.js zera o EXP_MULT no começo (testes antigos usam a curva base) e tem um teste próprio dele.

### Ficha mostra o Pacto (Henri, 19/11/2026)
- O Pacto de Ascensão (e runas e skills do clã) só entra em `status(p, true)` (contra monstros). A ficha usava
  `status(p)`, então a vida do Pacto (ex.: Vigor +2%) não aparecia. Agora: a barra de vida da ficha usa `status(p, true)`
  e os detalhes mostram "(contra monstros: X)" em Vida máxima, Dano e Defesa quando muda. Na Arena continua sem o Pacto.

### Clã e Pacto de Ascensão valem na Arena (Henri, 19/11/2026)
- Cliente: `status(p)` já soma `comCla` e `comAscensao` (aparecem na ficha e no poder na hora da compra); `status(p, true)`
  soma também as runas (só contra monstros).
- Servidor: `tanka_status` termina com `arena_com_pacto(arena_com_cla(res, p), p)`. Clã: lido do banco
  (`alianca_skills` + `alianca_membros` pelo `dados.id`); vida, dano, resistência (defesas) e velocidade, em %.
  Pacto: `ASC_NOS` (id → custo, tipo, ef) e `ASCENSAO` no tanka_dados; soma vida, dano, defesa, defesaMagica e
  velocidade dos nós se o custo couber nos pontos do level (+extras, até o limite) e no máximo de pedras; nó
  desconhecido = ignora o Pacto. Crítico, dano crítico, precisão e esquiva por pontos não contam (crítico na Arena é o D20).
- O gatilho da ficha agora força `dados.id = id da linha` (o clã da Arena é lido por ele).
