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
- Ícones: faltam os 16 (`assets/habilidades/<id>.webp`); prompt de folha 4x4 no scratchpad (eldrin-icones-habilidades-20-30.txt).

## Caixa de entrada e sininho (Henri, nov/2026)
- Botões ✉ e 🔔 no fim da barra de recursos (`botoesAvisosHtml`), com selo de não lidas; painel `#painel-topo` no body.
- Caixa: `p.caixa` (até 80, mais novo primeiro, `{t, o, x}`) e `p.caixaVista`. Entra pelos avisos de `resgatarRecompensas`
  (`avisarCaixa`, origem da recompensa → boss/leilao/mercado/oficina/cla/masmorra) e de `aplicarCreditos` (menos os
  que o próprio jogador fez: lance, compra, fundação/doação do clã, pedido na oficina). "Mochila cheia" não entra.
- Sininho: todo `avisar` (`guardarNotificacao`), até 60, no localStorage por personagem (`eldrin.notificacoes.<id>`).

## Ficha do item flutuante (Henri, nov/2026)
- Saiu o painel `#ficha-item` ao lado dos equipados (mudava de tamanho e empurrava a mochila) e o "passar o mouse".
  Um clique em item/consumível abre `#ficha-flutuante` (dentro do #app, `position: fixed`, ao lado do item) com
  `fichaItemHtml` + botão "Ampliar e comparar" (`item-ampliar` → o zoom de antes). Fecha clicando fora, no ✕, no mesmo
  item ou Esc. `telaJogo` foi embrulhada para reabrir a ficha presa ao item depois de redesenhar.
