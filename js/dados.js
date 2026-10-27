// Tanka — dados do jogo (raças, classes, monstros, armas e constantes de balanceamento).
// Tudo que é número de balanceamento mora aqui para ser ajustado sem mexer na lógica.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dados = {
  NOME_JOGO: 'Tanka',
  DOMINIO: 'tankaarena.com',

  // Contas com a aba Admin (ferramentas de teste). Use o nome de usuário em minúsculas.
  // Atenção: enquanto as contas ficam no navegador, isso não é segurança de verdade;
  // com o servidor, o servidor é quem deve decidir quem é admin.
  ADMINS: ['admin'],

  // Progressão
  HP_INICIAL: 100,        // HP no level 1
  HP_POR_NIVEL: 10,       // HP extra a cada level
  HP_POR_RES: 5,          // HP extra por ponto de Resistência distribuído
  PONTOS_POR_NIVEL: 3,    // pontos de atributo ganhos a cada level
  EXP_BASE: 10,           // exp para sair do level 1; dobra a cada level até o 5
  EXP_CRESCIMENTO: 1.5,   // do level 6 em diante, cada level pede 50% a mais que o anterior
  MAX_PERSONAGENS: 3,
  MOCHILA_MAX: 32,        // espaços da mochila (itens não equipados)
  MODIFICADOR_RACA: 3,    // cada elevação +3, cada redução -3

  atributos: {
    for: { nome: 'Força', sigla: 'FOR', efeito: 'Ataque, dano crítico' },
    des: { nome: 'Destreza', sigla: 'DES', efeito: 'Chance de magia crítica, evasão, precisão, velocidade de ataque' },
    res: { nome: 'Resistência', sigla: 'RES', efeito: 'Defesa, defesa mágica, vida' },
    int: { nome: 'Inteligência', sigla: 'INT', efeito: 'Ataque mágico' },
    sor: { nome: 'Sorte', sigla: 'SOR', efeito: 'Chance de crítico, dano crítico mágico, craft, drop e encantamento' },
  },

  classes: {
    cavaleiro: {
      nome: 'Cavaleiro',
      descricao: 'Força e resistência elevadas. A muralha de aço da linha de frente.',
      atributos: { for: 15, des: 10, res: 20, int: 10, sor: 10 },
      dano: 'fisico',
    },
    arqueiro: {
      nome: 'Arqueiro',
      descricao: 'Destreza e sorte elevadas. Flechas rápidas e certeiras.',
      atributos: { for: 15, des: 20, res: 10, int: 10, sor: 20 },
      dano: 'fisico',
    },
    mago: {
      nome: 'Mago',
      descricao: 'Destreza e inteligência elevadas. Domina as artes arcanas.',
      atributos: { for: 10, des: 15, res: 10, int: 20, sor: 10 },
      dano: 'magico',
    },
    artesao: {
      nome: 'Artesão',
      descricao: 'Força e sorte elevadas. Forja, encanta e esmaga com o martelo.',
      atributos: { for: 15, des: 10, res: 15, int: 10, sor: 20 },
      dano: 'fisico',
    },
  },

  // elevado: +3 | reduzido: -3
  racas: {
    humano: {
      nome: 'Humano',
      descricao: 'Versáteis e equilibrados. Podem seguir qualquer caminho.',
      elevados: [], reduzidos: [],
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfo: {
      nome: 'Elfo',
      descricao: 'Ágeis e sábios, porém de corpo frágil.',
      elevados: ['des', 'int'], reduzidos: ['res', 'for'],
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfoNegro: {
      nome: 'Elfo Negro',
      descricao: 'Fortes e astutos, mas pouco resistentes e de sorte amaldiçoada.',
      elevados: ['for', 'int'], reduzidos: ['res', 'sor'],
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    orc: {
      nome: 'Orc',
      descricao: 'Brutos e duros como rocha, mas lentos de corpo e mente.',
      elevados: ['for', 'res'], reduzidos: ['des', 'int'],
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    anao: {
      nome: 'Anão',
      descricao: 'Robustos e sortudos, mestres das minas, pouco ágeis.',
      elevados: ['res', 'sor'], reduzidos: ['des', 'int'],
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
  },

  // venda: ouro recebido ao vender | compra: preço no mercado
  raridades: {
    comum: { nome: 'Comum', dano: [1, 1], venda: 10, compra: 10 },
    rara: { nome: 'Rara', dano: [3, 5], venda: 20, compra: 100 },
    epica: { nome: 'Épica', dano: [10, 15], venda: 50, compra: 1000 },
    lendaria: { nome: 'Lendária', dano: [30, 55], venda: 100, compra: 10000 },
  },

  // Espaços de equipamento (aba Personagem). `tipo` é o tipo de item que cabe no espaço.
  slots: {
    elmo: { nome: 'Elmo', tipo: 'elmo' },
    colar: { nome: 'Colar', tipo: 'colar' },
    peitoral: { nome: 'Peitoral', tipo: 'peitoral' },
    arma: { nome: 'Arma', tipo: 'arma' },
    luvas: { nome: 'Luvas', tipo: 'luvas' },
    anel1: { nome: 'Anel', tipo: 'anel' },
    anel2: { nome: 'Anel', tipo: 'anel' },
    botas: { nome: 'Botas', tipo: 'botas' },
  },

  // Nomes dos bônus de equipamento.
  bonus: {
    defesa: 'Defesa', defesaMagica: 'Defesa Mágica', vida: 'Vida',
    for: 'Força', des: 'Destreza', res: 'Resistência', int: 'Inteligência', sor: 'Sorte',
  },

  // Armaduras de cada classe. Valores dos bônus na ordem: comum, rara, épica, lendária.
  armaduras: {
    cavaleiro: {
      elmo: { tipo: 'Elmo', bonus: { defesa: [2, 5, 10, 20], vida: [10, 25, 60, 150] },
        nomes: ['Elmo de Ferro', 'Elmo de Aço', 'Elmo do Crepúsculo', 'Elmo do Rei Eterno'] },
      peitoral: { tipo: 'Peitoral', bonus: { defesa: [3, 8, 16, 32], vida: [15, 40, 100, 250] },
        nomes: ['Peitoral de Ferro', 'Peitoral de Aço', 'Peitoral do Crepúsculo', 'Peitoral do Rei Eterno'] },
      luvas: { tipo: 'Manoplas', bonus: { defesa: [1, 3, 6, 12], for: [1, 2, 4, 8] },
        nomes: ['Manoplas de Ferro', 'Manoplas de Aço', 'Manoplas do Crepúsculo', 'Manoplas do Rei Eterno'] },
      botas: { tipo: 'Grevas', bonus: { defesa: [1, 3, 6, 12], res: [1, 2, 4, 8] },
        nomes: ['Grevas de Ferro', 'Grevas de Aço', 'Grevas do Crepúsculo', 'Grevas do Rei Eterno'] },
    },
    arqueiro: {
      elmo: { tipo: 'Capuz', bonus: { defesa: [1, 3, 6, 12], des: [1, 2, 4, 8] },
        nomes: ['Capuz de Couro', 'Capuz Élfico', 'Capuz da Lua Sangrenta', 'Capuz do Sol Dourado'] },
      peitoral: { tipo: 'Colete', bonus: { defesa: [2, 5, 10, 20], vida: [10, 25, 60, 150] },
        nomes: ['Colete de Couro', 'Colete Élfico', 'Colete da Lua Sangrenta', 'Colete do Sol Dourado'] },
      luvas: { tipo: 'Braçadeiras', bonus: { defesa: [1, 2, 4, 8], des: [1, 2, 4, 8] },
        nomes: ['Braçadeiras de Couro', 'Braçadeiras Élficas', 'Braçadeiras da Lua Sangrenta', 'Braçadeiras do Sol Dourado'] },
      botas: { tipo: 'Botas', bonus: { defesa: [1, 2, 4, 8], sor: [1, 2, 4, 8] },
        nomes: ['Botas de Couro', 'Botas Élficas', 'Botas da Lua Sangrenta', 'Botas do Sol Dourado'] },
    },
    mago: {
      elmo: { tipo: 'Chapéu', bonus: { defesaMagica: [2, 5, 10, 20], int: [1, 2, 4, 8] },
        nomes: ['Chapéu de Linho', 'Chapéu Arcano', 'Chapéu do Vazio Estelar', 'Chapéu da Origem'] },
      peitoral: { tipo: 'Manto', bonus: { defesa: [1, 3, 6, 12], defesaMagica: [2, 5, 10, 20], vida: [5, 15, 40, 100] },
        nomes: ['Manto de Linho', 'Manto Arcano', 'Manto do Vazio Estelar', 'Manto da Origem'] },
      luvas: { tipo: 'Luvas', bonus: { defesa: [1, 2, 4, 8], int: [1, 2, 4, 8] },
        nomes: ['Luvas de Linho', 'Luvas Arcanas', 'Luvas do Vazio Estelar', 'Luvas da Origem'] },
      botas: { tipo: 'Sandálias', bonus: { defesa: [1, 2, 4, 8], des: [1, 2, 4, 8] },
        nomes: ['Sandálias de Linho', 'Sandálias Arcanas', 'Sandálias do Vazio Estelar', 'Sandálias da Origem'] },
    },
    artesao: {
      elmo: { tipo: 'Capacete', bonus: { defesa: [2, 4, 8, 16], vida: [5, 15, 40, 100] },
        nomes: ['Capacete de Couro', 'Capacete Rúnico', 'Capacete do Trovão', 'Capacete dos Deuses Forjadores'] },
      peitoral: { tipo: 'Avental', bonus: { defesa: [2, 5, 10, 20], vida: [10, 25, 60, 150] },
        nomes: ['Avental de Couro', 'Avental Rúnico', 'Avental do Trovão', 'Avental dos Deuses Forjadores'] },
      luvas: { tipo: 'Luvas', bonus: { defesa: [1, 2, 4, 8], for: [1, 2, 4, 8] },
        nomes: ['Luvas de Couro', 'Luvas Rúnicas', 'Luvas do Trovão', 'Luvas dos Deuses Forjadores'] },
      botas: { tipo: 'Botas', bonus: { defesa: [1, 2, 4, 8], sor: [1, 2, 4, 8] },
        nomes: ['Botas de Couro', 'Botas Rúnicas', 'Botas do Trovão', 'Botas dos Deuses Forjadores'] },
    },
  },

  // Joias: servem para todas as classes.
  joias: {
    colar: { tipo: 'Colar', bonus: { defesaMagica: [1, 3, 6, 12], vida: [5, 15, 40, 100] },
      nomes: ['Colar de Cobre', 'Colar de Prata', 'Colar de Ametista', 'Colar do Sol Eterno'] },
    anel: { tipo: 'Anel', bonus: { sor: [1, 2, 4, 8] },
      nomes: ['Anel de Cobre', 'Anel de Prata', 'Anel de Ametista', 'Anel do Sol Eterno'] },
  },

  // Encantamento: +0 a +10, gastando 1 pergaminho da raridade da arma por tentativa.
  encantamento: {
    maximo: 10,
    seguroAte: 3,              // +1 a +3 nunca falham
    chances: { 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 },
    chanceMaxima: 95,          // teto depois do bônus de Sorte (+1% por ponto)
    voltaZeroAte: 6,           // falha até +6 volta a arma para +0; do +7 em diante ela quebra
    danoPorNivel: { comum: 1, rara: 2, epica: 3, lendaria: 5 },
    precoPergaminho: { comum: 5, rara: 50, epica: 500, lendaria: 5000 },
    vendaPorNivel: 0.2,        // +20% do valor de venda por nível
    // Bônus por nível em armaduras e joias
    bonusPorNivel: { elmo: 'defesa', peitoral: 'defesa', luvas: 'defesa', botas: 'defesa', colar: 'defesaMagica', anel: 'sor' },
  },

  sexos: {
    masculino: { nome: 'Homem' },
    feminino: { nome: 'Mulher' },
  },

  // Arma de cada classe por raridade. O drop sempre respeita a classe do personagem.
  armas: {
    cavaleiro: { tipo: 'Espada', comum: 'Espada de Ferro', rara: 'Espada Rúnica', epica: 'Lâmina do Crepúsculo', lendaria: 'Espada do Rei Eterno' },
    arqueiro: { tipo: 'Arco', comum: 'Arco Curto', rara: 'Arco Élfico', epica: 'Arco da Lua Sangrenta', lendaria: 'Arco do Sol Dourado' },
    mago: { tipo: 'Cajado', comum: 'Cajado de Carvalho', rara: 'Cajado Arcano', epica: 'Cajado do Vazio Estelar', lendaria: 'Cajado da Origem' },
    artesao: { tipo: 'Martelo de Batalha', comum: 'Martelo de Batalha', rara: 'Martelo Rúnico', epica: 'Martelo do Trovão Ancestral', lendaria: 'Martelo dos Deuses Forjadores' },
  },

  // ouro: sempre cai (100%) ao derrotar o monstro.
  // Cada monstro tem o dobro dos atributos e da exp do anterior.
  // destreza = velocidade (usada para evasão e precisão do monstro).
  // ---------- Áreas de caça ----------
  // Dentro da área, cada monstro tem o dobro de vida e exp do anterior; ataque e velocidade
  // crescem conforme `crescimento` (a Floresta dobra tudo, como Lobo → Cobra → Urso).
  // `base` são os valores do 1º monstro; o chefe é calculado a partir do 3º (ver abaixo).
  // drops: armas; dropsArmadura: peças (4 da classe + colar + anel, sorteada).
  // Chances em % (cumulativas, roladas uma vez), multiplicadas pelo bônus de Sorte.
  // chanceChefe: % somada à presença do chefe a cada monstro morto na área (escondida do jogador).
  NIVEL_MAXIMO: 40,
  areas: [
    {
      id: 'floresta', nome: 'Floresta Sombria', nivelMin: 1, chanceChefe: 1,
      crescimento: { ataque: 2, velocidade: 2 },
      descricao: 'Mata densa e enevoada onde todo aventureiro dá os primeiros passos.',
      base: { hp: 20, ataque: 1, velocidade: 8, exp: 2 }, ouro: [2, 5, 20],
      monstros: [
        { id: 'lobo', nome: 'Lobo Selvagem', descricao: 'Caça em matilha nas florestas enevoadas.',
          drops: [], dropsArmadura: [{ raridade: 'comum', chance: 10 }] },
        { id: 'cobra', nome: 'Cobra Viscosa', descricao: 'Desliza pelos pântanos deixando um rastro de gosma venenosa.',
          drops: [{ raridade: 'rara', chance: 10 }], dropsArmadura: [{ raridade: 'comum', chance: 15 }, { raridade: 'rara', chance: 5 }] },
        { id: 'urso', nome: 'Urso Raivoso', descricao: 'Senhor das cavernas. Sua fúria derruba árvores.',
          drops: [{ raridade: 'epica', chance: 10 }, { raridade: 'rara', chance: 30 }],
          dropsArmadura: [{ raridade: 'rara', chance: 10 }, { raridade: 'epica', chance: 3 }] },
      ],
      chefe: { id: 'grakk', nome: 'Grakk, o Lobo Alfa', descricao: 'O líder da matilha. Seus uivos gelam o sangue.',
        drops: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 25 }], dropPadrao: 'rara' },
    },
    {
      id: 'pantano', nome: 'Pântano de Brumafria', nivelMin: 5, chanceChefe: 0.7,
      descricao: 'Águas paradas cobertas por uma névoa gelada que nunca se dissipa.',
      base: { hp: 70, ataque: 8, velocidade: 9, exp: 10 }, ouro: [30, 60, 120],
      monstros: [
        { id: 'sapo', nome: 'Sapo Gigante', descricao: 'Do tamanho de um boi, engole viajantes inteiros.',
          drops: [{ raridade: 'rara', chance: 5 }], dropsArmadura: [{ raridade: 'comum', chance: 20 }] },
        { id: 'aranha', nome: 'Aranha do Brejo', descricao: 'Tece teias entre as árvores mortas do pântano.',
          drops: [{ raridade: 'rara', chance: 10 }], dropsArmadura: [{ raridade: 'rara', chance: 5 }] },
        { id: 'troll', nome: 'Troll do Pântano', descricao: 'Coberto de musgo, regenera feridas no lodo.',
          drops: [{ raridade: 'epica', chance: 8 }, { raridade: 'rara', chance: 25 }],
          dropsArmadura: [{ raridade: 'epica', chance: 3 }, { raridade: 'rara', chance: 10 }] },
      ],
      chefe: { id: 'morgath', nome: 'Morgath, a Bruxa do Brejo', descricao: 'Senhora da névoa. Fala com os mortos do pântano.',
        drops: [{ raridade: 'lendaria', chance: 10 }, { raridade: 'epica', chance: 40 }], dropPadrao: 'rara' },
    },
    {
      id: 'ruinas', nome: 'Ruínas de Dravenhold', nivelMin: 10, chanceChefe: 0.5,
      descricao: 'Restos de um reino caído, onde os mortos ainda guardam seus tesouros.',
      base: { hp: 140, ataque: 15, velocidade: 10, exp: 30 }, ouro: [100, 200, 400],
      monstros: [
        { id: 'esqueleto', nome: 'Esqueleto Guerreiro', descricao: 'Soldado de Dravenhold que nunca deixou o posto.',
          drops: [{ raridade: 'rara', chance: 10 }], dropsArmadura: [{ raridade: 'rara', chance: 8 }] },
        { id: 'goblin', nome: 'Goblin Saqueador', descricao: 'Revira as ruínas atrás de ouro e não divide com ninguém.',
          drops: [{ raridade: 'epica', chance: 3 }, { raridade: 'rara', chance: 20 }],
          dropsArmadura: [{ raridade: 'epica', chance: 2 }, { raridade: 'rara', chance: 12 }] },
        { id: 'gargula', nome: 'Gárgula', descricao: 'Estátua de pedra que ganha vida ao anoitecer.',
          drops: [{ raridade: 'epica', chance: 10 }], dropsArmadura: [{ raridade: 'epica', chance: 5 }] },
      ],
      chefe: { id: 'varnok', nome: 'Varnok, o Lich', descricao: 'O antigo rei de Dravenhold, que trocou a alma pela imortalidade.',
        drops: [{ raridade: 'lendaria', chance: 20 }], dropPadrao: 'epica' },
    },
    {
      id: 'torre', nome: 'Torre Carmesim', nivelMin: 15, chanceChefe: 0.3,
      descricao: 'Uma torre de pedra vermelha que pulsa com magia proibida.',
      base: { hp: 200, ataque: 22, velocidade: 11, exp: 90 }, ouro: [300, 600, 1200],
      monstros: [
        { id: 'golem', nome: 'Golem de Pedra', descricao: 'Guardião construído pelos magos da torre.',
          drops: [{ raridade: 'epica', chance: 5 }], dropsArmadura: [{ raridade: 'rara', chance: 15 }] },
        { id: 'cultista', nome: 'Cultista Sombrio', descricao: 'Entoa rituais para despertar o que dorme no topo.',
          drops: [{ raridade: 'epica', chance: 8 }], dropsArmadura: [{ raridade: 'epica', chance: 4 }] },
        { id: 'espectro', nome: 'Espectro', descricao: 'Alma presa na torre, atravessa paredes e armaduras.',
          drops: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 12 }], dropsArmadura: [{ raridade: 'epica', chance: 6 }] },
      ],
      chefe: { id: 'guardiao', nome: 'O Guardião da Torre', descricao: 'Ninguém sabe o que há sob a armadura. Ninguém voltou para contar.',
        drops: [{ raridade: 'lendaria', chance: 20 }], dropPadrao: 'epica' },
    },
    {
      id: 'areias', nome: 'Areias Rubras', nivelMin: 20, chanceChefe: 0.2,
      descricao: 'Deserto de areia vermelha que engoliu um império inteiro.',
      base: { hp: 320, ataque: 37, velocidade: 12, exp: 270 }, ouro: [800, 1600, 3200],
      monstros: [
        { id: 'escorpiao', nome: 'Escorpião Gigante', descricao: 'Seu ferrão atravessa escudos de aço.',
          drops: [{ raridade: 'epica', chance: 10 }], dropsArmadura: [{ raridade: 'epica', chance: 6 }] },
        { id: 'lagarto', nome: 'Homem-Lagarto', descricao: 'Guerreiro das dunas, rápido e traiçoeiro.',
          drops: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 14 }], dropsArmadura: [{ raridade: 'epica', chance: 8 }] },
        { id: 'mumia', nome: 'Múmia', descricao: 'Sacerdote do império perdido, envolto em faixas amaldiçoadas.',
          drops: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 18 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 10 }] },
      ],
      chefe: { id: 'farao', nome: 'O Faraó Sem Nome', descricao: 'Seu nome foi apagado da história. Sua vingança não.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
    {
      id: 'vale', nome: 'Vale dos Dragões', nivelMin: 25, chanceChefe: 0.15,
      descricao: 'Desfiladeiros de rocha negra onde os dragões fazem seus ninhos.',
      base: { hp: 420, ataque: 48, velocidade: 13, exp: 800 }, ouro: [2000, 4000, 8000],
      monstros: [
        { id: 'drake', nome: 'Drake', descricao: 'Dragão jovem, sem asas, mas com garras de ferro.',
          drops: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 15 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 10 }] },
        { id: 'wyvern', nome: 'Wyvern', descricao: 'Ataca dos céus com cauda venenosa.',
          drops: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 18 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 12 }] },
        { id: 'cavaleiroDraconico', nome: 'Cavaleiro Dracônico', descricao: 'Guerreiro que bebeu sangue de dragão e virou parte deles.',
          drops: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 20 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 15 }] },
      ],
      chefe: { id: 'vharkesh', nome: "Vhar'kesh, o Dragão Ancião", descricao: 'O mais velho dos dragões. Viu reinos nascerem e caírem.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
    {
      id: 'cume', nome: 'Cume do Fogo Eterno', nivelMin: 30, chanceChefe: 0.1,
      descricao: 'O topo do vulcão, onde a lava nunca esfria.',
      base: { hp: 550, ataque: 60, velocidade: 14, exp: 2400 }, ouro: [5000, 10000, 20000],
      monstros: [
        { id: 'salamandra', nome: 'Salamandra', descricao: 'Nada na lava como um peixe na água.',
          drops: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 20 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 15 }] },
        { id: 'demonio', nome: 'Demônio de Lava', descricao: 'Nascido do fogo, deixa um rastro de brasas.',
          drops: [{ raridade: 'lendaria', chance: 7 }, { raridade: 'epica', chance: 22 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 18 }] },
        { id: 'elemental', nome: 'Elemental de Fogo', descricao: 'Chama viva, quente o bastante para derreter aço.',
          drops: [{ raridade: 'lendaria', chance: 10 }, { raridade: 'epica', chance: 25 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 7 }, { raridade: 'epica', chance: 20 }] },
      ],
      chefe: { id: 'ignaroth', nome: 'Ignaroth, Senhor das Chamas', descricao: 'O fogo obedece a ele. O mundo inteiro teme o dia em que ele acordar.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
  ],

  // Crescimento de ataque e velocidade de um monstro para o próximo (dobrar tudo deixava
  // o 3º monstro e o chefe impossíveis: 4x o ataque com 4x a velocidade = 16x o dano).
  crescimento: { ataque: 1.5, velocidade: 1.25 },

  // Chefe em relação ao 3º monstro da área.
  chefe: { vida: 3, ataque: 1.5, exp: 5, ouro: 5, pergaminhos: [1, 3] },

  // Preenchido abaixo a partir das áreas.
  monstros: {},
};

// Monta os monstros e chefes a partir das áreas (regra do dobro dentro de cada área).
(function (D) {
  function arquivo(nome) {
    return 'assets/monstros/' + nome.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f']/g, '')
      .toLowerCase().replace(/^o /, '').trim().replace(/\s+/g, '-') + '.jpg';
  }
  D.areas.forEach(function (area) {
    var b = area.base, c0 = area.crescimento || D.crescimento;
    area.monstros.forEach(function (m, i) {
      var f = Math.pow(2, i);
      var ataque = Math.round(b.ataque * Math.pow(c0.ataque, i));
      D.monstros[m.id] = {
        nome: m.nome, descricao: m.descricao, area: area.id,
        hp: b.hp * f, ataque: [ataque, ataque], velocidade: Math.round(b.velocidade * Math.pow(c0.velocidade, i)),
        defesa: 0, defesaMagica: 0, exp: b.exp * f, ouro: area.ouro[i],
        drops: m.drops, dropsArmadura: m.dropsArmadura,
        chancePergaminho: i === 2 ? 5 : 0,
        imagem: arquivo(m.nome),
      };
    });
    var m2 = D.monstros[area.monstros[1].id], m3 = D.monstros[area.monstros[2].id], c = area.chefe;
    D.monstros[c.id] = {
      nome: c.nome, descricao: c.descricao, area: area.id, chefe: true,
      hp: m3.hp * D.chefe.vida, ataque: [Math.round(m3.ataque[0] * D.chefe.ataque), Math.round(m3.ataque[1] * D.chefe.ataque)],
      velocidade: m2.velocidade, defesa: 0, defesaMagica: 0,
      exp: m3.exp * D.chefe.exp, ouro: m3.ouro * D.chefe.ouro,
      drops: [], dropsArmadura: [], dropsChefe: c.drops, dropPadrao: c.dropPadrao,
      imagem: arquivo(c.nome),
    };
  });
})(Tanka.dados);
