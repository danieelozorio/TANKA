// Tanka — dados do jogo (raças, classes, monstros, armas e constantes de balanceamento).
// Tudo que é número de balanceamento mora aqui para ser ajustado sem mexer na lógica.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dados = {
  NOME_JOGO: 'Eldrin',
  SUBTITULO: 'RPG Narrado · Arena & Glória',
  DOMINIO: 'Eldrinonline.com.br',

  // Contas com a aba Admin (ferramentas de teste). Use o nome de usuário em minúsculas.
  // Atenção: enquanto as contas ficam no navegador, isso não é segurança de verdade;
  // com o servidor, o servidor é quem deve decidir quem é admin.
  ADMINS: ['admin'],

  // Progressão
  HP_INICIAL: 100,        // HP no level 1
  HP_POR_NIVEL: 10,       // HP extra a cada level
  HP_POR_RES: 3,          // HP extra por ponto de Resistência acima de RES_SEM_VIDA (inclusive os da classe, nov/2026)
  RES_SEM_VIDA: 10,       // a vida da RES conta a partir daqui (RES 20 = +30 de vida)
  PONTOS_POR_DANO: 3,     // a cada 3 pontos do atributo de dano da classe (FOR, DES ou INT): +1 de dano
  PONTOS_POR_NIVEL: 3,    // pontos de atributo ganhos a cada level
  EXP_BASE: 10,           // exp para sair do level 1; dobra a cada level até o 5
  EXP_CRESCIMENTO: 1.5,   // do level 6 ao 19, cada level pede 50% a mais que o anterior
  // Henri (nov/2026): depois do 19 a curva cresce menos, para cada level pedir mais ou menos os mesmos monstros
  // (a exp dos monstros triplica a cada área de 5 levels): +30% por level do 20 ao 29 e +12% do 30 em diante.
  EXP_FAIXAS: [{ ate: 19, crescimento: 1.5 }, { ate: 29, crescimento: 1.3 }, { ate: 99, crescimento: 1.12 }],
  MAX_PERSONAGENS: 3,
  MOCHILA_MAX: 32,        // espaços da mochila (itens não equipados)
  // Consumíveis (aba Consumíveis da mochila): itens empilhados { id, tipo, raridade, qtd } em p.consumiveis,
  // separados dos equipáveis e sem limite de espaço. Arte: assets/itens/<tipo>-<raridade>.webp.
  CONSUMIVEIS: {
    pergaminho: { nome: 'Pergaminho de Encantamento',
      descricao: 'Gasta 1 em cada tentativa de encantar um item da mesma raridade (aba Encantar). 10 trocam por 1 da raridade seguinte no Mercado.' },
    cristal: { nome: 'Cristal',
      descricao: 'Sobra de um item que quebrou na Forja, da mesma raridade dele. Ingrediente do Pergaminho de Proteção (Oficina).' },
    protecao: { nome: 'Pergaminho de Proteção',
      descricao: 'Usado junto com o encanto de um item da mesma raridade: se falhar, o item não quebra nem volta a +0. Só o Coletor fabrica.' },
    // (raridade = id do material em CRAFT.materiais / id da região em D.areas)
    material: { nome: 'Material', descricao: 'Material de craft. Usado pelo Coletor nas receitas e proteções e pelo Ferreiro na forja.' },
    receita: { nome: 'Receita', descricao: 'Fabricada pelo Coletor. Com ela e os materiais da região, o Ferreiro forja uma arma ou armadura.' },
  },
  // ---------- Craft dos Anões (Daniel, nov/2026; etapas 1 a 3 do PDF "Os Anões: Mestres da Forja") ----------
  // Materiais: cada região tem o seu (caem dos monstros: % pela posição do monstro) e cada chefe um raro (dropChefe %).
  // Coletor (segunda classe) acha `coletorBonus`% a mais. Minas: qualquer herói manda minerar na região que escolher
  // (qualquer uma já liberada pelo level) e volta com o material dela e às vezes Pedra Preciosa. Coletor fabrica Receitas (uma por região) e
  // Pergaminhos de Proteção; o Ferreiro forja arma/armadura de qualquer classe com uma Receita + materiais.
  CRAFT: {
    materiais: {
      ferro: { nome: 'Minério de Ferro', area: 'floresta' }, nevoa: { nome: 'Essência de Névoa', area: 'pantano' },
      osso: { nome: 'Osso Rúnico', area: 'ruinas' }, carmesim: { nome: 'Cristal Carmesim', area: 'torre' },
      areia: { nome: 'Areia Rubra', area: 'areias' }, couro: { nome: 'Couro de Drake', area: 'vale' },
      brasa: { nome: 'Brasa Vulcânica', area: 'cume' },
      seiva: { nome: 'Seiva Ancestral', chefe: 'velgrath' }, lagrima: { nome: 'Lágrima da Bruxa', chefe: 'morgath' },
      po: { nome: 'Pó de Lich', chefe: 'varnok' }, nucleo: { nome: 'Núcleo Arcano', chefe: 'guardiao' },
      ouroMaldito: { nome: 'Ouro Amaldiçoado', chefe: 'farao' }, escama: { nome: 'Escama de Dragão', chefe: 'vharkesh' },
      brasaIgnaroth: { nome: 'Brasa do Ignaroth', chefe: 'ignaroth' },
      gema: { nome: 'Pedra Preciosa', minas: true },
      fragmento: { nome: 'Fragmento de Selo', boss: true },   // quem dá mais dano no boss do clã ganha 1 (Relíquia Rúnica)
    },
    dropMaterial: [6, 8, 10],      // % de cair 1 material da região (1º, 2º e 3º monstro); cai mesmo em região abaixo do level
    dropChefe: 15,                 // % de o chefe deixar 1 do material dele (Daniel: antes era sempre)
    coletorBonus: 50,              // Coletor: +50% nessa chance e +50% nas Minas
    // Mineração (Aventura › Mineração, Henri nov/2026): ~4 por hora; as longas rendem um pouco menos por hora.
    // Parar antes do fim: com 50% do tempo ou mais, metade do prêmio; antes disso, nada.
    minas: {
      opcoes: [{ minutos: 30, qtd: [1, 3] }, { minutos: 60, qtd: [3, 5] }, { minutos: 120, qtd: [6, 10] },
        { minutos: 240, qtd: [12, 18] }, { minutos: 480, qtd: [24, 32] }, { minutos: 1440, qtd: [60, 84] }],
      gemaPct: 8,                  // % de cada unidade minerada virar Pedra Preciosa
      metadeDesde: 50,             // % do tempo a partir do qual parar ainda dá metade do prêmio
    },
    // Receita da região (Coletor): materiais da região + ouro. Forja (Ferreiro): 1 receita + materiais + ouro.
    receita: { material: 10, ouro: [500, 1500, 3000, 6000, 12000, 25000, 50000] },   // ouro por região (índice da área)
    forja: { material: 5, ouro: [1000, 3000, 6000, 12000, 25000, 50000, 100000],
      raridade: [{ raridade: 'comum', chance: 60 }, { raridade: 'rara', chance: 35 }, { raridade: 'epica', chance: 5 }],
      // ingredientes extras (até `maxExtra` de cada): material do chefe da região e Pedra Preciosa
      extraChefe: { epica: 3, lendaria: 0.5 }, extraGema: { epica: 2, lendaria: 0.5 }, maxExtra: 3,
      obraPrima: 2, obraPrimaAnao: 1 },   // % de sair uma raridade acima (Anão +1%)
    // Oficinas (etapa 4): cada Artesão abre a sua e vende serviços com preço próprio. O cliente entrega tudo (item,
    // pergaminhos, materiais e o pagamento) e o servidor guarda; a sorte é jogada no servidor com a Sorte e a raça do
    // ARTESÃO. Feito ou não, o artesão recebe o pagamento menos `taxa`%. Sem fazer em `prazoHoras`, tudo volta ao cliente.
    oficina: { taxa: 10, prazoHoras: 24, maxPedidos: 5,
      servicos: {
        encantar: { nome: 'Encantar item', de: 'ferreiro' }, forjar: { nome: 'Forjar arma ou armadura', de: 'ferreiro' },
        reliquia: { nome: 'Relíquia Rúnica', de: 'ferreiro' },
        receita: { nome: 'Fabricar Receita', de: 'coletor' }, protecao: { nome: 'Fabricar Pergaminho de Proteção', de: 'coletor' },
      } },
    // Relíquia Rúnica (etapa 5): só Anão Ferreiro level 30+, 1 tentativa por semana. Item lendário +7 ou mais vira uma
    // relíquia ÚNICA no jogo (nome escolhido pelo cliente, assinatura do anão) com uma runa sorteada (bônus só contra
    // monstros). Chance = base + Sorte x porSorte, até `maxima`. Falhou: os materiais se perdem, o item volta igual.
    // porEncanto: a runa fica mais forte com o encanto do item (+7 = 100%, +8 = 125%, +9 = 150%, +10 = 175%).
    // Depois de virar relíquia, o item não pode mais ser encantado nem forjado de novo (o encanto fica travado).
    reliquia: { nivelMin: 30, encantoMin: 7, base: 10, porSorte: 0.05, maxima: 20, porEncanto: 0.25,
      materiais: { escama: 3, brasaIgnaroth: 2, fragmento: 1 },
      runas: [
        { id: 'furia', nome: 'Runa da Fúria', dano: 6, texto: '+6% de dano' },
        { id: 'colosso', nome: 'Runa do Colosso', vida: 8, texto: '+8% de vida' },
        { id: 'falcao', nome: 'Runa do Falcão', critico: 4, texto: '+4% de chance de crítico' },
        { id: 'tempestade', nome: 'Runa da Tempestade', velocidade: 6, texto: '+6% de velocidade' },
        { id: 'muralha', nome: 'Runa da Muralha', defesa: 10, texto: '+10% de defesa' },
      ] },
    // Pergaminho de Proteção (Coletor): cristais da raridade + materiais.
    protecao: {
      comum: { cristal: 50, materiais: { ferro: 10 } },
      rara: { cristal: 80, materiais: { nevoa: 10, osso: 5 } },
      epica: { cristal: 120, materiais: { areia: 10, ouroMaldito: 3 } },
      lendaria: { cristal: 200, materiais: { escama: 2, brasaIgnaroth: 1 } },
    },
  },
  // Item que quebra na Forja vira cristais da raridade dele. Quantidade pelo + que se tentava (igual para todas as raridades).
  CRISTAIS_QUEBRA: { 7: 100, 8: 150, 9: 200, 10: 500 },
  MODIFICADOR_RACA: 3,    // cada elevação +3, cada redução -3

  atributos: {
    for: { nome: 'Força', sigla: 'FOR', efeito: 'Ataque (Cavaleiro e Artesão), dano crítico' },
    des: { nome: 'Destreza', sigla: 'DES', efeito: 'Ataque (Caçador), chance de crítico, evasão, precisão' },
    res: { nome: 'Resistência', sigla: 'RES', efeito: 'Defesa, defesa mágica, vida' },
    int: { nome: 'Inteligência', sigla: 'INT', efeito: 'Ataque mágico (Mago)' },
    sor: { nome: 'Sorte', sigla: 'SOR', efeito: 'Crítico mágico, dano crítico mágico, craft e encantamento' },
  },

  classes: {
    cavaleiro: {
      nome: 'Cavaleiro', nomeF: 'Cavaleira',
      descricao: 'Força e resistência elevadas. A muralha de aço da linha de frente.',
      atributos: { for: 15, des: 10, res: 20, int: 10, sor: 15 },   // todas as classes com 70 pontos (nov/2026)
      dano: 'fisico', atributoDano: 'for',
    },
    // O id continua 'arqueiro' (personagens salvos); o nome na tela é Caçador.
    arqueiro: {
      nome: 'Caçador', nomeF: 'Caçadora',
      descricao: 'Destreza e sorte elevadas. Arcos, bestas e golpes rápidos e certeiros.',
      atributos: { for: 15, des: 20, res: 10, int: 10, sor: 15 },
      // Henri (nov/2026): o ataque do Caçador (e das segundas classes Arqueiro e Assassino) voltou para a Destreza
      // (ficou na Força de 03/11 a 11/11/2026).
      dano: 'fisico', atributoDano: 'des',
    },
    mago: {
      nome: 'Mago', nomeF: 'Maga',
      descricao: 'Destreza e inteligência elevadas. Domina as artes arcanas.',
      atributos: { for: 10, des: 15, res: 10, int: 20, sor: 15 },
      dano: 'magico', atributoDano: 'int',
    },
    artesao: {
      nome: 'Artesão', nomeF: 'Artesã',
      descricao: 'Força e sorte elevadas. Forja, encanta e esmaga com o martelo.',
      atributos: { for: 15, des: 10, res: 15, int: 10, sor: 20 },
      dano: 'fisico', atributoDano: 'for',
    },
  },

  // Raças (nov/2026): não mudam mais os atributos; cada uma tem traços em % (tracos), aplicados no status e na Arena.
  //   vidaPct / danoPct / velocidadePct: % da vida, do dano e da velocidade · critico: pontos de % de chance de crítico
  //   danoCritico: pontos de % de dano crítico · evasaoPct: % da esquiva (−50 = metade).
  // elevados/reduzidos (+3/−3) ficaram vazios: os atributos vêm só da classe.
  racas: {
    humano: {
      nome: 'Humano', nomeF: 'Humana',
      descricao: 'Versáteis e equilibrados. Podem seguir qualquer caminho.',
      lema: 'A escolha',
      lore: 'Os Humanos guardaram dois dos Sete Selos, porque eram o povo mais numeroso. Nas Areias Rubras, o imperador Amenreth deu o próprio nome para fechar o selo dele. Em Dravenhold, um rei abriu uma fresta no selo por ambição, e o reino virou pó. Kael também é humano. Nenhuma raça é capaz de tanto sacrifício, nem de tanta traição.',
      elevados: [], reduzidos: [], tracos: {},
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfo: {
      nome: 'Elfo', nomeF: 'Elfa',
      descricao: 'Ágeis e certeiros: mais críticos e mais ataques, mas corpo frágil e golpes mais leves.',
      lema: 'A vida',
      lore: 'Os Elfos guardavam o selo da Floresta Sombria. Esconderam-no entre as raízes de Velgrath, a árvore mais antiga do reino, e cantaram parte da própria vida para dentro dela, para que ela despertasse e o protegesse. Quando o Espinho Negro feriu Velgrath, foi como ferir um parente dos Elfos.',
      elevados: [], reduzidos: [], tracos: { critico: 5, velocidadePct: 10, vidaPct: -5, danoPct: -5 },   // Henri, 13/11/2026: vida e dano −5% (eram −10%)
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    elfoNegro: {
      nome: 'Elfo Negro', nomeF: 'Elfa Negra',
      descricao: 'Letais: críticos mais fortes e mais dano, mas pouca vida.',
      lema: 'O sacrifício',
      lore: 'Eram Elfos que se recusaram a só esperar. Entraram na névoa do Pântano de Brumafria para guardar o selo de lá e caçar os cultistas de Ignaroth. A névoa os mudou: a pele escureceu e o coração esfriou. Os outros Elfos os chamaram de traidores, mas foram eles que seguraram o culto por mil anos. Morgath aprendeu a ouvir a névoa com eles e usou isso para o mal, e essa vergonha também é deles.',
      elevados: [], reduzidos: [], tracos: { danoCritico: 10, danoPct: 5, vidaPct: -10 },
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    orc: {
      nome: 'Orc', nomeF: 'Orc',
      descricao: 'Brutos: muita vida e mais dano, mas lentos, com menos críticos e quase sem esquiva.',
      lema: 'A honra',
      lore: 'Os Orcs nasceram ao pé do vulcão e não temem o fogo. Foram os cavaleiros dos dragões: um chefe orc selou o pacto com Vhar\'kesh, e juntos guardaram o selo do Vale dos Dragões. Os outros povos esqueceram esse pacto, mas as canções orcs nunca esqueceram. Quando Kael envenenou Vhar\'kesh, os dragões se voltaram contra os próprios Orcs.',
      elevados: [], reduzidos: [], tracos: { vidaPct: 20, danoPct: 10, critico: -5, velocidadePct: -10, evasaoPct: -50 },
      classes: ['cavaleiro', 'arqueiro', 'mago', 'artesao'],
    },
    anao: {
      nome: 'Anão', nomeF: 'Anã',
      descricao: 'Robustos: mais vida e força (menos que o Orc), mas menos críticos e mais lentos.',
      lema: 'A forja',
      lore: 'Os Anões forjaram as correntes de luz que prendem Ignaroth e guardaram as chaves dos Sete Selos. A Torre Carmesim era a forja deles, e o Guardião da Torre foi a última armadura que fizeram para protegê-la. Hoje o Culto Vermelho tomou a torre, e o Guardião obedece ao fogo. Só um Anão Ferreiro forja uma Relíquia Rúnica: o Fragmento de Selo obedece ao sangue de quem o criou.',
      elevados: [], reduzidos: [], tracos: { vidaPct: 10, danoPct: 5, critico: -3, velocidadePct: -5 },
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
    secundaria: { nome: 'Mão esquerda', tipo: 'secundaria' },
  },

  // Nomes dos bônus de equipamento.
  bonus: {
    defesa: 'Defesa', defesaMagica: 'Defesa Mágica', vida: 'Vida',
    for: 'Força', des: 'Destreza', res: 'Resistência', int: 'Inteligência', sor: 'Sorte',
    dano: 'Dano', danoPct: 'Dano %', vidaPct: 'Vida %', defesaPct: 'Defesa %', regen: 'Regeneração de vida %/min', precisao: 'Precisão %', critico: 'Chance de crítico %', danoMagico: 'Dano mágico %', danoCriticoMagico: 'Dano crítico mágico %',
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
      // Henri (nov/2026): o chapéu também dá defesa (menos que o elmo do cavaleiro/artesão, igual ao capuz do arqueiro)
      elmo: { tipo: 'Chapéu', bonus: { defesa: [1, 3, 6, 12], defesaMagica: [2, 5, 10, 20], int: [1, 2, 4, 8] },
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
    // Anel (Henri, nov/2026): comum = dano; rara + defesa mágica; épica + 1 atributo sorteado + regeneração;
    // lendária + 2 atributos sorteados + vida + regeneração. Valores por nível em ANEL (os de baixo são só de reserva).
    anel: { tipo: 'Anel', bonus: { dano: [1, 2, 3, 4], defesaMagica: [0, 2, 4, 6], vida: [0, 0, 0, 30] },
      nomes: ['Anel de Cobre', 'Anel de Prata', 'Anel de Ametista', 'Anel do Sol Eterno'] },
  },
  // Anel por nível: dano = danoPctArma% do dano médio de uma arma do mesmo nível e qualidade (mínimo 1);
  // defesa mágica e vida crescem com o nível como as armaduras (valor de referência da rara);
  // atributos: quantos atributos diferentes sorteados (valores de VARIACAO_ITEM.extra); regen: % da vida por minuto
  // (soma aos VIDA.regenPorMinuto, fora da luta; 2 anéis somam).
  // nov/2026: a regeneração de vida do anel saiu (a vida começa cheia em toda luta).
  ANEL: { danoPctArma: 15, defesaMagica: 2, vida: 15,
    desde: { defesaMagica: 'rara', atributos: 'epica', vida: 'lendaria' }, atributos: { epica: 1, lendaria: 2 } },

  // Encantamento: +0 a +10, gastando 1 pergaminho da raridade da arma por tentativa.
  encantamento: {
    // Teto da chance por nível (Daniel, nov/2026): nem com muita Sorte nem Anão passa disso. Anão: +anao% em cada tentativa.
    teto: { 4: 85, 5: 75, 6: 65, 7: 55, 8: 42, 9: 30, 10: 20 }, anao: 3,
    maximo: 10,
    seguroAte: 3,              // +1 a +3 nunca falham
    chances: { 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 },
    chanceMaxima: 95,          // teto depois do bônus de Sorte (SORTE.encanto por ponto)
    voltaZeroAte: 6,           // falha até +6 volta a arma para +0; do +7 em diante ela quebra
    // Cada + do encanto dá +5% do próprio item: na arma, do dano; nas outras peças, do bônus principal.
    // Cada raridade é ~30% mais forte que a anterior, então +6 (+30%) iguala o +0 da raridade seguinte.
    pctPorNivel: 5,
    precoPergaminho: { comum: 100, rara: 1000, epica: 5000, lendaria: 10000 },
    vendaPorNivel: 0.2,        // +20% do valor de venda por nível
    // Bônus por nível em armaduras e joias
    bonusPorNivel: { elmo: 'defesa', peitoral: 'defesa', luvas: 'defesa', botas: 'defesa', colar: 'defesaMagica', anel: 'dano' },   // mão esquerda: MAO_ESQUERDA[x].encanto
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
  // ---------- Tipos de arma (mão direita) e itens da mão esquerda ----------
  // vel: devagar / normal / rapida (multiplica a velocidade do herói: mais ou menos ataques).
  // fator: multiplica o golpe inteiro (arma + dano do herói). Equilíbrio: rápida 0,83 x 1,2 ataques = normal;
  // lenta de uma mão 1,25 x 0,8 = normal (golpes maiores); lenta de duas mãos 1,4 x 0,8 = +12% (paga a mão esquerda).
  // duasMaos: ocupa a mão esquerda também. proibe: itens da mão esquerda que não combinam com ela.
  // Tipos que não estão na lista de nenhuma classe base são das segundas classes e só existem a partir da raridade rara.
  // As 4 armas antigas (espada, arco, cajado, martelo) usam os nomes de `armas` acima; as outras usam SUFIXOS_ARMA.
  VELOCIDADE_ARMA: { devagar: 0.8, normal: 1, rapida: 1.2 },
  NOME_VELOCIDADE: { devagar: 'Devagar', normal: 'Normal', rapida: 'Rápida' },
  TIPOS_ARMA: {
    espada: { nome: 'Espada', classe: 'cavaleiro', vel: 'normal', fator: 1 },
    espada2m: { nome: 'Espada de Duas Mãos', classe: 'cavaleiro', vel: 'devagar', fator: 1.4, duasMaos: true },
    machado: { nome: 'Machado', classe: 'cavaleiro', vel: 'normal', fator: 1 },
    arco: { nome: 'Arco', classe: 'arqueiro', vel: 'normal', fator: 1 },
    besta: { nome: 'Besta', classe: 'arqueiro', vel: 'devagar', fator: 1.25 },
    // normal de duas mãos: 1,12 (= os +12% que as lentas de duas mãos rendem para pagar a mão esquerda)
    balestra: { nome: 'Balestra', classe: 'arqueiro', vel: 'normal', fator: 1.12, duasMaos: true },
    adaga: { nome: 'Adaga', classe: 'arqueiro', vel: 'rapida', fator: 0.83, proibe: ['aljava'] },
    livro: { nome: 'Livro de Magias', classe: 'mago', vel: 'normal', fator: 1 },
    cajado: { nome: 'Cajado', classe: 'mago', vel: 'devagar', fator: 1.4, duasMaos: true },
    varinha: { nome: 'Varinha', classe: 'mago', vel: 'normal', fator: 1 },
    martelo: { nome: 'Martelo', classe: 'artesao', vel: 'normal', fator: 1 },
    martelo2m: { nome: 'Martelo de Duas Mãos', classe: 'artesao', vel: 'devagar', fator: 1.4, duasMaos: true },
    maca: { nome: 'Maça', classe: 'artesao', vel: 'normal', fator: 1 },
    // segundas classes (a partir de rara)
    mangual: { nome: 'Mangual', classe: 'cavaleiro', vel: 'normal', fator: 1 },
    machado2m: { nome: 'Machado de Duas Mãos', classe: 'cavaleiro', vel: 'devagar', fator: 1.4, duasMaos: true },
    garra: { nome: 'Garra', classe: 'arqueiro', vel: 'rapida', fator: 0.83, proibe: ['aljava'] },
    cetro: { nome: 'Cetro', classe: 'mago', vel: 'normal', fator: 1 },
    foice: { nome: 'Foice', classe: 'artesao', vel: 'rapida', fator: 0.83 },
    picareta: { nome: 'Picareta', classe: 'artesao', vel: 'normal', fator: 1 },
  },
  ARMA_PADRAO: { cavaleiro: 'espada', arqueiro: 'arco', mago: 'cajado', artesao: 'martelo' },
  // Mão esquerda: bônus por raridade (comum, rara, épica, lendária); encanto: o bônus que sobe +5% por nível de encanto.
  // Henri (nov/2026): para valer tanto quanto os +12% da arma de duas mãos, a mão esquerda dá % fixos pela raridade
  // (os bônus em `fixos` não crescem com o nível do item): dano 4/7/10/14%; o Escudo dá vida % e defesa %.
  MAO_ESQUERDA: {
    escudo: { nome: 'Escudo', bonus: { defesaPct: [6, 10, 13, 16], vidaPct: [3, 5, 7, 9] }, fixos: ['defesaPct', 'vidaPct'], encanto: 'defesaPct' },
    aljava: { nome: 'Aljava', bonus: { danoPct: [4, 7, 10, 14], critico: [1, 2, 3, 5] }, fixos: ['danoPct', 'critico'], encanto: 'danoPct' },
    orbe: { nome: 'Orbe', bonus: { danoMagico: [4, 7, 10, 14], danoCriticoMagico: [5, 10, 15, 20] }, fixos: ['danoMagico', 'danoCriticoMagico'], encanto: 'danoMagico' },
    manopla: { nome: 'Manopla', bonus: { defesa: [1, 3, 6, 12], danoPct: [4, 7, 10, 14] }, fixos: ['danoPct'], encanto: 'danoPct' },
    // segundas classes (a partir de rara)
    livro: { nome: 'Livro de Magias', bonus: { int: [1, 2, 4, 8], danoMagico: [4, 7, 10, 14] }, fixos: ['danoMagico'], encanto: 'danoMagico' },
    adaga: { nome: 'Adaga', bonus: { dano: [2, 5, 10, 16], critico: [1, 2, 3, 5] }, fixos: ['critico'], encanto: 'dano' },
    garra: { nome: 'Garra', bonus: { dano: [3, 6, 12, 18] }, encanto: 'dano' },
    shuriken: { nome: 'Shuriken', bonus: { dano: [1, 3, 6, 10], critico: [2, 4, 6, 10] }, fixos: ['critico'], encanto: 'critico' },
  },
  // Armas e mão esquerda de cada classe base e de cada segunda classe.
  ARMAS_CLASSE: {
    cavaleiro: { armas: ['espada', 'espada2m', 'machado'], mao: ['escudo'] },
    arqueiro: { armas: ['arco', 'besta', 'balestra', 'adaga'], mao: ['aljava'] },
    mago: { armas: ['livro', 'cajado', 'varinha'], mao: ['orbe'] },
    artesao: { armas: ['martelo', 'martelo2m', 'maca'], mao: ['manopla'] },
    paladino: { armas: ['espada', 'mangual'], mao: ['escudo'] },
    destruidor: { armas: ['espada2m', 'machado2m'], mao: [] },
    cacador: { armas: ['arco', 'besta', 'balestra'], mao: ['aljava'] },
    assassino: { armas: ['adaga', 'garra'], mao: ['adaga', 'garra', 'shuriken'] },
    bruxo: { armas: ['cajado', 'varinha', 'cetro'], mao: ['livro'] },
    curandeiro: { armas: ['cetro', 'cajado', 'varinha'], mao: ['orbe'] },
    ferreiro: { armas: ['martelo', 'martelo2m', 'maca'], mao: ['manopla'] },
    coletor: { armas: ['foice', 'martelo', 'picareta'], mao: ['escudo'] },
  },
  // Nomes das armas e itens novos: "<tipo> <sufixo>" (8 por raridade).
  SUFIXOS_ARMA: {
    comum: ['de Ferro', 'de Bronze', 'do Recruta', 'de Guarda', 'do Aprendiz', 'de Treino', 'de Caça', 'do Viajante'],
    rara: ['de Aço Negro', 'de Prata', 'do Capitão', 'do Vento', 'da Vigília', 'do Falcão', 'da Névoa', 'do Patrulheiro'],
    epica: ['do Crepúsculo', 'da Tempestade', 'do Abismo', 'do Eclipse', 'da Lua Sangrenta', 'das Sombras', 'do Relâmpago', 'da Serpente'],
    lendaria: ['do Rei Eterno', 'do Primeiro Sol', 'do Dragão Ancestral', 'da Aurora', 'do Destino', 'da Fênix', 'dos Mil Juramentos', 'do Fim dos Tempos'],
  },
  // Extras da arma pela raridade (comum, rara, épica, lendária): atributo de dano da classe, % de dano contra monstros (PvE)
  // e % de dano na Arena (PvP).
  RARIDADE_ARMA: { atributo: [0, 2, 4, 6], pve: [0, 0, 10, 10], pvp: [0, 0, 0, 10] },
  // ---------- Nível dos itens (1 a 60) ----------
  // Drops e Mercado: nível do herói ±3 (drops: do level 35 em diante, do 35 ao 60). A raridade é a QUALIDADE do item no
  // nível: sorteada com as chances de sempre e convertida numa qualidade de 0 a 1 (faixaQualidade); com a mesma
  // qualidade, um item de nível maior é mais forte.
  ITEM_NIVEL: {
    // Drop: sempre o nível do herói ±3 (Henri, 13/11/2026; antes, do level 35 em diante caía entre 35 e 60).
    // Para voltar a regra antiga: altoDesde: 35, altoMin: 35.
    maximo: 60, variacao: 3, altoDesde: null, altoMin: 35,
    faixaQualidade: { comum: [0, 0.4], rara: [0.4, 0.7], epica: [0.7, 0.9], lendaria: [0.9, 1] },
    // Força pela raridade (o mais fraco e o mais forte de cada uma): cada raridade ~25% acima da anterior.
    multRaridade: { comum: [0.7, 0.8], rara: [0.95, 1.05], epica: [1.27, 1.37], lendaria: [1.6, 1.7] },
    // Arma: dano médio = (danoPorNivel x nível + danoBase) x qualidade; o dano vai de -15% a +15% da média.
    danoPorNivel: 0.8, danoBase: 2, danoFaixa: 0.15,
    // Armadura, joia e mão esquerda: valor "raro" da tabela, dobrando a cada 10 níveis a partir do 15 (até o 40;
    // depois do 40, +3% por nível), vezes a qualidade.
    bonusReferencia: 15, bonusDobraA: 10, bonusDepois40: 0.03,
    // Mercado: preço pelo nível do herói (100 no 1, x1,12 por nível); vem comum ou rara.
    // Venda: 10% do preço do nível do item, x raridade.
    precoBase: 100, precoCresce: 1.12, mercadoRara: 0.5, vendaPct: 10, vendaRaridade: { comum: 1, rara: 1.5, epica: 3, lendaria: 6 },
  },
  // Conjuntos das segundas classes: elmo, peitoral, luvas e botas que caem (ou são comprados) por quem tem a segunda
  // classe vêm de um conjunto com o nome da faixa de nível do item (1–10, 11–20, ... 51–60). Peças com o MESMO nome
  // equipadas por alguém da MESMA segunda classe dão o bônus de 2, 3 e 4 peças (somam).
  // Chaves: defesa, vida, dano, for (Força), velocidade, critico (% físico), evasao (%), criticoMagico (%).
  CONJUNTOS: {
    paladino: { nomes: ['da Fé', 'do Juramento', 'da Luz Sagrada', 'do Templo', 'do Santo Guardião', 'da Aurora Divina'],
      bonus: { 2: { defesa: 23 }, 3: { dano: 5 }, 4: { vida: 30 } } },
    destruidor: { nomes: ['da Fúria', 'do Sangue', 'da Ruína', 'do Trovão', 'do Massacre', 'do Fim do Mundo'],
      bonus: { 2: { for: 5 }, 3: { dano: 5 }, 4: { velocidade: 2 } } },
    cacador: { nomes: ['do Batedor', 'do Vento', 'do Falcão', 'da Floresta Antiga', 'do Olho de Águia', 'da Estrela Cadente'],
      bonus: { 2: { critico: 5 }, 3: { dano: 5 }, 4: { velocidade: 3 } } },
    assassino: { nomes: ['da Sombra', 'da Noite', 'do Silêncio', 'da Lâmina Oculta', 'do Véu Negro', 'da Morte Silenciosa'],
      bonus: { 2: { evasao: 5 }, 3: { dano: 5 }, 4: { velocidade: 3 } } },
    bruxo: { nomes: ['do Gelo', 'da Brasa', 'da Tempestade', 'do Abismo', 'do Eclipse', 'do Caos Eterno'],
      bonus: { 2: { criticoMagico: 5 }, 3: { dano: 5 }, 4: { velocidade: 3 } } },
    curandeiro: { nomes: ['da Esperança', 'da Graça', 'da Fonte', 'da Luz Serena', 'da Vida Eterna', 'do Milagre'],
      bonus: { 2: { criticoMagico: 5 }, 3: { dano: 5 }, 4: { velocidade: 3 } } },
    ferreiro: { nomes: ['da Bigorna', 'da Forja', 'do Aço Rúnico', 'do Mestre Ferreiro', 'da Forja Ancestral', 'do Coração de Ferro'],
      bonus: { 2: { defesa: 23 }, 3: { dano: 5 }, 4: { vida: 30 } } },
    coletor: { nomes: ['do Viajante', 'do Garimpeiro', 'do Tesouro', 'da Fortuna', 'do Rei Mercador', 'da Riqueza Perdida'],
      bonus: { 2: { defesa: 23 }, 3: { dano: 5 }, 4: { vida: 30 } } },
  },
  // Chance (%) de uma armadura que cai na caçada vir de conjunto, para quem tem segunda classe.
  // A peça de conjunto vem na raridade sorteada (comum a lendária). O Mercado não vende peças de conjunto.
  // Imagem própria: assets/itens/conjunto-<segunda classe>-<elmo|peitoral|luvas|botas>.webp (sem ela, a da armadura normal).
  CONJUNTO_CHANCE: 10,
  NOME_BONUS_CONJUNTO: { defesa: 'de defesa', vida: 'de vida', dano: 'de dano', for: 'de Força', velocidade: 'de velocidade',
    critico: '% de chance de crítico', evasao: '% de esquiva', criticoMagico: '% de chance de crítico mágico' },
  // Extras das armas pela faixa de nível (sorteados quando a arma cai ou é comprada). atributos: [quantos, mín, máx]
  // (atributos diferentes, sorteados entre FOR/DES/RES/INT/SOR); pve/pvp: % de dano; hab: pontos numa habilidade
  // sorteada da segunda classe (nº 1 a 4 da lista de quem usar a arma), além do limite de 10.
  // Estes extras substituem os da raridade (RARIDADE_ARMA), que ficam só para as armas antigas.
  EXTRAS_ARMA: [
    { ate: 10 },
    { ate: 20, atributos: [1, 1, 2] },
    { ate: 30, atributos: [1, 3, 5] },
    { ate: 40, atributos: [1, 5, 8] },
    { ate: 50, atributos: [2, 5, 10], pve: [5, 10], hab: [1, 1] },
    { ate: 60, atributos: [2, 5, 10], pve: [5, 10], pvp: [5, 10], hab: [2, 3] },
  ],
  // Armaduras, joias e mão esquerda caem com os bônus sorteados (como o dano das armas): cada bônus entre 80% e 120%
  // do valor da raridade (mínimo 1). Da rara em diante ganham também 1 atributo extra sorteado (FOR, DES, RES, INT ou SOR).
  // Itens antigos (sem `bonus` salvo) continuam com o valor fixo.
  VARIACAO_ITEM: { faixa: [0.8, 1.2], extra: { comum: null, rara: [1, 2], epica: [2, 4], lendaria: [3, 6] } },

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
  // Número ⚔ Poder (só para mostrar e para os rankings; não muda nenhuma luta): ataque + PESO x defesa.
  // 1,5 escolhido nas simulações (duelos e caçada) de nov/2026: acerta ~94% de quem é mais forte (Daniel).
  PODER_PESO_DEFESA: 1.5,

  // Vida com o tempo: % da vida máxima por minuto fora da batalha (também com o jogo fechado).
  // Acampado, multiplica pela velocidade do acampamento, mas não pode caçar.
  // Reset diário à meia-noite de Brasília (UTC-3): vida cheia e as poções do dia voltam.
  VIDA: { regenPorMinuto: 2, acampamento: 3, pocoesPorDia: 2, fusoReset: -3 },
  // Estamina (Daniel/Henri, nov/2026): o que limita a caçada. Barra igual para todos; cada luta gasta pelo monstro
  // (1º, 2º, 3º da área e chefe). Enche sozinha em minutosSemAcampar (0 = não recupera); acampado em minutosAcampado;
  // à meia-noite enche. acampar: false desliga o botão Acampar (Henri, 11/11/2026; para religar: true e acertar os minutos).
  // A vida do herói começa cheia em toda luta (o dano dos monstros na caçada é o `danoCacada` de cada um).
  // pote: comprado com reputação (precos = 1º e 2º do dia), enche +240 (pode passar do máximo).
  ESTAMINA: { maximo: 240, acampar: false, minutosAcampado: 90, minutosSemAcampar: 90, custo: [1, 2, 3], custoChefe: 5,
    pote: { enche: 240, precos: [40, 60] } },
  // Poção de vida: 2 de graça por dia (VIDA.pocoesPorDia); mais, só comprando com ouro (preço pelo level).
  // Guarda no máximo `maximo` (VIP: maximoVip). Só vale na caçada (Arena, masmorra e Chefe Mundial não usam).
  POCAO: { maximo: 2, maximoVip: 4, precos: [{ ate: 9, ouro: 100 }, { ate: 19, ouro: 500 }, { ate: 29, ouro: 5000 }, { ate: 999, ouro: 10000 }] },

  // Penalidade de área baixa (exp e ouro reduzidos e nenhum drop): conta quantos mapas DEPOIS desta área o herói
  // já liberou pelo level. Até 1 mapa à frente: sem penalidade (sempre 2 mapas para farmar: o mais alto e o anterior).
  // 2 mapas à frente: 50%; 3 ou mais: 10%. A última área nunca reduz.
  // Defesa do herói em porcentagem (igual aos monstros): dano recebido x 100 / (100 + defesa).
  // 100 de defesa = -50%, 200 = -67%, 300 = -75%: nunca imortal, sempre útil. Para a defesa valer o mesmo de antes,
  // a defesa das armaduras, joias, mão esquerda e da RES vale x`fator` (3) — vale para itens antigos também.
  // Henri (nov/2026): defesa 50% mais eficaz: fator 3 -> 4,5 (itens, RES e conjuntos); arredonda por item.
  DEFESA: { k: 100, fator: 4.5 },
  EXP_REDUZIDA: [{ mapasAFrente: 3, pct: 10 }, { mapasAFrente: 2, pct: 50 }],
  // ---------- Habilidades (aba Herói > Habilidades) e segunda classe ----------
  // Antes do level 10: só a habilidade inicial da classe (sem pontos). No level 10 o jogador escolhe a segunda
  // classe e ganha 4 pontos (+1 por level depois), até 10 pontos por habilidade. Uma habilidade precisa de pelo
  // menos 1 ponto para ser usada. Valor = base + porPonto x pontos.
  // Na luta, a cada vez do herói: usa a 1ª habilidade pronta da ordem escolhida (caçada / masmorra / arena).
  // Reforços (tipo reforco, furtivo, provocar) não gastam a vez: o herói usa e ataca junto.
  // "turnos" = vezes do herói. recarga 3 = usada na vez 2, volta na vez 5.
  TALENTOS: {
    nivelSegunda: 10, pontosIniciais: 4, pontosPorNivel: 1, maxPorHabilidade: 10,
    // Passivas são fixas (valor de 1 ponto, sem receber pontos). Do level 21 em diante: 2 pontos por level (Daniel, nov/2026): 14 no level 20, 34 no level 30.
    pontosDepois: { nivel: 20, porNivel: 2 },
    unico: { base: 150, porPonto: 5 }, unicoReduzido: { base: 120, porPonto: 4 },
    area: { base: 80, porPonto: 3 }, areaReduzida: { base: 60, porPonto: 3 },
    atordoar: { base: 100, porPonto: 5 },     // dano do golpe que atordoa
    multiplo: { base: 100, porPonto: 3 },     // cada flecha do Double Shot (2 x 100%, +3% por ponto em cada)
    bonusPorPonto: 1,                          // % a mais por ponto em reforços, cura e passivas
    atordoarChefeMax: 1,                       // contra chefes o atordoar dura no máximo 1 turno
    curaSoAbaixo: 80,                          // em grupo, só cura se alguém estiver abaixo de 80% da vida
  },
  RECOMECO_HABILIDADES: { nome: 'Pergaminho das Habilidades', precoOuro: 2000 },
  HABILIDADE_INICIAL: {
    cavaleiro: { id: 'espada-giratoria', nome: 'Espada Giratória', tipo: 'unico', recarga: 3, descricao: 'Gira a espada e acerta um inimigo com força.' },
    arqueiro: { id: 'chuva-de-flechas', nome: 'Chuva de Flechas', tipo: 'unico', recarga: 3, descricao: 'Uma chuva de flechas sobre um inimigo.' },
    mago: { id: 'meteoro', nome: 'Meteoro', tipo: 'unico', recarga: 3, descricao: 'Uma pedra de fogo cai sobre um inimigo.' },
    artesao: { id: 'tremor', nome: 'Tremor', tipo: 'unico', recarga: 3, descricao: 'Bate no chão e faz a terra tremer sob um inimigo.' },
  },
  // tipos: unico, area (atordoa: turnos), atordoar (alvo único), reforco (turnos + bônus em %), furtivo, provocar,
  // cura, passiva. Campos em % (dano, danoCritico, critico, velocidade, precisao, vidaPct, defesaPct, evasao,
  // danoCriticoMagico, recompensa) ganham +1 por ponto; atributos (+5) são fixos. grupo: vale para todos do grupo.
  SEGUNDAS_CLASSES: {
    paladino: { de: 'cavaleiro', nome: 'Paladino', nomeF: 'Paladina', descricao: 'Protege o grupo: atordoa, chama os ataques para si e aguenta firme.',
      habilidades: [
        { id: 'martelo-sagrado', nome: 'Martelo Sagrado', tipo: 'area', atordoa: 1, recarga: 5, descricao: 'Dano em área e atordoa todos os inimigos.' },
        { id: 'grito-de-desafio', nome: 'Grito de Desafio', tipo: 'provocar', turnos: 2, defesaPct: 10, recarga: 4, descricao: 'Todos os inimigos atacam só você e sua defesa sobe.' },
        { id: 'golpe-justo', nome: 'Golpe Justo', tipo: 'unico', recarga: 2, descricao: 'Um golpe forte em um inimigo.' },
        { id: 'pele-de-ferro', nome: 'Pele de Ferro', tipo: 'passiva', defesaPct: 10, vidaPct: 10, descricao: 'Mais defesa e mais vida, sempre.' },
        // Level 20 (foco: caçada) e level 30 (foco: Arena); todas valem em todo lugar. Valores [base, por ponto]: base + porPonto x pontos.
        { id: 'aura-sagrada', nome: 'Aura Sagrada', tipo: 'passiva', nivel: 20, foco: 'cacada', regenPct: [0.6, 0.06],
          descricao: 'Recupera 0,66% a 1,26% da vida máxima a cada turno. Mais forte na caçada.' },
        { id: 'defesa-suprema', nome: 'Defesa Suprema', tipo: 'reforco', nivel: 30, foco: 'arena', turnos: 2, recarga: 5,
          defesaPct: [30, 2], reflete: 15, descricao: '+30% a +50% de defesa por 2 turnos e devolve 15% do dano recebido. Mais forte na Arena.' },
      ] },
    destruidor: { de: 'cavaleiro', nome: 'Destruidor', nomeF: 'Destruidora', descricao: 'Pura força: entra em fúria e derruba tudo.',
      habilidades: [
        { id: 'furia', nome: 'Fúria', tipo: 'reforco', turnos: 2, dano: 10, danoCritico: 10, recarga: 4, descricao: 'Mais dano e mais dano crítico.' },
        { id: 'terremoto', nome: 'Terremoto', tipo: 'area', recarga: 3, descricao: 'Dano em área.' },
        { id: 'golpe-pesado', nome: 'Golpe Pesado', tipo: 'unico', recarga: 3, descricao: 'Um golpe muito forte em um inimigo.' },
        { id: 'forca-bruta', nome: 'Força Bruta', tipo: 'passiva', atributos: { for: 5 }, danoCritico: 10, descricao: '+5 de Força e mais dano crítico, sempre.' },
        { id: 'sede-de-sangue', nome: 'Sede de Sangue', tipo: 'passiva', nivel: 20, foco: 'cacada', rouboVida: [4, 1],
          descricao: '5% a 15% do dano que você causa vira vida. Mais forte na caçada.' },
        // Henri (13/11/2026): no lugar do Golpe Apocalíptico. quebraTurnos: a defesa quebrada dura essas vezes do alvo.
        { id: 'quebra-ossos', nome: 'Quebra-Ossos', tipo: 'unico', nivel: 30, foco: 'arena', recarga: 5, mult: [200, 0],
          ignoraDefesaPct: 100, quebraDefesaPct: [25, 1], quebraTurnos: 2,
          descricao: 'Golpe de 200% que ignora a defesa do alvo e deixa o inimigo com −25% a −35% de defesa por 2 turnos. Mais forte na Arena.' },
      ] },
    // id 'cacador' (personagens salvos); o nome na tela é Arqueiro.
    cacador: { de: 'arqueiro', nome: 'Arqueiro', nomeF: 'Arqueira', descricao: 'Controla a luta de longe: prende, dispara e corre.',
      habilidades: [
        { id: 'flecha-na-perna', nome: 'Flecha na Perna', tipo: 'atordoar', atordoa: 2, recarga: 5, descricao: 'Acerta um inimigo e ele fica parado.' },
        { id: 'saraivada', nome: 'Saraivada', tipo: 'area', recarga: 3, descricao: 'Dano em área.' },
        // id antigo 'pes-ligeiros' mantido: os pontos e a ordem já salvos passam para o Double Shot.
        { id: 'pes-ligeiros', nome: 'Double Shot', tipo: 'multiplo', flechas: 2, recarga: 3,
          descricao: 'Atira duas flechas no mesmo turno, cada uma com o dano de um ataque básico.' },
        { id: 'reflexo-rapido', nome: 'Reflexo Rápido', tipo: 'passiva', atributos: { des: 5 }, evasao: 5, descricao: '+5 de Destreza e mais esquiva, sempre.' },
        { id: 'flecha-envenenada', nome: 'Flecha Envenenada', tipo: 'dot', nivel: 20, foco: 'cacada', recarga: 4, turnos: 3,
          dotPct: [90, 5], curaMorte: 5, pula: true,
          descricao: 'Veneno de 90% a 140% de um ataque por turno, por 3 turnos. Pula para outro monstro; cada monstro morto pelo veneno cura 5%.' },
        { id: 'tiro-silenciador', nome: 'Tiro Silenciador', tipo: 'unico', nivel: 30, foco: 'arena', recarga: 6, mult: [180, 5],
          ignoraDefesaPct: 50, silencia: 1, descricao: 'Golpe de 180% a 230% que ignora metade da defesa e cala o oponente por 1 turno. Mais forte na Arena.' },
      ] },
    assassino: { de: 'arqueiro', nome: 'Assassino', nomeF: 'Assassina', descricao: 'Some nas sombras e volta com golpes críticos.',
      habilidades: [
        { id: 'mira-certeira', nome: 'Mira Certeira', tipo: 'reforco', turnos: 2, critico: 5, danoCritico: 5, recarga: 4, descricao: 'Mais chance e mais dano crítico.' },
        { id: 'sombra', nome: 'Sombra', tipo: 'furtivo', danoCritico: 0, recarga: 4, descricao: 'Esquiva do próximo ataque e o seu próximo golpe é crítico.' },
        { id: 'golpe-fatal', nome: 'Golpe Fatal', tipo: 'unico', recarga: 3, descricao: 'Um golpe enorme em um inimigo.' },
        { id: 'lamina-afiada', nome: 'Lâmina Afiada', tipo: 'passiva', atributos: { des: 5 }, critico: 10, descricao: '+5 de Destreza e mais chance de crítico, sempre.' },
        { id: 'corte-vampirico', nome: 'Corte Vampírico', tipo: 'dot', nivel: 20, foco: 'cacada', recarga: 4, turnos: 3,
          dotPct: [40, 4], curaDot: 20,
          descricao: 'Sangramento de 40% a 80% de um ataque por turno, por 3 turnos; você recupera 20% do que ele tira.' },
        { id: 'execucao', nome: 'Execução', tipo: 'unico', nivel: 30, foco: 'arena', recarga: 5, mult: [250, 3], garantido: true,
          semEsquiva: true, executa: { abaixo: 30, bonus: 50 },
          descricao: 'Golpe de 250% a 280%, sempre no máximo do dado, que não pode ser esquivado. +50% se o oponente tiver menos de 30% da vida. Mais forte na Arena.' },
      ] },
    bruxo: { de: 'mago', nome: 'Bruxo', nomeF: 'Bruxa', descricao: 'Magia de destruição: congela, queima e fulmina.',
      habilidades: [
        { id: 'nevasca', nome: 'Nevasca', tipo: 'area', atordoa: 2, congela: true, recarga: 5, descricao: 'Dano em área e congela todos os inimigos.' },
        { id: 'chuva-de-meteoros', nome: 'Chuva de Meteoros', tipo: 'area', recarga: 3, descricao: 'Dano em área.' },
        { id: 'raio-da-morte', nome: 'Raio da Morte', tipo: 'unico', recarga: 2, descricao: 'Um raio forte em um inimigo.' },
        { id: 'mente-sombria', nome: 'Mente Sombria', tipo: 'passiva', atributos: { int: 5 }, dano: 10, descricao: '+5 de Inteligência e mais dano, sempre.' },
        { id: 'escudo-de-gelo', nome: 'Escudo de Gelo', tipo: 'escudo', nivel: 20, foco: 'cacada', recarga: 5, turnos: 3,
          escudoPct: [10, 1], congelaChance: 30,
          descricao: 'Escudo que segura dano (10% a 20% da vida) por 3 turnos; quem bate nele tem 30% de chance de congelar.' },
        { id: 'maldicao-de-ignaroth', nome: 'Maldição de Ignaroth', tipo: 'unico', nivel: 30, foco: 'arena', recarga: 5, mult: [200, 5],
          queima: { turnos: 3, pct: [15, 1] }, cortaCura: 50,
          descricao: 'Golpe de 200% a 250% que queima (15% a 25% do dano) por 3 turnos e corta pela metade as curas do oponente. Mais forte na Arena.' },
      ] },
    curandeiro: { de: 'mago', nome: 'Curandeiro', nomeF: 'Curandeira', descricao: 'Cuida do grupo: cura, fortalece e ainda castiga.',
      habilidades: [
        { id: 'luz-que-cura', nome: 'Luz que Cura', tipo: 'cura', vidaPct: 20, recarga: 4, descricao: 'Cura todo o grupo (% da vida máxima). Na caçada, vira dano no monstro. Na Arena, o dado decide: 1 não cura, 10 cura metade, 20 cura tudo.' },
        { id: 'explosao-de-luz', nome: 'Explosão de Luz', tipo: 'area', recarga: 3, descricao: 'Dano em área.' },
        // Henri (13/11/2026): no lugar da Bênção. curaDano = % do dano causado que vira vida (+1 por ponto).
        { id: 'luz-punitiva', nome: 'Luz Punitiva', tipo: 'unico', recarga: 3, curaDano: 50, descricao: 'Golpe de luz num inimigo: você se cura com parte do dano causado.' },
        { id: 'fe-profunda', nome: 'Fé Profunda', tipo: 'passiva', atributos: { int: 5 }, danoCriticoMagico: 10, descricao: '+5 de Inteligência e mais dano crítico mágico, sempre.' },
        { id: 'regeneracao', nome: 'Regeneração', tipo: 'passiva', nivel: 20, foco: 'cacada', regenPct: [1, 0.1],
          descricao: 'Recupera 1,1% a 2,1% da vida máxima a cada turno. Mais forte na caçada.' },
        { id: 'milagre', nome: 'Milagre', tipo: 'passiva', nivel: 30, foco: 'arena', milagrePct: [20, 1],
          descricao: 'Uma vez por luta, se cair, volta com 21% a 31% da vida. Mais forte na Arena.' },
      ] },
    ferreiro: { de: 'artesao', nome: 'Ferreiro', nomeF: 'Ferreira', descricao: 'Mão pesada e couro grosso.',
      habilidades: [
        { id: 'marretada-no-chao', nome: 'Marretada no Chão', tipo: 'area', recarga: 3, descricao: 'Dano em área.' },
        { id: 'martelada', nome: 'Martelada', tipo: 'unico', recarga: 2, descricao: 'Um golpe forte em um inimigo.' },
        { id: 'pancada-tonta', nome: 'Pancada Tonta', tipo: 'atordoar', atordoa: 2, recarga: 5, descricao: 'Acerta um inimigo e ele fica tonto.' },
        { id: 'couro-grosso', nome: 'Couro Grosso', tipo: 'passiva', atributos: { sor: 5 }, defesaPct: 20, descricao: '+5 de Sorte e mais defesa, sempre.' },
        { id: 'tempera-de-fogo', nome: 'Têmpera de Fogo', tipo: 'passiva', nivel: 20, foco: 'cacada', reducaoDano: [10, 1], danoExtraPct: [20, 1.5],
          descricao: 'Recebe 11% a 21% menos dano e causa 21,5% a 36,5% mais dano. Mais forte na caçada.' },
        { id: 'martelo-das-correntes', nome: 'Martelo das Correntes', tipo: 'unico', nivel: 30, foco: 'arena', recarga: 5, mult: [220, 5],
          atordoa: 1, quebraDefesaPct: 30,
          descricao: 'Golpe de 220% a 270% que prende o oponente por 1 turno e tira 30% da defesa dele até o fim da luta. Mais forte na Arena.' },
      ] },
    coletor: { de: 'artesao', nome: 'Coletor', nomeF: 'Coletora', descricao: 'Bate menos, mas sai de toda luta com o bolso cheio.',
      habilidades: [
        { id: 'chuva-de-pedras', nome: 'Chuva de Pedras', tipo: 'area', reduzido: true, recarga: 3, descricao: 'Dano em área (mais fraco).' },
        { id: 'pedrada', nome: 'Pedrada', tipo: 'unico', reduzido: true, recarga: 2, descricao: 'Um golpe em um inimigo (mais fraco).' },
        { id: 'rede', nome: 'Rede', tipo: 'atordoar', atordoa: 2, recarga: 5, descricao: 'Joga a rede em um inimigo e ele fica preso.' },
        { id: 'bolso-fundo', nome: 'Bolso Fundo', tipo: 'passiva', recompensa: 10, descricao: 'Mais ouro e exp em cada luta da caçada.' },
        { id: 'bolso-de-pocoes', nome: 'Bolso de Poções', tipo: 'passiva', nivel: 20, foco: 'cacada', curaEmergencia: [35, 2], limiar: 40,
          descricao: 'Uma vez por luta, quando a vida cai abaixo de 40%, recupera 37% a 57% da vida. Mais forte na caçada.' },
        { id: 'po-nos-olhos', nome: 'Pó nos Olhos', tipo: 'cegar', nivel: 30, foco: 'arena', recarga: 6, turnos: 2, erroPct: [30, 1],
          descricao: 'Por 2 turnos, o oponente tem 30% a 40% de chance de errar cada ataque. Mais forte na Arena.' },
      ] },
  },
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
  // Drops dos monstros: iguais em todas as áreas, pela posição do monstro (ver DROPS_CACADA abaixo).
  // Chefes: drop e pergaminho iguais para todos (D.chefe.drop e D.chefe.pergaminho, abaixo).
  // chanceChefe: % somada à presença do chefe a cada monstro morto na área (escondida do jogador).
  // ajusteVida: multiplica a vida dos monstros da área (compensa o dano maior dos heróis desde que 3 pontos = +1 de dano).
  // Drops da caçada, iguais em todas as áreas: chance (%) pela posição do monstro (1º, 2º, 3º).
  // Arma, armadura e pergaminho são sorteados separados (dá para cair mais de um na mesma luta).
  // Armadura = uma das 4 peças da classe ou a mão esquerda. O bônus de Sorte aumenta as chances.
  // `qualidade`: raridade de tudo o que cair (arma, armadura e pergaminho), a Sorte não muda.
  DROPS_CACADA: {
    monstros: [
      // pergaminho (Henri, nov/2026): 2% no 1º monstro, 4% no 2º e 10% no 3º de cada área
      { arma: 5, armadura: 5, pergaminho: 2 },
      { arma: 8, armadura: 8, pergaminho: 4 },
      { arma: 10, armadura: 10, pergaminho: 10 },
    ],
    qualidade: [
      { raridade: 'lendaria', chance: 1 },
      { raridade: 'epica', chance: 7 },
      { raridade: 'rara', chance: 22 },
      { raridade: 'comum', chance: 70 },
    ],
  },
  NIVEL_MAXIMO: 40,
  // Chefe Mundial (Ignaroth): o resto dos números fica no servidor (boss_cfg em supabase/schema.sql).
  CHEFE_MUNDIAL: { acoesPorAtaque: 30, entradas: 5 },   // entradas: ataques por despertar (igual a boss_cfg no schema.sql)

  areas: [
    {
      id: 'floresta', nome: 'Floresta Sombria', nivelMin: 1, chanceChefe: 1, ajusteVida: 1.65,
      crescimento: { ataque: 2 },
      descricao: 'Mata densa e enevoada onde todo aventureiro dá os primeiros passos.',
      base: { hp: 20, ataque: 1, exp: 2 }, ouro: [2, 5, 8],
      monstros: [
        { id: 'lobo', dano: [3, 5], danoCacada: [7, 12], nome: 'Lobo Selvagem', descricao: 'Caça em matilha nas florestas enevoadas.' },
        { id: 'cobra', dano: [4, 6], danoCacada: [9, 14], nome: 'Cobra Viscosa', descricao: 'Desliza pelos pântanos deixando um rastro de gosma venenosa.' },
        { id: 'urso', dano: [5, 8], danoCacada: [14, 23], nome: 'Urso Raivoso', descricao: 'Senhor das cavernas. Sua fúria derruba árvores.' },
      ],
      chefe: { id: 'velgrath', dano: [8, 10], danoCacada: [17, 21], ouro: 20, exp: 50, nome: 'Velgrath, o Ancião Apodrecido', descricao: 'A árvore mais antiga da floresta, corrompida por magia sombria. Suas raízes arrastam os invasores para a terra.' },
    },
    {
      id: 'pantano', nome: 'Pântano de Brumafria', nivelMin: 5, chanceChefe: 0.7, ajusteVida: 1.6,
      descricao: 'Águas paradas cobertas por uma névoa gelada que nunca se dissipa.',
      base: { hp: 70, ataque: 8, exp: 10 }, ouro: [12, 20, 30],
      monstros: [
        { id: 'sapo', dano: [10, 15], danoCacada: [6, 10], nome: 'Sapo Gigante', descricao: 'Do tamanho de um boi, engole viajantes inteiros.' },
        { id: 'aranha', dano: [15, 20], danoCacada: [10, 13], nome: 'Aranha do Brejo', descricao: 'Tece teias entre as árvores mortas do pântano.' },
        { id: 'troll', dano: [18, 22], danoCacada: [15, 20], nome: 'Troll do Pântano', descricao: 'Coberto de musgo, regenera feridas no lodo.' },
      ],
      chefe: { id: 'morgath', dano: [25, 30], danoCacada: [17, 19], nome: 'Morgath, a Bruxa do Brejo', descricao: 'Senhora da névoa. Fala com os mortos do pântano.' },
    },
    {
      id: 'ruinas', nome: 'Ruínas de Dravenhold', nivelMin: 10, chanceChefe: 0.5, ajusteVida: 1.3,
      descricao: 'Restos de um reino caído, onde os mortos ainda guardam seus tesouros.',
      base: { hp: 140, ataque: 15, exp: 30 }, ouro: [40, 60, 80],
      monstros: [
        { id: 'esqueleto', dano: [20, 28], danoCacada: [33, 46], nome: 'Esqueleto Guerreiro', descricao: 'Soldado de Dravenhold que nunca deixou o posto.' },
        { id: 'goblin', dano: [26, 35], danoCacada: [42, 57], nome: 'Goblin Saqueador', descricao: 'Revira as ruínas atrás de ouro e não divide com ninguém.' },
        { id: 'gargula', dano: [31, 42], danoCacada: [58, 78], nome: 'Gárgula', descricao: 'Estátua de pedra que ganha vida ao anoitecer.' },
      ],
      chefe: { id: 'varnok', dano: [38, 52], danoCacada: [59, 79], ouro: 200, nome: 'Varnok, o Lich', descricao: 'O antigo rei de Dravenhold, que trocou a alma pela imortalidade.' },
    },
    {
      id: 'torre', nome: 'Torre Carmesim', nivelMin: 15, chanceChefe: 0.3, ajusteVida: 1.35,
      descricao: 'Uma torre de pedra vermelha que pulsa com magia proibida.',
      base: { hp: 200, ataque: 22, exp: 90 }, ouro: [100, 150, 200],
      monstros: [
        { id: 'golem', dano: [30, 40], danoCacada: [37, 50], nome: 'Golem de Pedra', descricao: 'Guardião construído pelos magos da torre.' },
        { id: 'cultista', dano: [38, 52], danoCacada: [47, 65], nome: 'Cultista Sombrio', descricao: 'Entoa rituais para despertar o que dorme no topo.' },
        { id: 'espectro', dano: [46, 63], danoCacada: [70, 97], nome: 'Espectro', descricao: 'Alma presa na torre, atravessa paredes e armaduras.' },
      ],
      chefe: { id: 'guardiao', dano: [56, 75], danoCacada: [86, 115], nome: 'O Guardião da Torre', descricao: 'Ninguém sabe o que há sob a armadura. Ninguém voltou para contar.' },
    },
    {
      id: 'areias', nome: 'Areias Rubras', nivelMin: 20, chanceChefe: 0.2, ajusteVida: 1.3,
      descricao: 'Deserto de areia vermelha que engoliu um império inteiro.',
      base: { hp: 320, ataque: 32, exp: 270 }, ouro: [150, 300, 600],   // nov/2026: era 800/1600/3200 (ouro x16 da Torre); agora ~x3 por área, como a exp
      monstros: [
        { id: 'escorpiao', dano: [44, 59], danoCacada: [68, 91], nome: 'Escorpião Gigante', descricao: 'Seu ferrão atravessa escudos de aço.' },
        { id: 'lagarto', dano: [54, 74], danoCacada: [84, 115], nome: 'Homem-Lagarto', descricao: 'Guerreiro das dunas, rápido e traiçoeiro.' },
        { id: 'mumia', dano: [68, 92], danoCacada: [114, 154], nome: 'Múmia', descricao: 'Sacerdote do império perdido, envolto em faixas amaldiçoadas.' },
      ],
      chefe: { id: 'farao', dano: [82, 110], danoCacada: [143, 193], nome: 'O Faraó Sem Nome', descricao: 'Seu nome foi apagado da história. Sua vingança não.' },
    },
    {
      id: 'vale', nome: 'Vale dos Dragões', nivelMin: 25, chanceChefe: 0.15, ajusteVida: 1.4,
      descricao: 'Desfiladeiros de rocha negra onde os dragões fazem seus ninhos.',
      base: { hp: 420, ataque: 40, exp: 800 }, ouro: [450, 900, 1800],   // era 2000/4000/8000
      monstros: [
        { id: 'drake', dano: [54, 74], danoCacada: [123, 168], nome: 'Drake', descricao: 'Dragão jovem, sem asas, mas com garras de ferro.' },
        { id: 'wyvern', dano: [68, 92], danoCacada: [155, 209], nome: 'Wyvern', descricao: 'Ataca dos céus com cauda venenosa.' },
        { id: 'cavaleiroDraconico', dano: [86, 116], danoCacada: [224, 301], nome: 'Cavaleiro Dracônico', descricao: 'Guerreiro que bebeu sangue de dragão e virou parte deles.' },
      ],
      chefe: { id: 'vharkesh', dano: [103, 140], danoCacada: [225, 304], nome: "Vhar'kesh, o Dragão Ancião", descricao: 'O mais velho dos dragões. Viu reinos nascerem e caírem.' },
    },
    {
      id: 'cume', nome: 'Cume do Fogo Eterno', nivelMin: 30, chanceChefe: 0.1, ajusteVida: 1.35,
      descricao: 'O topo do vulcão, onde a lava nunca esfria.',
      base: { hp: 550, ataque: 60, exp: 2400 }, ouro: [1350, 2700, 5400],   // era 5000/10000/20000
      monstros: [
        { id: 'salamandra', dano: [82, 110], danoCacada: [233, 312], nome: 'Salamandra', descricao: 'Nada na lava como um peixe na água.' },
        { id: 'demonio', dano: [102, 138], danoCacada: [290, 392], nome: 'Demônio de Lava', descricao: 'Nascido do fogo, deixa um rastro de brasas.' },
        { id: 'elemental', dano: [128, 173], danoCacada: [379, 513], nome: 'Elemental de Fogo', descricao: 'Chama viva, quente o bastante para derreter aço.' },
      ],
      chefe: { id: 'ignaroth', dano: [154, 208], danoCacada: [612, 825], nome: 'Ignaroth, Senhor das Chamas', descricao: 'O fogo obedece a ele. O mundo inteiro teme o dia em que ele acordar.' },
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
  // Sorte (Henri, nov/2026): % por ponto de SOR no encantamento (soma). A Sorte não mexe mais no drop nem no crítico físico.
  // Vitalidade (Henri, nov/2026): cada vitória na caçada gasta 1 ponto e dá exp e ouro x2. Recarrega porHora a
  // cada hora e enche à meia-noite (horário de Brasília, fuso -3). maximoVip: para o VIP no futuro (p.vip).
  // Não gasta em área abaixo do nível do herói (exp reduzida).
  // ligada: false = desligada (nov/2026, teste do progresso sem ela). Para voltar: true (a regra e a tela já estão prontas).
  VITALIDADE: { ligada: false, maximo: 100, maximoVip: 200, porHora: 5, multiplicador: 2, fuso: -3 },
  SORTE: { encanto: 0.5, drop: 0.2 },   // drop: +0,2% sobre a chance base de cada drop por ponto (nov/2026)

  // Chance mínima do herói acertar um monstro (caçada e masmorra); a precisão acima disso chega a 100%.
  ACERTO_PVE_MINIMO: 95,
  MONSTRO: { velocidade: 15, defesa: 1, velocidadePorMonstro: 1.1, defesaPorMonstro: 1.25, entreAreas: 1.1,
    // Henri (nov/2026): a velocidade do monstro vem da velocidade de um herói (arma normal) no level mínimo da área:
    // 1º monstro 70%, 2º 80%, 3º 90% (o chefe igual ao 3º). Assim o herói da área ataca mais vezes que o monstro.
    // O dano dos monstros não mudou. (velocidade/velocidadePorMonstro/entreAreas não são mais usados na velocidade.)
    velocidadeHeroi: [0.7, 0.8, 0.9],
    // Exp do 1º, 2º e 3º monstro = base.exp da área x estes números (Henri, nov/2026: antes 1, 2 e 4).
    // Floresta (base 2): 2, 5 e 10. O chefe dá 5x o 3º. Por ponto de estamina (custo 1, 2, 3): 1x, 1,25x e 1,67x a base,
    // ou seja, o 2º rende mais que o 1º e menos que o 3º.
    expMonstros: [1, 2.5, 5] },

  // Chefe em relação ao 3º monstro da área: +50% de vida e velocidade, +20% de ataque, dobro da defesa,
  // e 5x a exp e o ouro (para valer o risco).
  // Drop de todos os chefes (Henri, nov/2026): 4% lendário, 20% épico (1 arma, armadura ou mão esquerda; senão nada);
  // 80% de chance de 1 pergaminho, raridade pela qualidade da caçada (70/22/7/1), sem depender da arma.
  chefe: { vida: 1.5, ataque: 1.2, velocidade: 1, defesa: 2, exp: 5, ouro: 5,
    drop: [{ raridade: 'lendaria', chance: 4 }, { raridade: 'epica', chance: 20 }], pergaminho: 80 },

  // ---------- Masmorras (grupo de 3) ----------
  // Única fonte de colar e anel. Vida própria (não mexe na vida de fora), sem poções e sem
  // habilidades. Batalha automática com semente do servidor (todos calculam a mesma luta).
  // Salas: 1) os 3 monstros da área; 2) 2x o 3º monstro + Elite; 3) Chefe da Masmorra.
  // forca: multiplica vida e ataque de todos os monstros da masmorra (calibrado por simulação:
  // grupo no level mínimo, itens da raridade da área +3, vence cerca de 2 em 3 vezes).
  // As raridades da joia também estão em supabase/schema.sql (função sortear_raridade_joia).
  // pergaminho: % de chance de cada herói ganhar 1 pergaminho de encantamento na vitória (qualidade de
  // DROPS_CACADA). O sorteio é do servidor: mudar também em supabase/schema.sql (masmorra_concluir).
  MASMORRA: { entradasPorDia: 5,   // igual a masmorra_entradas_dia() no schema.sql
     tamanhoGrupo: 3, elite: { vida: 2, ataque: 1.25 }, chefe: { vida: 3, ataque: 1.25 }, pergaminho: 90 },
  masmorras: [
    { id: 'toca', nome: 'Toca dos Lobos Sombrios', nivelMin: 5, area: 'floresta', elite: 'Urso Garra-Negra', chefe: 'Velgrath, Raiz do Medo',
      forca: { vida: 4, ataque: 8 },   // ataque 8 (era 4): o dano da Floresta caiu pela metade e a masmorra continua igual
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
  // Caçada contínua. Tempo de busca (ms) do monstro mais fraco ao mais forte da região: no começo da região
  // `tempoInicio` e, com a evolução, até `tempoFinal`. Rastreio = Velocidade + Sorte. A evolução na região vai de 0%
  // (rastreio igual ao de referência: velocidade do level mínimo da região + `sorteBase`) a 100% (`faixaEvolucao`
  // = +60% acima da referência). Chance: o mais fraco pesa 1 + `pesoFraco` (3x o mais forte) no começo; com a
  // evolução os pesos se igualam.
  CACADA: { tempoInicio: [2000, 2000], tempoFinal: [2000, 2000], sorteBase: 15, faixaEvolucao: 0.6, pesoFraco: 2,
    vidaMinima: 5, contagem: 3, pocaoAuto: [10, 5], historico: 10 },

  // Prêmios de login (Daniel, nov/2026): 1 vez por dia (vira às 00:00 de Brasília), os dias NÃO precisam ser seguidos.
  // semana: boas-vindas, 7 prêmios, um por dia de login, SÓ UMA VEZ por herói (depois fica só a trilha dos 30).
  // diario: o que todo login dá na trilha dos 30. trinta: marcos da trilha de 30 dias de login; depois do 30º recomeça.
  // Ouro da trilha: diário 30 x 100 + marcos 3.700 = 6.700 x level por volta (uns 200 mil no level 30).
  // Prêmio: ouroPorNivel (x level), reputacao, pergaminho {raridade, qtd}, item {raridade, tipo: 'arma' | 'armadura'}
  // (da classe do herói, do level dele; armadura sorteia elmo, peitoral, luvas ou botas).
  LOGIN: {
    semana: [
      { ouroPorNivel: 200 },
      { reputacao: 40 },
      { item: { tipo: 'arma', raridade: 'epica' }, pergaminho: { raridade: 'epica', qtd: 1 } },
      { ouroPorNivel: 300 },
      { item: { tipo: 'armadura', raridade: 'epica' } },
      { ouroPorNivel: 400 },
      { item: { tipo: 'arma', raridade: 'lendaria' }, pergaminho: { raridade: 'lendaria', qtd: 2 }, reputacao: 100 },
    ],
    diario: { ouroPorNivel: 100 },
    trinta: {
      7: { ouroPorNivel: 800 },
      14: { ouroPorNivel: 800, pergaminho: { raridade: 'epica', qtd: 2 } },
      21: { ouroPorNivel: 800, reputacao: 200 },
      30: { ouroPorNivel: 1300, item: { tipo: 'arma', raridade: 'lendaria' }, pergaminho: { raridade: 'epica', qtd: 2 } },
    },
  },

  // Missões diárias (renovam às 00:00 de Brasília) e semanais (renovam na segunda às 00:00).
  // evento: o que conta progresso | prêmio: ouroPorNivel (x level), reputacao, pergaminhoArma (da raridade da arma equipada).
  MISSOES: {
    diarias: [
      { id: 'd-cacar', nome: 'Caçador do dia', texto: 'Derrote 15 monstros nas caçadas', evento: 'abate', meta: 15, premio: { ouroPorNivel: 30 } },
      { id: 'd-encantar', nome: 'Martelo quente', texto: 'Tente encantar 3 vezes', evento: 'encantar', meta: 3, premio: { pergaminhoArma: 1 } },
      { id: 'd-arena', nome: 'Sangue na areia', texto: 'Lute 2 vezes na Arena', evento: 'arena', meta: 2, premio: { reputacao: 40 } },
      { id: 'd-masmorra', nome: 'Desbravador', texto: 'Vença 1 masmorra em grupo', evento: 'masmorra', meta: 1, premio: { ouroPorNivel: 50 } },
    ],
    bonusDiario: { pergaminhoArma: 1, reputacao: 60 },   // completar e resgatar todas as diárias
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
    nivelMin: 10, custoOuro: 6000, custoReputacao: 100,
    vagasIniciais: 15, vagasPorNivel: 3, maxOficiais: 3, nivelMax: 10,
    expProximo: [50000, 100000, 200000, 400000, 700000, 1000000, 1500000, 2000000, 3000000],   // Lv1->2 ... Lv9->10
    doacaoMinima: 100, esperaHoras: 24, liderSumidoDias: 14, ativoDias: 3, muralMax: 300,
    bonus: { custo: 20000, dias: 7, minimo: 5, maximo: 15 },   // (antigo: bônus de 7 dias; trocado pelas skills do clã)
    // Doação (Daniel, nov/2026): cada jogador doa no máximo `doacaoMaxDia` de ouro por dia (zera à meia-noite de Brasília).
    doacaoMaxDia: 3000,
    // Skills do clã (Daniel, nov/2026): compradas pelo líder com o ouro do tesouro e PERMANENTES para todos os membros.
    // O nível da skill nunca passa do nível do clã (clã nível 2 libera as skills nível 2). Preço do nível n = precos[n-1].
    // porNivel: quanto cada nível soma. Combate (dano, crítico, resistência, vida, velocidade, esquiva) vale só contra
    // monstros (caçada, masmorra e bosses), nunca na Arena. Ícones: assets/cla/skill-<id>.webp (sem a arte, um símbolo).
    skillPrecos: [25000, 40000, 65000, 100000, 150000, 225000, 325000, 475000, 700000, 1000000],
    skills: [
      { id: 'exp', nome: 'Sabedoria', simbolo: '📖', porNivel: 2, unidade: '% de exp', descricao: 'Mais exp na caçada.' },
      { id: 'ouro', nome: 'Cofre Cheio', simbolo: '💰', porNivel: 2, unidade: '% de ouro', descricao: 'Mais ouro na caçada.' },
      { id: 'dano', nome: 'Fúria do Clã', simbolo: '⚔', porNivel: 1.5, unidade: '% de dano', descricao: 'Mais dano contra monstros.' },
      { id: 'critico', nome: 'Olho de Águia', simbolo: '🎯', porNivel: 0.5, unidade: '% de chance de crítico', descricao: 'Mais chance de acerto crítico.' },
      { id: 'danoCritico', nome: 'Golpe Brutal', simbolo: '💥', porNivel: 3, unidade: '% de dano crítico', descricao: 'Críticos mais fortes.' },
      { id: 'resistencia', nome: 'Muralha', simbolo: '🛡', porNivel: 2, unidade: '% de defesa', descricao: 'Mais defesa e defesa mágica.' },
      { id: 'vida', nome: 'Vigor', simbolo: '❤', porNivel: 2, unidade: '% de vida', descricao: 'Mais vida máxima contra monstros.' },
      { id: 'velocidade', nome: 'Passo Ligeiro', simbolo: '💨', porNivel: 1, unidade: '% de velocidade', descricao: 'Ataca mais vezes.' },
      { id: 'esquiva', nome: 'Sombra Ágil', simbolo: '🌀', porNivel: 0.5, unidade: '% de esquiva', descricao: 'Desvia de mais golpes.' },
      { id: 'fortuna', nome: 'Fortuna', simbolo: '🍀', porNivel: 2, unidade: '% de chance de drop', descricao: 'Mais chance de itens caírem.' },
    ],
    // Missões do clã (Daniel, nov/2026): o progresso é a soma de todos os membros. Cumpriu: `ouro` vai para o tesouro,
    // x (1 + ouroPorNivel x (nível do clã - 1)). Semanais: além do ouro, `buff`% de dano contra o boss do clã até o fim
    // da semana (segunda 00:00, Brasília; somam: as 4 = +10%). Ouro pela metade e buff 10% no total (Daniel, nov/2026). tipo: monstros (caçada), encantar (tentativas na Forja), arena (lutas
    // atacando), masmorra (vitórias), bossCla (boss do clã derrotado; contado pelo servidor).
    missoesOuroPorNivel: 0.2,
    missoes: {
      diarias: [
        { tipo: 'monstros', meta: 1000, ouro: 3000, nome: 'Caçar 1.000 monstros' },
        { tipo: 'encantar', meta: 50, ouro: 2000, nome: 'Encantar 50 vezes' },
        { tipo: 'arena', meta: 50, ouro: 2000, nome: 'Lutar 50 vezes na Arena' },
        { tipo: 'masmorra', meta: 10, ouro: 2500, nome: 'Vencer 10 masmorras' },
      ],
      semanais: [
        { tipo: 'monstros', meta: 15000, ouro: 20000, buff: 2.5, nome: 'Caçar 15.000 monstros' },
        { tipo: 'encantar', meta: 500, ouro: 15000, buff: 2.5, nome: 'Encantar 500 vezes' },
        { tipo: 'arena', meta: 400, ouro: 15000, buff: 2.5, nome: 'Lutar 400 vezes na Arena' },
        { tipo: 'bossCla', meta: 4, ouro: 25000, buff: 2.5, nome: 'Derrotar o boss do clã 4 vezes' },
      ],
    },
    // O jogo manda o progresso em lotes; o servidor aceita no máximo isto por envio (contra exageros).
    missoesMaxEnvio: { monstros: 300, encantar: 40, arena: 10, masmorra: 5 },
    brasao: {
      formas: ['classico', 'redondo', 'pontudo', 'estandarte'],
      cores: ['#8e1b1b', '#1f4f8e', '#2d6b34', '#5b2a86', '#b8860b', '#2b2b2b', '#7a3e12', '#1f6b6b'],
      simbolos: ['dragao', 'lobo', 'coroa', 'caveira', 'espada', 'machado', 'olho', 'chama'],
    },
  },

  // ---------- Boss da aliança (Daniel, nov/2026) ----------
  // Um boss por dia para cada aliança. O líder escolhe a hora (0 a 23, horário de Brasília) e o boss abre sozinho
  // todo dia nessa hora, por `duracaoMin` minutos. Ataques ilimitados enquanto estiver aberto, sozinho ou em grupo
  // de até `grupoMax` membros da aliança. Cada investida é uma luta como a da masmorra (vida própria, sem poções)
  // que acaba quando o grupo cai ou quando o boss atacar `limiteAtaques` vezes; o dano fica no boss (vida de todos).
  // Morreu: sobe 1 nível e todos que deram dano ganham prêmio. Não morreu na hora: no dia seguinte é o mesmo boss,
  // com a vida cheia de novo.
  // Nível do boss: a cada `niveisPorChefe` níveis ele vira o chefe seguinte da lista (mais forte); dentro do mesmo
  // chefe a vida cresce `vidaPorNivel` por nível. Depois do último chefe, a vida e o ataque continuam crescendo.
  // Vida = vida do chefe da caçada x `vida` x vidaPorNivel^(nível dentro do chefe).
  // Estes números também vão para o banco (tanka_dados): depois de mudar, rode ferramentas/gerar_dados_sql.js e o schema.
  BOSS_ALIANCA: {
    duracaoMin: 60, grupoMax: 4, limiteAtaques: 25,
    // chefes: de quem vêm os números (vida, ataque, defesa, prêmio) de cada fase; bosses: quem aparece no jogo
    // (nome, descrição e imagem próprios, "Os Libertos"), na mesma ordem.
    // area (Daniel, nov/2026: a partir do 2º boss, para valorizar o Curandeiro): a cada `cada` ataques do boss, um golpe
    // que acerta TODOS os heróis vivos e tira `vidaPct`% da vida máxima de cada um (no lugar do ataque normal; a defesa
    // não reduz, a esquiva evita). Calibrado: sem Curandeiro ~3 dos 4 caem e o dano cai; com Curandeiro ~0–1 cai e o
    // grupo faz ~10–25% mais dano.
    chefes: ['varnok', 'guardiao', 'farao', 'vharkesh', 'ignaroth'], niveisPorChefe: 3,
    bosses: [
      { id: 'boss-thalgor', nome: 'Thalgor, o Carcereiro de Ferro',
        descricao: 'O gigante de ferro que vigiava as prisões dos selos. Enlouqueceu quando o primeiro selo rachou.' },
      { id: 'boss-nyxara', area: { nome: 'Chuva de Teias Venenosas', cada: 5, vidaPct: 60 },
        feminino: true, nome: 'Nyxara, a Rainha das Aranhas Sombrias',
        descricao: 'Metade elfa sombria, metade aranha gigante. Tece suas teias nas ruínas embaixo de Dravenhold.' },
      { id: 'boss-sylvaris', area: { nome: 'Sopro Congelante', cada: 5, vidaPct: 60 },
        feminino: true, nome: 'Sylvaris, a Hidra das Brumas',
        descricao: 'Hidra de três cabeças que dormia no fundo do pântano. Uma das cabeças sopra névoa congelante.' },
      { id: 'boss-korvath', area: { nome: 'Ceifada de Cinzas', cada: 5, vidaPct: 65 },
        nome: 'Korvath, o Ceifador de Cinzas',
        descricao: 'Morto-vivo gigante com uma foice em brasa. Colhe as almas dos campos de batalha queimados.' },
      { id: 'boss-azhgar', area: { nome: 'Maré do Abismo', cada: 5, vidaPct: 70 },
        nome: 'Azhgar, o Titã do Abismo',
        descricao: 'Colosso de obsidiana e vazio, preso por correntes de luz. Veio do outro lado do mar, onde dorme o oitavo selo.' },
    ],
    vida: 45, vidaPorNivel: 1.3, ataque: 1, ataquePorNivelExtra: 0.05,
    titulos: ['', 'Desperto', 'Furioso'],
    // Prêmios quando o boss morre (para quem deu dano naquele dia). ouro e exp: o ouro e a exp do chefe na caçada
    // vezes estes números, +`porNivel` (25%) a cada nível dentro do chefe; a exp do herói fica limitada a `expMaxPct`%
    // da exp do level dele. alianca: exp da aliança = ouro do prêmio x este número.
    // pergaminho: quantos cada um ganha; a raridade melhora com o chefe (índice do chefe na lista).
    // item: quem deu mais dano ganha 1 item (arma, armadura ou mão esquerda) com estas chances.
    // Calibrado (simulação): grupo de 4 no level do chefe vence o 1º nível de cada chefe com ~10 a 18 investidas.
    premio: {
      ouro: 10, exp: 5, porNivel: 0.25, expMaxPct: 20, alianca: 2,
      pergaminho: { qtd: 2, raridade: ['comum', 'rara', 'rara', 'epica', 'epica'] },
      item: [{ raridade: 'lendaria', chance: 10 }, { raridade: 'epica', chance: 90 }],
    },
  },

  // Pergaminho do Recomeço: devolve todos os pontos de atributo para distribuir de novo.
  RECOMECO: { nome: 'Pergaminho do Recomeço', precoOuro: 2000 },
  // Troca de pergaminhos de encantamento no Mercado: 10 de uma raridade = 1 da seguinte (comum → rara → épica → lendária).
  // ouro: preço para receber 1 da raridade (Henri, 13/11/2026).
  TROCA_PERGAMINHO: { quantidade: 10, ouro: { rara: 1000, epica: 10000, lendaria: 100000 } },
  // ---------- Leilão do servidor (Mercado > Leilão) ----------
  // Uma rodada por faixa de level, sempre rodando: dura `duracaoMin` e, quando acaba, outra começa com itens novos.
  // 12 lotes: 1 arma e 1 armadura de cada classe base, 2 joias (colar/anel) e 2 pacotes de pergaminho.
  // Garantias: pelo menos 1 arma épica, 1 armadura épica e 1 joia rara (ou melhor) por rodada.
  // Lance mínimo = `minimo[raridade]` x `mult` da faixa; cada lance novo é pelo menos +`incrementoPct`%.
  // Tempo mostrado por fase (como "Muito longo"), nunca o relógio exato; a fase "Muito curto" começa num ponto
  // sorteado entre 1 e 4 minutos antes do fim. Tudo é sorteado e cobrado no servidor (supabase/schema.sql, leilao_*);
  // o item de cada lote é gerado no jogo a partir da `semente` (R.itemDoLote), igual para todo mundo.
  // Ouro por hora de caçada medido em simulação: 10–19 ~10–25 mil; 20–29 ~100–240 mil; 30+ ~200 mil–1,3 milhão.
  LEILAO: {
    nivelMin: 10, duracaoMin: 240, incrementoPct: 5, muitoCurto: [1, 4],
    fases: [{ id: 'muitoLongo', nome: 'Muito longo', acimaMin: 180 }, { id: 'longo', nome: 'Longo', acimaMin: 60 },
      { id: 'medio', nome: 'Médio', acimaMin: 20 }, { id: 'curto', nome: 'Curto', acimaMin: 0 }],
    nomeMuitoCurto: 'Muito curto',
    minimo: { comum: 1000, rara: 5000, epica: 10000, lendaria: 50000 },
    pacotePergaminho: { comum: 10, rara: 5, epica: 3, lendaria: 1 },
    faixas: [
      { id: 'l1', nome: 'Leilão do Mercador', nivel: [10, 19], mult: 1, itemNivel: [18, 22],
        raridades: { comum: 30, rara: 45, epica: 22, lendaria: 3 } },
      { id: 'l2', nome: 'Leilão da Coroa', nivel: [20, 29], mult: 10, itemNivel: [28, 32],
        raridades: { comum: 15, rara: 45, epica: 32, lendaria: 8 } },
      { id: 'l3', nome: 'Leilão dos Reis', nivel: [30, 999], mult: 40, itemNivel: [42, 50],
        raridades: { comum: 0, rara: 35, epica: 45, lendaria: 20 } },
    ],
  },

  SKINS_DADO: [
    { id: 'vermelho', nome: 'Rubi', preco: 0 },
    { id: 'azul', nome: 'Safira', preco: 500 },
    { id: 'dourada', nome: 'Ouro Real', preco: 1500 },
    { id: 'obsidiana', nome: 'Obsidiana', preco: 3000 },
    { id: 'dragao', nome: 'Dragão Cinzento', preco: 5000 },
    // Prêmio do último capítulo da História (não se compra).
    { id: 'selos', nome: 'Sete Selos', preco: 0, historia: true },
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
  // 5% de arma com 70/22/7/1 de qualidade = comum 3,5%, rara 1,1%, épica 0,35%, lendária 0,05%.
  function tabelaDrop(chance) {
    if (!chance) return [];
    return D.DROPS_CACADA.qualidade.map(function (q) { return { raridade: q.raridade, chance: chance * q.chance / 100 }; });
  }
  D.areas.forEach(function (area, indiceArea) {
    var b = area.base, c0 = area.crescimento || D.crescimento;
    if (indiceArea > 0) { vel *= M.entreAreas; def *= M.entreAreas; }
    var velHeroi = D.VELOCIDADE.inicial * Math.pow(D.VELOCIDADE.porNivel, area.nivelMin - 1), velNova;
    area.monstros.forEach(function (m, i) {
      if (i > 0) { vel *= M.velocidadePorMonstro; def *= M.defesaPorMonstro; }
      velNova = Math.max(1, Math.round(velHeroi * M.velocidadeHeroi[i]));
      var f = Math.pow(2, i);
      var ataque = Math.round(b.ataque * Math.pow(c0.ataque, i));
      var dc = D.DROPS_CACADA.monstros[i] || {};
      D.monstros[m.id] = {
        nome: m.nome, descricao: m.descricao, area: area.id, indiceArea: indiceArea,
        hp: Math.round(b.hp * f * (area.ajusteVida || 1)), ataque: m.dano ? m.dano.slice() : [ataque, ataque], velocidade: velNova,
        ataqueCacada: m.danoCacada ? m.danoCacada.slice() : null,   // dano na caçada (vida cheia a cada luta); `ataque` vale na masmorra e nos bosses
        defesa: Math.max(1, Math.round(def)), defesaMagica: Math.max(1, Math.round(def)), exp: Math.round(b.exp * M.expMonstros[i]), ouro: area.ouro[i],
        // Tabelas no formato { raridade, chance } (cumulativas): chance do drop x qualidade (DROPS_CACADA).
        chanceArma: dc.arma || 0, chanceArmadura: dc.armadura || 0,
        drops: tabelaDrop(dc.arma), dropsArmadura: tabelaDrop(dc.armadura), dropsItem: [],
        // pergaminho: { chance, qualidade: true } = raridade sorteada pela tabela de qualidade
        pergaminho: dc.pergaminho ? { chance: dc.pergaminho, qualidade: true } : null,
        imagem: arquivo(m.nome),
      };
    });
    var m3 = D.monstros[area.monstros[2].id], c = area.chefe, C = D.chefe;
    D.monstros[c.id] = {
      nome: c.nome, descricao: c.descricao, area: area.id, indiceArea: indiceArea, chefe: true,
      ataqueCacada: c.danoCacada ? c.danoCacada.slice() : null,
      hp: Math.round(m3.hp * C.vida), ataque: c.dano ? c.dano.slice() : [Math.round(m3.ataque[0] * C.ataque), Math.round(m3.ataque[1] * C.ataque)],
      velocidade: Math.max(1, Math.round(velNova * C.velocidade)), defesa: Math.round(m3.defesa * C.defesa), defesaMagica: Math.round(m3.defesa * C.defesa),
      // `ouro` e `exp` no chefe da área substituem a conta (5x o 3º monstro).
      exp: c.exp != null ? c.exp : m3.exp * C.exp, ouro: c.ouro != null ? c.ouro : m3.ouro * C.ouro,
      drops: [], dropsArmadura: [], dropsItem: [],
      // Drop e pergaminho: iguais para todos os chefes (D.chefe.drop / D.chefe.pergaminho).
      imagem: arquivo(c.nome),
    };
  });
  // Bosses da aliança ("Os Libertos"): números do chefe da caçada de cada fase, com nome, descrição e imagem próprios.
  D.BOSS_ALIANCA.bosses.forEach(function (b, i) {
    var base = D.monstros[D.BOSS_ALIANCA.chefes[i]];
    D.monstros[b.id] = Object.assign({}, base, { nome: b.nome, descricao: b.descricao, area: null, bossAlianca: true,
      imagem: 'assets/monstros/' + b.id + '.jpg' });
  });
  // Chefe Mundial: o Ignaroth com a imagem do evento (o da caçada continua com a dele).
  D.monstros['ignaroth-mundial'] = Object.assign({}, D.monstros.ignaroth, { area: null, imagem: 'assets/monstros/boss-mundial.jpg' });
})(Tanka.dados);
