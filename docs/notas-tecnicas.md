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
- **Curva de exp**: do 25 ao 40 ficou longa demais (simulação: ~2.700 h até o 40 para Cavaleiro, muito mais para Mago).
  Sugestão feita: crescimento de +50% para +25–30% por level, e dar exp em missões/masmorras. Esperando ele escolher.
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
- APK: precisa do Android SDK (dl.google.com está bloqueado neste ambiente). Caminhos: liberar dl.google.com na rede do
  ambiente e montar um TWA aqui, ou o Daniel gerar no PWABuilder.com com a URL do jogo.

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
- Drops da caçada iguais em todas as áreas (`DROPS_CACADA`): 1º monstro 5%/5%, 2º 8%/8%, 3º 10%/10% + pergaminho 5%;
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
  armadura/joia/mão: bônus principal +5% por nível, mínimo +1 por nível (`bonusComEncanto`). Servidor igual
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

## Tema "Pedra Sombria" (Daniel, nov/2026)
- Visual escuro aprovado pelo Daniel a partir de uma imagem do Gemini. Só aparência; regras e telas iguais.
- `css/tema-sombrio.css` (escrito à mão) carrega depois de `css/estilo.css`; `css/tema-sombrio-cores.css` (gerado) fica
  entre os dois e troca os azuis-escuros antigos por pedra quente: `python3 ferramentas/gerar_tema_cores.py` de novo se
  `estilo.css` ganhar painéis azulados. Para voltar ao visual antigo, tirar os dois `<link>` do index.html.
- Letras: IM Fell English (texto) e IM Fell English SC (títulos/abas/botões), "ELDRIN" em Cinzel Decorative (Google Fonts).
  Os algarismos e o % vêm de `assets/fontes/ebgaramond.woff2` (fonte "Numeros Eldrin", `unicode-range`), porque os números
  do IM Fell são tortos.
- Arte em `assets/interface/`: `fundo.webp` (parede gótica, Gemini), `rocha.webp` (pedra rachada dos painéis, gerada por
  código), `canto-tl/tr/bl/br.webp` (enfeite dourado nos cantos de `.caixa`, Gemini). Faíscas só em CSS (`body::after`).
- Itens: fundo da raridade bem leve; brilho do encanto (`aura-eN`) com a mesma ordem de cores, tons mais frios e médio.
- Herói > Personagem: `abaPersonagem` agora embrulha em `.personagem-grade` > `.pg-equipamento` + `.pg-mochila`; a partir
  de 1450px a mochila vai para uma 3ª coluna (ficha | equipamento | mochila). Abaixo disso fica como antes.
- Daniel pediu: sem barras coloridas nos atributos (só números, como já era) e sem caveiras.

