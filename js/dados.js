// Tanka — dados do jogo (raças, classes, monstros, armas e constantes de balanceamento).
// Tudo que é número de balanceamento mora aqui para ser ajustado sem mexer na lógica.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dados = {
  NOME_JOGO: 'Tanka',
  DOMINIO: 'tankaarena.com',

  // Progressão
  HP_INICIAL: 100,        // HP no level 1
  HP_POR_NIVEL: 10,       // HP extra a cada level
  HP_POR_RES: 5,          // HP extra por ponto de Resistência distribuído
  PONTOS_POR_NIVEL: 3,    // pontos de atributo ganhos a cada level
  EXP_BASE: 10,           // exp para sair do level 1; dobra a cada level
  MAX_PERSONAGENS: 3,
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
  // drops: chance em % (cumulativa, rolada uma vez), multiplicada pelo bônus de Sorte.
  monstros: {
    lobo: {
      nome: 'Lobo Selvagem',
      descricao: 'Caça em matilha nas florestas enevoadas.',
      hp: 20, ataque: [1, 1], velocidade: 8, defesa: 0, defesaMagica: 0,
      exp: 2,
      ouro: 2,
      drops: [],
      imagem: 'assets/monstros/lobo-selvagem.jpg',
    },
    cobra: {
      nome: 'Cobra Viscosa',
      descricao: 'Desliza pelos pântanos deixando um rastro de gosma venenosa.',
      hp: 40, ataque: [2, 2], velocidade: 16, defesa: 0, defesaMagica: 0,
      exp: 4,
      ouro: 5,
      drops: [{ raridade: 'rara', chance: 10 }],
      imagem: 'assets/monstros/cobra-viscosa.jpg',
    },
    urso: {
      nome: 'Urso Raivoso',
      descricao: 'Senhor das cavernas. Sua fúria derruba árvores.',
      hp: 80, ataque: [4, 4], velocidade: 32, defesa: 0, defesaMagica: 0,
      exp: 8,
      ouro: 20,
      drops: [{ raridade: 'epica', chance: 10 }, { raridade: 'rara', chance: 30 }],
      chancePergaminho: 5,
      imagem: 'assets/monstros/urso-raivoso.jpg',
    },
  },
};
