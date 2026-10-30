# Tanka — Arena Medieval Mística

RPG medieval místico de navegador. Domínio: **tankaarena.com**.

## Como jogar localmente

O jogo é HTML + CSS + JavaScript puro, sem build. Sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

> Use `http://localhost` ou `https://`: o hash da senha usa a Web Crypto do navegador, que só funciona em contexto seguro.

> Ao publicar uma atualização, aumente o número `?v=` dos arquivos em `index.html` (ex.: `?v=5` → `?v=6`). Assim o navegador dos jogadores baixa a versão nova em vez de usar a antiga guardada.

Testes do banco (precisa de um PostgreSQL local; ver `testes/banco.test.sh`):

```bash
PGHOST=/caminho/do/socket PGPORT=5432 sh testes/banco.test.sh
```

Testes das regras:

```bash
node testes/regras.test.js
```

## Servidor (Supabase)

As contas e os personagens ficam no **Supabase** (projeto `tanka`). O site continua estático (GitHub Pages) e fala direto com a API do Supabase em `js/contas.js`, sem biblioteca externa. O endereço e a chave **publishable** ficam em `js/config.js`. A chave secreta (`sb_secret_...` / service_role) **nunca** vai para o código.

Para preparar um projeto Supabase novo:

1. **SQL Editor → New query**: cole `supabase/schema.sql` inteiro e clique em **Run**. Cria as tabelas `contas` e `personagens`, as regras de segurança (cada um só lê e salva o que é seu), o limite de 3 personagens, nomes únicos e o relógio do servidor.
2. **Authentication → Sign In / Providers → Email**: desligue **Confirm email**. O login é por nome de usuário; por baixo, o Auth recebe um e-mail interno `<usuario>@jogador.tankaarena.com`, que não recebe mensagens. O e-mail real fica na tabela `contas`.
3. **Administrador**: cadastre a conta no jogo e rode no SQL Editor: `update contas set admin = true where lower(usuario) = 'admin';`

A vida com o tempo e o reset diário usam o relógio do servidor. Ainda falta a **Fase 2**: hoje o combate, os drops e o ouro são calculados no navegador, então um jogador que entende de programação ainda consegue trapacear o próprio personagem.

`js/contas-local.js` é a versão sem servidor (localStorage), com a mesma interface, usada só na prévia offline.

## O que já existe

- **Cadastro** (usuário, senha e e-mail) e **login** com usuário e senha.
- **Excluir personagem** (tela de escolha): botão Excluir em cada personagem; para confirmar é preciso digitar o nome dele (maiúsculas não importam). Apaga o personagem e as amizades dele, sem volta, e libera o nome e a vaga.
- **Criação de personagem**: nome, sexo (Homem ou Mulher), raça e classe, até 3 por conta. O sexo muda só os retratos.
- **Raças**: Humano, Elfo, Elfo Negro, Orc e Anão (cada elevação +3, cada redução −3).
- **Classes**: Cavaleiro (Espada), Arqueiro (Arco), Mago (Cajado) e Artesão (Martelo de Batalha). Todas começam com 100 HP, 0 de ouro e uma arma comum de dano 1–5.
- **Level**: até o level 5 a exp dobra (10, 20, 40, 80, 160); do 6 em diante cada level pede 50% a mais (240, 360, 540…). **Level máximo: 40.** Cada level dá 3 pontos de atributo.
- **Combate por velocidade**: a velocidade **não vem da Destreza**. Todo personagem começa com 15 e ganha 6% por level (composto: level 10 = 25, 20 = 45, 30 = 81, 40 = 146). Quem tem o dobro da velocidade ataca duas vezes para cada ataque do outro. **O monstro sempre dá o primeiro golpe** da luta (pode errar pela evasão). Todo golpe tira no mínimo 1.
- **Velocidade e defesa dos monstros** (escada única por todas as áreas): o Lobo tem 15 de velocidade e 1 de defesa; cada monstro seguinte +10% de velocidade e +25% de defesa; o 1º monstro da área seguinte tem 10% a mais que o 3º da anterior. A defesa do monstro **reduz o seu dano em porcentagem**: dano × 100 / (100 + defesa) (ex.: 40 de defesa = −29%). A carta do monstro mostra a defesa e o quanto ela reduz. Acerto: sua precisão −3% por área; o monstro acerta 80% + 2% por área − sua evasão.
- **Áreas de caça** (aba Caçar): cada área libera num level mínimo. Dentro da área, cada monstro tem o dobro de vida e exp do anterior e +25% de ataque (a Floresta dobra o ataque). Valores em `js/dados.js` (`areas`).

| Área | Level | Monstros | Chefe | Presença do chefe por abate |
|---|---|---|---|---|
| Floresta Sombria | 1+ | Lobo Selvagem, Cobra Viscosa, Urso Raivoso | Velgrath, o Ancião Apodrecido | +1% |
| Pântano de Brumafria | 5+ | Sapo Gigante, Aranha do Brejo, Troll do Pântano | Morgath, a Bruxa do Brejo | +0,7% |
| Ruínas de Dravenhold | 10+ | Esqueleto Guerreiro, Goblin Saqueador, Gárgula | Varnok, o Lich | +0,5% |
| Torre Carmesim | 15+ | Golem de Pedra, Cultista Sombrio, Espectro | O Guardião da Torre | +0,3% |
| Areias Rubras | 20+ | Escorpião Gigante, Homem-Lagarto, Múmia | O Faraó Sem Nome | +0,2% |
| Vale dos Dragões | 25+ | Drake, Wyvern, Cavaleiro Dracônico | Vhar'kesh, o Dragão Ancião | +0,15% |
| Cume do Fogo Eterno | 30+ | Salamandra, Demônio de Lava, Elemental de Fogo | Ignaroth, Senhor das Chamas | +0,1% |

- **Vida com o tempo** (único freio do jogo, sem estamina): fora da batalha a vida volta 2% da vida máxima por minuto, mesmo com o jogo fechado. **Acampar** faz a vida voltar 3x mais rápido (6%/min), mas não deixa caçar. O menu mostra "Vida cheia em X min".
- **Poções diárias**: cada personagem tem 2 poções por dia; cada uma cura 100% da vida, fora ou dentro da batalha (na batalha gasta a vez). Não acumulam, não são vendidas e não dropam.
- **Reset diário** à meia-noite de Brasília: vida cheia e as 2 poções de volta. (Sem servidor, o relógio é o do aparelho do jogador.)
- **Exp reduzida em área fácil**: a faixa de cada área termina no level da próxima área. De 3 a 7 levels acima do fim da faixa, a exp cai para 50%; com 8 ou mais, 10%. O Cume do Fogo Eterno nunca reduz. Ouro e drops não mudam. Valores em `js/dados.js` (`VIDA` e `EXP_REDUZIDA`).
- **Habilidades especiais** (*desligadas por enquanto*: para religar, mude `HABILIDADES_ATIVAS` para `true` em `js/dados.js`): na batalha, a barra de Poder enche (+25 por acerto, Mago +34; +10 por golpe recebido). Cheia, o jogador clica na habilidade (ou marca "Usar automaticamente"). Evolui nos levels 10, 20 e 30.
  - Cavaleiro, Golpe de Escudo: dano x1,5/x2/x2,5/x3 e atordoa o monstro por 1/2/2/3 ações.
  - Arqueiro, Chuva de Flechas: 2/3/3/4 flechas seguidas, com +10/+20/+30/+40% de crítico.
  - Mago, Bola de Fogo: dano x2,5/x3/x4/x5, sempre acerta e ignora a defesa mágica.
  - Artesão, Martelada Sísmica: dano x2/x2,5/x3/x4 ignorando a defesa; 20/30/40/50% (+Sorte) de quebrar a armadura (+25% de dano até o fim da luta).
- **Chefes**: em relação ao 3º monstro, +50% de vida e velocidade, +20% de ataque, o dobro da defesa, e exp x5 e ouro x5. Cada monstro morto na área soma presença (escondida do jogador); ao clicar em Caçar, se o sorteio cair, aparece o aviso "Enfrentar / Fugir". Fugir leva ao monstro escolhido. Derrotar o chefe zera a presença. Drops dos chefes:

| Chefe | Item | Pergaminhos |
|---|---|---|
| Velgrath | 15% de 1 item raro (qualquer tipo) | 1 a 3 comuns (sempre) |
| Morgath | 20% de 1 item raro | 1 a 3 raros |
| Varnok | 25% de 1 item raro | 2 a 5 raros |
| Guardião, Faraó, Vhar'kesh, Ignaroth | sempre 1 arma ou armadura (com chance de lendária) | 1 a 3 da raridade da arma equipada |
- **Drops**: armas e armaduras sempre da classe do personagem (colar e anel servem para todos). A Sorte aumenta a chance (+1% relativo por ponto). "Qualquer item" sorteia entre arma, as 4 armaduras da classe, colar e anel.

| Monstro | Armas | Armaduras/joias | Qualquer item | Pergaminho |
|---|---|---|---|---|
| Lobo | comum 10% | comum 10% | | |
| Cobra | comum 15% | comum 15% | | |
| Urso | | | comum 15% | comum 5% |
| Sapo | | | comum 15% | comum 10% |
| Aranha | | | comum 18% | comum 13% |
| Troll | | | comum 20% | comum 15% |
| Esqueleto | rara 8% | rara 8% | | |
| Goblin | rara 10% | rara 10% | | |
| Gárgula | rara 15% | rara 15% | | 5% (da arma equipada) |

  Da Torre Carmesim em diante, os drops continuam como antes (ver `js/dados.js`).
- **Aba Personagem** (abre primeiro): retrato com 8 espaços em volta (elmo, colar, peitoral, arma, luvas, 2 anéis, botas) e a mochila de 32 espaços. Com mouse: clicar equipa/desequipa e passar o mouse mostra a ficha do item com comparação. No celular: tocar mostra a ficha com os botões. Mochila cheia não recebe drops.
- **Armaduras por classe**: Cavaleiro (placas: defesa e vida), Arqueiro (couro: destreza e sorte), Mago (tecido: inteligência e defesa mágica), Artesão (forja: força e sorte). Colar e anel para todos. Os bônus de atributo contam para tudo que o atributo influencia. Valores em `js/dados.js` (`armaduras` e `joias`).
- **Ouro e mercado**: o ouro aparece acima dos atributos. Qualquer arma, menos a equipada, pode ser vendida no inventário. As armas têm **8 variações por raridade** em cada classe (nomes diferentes) e o dano é **sorteado** quando a arma cai ou é comprada: o mínimo numa faixa e o máximo em outra (ex.: uma comum 4–10). Armas de antes dessa mudança viraram a variação clássica com o dano no meio das faixas. A aba Mercado vende armas sorteadas de cada raridade:

| Raridade | Dano (mínimo / máximo) | Venda | Compra |
|---|---|---|---|
| Comum | 1–5 / 5–10 | 10 | 10 |
| Rara | 11–15 / 16–20 | 20 | 100 |
| Épica (roxo) | 21–24 / 25–30 | 50 | 1.000 |
| Lendária (amarelo) | 31–34 / 35–40 | 100 | 10.000 |

- **Encantamento** (aba Encantar): de +0 a +10, gastando 1 Pergaminho de Encantamento da raridade da arma por tentativa. O pergaminho é vendido no Mercado (comum 5, rara 50, épica 500, lendária 5.000 de ouro) e alguns monstros e todos os chefes dropam pergaminhos (ver as tabelas de drops).

| Nível | +1 a +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 70% | 60% | 50% | 40% | 30% | 20% | 10% |
| Se falhar | — | volta a +0 | volta a +0 | volta a +0 | quebra | quebra | quebra | quebra |

  Cada ponto de Sorte soma +1% na chance (máximo 95%). Cada nível soma dano: comum +1, rara +2, épica +3, lendária +5. A venda vale +20% por nível. O nome brilha em azul (+4 a +6), roxo (+7 a +9) e dourado (+10). Nos quadros de item, uma **luz suave da cor da raridade fica atrás do item** (cinza, azul, roxo, laranja) e a **borda brilha piscando na cor do encantamento**: prata fraco (+1), verde crescente (+2 e +3), azul crescente (+4 e +5), rosa (+6), roxo (+7), amarelo (+8), laranja (+9) e vermelho (+10).
- **Conta de administrador**: contas com `admin = true` na tabela `contas` (na versão local, as listadas em `ADMINS` em `js/dados.js`) veem a aba **Admin**, com botões para dar ouro, subir de level, pegar todas as armas da classe (+0, +7 ou +10), um conjunto completo de qualquer raridade, ganhar pergaminhos, curar, recarregar as poções e simular o reset diário. Também tira: ouro (−1.000, −10.000, zerar), level (−1, −5, voltar ao 1; zera a exp e devolve os pontos), exp (±% do level), pontos de atributo (resetar), pergaminhos, vida (50%, 10%, zerar), poções e itens da mochila (com confirmação). É para testes; quando houver servidor, quem decide quem é admin deve ser o servidor.
- **Ranking** (aba Ranking): top 100 por **Level** (empate: exp) ou por **Poder**. O Poder também aparece na ficha: é uma nota de força = ataque (dano médio × crítico esperado × precisão × velocidade ÷ 10, vezes 10) + metade da resistência (vida × (1 + defesas ÷ 20) × (1 + evasão)). Fórmula em `R.poder` (`js/regras.js`). Contas de administrador não entram.
- **Masmorras em grupo** (aba Masmorra): grupo de 3 personagens amigos. No Social, "Convidar para o grupo" (quem convida vira o líder 👑); o convidado aceita na aba Masmorra. O líder escolhe a masmorra, os 3 marcam "Pronto" e o líder clica em "Entrar". Luta automática, sem poções e sem habilidades, com **vida própria** (morrer lá não mexe na vida nem na exp de fora). 3 salas: os 3 monstros da área, 2x o 3º monstro + Elite, e o Chefe da Masmorra. Se pelo menos um herói vencer o chefe, **os 3 ganham um colar ou anel** (única fonte de joias: elas não caem mais nas caçadas nem são vendidas no Mercado) e gastam 1 das 2 entradas do dia; se os 3 caírem, ninguém perde nada e a entrada não é gasta. O servidor sorteia a semente da luta e cada navegador calcula a mesma luta (`R.simularMasmorra`); o líder informa o resultado e o servidor entrega as joias (tabela `recompensas`). Masmorras, níveis, Elites, Chefes e raridades em `js/dados.js` (`masmorras`) e em `supabase/schema.sql`.

| Masmorra | Level | Joia |
|---|---|---|
| Toca dos Lobos Sombrios | 5+ | comum 80%, rara 20% |
| Ninho da Bruxa | 10+ | comum 50%, rara 45%, épica 5% |
| Catacumbas de Dravenhold | 15+ | rara 80%, épica 20% |
| Biblioteca Proibida | 20+ | rara 50%, épica 48%, lendária 2% |
| Tumba do Faraó | 25+ | épica 90%, lendária 10% |
| Covil de Vhar'kesh | 30+ | épica 80%, lendária 20% |
| Coração do Vulcão | 35+ | épica 65%, lendária 35% |

- **Social** (aba Social): adicionar amigo pelo nome do personagem, aceitar/recusar pedidos (a aba mostra quantos chegaram), cancelar pedidos enviados e remover amigos (com confirmação). A lista mostra raça, classe, level, poder e se o amigo está **online** (jogou nos últimos 3 minutos; o jogo avisa o servidor a cada minuto) ou há quanto tempo foi visto. Se os dois pedirem um ao outro, a amizade vira na hora. Até 50 amigos e pedidos por personagem.
- **Chat Global**: botão 💬 no canto da tela do jogo (com contador de mensagens novas). Mostra nome, classe e level do personagem e as últimas 100 mensagens; atualiza a cada 4 s com a janela aberta. Até 200 caracteres e 1 mensagem a cada 3 s (conferido no servidor, que também preenche classe e level a partir do personagem salvo). Mensagens com mais de 7 dias são apagadas. O admin vê 🗑 (apagar) e 🔇 (silenciar por X horas, "sempre" ou 0 para liberar) em cada mensagem.
- **Retratos**: arte pintada quando existe; se o arquivo não existir, aparece um desenho SVG no lugar.

## Como adicionar as artes

Salve em `assets/personagens/` com o nome `raca-classe.jpg`, e com `-f` no final para a versão feminina:

- raças: `humano`, `elfo`, `elfonegro`, `orc`, `anao`
- classes: `cavaleiro`, `arqueiro`, `mago`, `artesao`
- exemplos: `humano-cavaleiro.jpg`, `elfonegro-mago-f.jpg`

Para recortar uma grade de ícones gerada por IA (2x2, 4x4...): `python3 ferramentas/recortar_grade.py IMAGEM LINHAS COLUNAS nome1 nome2 ...` (nomes da esquerda para a direita, de cima para baixo). Os ícones vão para `assets/itens/`.

Depois de adicionar ícones novos, rode `python3 ferramentas/recortar_fundo.py` (ou com os nomes, ex.: `... anel-comum`): ela cria ao lado de cada `.jpg` uma versão `.webp` sem o fundo escuro, que o jogo usa para a cor da raridade aparecer atrás do item. Sem o `.webp`, o jogo usa o `.jpg`.

Ícones de itens (opcional) ficam em `assets/itens/`: armas `arma-<classe>-<raridade>.jpg`, armaduras `<classe>-<tipo>-<raridade>.jpg` (tipos: `elmo`, `peitoral`, `luvas`, `botas`) e joias `colar-<raridade>.jpg` / `anel-<raridade>.jpg`. Raridades: `comum`, `rara`, `epica`, `lendaria`. Sem o arquivo, aparece o ícone desenhado.

Monstros ficam em `assets/monstros/`, com o nome do monstro em minúsculas, sem acento e com hífens: `lobo-selvagem.jpg`, `aranha-do-brejo.jpg`, `cavaleiro-draconico.jpg`. Chefes usam só o primeiro nome: `velgrath.jpg`, `morgath.jpg`, `varnok.jpg`, `guardiao-da-torre.jpg`, `farao-sem-nome.jpg`, `vharkesh.jpg`, `ignaroth.jpg`. Sem a arte, aparece uma silhueta provisória. Não é preciso mexer no código: o jogo encontra o arquivo pelo nome.

## Fórmulas dos atributos

Todos os números ficam em `js/dados.js` (dados) e `js/regras.js` (fórmulas).

| Atributo | Afeta |
|---|---|
| Força | Ataque físico (+1 a cada 5), dano crítico (150% + 1% por ponto) |
| Destreza | Precisão (75% + DES), evasão (0,5% por ponto), chance de crítico mágico (0,5% por ponto). Não dá mais velocidade. |
| Resistência | Defesa e defesa mágica (+1 a cada 10), vida (+5 HP por ponto distribuído) |
| Inteligência | Ataque mágico (+1 a cada 5) |
| Sorte | Chance de crítico (0,5% por ponto), dano crítico mágico (150% + 1% por ponto), craft (1%/ponto), drop (+1%/ponto), encantamento (1%/ponto) |

Vida máxima = 100 + 10 por level acima do 1 + 5 por ponto de Resistência distribuído.
Ao perder uma batalha, o personagem fica com **0 de vida** e perde **5% da exp do level** (sem descer de level; `PERDA_EXP_DERROTA` em `js/dados.js`). Com 0 de vida não pode caçar; a partir de 1 de vida já pode, por sua conta e risco de morrer de novo. Por isso é preciso tomar cuidado com áreas difíceis demais.

## Estrutura

```
index.html          página única
css/estilo.css      visual
js/dados.js         raças, classes, monstros, armas e constantes
js/regras.js        status, level, combate, drops (sem DOM, testável)
js/config.js        endereço e chave pública do Supabase
js/contas.js        cadastro/login/salvamento no Supabase
js/contas-local.js  a mesma coisa sem servidor (localStorage + PBKDF2)
supabase/schema.sql tabelas e regras de segurança do banco
js/retratos.js      retratos SVG e ilustrações dos monstros
js/app.js           telas e interação
assets/             artes (personagens, monstros e itens)
ferramentas/        recortar_grade.py (recorta grades de ícones)
testes/             testes das regras em Node
```

## Próximos passos para o tankaarena.com

- **Fase 2 do servidor**: combate, drops, compras e encantamento calculados no servidor (Supabase Edge Functions), para impedir trapaça.
- Sistema de craft do Artesão (a chance já é calculada e exibida).
