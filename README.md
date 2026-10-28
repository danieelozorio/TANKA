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

Testes das regras:

```bash
node testes/regras.test.js
```

## O que já existe

- **Cadastro** (usuário, senha, e-mail, WhatsApp) e **login** com usuário e senha.
- **Criação de personagem**: nome, sexo (Homem ou Mulher), raça e classe, até 3 por conta. O sexo muda só os retratos.
- **Raças**: Humano, Elfo, Elfo Negro, Orc e Anão (cada elevação +3, cada redução −3).
- **Classes**: Cavaleiro (Espada), Arqueiro (Arco), Mago (Cajado) e Artesão (Martelo de Batalha). Todas começam com 100 HP, 0 de ouro e uma arma comum de dano 1–1.
- **Level**: até o level 5 a exp dobra (10, 20, 40, 80, 160); do 6 em diante cada level pede 50% a mais (240, 360, 540…). **Level máximo: 40.** Cada level dá 3 pontos de atributo.
- **Combate por velocidade**: velocidade = Destreza. Um monstro com o dobro da sua velocidade ataca duas vezes para cada ataque seu.
- **Áreas de caça** (aba Caçar): cada área libera num level mínimo. Dentro da área, cada monstro tem o dobro de vida e exp do anterior; ataque +50% e velocidade +25% (a Floresta dobra tudo). Valores em `js/dados.js` (`areas`).

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
- **Chefes**: vida x3, ataque +50%, exp x5 e ouro x5 do 3º monstro. Cada monstro morto na área soma presença (escondida do jogador); ao clicar em Caçar, se o sorteio cair, aparece o aviso "Enfrentar / Fugir". Fugir leva ao monstro escolhido. Derrotar o chefe zera a presença. O chefe sempre dropa 1 arma ou armadura (com chance de lendária) e 1 a 3 pergaminhos.
- **Drops**: armas e armaduras sempre da classe do personagem (colar e anel servem para todos). A Sorte aumenta a chance (+1% relativo por ponto). Armaduras: Lobo 10% comum; Cobra 15% comum e 5% rara; Urso 10% rara e 3% épica.
- **Aba Personagem** (abre primeiro): retrato com 8 espaços em volta (elmo, colar, peitoral, arma, luvas, 2 anéis, botas) e a mochila de 32 espaços. Com mouse: clicar equipa/desequipa e passar o mouse mostra a ficha do item com comparação. No celular: tocar mostra a ficha com os botões. Mochila cheia não recebe drops.
- **Armaduras por classe**: Cavaleiro (placas: defesa e vida), Arqueiro (couro: destreza e sorte), Mago (tecido: inteligência e defesa mágica), Artesão (forja: força e sorte). Colar e anel para todos. Os bônus de atributo contam para tudo que o atributo influencia. Valores em `js/dados.js` (`armaduras` e `joias`).
- **Ouro e mercado**: o ouro aparece acima dos atributos. Qualquer arma, menos a equipada, pode ser vendida no inventário. A aba Mercado vende todas as armas da classe do personagem:

| Raridade | Dano | Venda | Compra |
|---|---|---|---|
| Comum | 1–1 | 10 | 10 |
| Rara | 3–5 | 20 | 100 |
| Épica (roxo) | 10–15 | 50 | 1.000 |
| Lendária (amarelo) | 30–55 | 100 | 10.000 |

- **Encantamento** (aba Encantar): de +0 a +10, gastando 1 Pergaminho de Encantamento da raridade da arma por tentativa. O pergaminho é vendido no Mercado (comum 5, rara 50, épica 500, lendária 5.000 de ouro) e o Urso tem 5% de chance de dropar um, da raridade da arma equipada.

| Nível | +1 a +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 70% | 60% | 50% | 40% | 30% | 20% | 10% |
| Se falhar | — | volta a +0 | volta a +0 | volta a +0 | quebra | quebra | quebra | quebra |

  Cada ponto de Sorte soma +1% na chance (máximo 95%). Cada nível soma dano: comum +1, rara +2, épica +3, lendária +5. A venda vale +20% por nível. O nome brilha em azul (+4 a +6), roxo (+7 a +9) e dourado (+10).
- **Conta de administrador**: contas listadas em `ADMINS` (em `js/dados.js`, hoje só `admin`) veem a aba **Admin**, com botões para dar ouro, subir de level, pegar todas as armas da classe (+0, +7 ou +10), um conjunto completo de qualquer raridade, ganhar pergaminhos, curar, recarregar as poções e simular o reset diário. É para testes; quando houver servidor, quem decide quem é admin deve ser o servidor.
- **Retratos**: arte pintada quando existe; se o arquivo não existir, aparece um desenho SVG no lugar.

## Como adicionar as artes

Salve em `assets/personagens/` com o nome `raca-classe.jpg`, e com `-f` no final para a versão feminina:

- raças: `humano`, `elfo`, `elfonegro`, `orc`, `anao`
- classes: `cavaleiro`, `arqueiro`, `mago`, `artesao`
- exemplos: `humano-cavaleiro.jpg`, `elfonegro-mago-f.jpg`

Para recortar uma grade de ícones gerada por IA (2x2, 4x4...): `python3 ferramentas/recortar_grade.py IMAGEM LINHAS COLUNAS nome1 nome2 ...` (nomes da esquerda para a direita, de cima para baixo). Os ícones vão para `assets/itens/`.

Ícones de itens (opcional) ficam em `assets/itens/`: armas `arma-<classe>-<raridade>.jpg`, armaduras `<classe>-<tipo>-<raridade>.jpg` (tipos: `elmo`, `peitoral`, `luvas`, `botas`) e joias `colar-<raridade>.jpg` / `anel-<raridade>.jpg`. Raridades: `comum`, `rara`, `epica`, `lendaria`. Sem o arquivo, aparece o ícone desenhado.

Monstros ficam em `assets/monstros/`, com o nome do monstro em minúsculas, sem acento e com hífens: `lobo-selvagem.jpg`, `aranha-do-brejo.jpg`, `cavaleiro-draconico.jpg`. Chefes usam só o primeiro nome: `velgrath.jpg`, `morgath.jpg`, `varnok.jpg`, `guardiao-da-torre.jpg`, `farao-sem-nome.jpg`, `vharkesh.jpg`, `ignaroth.jpg`. Sem a arte, aparece uma silhueta provisória. Não é preciso mexer no código: o jogo encontra o arquivo pelo nome.

## Fórmulas dos atributos

Todos os números ficam em `js/dados.js` (dados) e `js/regras.js` (fórmulas).

| Atributo | Afeta |
|---|---|
| Força | Ataque físico (+1 a cada 5), dano crítico (150% + 1% por ponto) |
| Destreza | Velocidade (= DES), precisão (75% + DES), evasão (0,5% por ponto), chance de crítico mágico (0,5% por ponto) |
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
js/contas.js        cadastro/login/salvamento (localStorage + PBKDF2)
js/retratos.js      retratos SVG e ilustrações dos monstros
js/app.js           telas e interação
assets/             artes (personagens, monstros e itens)
ferramentas/        recortar_grade.py (recorta grades de ícones)
testes/             testes das regras em Node
```

## Próximos passos para o tankaarena.com

- **Servidor e banco de dados**: hoje as contas ficam no `localStorage` do navegador, então cada jogador só vê os próprios dados naquele aparelho. Para o jogo online, `js/contas.js` precisa virar chamadas a uma API (Node/PHP + PostgreSQL/MySQL), com o combate validado no servidor para evitar trapaça.
- Sistema de craft do Artesão (a chance já é calculada e exibida).
