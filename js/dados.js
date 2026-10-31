// Tanka — dados do jogo (raças, classes, monstros, armas e constantes de balanceamento).
// Tudo que é número de balanceamento mora aqui para ser ajustado sem mexer na lógica.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dados = {
  NOME_JOGO: 'Eldrin',
  SUBTITULO: 'RPG Narrado · Arena & Glória',
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
    des: { nome: 'Destreza', sigla: 'DES', efeito: 'Chance de magia crítica, evasão, precisão' },
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

  // venda: ouro recebido ao vender | compra: preço no mercado | compraReputacao: reputação pedida na compra
  raridades: {
    // Dano das armas: o mínimo e o máximo são sorteados em cada faixa quando a arma cai
    // (ex.: comum de 1–5 a 5–10, como uma 4–10).
    comum: { nome: 'Comum', danoMin: [1, 5], danoMax: [5, 10], venda: 20, compra: 100 },
    rara: { nome: 'Rara', danoMin: [11, 15], danoMax: [16, 20], venda: 200, compra: 1000 },
    epica: { nome: 'Épica', danoMin: [21, 24], danoMax: [25, 30], venda: 1000, compra: 5000 },
    lendaria: { nome: 'Lendária', danoMin: [31, 34], danoMax: [35, 40], venda: 2000, compra: 10000, compraReputacao: 300 },
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
    precoPergaminho: { comum: 100, rara: 1000, epica: 5000, lendaria: 10000 },
    vendaPorNivel: 0.2,        // +20% do valor de venda por nível
    // Bônus por nível em armaduras e joias
    bonusPorNivel: { elmo: 'defesa', peitoral: 'defesa', luvas: 'defesa', botas: 'defesa', colar: 'defesaMagica', anel: 'sor' },
  },

  sexos: {
    masculino: { nome: 'Homem' },
    feminino: { nome: 'Mulher' },
  },

  // Armas de cada classe: 8 variações por raridade (a variação é sorteada junto com o dano).
  // O drop sempre respeita a classe do personagem. A primeira de cada lista é a "clássica".
  armas: {
    cavaleiro: { tipo: 'Espada',
      comum: ['Espada de Ferro', 'Espada Curta', 'Espada de Bronze', 'Gládio Velho', 'Espada do Recruta', 'Lâmina Cega', 'Espada de Guarda', 'Sabre Enferrujado'],
      rara: ['Espada Rúnica', 'Lâmina de Aço Negro', 'Espada do Capitão', 'Montante de Prata', 'Sabre do Vento', 'Espada Gêmea', 'Lâmina Juramentada', 'Espada da Vigília'],
      epica: ['Lâmina do Crepúsculo', 'Espada Flamejante', 'Lâmina da Tempestade', 'Espada do Juramento Quebrado', 'Montante do Abismo', 'Lâmina Gélida', 'Espada do Eclipse', 'Lâmina Carmesim'],
      lendaria: ['Espada do Rei Eterno', 'Lâmina do Primeiro Sol', 'Espada dos Mil Juramentos', 'Lâmina do Fim dos Tempos', 'Espada do Dragão Ancestral', 'Aurora Eterna', 'Lâmina do Destino', 'Espada da Coroa Perdida'] },
    arqueiro: { tipo: 'Arco',
      comum: ['Arco Curto', 'Arco de Caça', 'Arco de Teixo', 'Arco do Aprendiz', 'Arco de Bétula', 'Arco Simples', 'Arco do Batedor', 'Arco Rústico'],
      rara: ['Arco Élfico', 'Arco Longo de Prata', 'Arco do Falcão', 'Arco Composto', 'Arco da Névoa', 'Arco do Patrulheiro', 'Arco Rúnico', 'Arco do Vento Norte'],
      epica: ['Arco da Lua Sangrenta', 'Arco da Tempestade', 'Arco Espectral', 'Arco do Caçador de Dragões', 'Arco Gélido', 'Arco das Sombras', 'Arco do Relâmpago', 'Arco da Serpente'],
      lendaria: ['Arco do Sol Dourado', 'Arco das Estrelas Cadentes', 'Arco do Primeiro Caçador', 'Arco da Aurora', 'Arco do Céu Partido', 'Arco do Destino', 'Arco da Fênix', 'Arco dos Ventos Eternos'] },
    mago: { tipo: 'Cajado',
      comum: ['Cajado de Carvalho', 'Cajado de Pinho', 'Bastão do Aprendiz', 'Cajado Torto', 'Cajado de Freixo', 'Bastão de Viagem', 'Cajado de Salgueiro', 'Cajado Simples'],
      rara: ['Cajado Arcano', 'Cajado de Cristal', 'Cajado da Névoa', 'Bastão Rúnico', 'Cajado do Eremita', 'Cajado da Chama Azul', 'Cajado de Prata', 'Cajado do Sábio'],
      epica: ['Cajado do Vazio Estelar', 'Cajado da Tempestade', 'Cajado do Necromante', 'Cajado Gélido', 'Cajado do Eclipse', 'Cajado da Serpente', 'Cajado do Abismo', 'Cajado das Almas'],
      lendaria: ['Cajado da Origem', 'Cajado do Primeiro Mago', 'Cajado das Mil Estrelas', 'Cajado do Tempo', 'Cajado da Criação', 'Cajado do Sol Negro', 'Cajado da Eternidade', 'Cajado do Dragão Ancião'] },
    artesao: { tipo: 'Martelo de Batalha',
      comum: ['Martelo de Batalha', 'Martelo de Ferro', 'Marreta do Ferreiro', 'Martelo de Pedra', 'Malho Velho', 'Martelo do Aprendiz', 'Martelo de Bronze', 'Marreta Rústica'],
      rara: ['Martelo Rúnico', 'Martelo de Aço Negro', 'Malho da Forja', 'Martelo do Mestre', 'Martelo de Granito', 'Martelo da Bigorna', 'Martelo do Minerador', 'Martelo de Prata'],
      epica: ['Martelo do Trovão Ancestral', 'Martelo Vulcânico', 'Martelo da Tempestade', 'Martelo do Gigante', 'Martelo Gélido', 'Martelo do Terremoto', 'Martelo Sombrio', 'Martelo da Montanha'],
      lendaria: ['Martelo dos Deuses Forjadores', 'Martelo do Primeiro Ferreiro', 'Martelo do Núcleo do Mundo', 'Martelo da Criação', 'Martelo do Trovão Eterno', 'Martelo do Sol Fundido', 'Martelo das Mil Forjas', 'Martelo do Titã'] },
  },
  // Arma com que todo personagem começa (comum, variação 0).
  ARMA_INICIAL_DANO: [1, 5],

  // Velocidade não vem mais da Destreza: todo personagem começa com 15 e ganha 6% por level
  // (composto: level 10 = 25, level 20 = 45, level 30 = 81, level 40 = 146).
  VELOCIDADE: { inicial: 15, porNivel: 1.06 },

  // ouro: sempre cai (100%) ao derrotar o monstro.
  // Cada monstro tem o dobro dos atributos e da exp do anterior.
  // destreza = velocidade (usada para evasão e precisão do monstro).
  // ---------- Habilidades especiais ----------
  // A barra de Poder (0 a 100) enche durante a luta; cheia, a habilidade pode ser usada.
  // A habilidade evolui nos levels de `niveisHabilidade` (nível 1, 2, 3 e 4).
  // Valores das listas: um por nível da habilidade.
  // Habilidades especiais desligadas por enquanto (true religa barra de Poder, botão e evolução).
  HABILIDADES_ATIVAS: false,

  // Derrota: perde este % da exp do level atual (não desce de level).
  PERDA_EXP_DERROTA: 5,
  PODER: { maximo: 100, porAcerto: 25, porGolpeRecebido: 10 },

  // Vida com o tempo: % da vida máxima por minuto fora da batalha (também com o jogo fechado).
  // Acampado, multiplica pela velocidade do acampamento, mas não pode caçar.
  // Reset diário à meia-noite de Brasília (UTC-3): vida cheia e as poções do dia voltam.
  VIDA: { regenPorMinuto: 2, acampamento: 3, pocoesPorDia: 2, fusoReset: -3 },

  // Exp reduzida quando o level passa do fim da faixa da área (fim = level da próxima área).
  // Ex.: 3 a 7 levels acima: 50%; 8 ou mais: 10%. A última área nunca reduz.
  EXP_REDUZIDA: [{ acima: 8, pct: 10 }, { acima: 3, pct: 50 }],
  niveisHabilidade: [1, 10, 20, 30],
  habilidades: {
    cavaleiro: { nome: 'Golpe de Escudo', descricao: 'Bate com o escudo e deixa o monstro atordoado.',
      multiplicador: [1.5, 2, 2.5, 3], atordoa: [1, 2, 2, 3] },
    arqueiro: { nome: 'Chuva de Flechas', descricao: 'Dispara várias flechas seguidas.',
      flechas: [2, 3, 3, 4], bonusCritico: [10, 20, 30, 40] },
    mago: { nome: 'Bola de Fogo', descricao: 'Uma explosão de fogo arcano.',
      multiplicador: [2.5, 3, 4, 5], poderPorAcerto: 34 },
    artesao: { nome: 'Martelada Sísmica', descricao: 'Um golpe que racha o chão e a armadura do inimigo.',
      multiplicador: [2, 2.5, 3, 4], quebraArmadura: [20, 30, 40, 50], danoArmaduraQuebrada: 1.25 },
  },

  // ---------- Áreas de caça ----------
  // Dentro da área, cada monstro tem o dobro de vida e exp do anterior; o ataque cresce
  // conforme `crescimento` (a Floresta dobra). Velocidade e defesa: ver MONSTRO abaixo.
  // `base` são os valores do 1º monstro; o chefe é calculado a partir do 3º (ver abaixo).
  // drops: armas; dropsArmadura: peças (4 da classe + colar + anel, sorteada);
  // dropsItem: qualquer tipo (arma, 4 armaduras da classe, colar ou anel, sorteado).
  // pergaminho: { chance, raridade } (sem isso, o 3º monstro tem 5% na raridade da arma equipada).
  // Chances em % (cumulativas, roladas uma vez), multiplicadas pelo bônus de Sorte.
  // chanceChefe: % somada à presença do chefe a cada monstro morto na área (escondida do jogador).
  NIVEL_MAXIMO: 40,
  areas: [
    {
      id: 'floresta', nome: 'Floresta Sombria', nivelMin: 1, chanceChefe: 1,
      crescimento: { ataque: 2 },
      descricao: 'Mata densa e enevoada onde todo aventureiro dá os primeiros passos.',
      base: { hp: 20, ataque: 1, exp: 2 }, ouro: [2, 5, 8],
      monstros: [
        { id: 'lobo', dano: [5, 10], nome: 'Lobo Selvagem', descricao: 'Caça em matilha nas florestas enevoadas.',
          drops: [{ raridade: 'comum', chance: 10 }], dropsArmadura: [{ raridade: 'comum', chance: 10 }] },
        { id: 'cobra', dano: [7, 12], nome: 'Cobra Viscosa', descricao: 'Desliza pelos pântanos deixando um rastro de gosma venenosa.',
          drops: [{ raridade: 'comum', chance: 15 }], dropsArmadura: [{ raridade: 'comum', chance: 15 }] },
        { id: 'urso', dano: [10, 15], nome: 'Urso Raivoso', descricao: 'Senhor das cavernas. Sua fúria derruba árvores.',
          dropsItem: [{ raridade: 'comum', chance: 15 }], pergaminho: { chance: 5, raridade: 'comum' } },
      ],
      chefe: { id: 'velgrath', dano: [15, 20], ouro: 20, exp: 40, nome: 'Velgrath, o Ancião Apodrecido', descricao: 'A árvore mais antiga da floresta, corrompida por magia sombria. Suas raízes arrastam os invasores para a terra.',
        dropItem: [{ raridade: 'rara', chance: 15 }], pergaminhos: { raridade: 'comum', qtd: [1, 3] } },
    },
    {
      id: 'pantano', nome: 'Pântano de Brumafria', nivelMin: 5, chanceChefe: 0.7,
      descricao: 'Águas paradas cobertas por uma névoa gelada que nunca se dissipa.',
      base: { hp: 70, ataque: 8, exp: 10 }, ouro: [12, 20, 30],
      monstros: [
        { id: 'sapo', dano: [10, 15], nome: 'Sapo Gigante', descricao: 'Do tamanho de um boi, engole viajantes inteiros.',
          dropsItem: [{ raridade: 'comum', chance: 15 }], pergaminho: { chance: 10, raridade: 'comum' } },
        { id: 'aranha', dano: [15, 20], nome: 'Aranha do Brejo', descricao: 'Tece teias entre as árvores mortas do pântano.',
          dropsItem: [{ raridade: 'comum', chance: 18 }], pergaminho: { chance: 13, raridade: 'comum' } },
        { id: 'troll', dano: [18, 22], nome: 'Troll do Pântano', descricao: 'Coberto de musgo, regenera feridas no lodo.',
          dropsItem: [{ raridade: 'comum', chance: 20 }], pergaminho: { chance: 15, raridade: 'comum' } },
      ],
      chefe: { id: 'morgath', dano: [25, 30], nome: 'Morgath, a Bruxa do Brejo', descricao: 'Senhora da névoa. Fala com os mortos do pântano.',
        dropItem: [{ raridade: 'rara', chance: 20 }], pergaminhos: { raridade: 'rara', qtd: [1, 3] } },
    },
    {
      id: 'ruinas', nome: 'Ruínas de Dravenhold', nivelMin: 10, chanceChefe: 0.5,
      descricao: 'Restos de um reino caído, onde os mortos ainda guardam seus tesouros.',
      base: { hp: 140, ataque: 15, exp: 30 }, ouro: [40, 60, 80],
      monstros: [
        { id: 'esqueleto', dano: [20, 28], nome: 'Esqueleto Guerreiro', descricao: 'Soldado de Dravenhold que nunca deixou o posto.',
          drops: [{ raridade: 'rara', chance: 8 }], dropsArmadura: [{ raridade: 'rara', chance: 8 }] },
        { id: 'goblin', dano: [26, 35], nome: 'Goblin Saqueador', descricao: 'Revira as ruínas atrás de ouro e não divide com ninguém.',
          drops: [{ raridade: 'rara', chance: 10 }], dropsArmadura: [{ raridade: 'rara', chance: 10 }] },
        { id: 'gargula', dano: [31, 42], nome: 'Gárgula', descricao: 'Estátua de pedra que ganha vida ao anoitecer.',
          drops: [{ raridade: 'rara', chance: 15 }], dropsArmadura: [{ raridade: 'rara', chance: 15 }] },
      ],
      chefe: { id: 'varnok', dano: [38, 52], ouro: 200, nome: 'Varnok, o Lich', descricao: 'O antigo rei de Dravenhold, que trocou a alma pela imortalidade.',
        dropItem: [{ raridade: 'rara', chance: 25 }], pergaminhos: { raridade: 'rara', qtd: [2, 5] } },
    },
    {
      id: 'torre', nome: 'Torre Carmesim', nivelMin: 15, chanceChefe: 0.3,
      descricao: 'Uma torre de pedra vermelha que pulsa com magia proibida.',
      base: { hp: 200, ataque: 22, exp: 90 }, ouro: [100, 150, 200],
      monstros: [
        { id: 'golem', dano: [30, 40], nome: 'Golem de Pedra', descricao: 'Guardião construído pelos magos da torre.',
          drops: [{ raridade: 'epica', chance: 5 }], dropsArmadura: [{ raridade: 'rara', chance: 15 }] },
        { id: 'cultista', dano: [38, 52], nome: 'Cultista Sombrio', descricao: 'Entoa rituais para despertar o que dorme no topo.',
          drops: [{ raridade: 'epica', chance: 8 }], dropsArmadura: [{ raridade: 'epica', chance: 4 }] },
        { id: 'espectro', dano: [46, 63], nome: 'Espectro', descricao: 'Alma presa na torre, atravessa paredes e armaduras.',
          drops: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 12 }], dropsArmadura: [{ raridade: 'epica', chance: 6 }] },
      ],
      chefe: { id: 'guardiao', dano: [56, 75], nome: 'O Guardião da Torre', descricao: 'Ninguém sabe o que há sob a armadura. Ninguém voltou para contar.',
        drops: [{ raridade: 'lendaria', chance: 20 }], dropPadrao: 'epica' },
    },
    {
      id: 'areias', nome: 'Areias Rubras', nivelMin: 20, chanceChefe: 0.2,
      descricao: 'Deserto de areia vermelha que engoliu um império inteiro.',
      base: { hp: 320, ataque: 32, exp: 270 }, ouro: [800, 1600, 3200],
      monstros: [
        { id: 'escorpiao', dano: [44, 59], nome: 'Escorpião Gigante', descricao: 'Seu ferrão atravessa escudos de aço.',
          drops: [{ raridade: 'epica', chance: 10 }], dropsArmadura: [{ raridade: 'epica', chance: 6 }] },
        { id: 'lagarto', dano: [54, 74], nome: 'Homem-Lagarto', descricao: 'Guerreiro das dunas, rápido e traiçoeiro.',
          drops: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 14 }], dropsArmadura: [{ raridade: 'epica', chance: 8 }] },
        { id: 'mumia', dano: [68, 92], nome: 'Múmia', descricao: 'Sacerdote do império perdido, envolto em faixas amaldiçoadas.',
          drops: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 18 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 10 }] },
      ],
      chefe: { id: 'farao', dano: [82, 110], nome: 'O Faraó Sem Nome', descricao: 'Seu nome foi apagado da história. Sua vingança não.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
    {
      id: 'vale', nome: 'Vale dos Dragões', nivelMin: 25, chanceChefe: 0.15,
      descricao: 'Desfiladeiros de rocha negra onde os dragões fazem seus ninhos.',
      base: { hp: 420, ataque: 40, exp: 800 }, ouro: [2000, 4000, 8000],
      monstros: [
        { id: 'drake', dano: [54, 74], nome: 'Drake', descricao: 'Dragão jovem, sem asas, mas com garras de ferro.',
          drops: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 15 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 1 }, { raridade: 'epica', chance: 10 }] },
        { id: 'wyvern', dano: [68, 92], nome: 'Wyvern', descricao: 'Ataca dos céus com cauda venenosa.',
          drops: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 18 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 12 }] },
        { id: 'cavaleiroDraconico', dano: [86, 116], nome: 'Cavaleiro Dracônico', descricao: 'Guerreiro que bebeu sangue de dragão e virou parte deles.',
          drops: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 20 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 15 }] },
      ],
      chefe: { id: 'vharkesh', dano: [103, 140], nome: "Vhar'kesh, o Dragão Ancião", descricao: 'O mais velho dos dragões. Viu reinos nascerem e caírem.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
    {
      id: 'cume', nome: 'Cume do Fogo Eterno', nivelMin: 30, chanceChefe: 0.1,
      descricao: 'O topo do vulcão, onde a lava nunca esfria.',
      base: { hp: 550, ataque: 60, exp: 2400 }, ouro: [5000, 10000, 20000],
      monstros: [
        { id: 'salamandra', dano: [82, 110], nome: 'Salamandra', descricao: 'Nada na lava como um peixe na água.',
          drops: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 20 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 3 }, { raridade: 'epica', chance: 15 }] },
        { id: 'demonio', dano: [102, 138], nome: 'Demônio de Lava', descricao: 'Nascido do fogo, deixa um rastro de brasas.',
          drops: [{ raridade: 'lendaria', chance: 7 }, { raridade: 'epica', chance: 22 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 5 }, { raridade: 'epica', chance: 18 }] },
        { id: 'elemental', dano: [128, 173], nome: 'Elemental de Fogo', descricao: 'Chama viva, quente o bastante para derreter aço.',
          drops: [{ raridade: 'lendaria', chance: 10 }, { raridade: 'epica', chance: 25 }],
          dropsArmadura: [{ raridade: 'lendaria', chance: 7 }, { raridade: 'epica', chance: 20 }] },
      ],
      chefe: { id: 'ignaroth', dano: [154, 208], nome: 'Ignaroth, Senhor das Chamas', descricao: 'O fogo obedece a ele. O mundo inteiro teme o dia em que ele acordar.',
        drops: [{ raridade: 'lendaria', chance: 40 }], dropPadrao: 'epica' },
    },
  ],

  // Crescimento de ataque de um monstro para o próximo dentro da área (+25%; +50% deixava
  // o 3º monstro e os chefes das áreas altas impossíveis nas simulações).
  crescimento: { ataque: 1.25 },

  // Velocidade e defesa seguem uma escada única por todas as áreas:
  // o 1º monstro da Floresta tem 15 de velocidade e 1 de defesa; cada monstro seguinte +10% de
  // velocidade e +25% de defesa; o 1º monstro da área seguinte tem 10% a mais que o 3º da anterior.
  // A defesa do monstro reduz o dano em porcentagem: dano x 100 / (100 + defesa)
  // (40 de defesa = -29% de dano). Nunca deixa o monstro imortal.
  MONSTRO: { velocidade: 15, defesa: 1, velocidadePorMonstro: 1.1, defesaPorMonstro: 1.25, entreAreas: 1.1 },

  // Chefe em relação ao 3º monstro da área: +50% de vida e velocidade, +20% de ataque, dobro da defesa,
  // e 5x a exp e o ouro (para valer o risco).
  chefe: { vida: 1.5, ataque: 1.2, velocidade: 1.5, defesa: 2, exp: 5, ouro: 5, pergaminhos: [1, 3] },

  // ---------- Masmorras (grupo de 3) ----------
  // Única fonte de colar e anel. Vida própria (não mexe na vida de fora), sem poções e sem
  // habilidades. Batalha automática com semente do servidor (todos calculam a mesma luta).
  // Salas: 1) os 3 monstros da área; 2) 2x o 3º monstro + Elite; 3) Chefe da Masmorra.
  // forca: multiplica vida e ataque de todos os monstros da masmorra (calibrado por simulação:
  // grupo no level mínimo, itens da raridade da área +3, vence cerca de 2 em 3 vezes).
  // As raridades da joia também estão em supabase/schema.sql (função sortear_raridade_joia).
  MASMORRA: { entradasPorDia: 2, tamanhoGrupo: 3, elite: { vida: 2, ataque: 1.25 }, chefe: { vida: 3, ataque: 1.25 } },
  masmorras: [
    { id: 'toca', nome: 'Toca dos Lobos Sombrios', nivelMin: 5, area: 'floresta', elite: 'Urso Garra-Negra', chefe: 'Velgrath, Raiz do Medo',
      forca: { vida: 4, ataque: 4 },
      joias: [{ raridade: 'rara', chance: 20 }, { raridade: 'comum', chance: 80 }] },
    { id: 'ninho', nome: 'Ninho da Bruxa', nivelMin: 10, area: 'pantano', elite: 'Troll Ancião do Lodo', chefe: 'Morgath, Mãe da Névoa',
      forca: { vida: 3, ataque: 1.15 },
      joias: [{ raridade: 'epica', chance: 5 }, { raridade: 'rara', chance: 45 }, { raridade: 'comum', chance: 50 }] },
    { id: 'catacumbas', nome: 'Catacumbas de Dravenhold', nivelMin: 15, area: 'ruinas', elite: 'Gárgula Sentinela', chefe: 'Varnok, o Rei Sem Alma',
      forca: { vida: 1.25, ataque: 1.15 },
      joias: [{ raridade: 'epica', chance: 20 }, { raridade: 'rara', chance: 80 }] },
    { id: 'biblioteca', nome: 'Biblioteca Proibida', nivelMin: 20, area: 'torre', elite: 'Espectro Bibliotecário', chefe: 'O Guardião Desperto',
      forca: { vida: 1.5, ataque: 0.7 },
      joias: [{ raridade: 'lendaria', chance: 2 }, { raridade: 'epica', chance: 48 }, { raridade: 'rara', chance: 50 }] },
    { id: 'tumba', nome: 'Tumba do Faraó', nivelMin: 25, area: 'areias', elite: 'Múmia Real', chefe: 'O Faraó Renascido',
      forca: { vida: 1.5, ataque: 0.6 },
      joias: [{ raridade: 'lendaria', chance: 10 }, { raridade: 'epica', chance: 90 }] },
    { id: 'covil', nome: "Covil de Vhar'kesh", nivelMin: 30, area: 'vale', elite: 'Cavaleiro Dracônico Ancestral', chefe: "Vhar'kesh em Fúria",
      forca: { vida: 0.6, ataque: 0.6 },
      joias: [{ raridade: 'lendaria', chance: 20 }, { raridade: 'epica', chance: 80 }] },
    { id: 'coracao', nome: 'Coração do Vulcão', nivelMin: 35, area: 'cume', elite: 'Elemental Primordial', chefe: 'Ignaroth Desacorrentado',
      forca: { vida: 1, ataque: 0.5 },
      joias: [{ raridade: 'lendaria', chance: 35 }, { raridade: 'epica', chance: 65 }] },
  ],

  // ---------- Arena (PvP) ----------
  // A luta roda no servidor (supabase/schema.sql). Estes valores vão para o banco pela
  // ferramenta ferramentas/gerar_dados_sql.js: depois de mudar aqui, rode a ferramenta e o schema.
  // dado: multiplicador de dano de cada face do D20 (índice 0 = face 1). 1 erra; 18 a 20 são críticos.
  ARENA: {
    nivelMin: 5, entradasMax: 5, recargaMinutos: 60, alcanceDesafio: 5, tempoDado: 5, limiteTurnos: 200,
    reputacaoVitoria: 10, reputacaoTop1Diario: 500, jackpotPorDefesa: 100, top1PorHora: 0.1,
    dado: [0, 0.6, 0.7, 0.8, 0.9, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.7, 1.8, 2],
    // Saque do ouro do oponente pela vida que o vencedor perdeu: até 30% -> 5%; 80% ou mais -> 10%; entre -> 5 a 8%.
    saque: { ate: 30, minimo: 5, desde: 80, maximo: 10, meio: [5, 8] },
    arenas: [
      { id: 'a1', nome: 'Arena 5~10', nivel: [5, 10], jackpotPor10min: 50 },
      { id: 'a2', nome: 'Arena 11~20', nivel: [11, 20], jackpotPor10min: 100 },
      { id: 'a3', nome: 'Arena 21~30', nivel: [21, 30], jackpotPor10min: 150 },
      { id: 'a4', nome: 'Arena 30+', nivel: [31, 40], jackpotPor10min: 200 },
    ],
  },

  // Skins do D20 da Arena, vendidas no Mercado por ouro. O vermelho vem com todo personagem.
  // As cores de cada skin ficam em css/estilo.css (.d20g.skin-<id>).
  // Caçada contínua: tempo de busca (cai com a Velocidade), peso extra dos monstros mais fortes pela Sorte,
  // vida mínima para caçar (% da vida máxima), segundos para responder ao encontro e opções de poção automática.
  CACADA: { buscaBase: 3000, velocidadeBase: 15, buscaMin: 800, buscaMax: 3000, sortePorPeso: 50, vidaMinima: 5,
    contagem: 3, pocaoAuto: [10, 5], historico: 10 },

  // Missões diárias (renovam às 00:00 de Brasília) e semanais (renovam na segunda às 00:00).
  // evento: o que conta progresso | prêmio: ouroPorNivel (x level), reputacao, pergaminhoArma (da raridade da arma equipada).
  MISSOES: {
    diarias: [
      { id: 'd-cacar', nome: 'Caçador do dia', texto: 'Derrote 15 monstros nas caçadas', evento: 'abate', meta: 15, premio: { ouroPorNivel: 30 } },
      { id: 'd-encantar', nome: 'Martelo quente', texto: 'Tente encantar 3 vezes', evento: 'encantar', meta: 3, premio: { pergaminhoArma: 1 } },
      { id: 'd-arena', nome: 'Sangue na areia', texto: 'Lute 2 vezes na Arena', evento: 'arena', meta: 2, premio: { reputacao: 20 } },
      { id: 'd-masmorra', nome: 'Desbravador', texto: 'Vença 1 masmorra em grupo', evento: 'masmorra', meta: 1, premio: { ouroPorNivel: 50 } },
    ],
    bonusDiario: { pergaminhoArma: 1, reputacao: 20 },   // completar e resgatar todas as diárias
    semanais: [
      { id: 's-cacar', nome: 'Terror das matas', texto: 'Derrote 150 monstros nas caçadas', evento: 'abate', meta: 150, premio: { ouroPorNivel: 300 } },
      { id: 's-chefe', nome: 'Matador de lendas', texto: 'Derrote 2 chefes de área', evento: 'chefe', meta: 2, premio: { pergaminhoArma: 3 } },
      { id: 's-arena', nome: 'Campeão da Arena', texto: 'Vença 10 lutas na Arena', evento: 'arenaVitoria', meta: 10, premio: { reputacao: 100 } },
      { id: 's-masmorra', nome: 'Senhor das masmorras', texto: 'Vença 5 masmorras em grupo', evento: 'masmorra', meta: 5, premio: { ouroPorNivel: 400 } },
      { id: 's-encantar', nome: 'Mestre da forja', texto: 'Consiga 5 encantamentos com sucesso', evento: 'encantoSucesso', meta: 5, premio: { reputacao: 50 } },
    ],
  },

  // Alianças: criar, cargos, tesouro, level e bônus (o servidor usa estes números; ver supabase/schema.sql).
  ALIANCA: {
    nivelMin: 10, custoOuro: 10000, custoReputacao: 300,
    vagasIniciais: 15, vagasPorNivel: 3, maxOficiais: 3, nivelMax: 10,
    expProximo: [50000, 100000, 200000, 400000, 700000, 1000000, 1500000, 2000000, 3000000],   // Lv1->2 ... Lv9->10
    doacaoMinima: 100, esperaHoras: 24, liderSumidoDias: 14, ativoDias: 3, muralMax: 300,
    bonus: { custo: 20000, dias: 7, minimo: 5, maximo: 15 },   // % = 5 no Lv1 até 15 no Lv10
    brasao: {
      formas: ['classico', 'redondo', 'pontudo', 'estandarte'],
      cores: ['#8e1b1b', '#1f4f8e', '#2d6b34', '#5b2a86', '#b8860b', '#2b2b2b', '#7a3e12', '#1f6b6b'],
      simbolos: ['dragao', 'lobo', 'coroa', 'caveira', 'espada', 'machado', 'olho', 'chama'],
    },
  },

  // Pergaminho do Recomeço: devolve todos os pontos de atributo para distribuir de novo.
  RECOMECO: { nome: 'Pergaminho do Recomeço', precoReputacao: 500 },

  SKINS_DADO: [
    { id: 'vermelho', nome: 'Rubi', preco: 0 },
    { id: 'azul', nome: 'Safira', preco: 500 },
    { id: 'dourada', nome: 'Ouro Real', preco: 1500 },
    { id: 'obsidiana', nome: 'Obsidiana', preco: 3000 },
    { id: 'dragao', nome: 'Dragão Cinzento', preco: 5000 },
  ],

  // Preenchido abaixo a partir das áreas.
  monstros: {},
};

// Monta os monstros e chefes a partir das áreas (regra do dobro dentro de cada área).
(function (D) {
  function arquivo(nome) {
    return 'assets/monstros/' + nome.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f']/g, '')
      .toLowerCase().replace(/^o /, '').trim().replace(/\s+/g, '-') + '.jpg';
  }
  var M = D.MONSTRO, vel = M.velocidade, def = M.defesa;
  D.areas.forEach(function (area, indiceArea) {
    var b = area.base, c0 = area.crescimento || D.crescimento;
    if (indiceArea > 0) { vel *= M.entreAreas; def *= M.entreAreas; }
    area.monstros.forEach(function (m, i) {
      if (i > 0) { vel *= M.velocidadePorMonstro; def *= M.defesaPorMonstro; }
      var f = Math.pow(2, i);
      var ataque = Math.round(b.ataque * Math.pow(c0.ataque, i));
      D.monstros[m.id] = {
        nome: m.nome, descricao: m.descricao, area: area.id, indiceArea: indiceArea,
        hp: b.hp * f, ataque: m.dano ? m.dano.slice() : [ataque, ataque], velocidade: Math.round(vel),
        defesa: Math.max(1, Math.round(def)), defesaMagica: Math.max(1, Math.round(def)), exp: b.exp * f, ouro: area.ouro[i],
        drops: m.drops || [], dropsArmadura: m.dropsArmadura || [], dropsItem: m.dropsItem || [],
        // pergaminho: { chance, raridade } (raridade null = da arma equipada)
        pergaminho: m.pergaminho || (i === 2 ? { chance: 5, raridade: null } : null),
        imagem: arquivo(m.nome),
      };
    });
    var m3 = D.monstros[area.monstros[2].id], c = area.chefe, C = D.chefe;
    D.monstros[c.id] = {
      nome: c.nome, descricao: c.descricao, area: area.id, indiceArea: indiceArea, chefe: true,
      hp: Math.round(m3.hp * C.vida), ataque: c.dano ? c.dano.slice() : [Math.round(m3.ataque[0] * C.ataque), Math.round(m3.ataque[1] * C.ataque)],
      velocidade: Math.round(vel * C.velocidade), defesa: Math.round(m3.defesa * C.defesa), defesaMagica: Math.round(m3.defesa * C.defesa),
      // `ouro` e `exp` no chefe da área substituem a conta (5x o 3º monstro).
      exp: c.exp != null ? c.exp : m3.exp * C.exp, ouro: c.ouro != null ? c.ouro : m3.ouro * C.ouro,
      drops: [], dropsArmadura: [], dropsItem: [],
      // Chefe com `dropItem`: chance de 1 item de qualquer tipo + pergaminhos fixos.
      // Sem `dropItem`: sempre dropa 1 arma ou armadura pela tabela `drops`.
      dropItem: c.dropItem || null, pergaminhosChefe: c.pergaminhos || null,
      dropsChefe: c.drops || [], dropPadrao: c.dropPadrao,
      imagem: arquivo(c.nome),
    };
  });
})(Tanka.dados);
