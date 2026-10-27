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
- **Level**: 10 de exp para o level 2, e a exp necessária dobra a cada level (10, 20, 40, 80…). Cada level dá 3 pontos de atributo.
- **Combate por velocidade**: velocidade = Destreza. Um monstro com o dobro da sua velocidade ataca duas vezes para cada ataque seu.
- **Monstros**:

| Monstro | HP | Ataque | Velocidade | Exp | Ouro (100%) | Drops |
|---|---|---|---|---|---|---|
| Lobo Selvagem | 20 | 1 | 8 | 2 | 2 | — |
| Cobra Viscosa | 40 | 2 | 16 | 4 | 5 | Rara 10% |
| Urso Raivoso | 80 | 4 | 32 | 8 | 20 | Épica 10%, Rara 30% |

- **Drops**: sempre a arma da classe do personagem. A Sorte aumenta a chance (+1% relativo por ponto).
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
- **Conta de administrador**: contas listadas em `ADMINS` (em `js/dados.js`, hoje só `admin`) veem a aba **Admin**, com botões para dar ouro, subir de level, pegar todas as armas da classe (+0, +7 ou +10), ganhar pergaminhos e curar. É para testes; quando houver servidor, quem decide quem é admin deve ser o servidor.
- **Retratos**: arte pintada quando existe; se o arquivo não existir, aparece um desenho SVG no lugar.

## Como adicionar as artes

Salve em `assets/personagens/` com o nome `raca-classe.jpg`, e com `-f` no final para a versão feminina:

- raças: `humano`, `elfo`, `elfonegro`, `orc`, `anao`
- classes: `cavaleiro`, `arqueiro`, `mago`, `artesao`
- exemplos: `humano-cavaleiro.jpg`, `elfonegro-mago-f.jpg`

Monstros ficam em `assets/monstros/`: `lobo-selvagem.jpg`, `cobra-viscosa.jpg`, `urso-raivoso.jpg`. Não é preciso mexer no código: o jogo encontra o arquivo pelo nome.

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
Ao perder uma batalha, o personagem volta com metade da vida, sem perder exp.

## Estrutura

```
index.html          página única
css/estilo.css      visual
js/dados.js         raças, classes, monstros, armas e constantes
js/regras.js        status, level, combate, drops (sem DOM, testável)
js/contas.js        cadastro/login/salvamento (localStorage + PBKDF2)
js/retratos.js      retratos SVG e ilustrações dos monstros
js/app.js           telas e interação
assets/             artes (personagens e monstros)
testes/             testes das regras em Node
```

## Próximos passos para o tankaarena.com

- **Servidor e banco de dados**: hoje as contas ficam no `localStorage` do navegador, então cada jogador só vê os próprios dados naquele aparelho. Para o jogo online, `js/contas.js` precisa virar chamadas a uma API (Node/PHP + PostgreSQL/MySQL), com o combate validado no servidor para evitar trapaça.
- Sistema de craft do Artesão (a chance já é calculada e exibida).
