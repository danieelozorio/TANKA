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
      imagem: 'assets/racas/humano.jpg',
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfo: {
      nome: 'Elfo',
      descricao: 'Ágeis e sábios, porém de corpo frágil.',
      elevados: ['des', 'int'], reduzidos: ['res', 'for'],
      imagem: 'assets/racas/elfo.jpg',
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfoNegro: {
      nome: 'Elfo Negro',
      descricao: 'Fortes e astutos, mas pouco resistentes e de sorte amaldiçoada.',
      elevados: ['for', 'int'], reduzidos: ['res', 'sor'],
      imagem: 'assets/racas/elfo-negro.jpg',
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    orc: {
      nome: 'Orc',
      descricao: 'Brutos e duros como rocha, mas lentos de corpo e mente.',
      elevados: ['for', 'res'], reduzidos: ['des', 'int'],
      imagem: null,
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    anao: {
      nome: 'Anão',
      descricao: 'Robustos e sortudos, mestres das minas, pouco ágeis.',
      elevados: ['res', 'sor'], reduzidos: ['des', 'int'],
      imagem: null,
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
  },

  raridades: {
    basica: { nome: 'Básica', dano: [1, 1] },
    rara: { nome: 'Rara', dano: [3, 5] },
    epica: { nome: 'Épica', dano: [6, 10] },
  },

  // Arma de cada classe por raridade. O drop sempre respeita a classe do personagem.
  armas: {
    cavaleiro: { tipo: 'Espada', basica: 'Espada de Ferro', rara: 'Espada Rúnica', epica: 'Lâmina do Crepúsculo' },
    arqueiro: { tipo: 'Arco', basica: 'Arco Curto', rara: 'Arco Élfico', epica: 'Arco da Lua Sangrenta' },
    mago: { tipo: 'Cajado', basica: 'Cajado de Carvalho', rara: 'Cajado Arcano', epica: 'Cajado do Vazio Estelar' },
    artesao: { tipo: 'Martelo de Batalha', basica: 'Martelo de Batalha', rara: 'Martelo Rúnico', epica: 'Martelo do Trovão Ancestral' },
  },

  // Cada monstro tem o dobro dos atributos e da exp do anterior.
  // destreza = velocidade (usada para evasão e precisão do monstro).
  // drops: chance em % (cumulativa, rolada uma vez), multiplicada pelo bônus de Sorte.
  monstros: {
    lobo: {
      nome: 'Lobo Selvagem',
      descricao: 'Caça em matilha nas florestas enevoadas.',
      hp: 20, ataque: [1, 1], velocidade: 8, defesa: 0, defesaMagica: 0,
      exp: 2,
      drops: [],
      imagem: 'assets/monstros/lobo-selvagem.jpg',
    },
    cobra: {
      nome: 'Cobra Viscosa',
      descricao: 'Desliza pelos pântanos deixando um rastro de gosma venenosa.',
      hp: 40, ataque: [2, 2], velocidade: 16, defesa: 0, defesaMagica: 0,
      exp: 4,
      drops: [{ raridade: 'rara', chance: 10 }],
      imagem: null,
    },
    urso: {
      nome: 'Urso Raivoso',
      descricao: 'Senhor das cavernas. Sua fúria derruba árvores.',
      hp: 80, ataque: [4, 4], velocidade: 32, defesa: 0, defesaMagica: 0,
      exp: 8,
      drops: [{ raridade: 'epica', chance: 10 }, { raridade: 'rara', chance: 30 }],
      imagem: null,
    },
  },
};
