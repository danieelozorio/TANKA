// Eldrin — A Crônica de Eldrin: "Os Sete Selos" (Aventura > História).
// Só texto e números da história; as regras ficam em regras.js (historia*) e a tela em app.js (abaHistoria).
// Não trava regiões: cada capítulo só pede o level da região dele (o mesmo que libera a caça lá).
//
// Falas: { quem, texto }. quem = 'narrador', um personagem de PERSONAGENS (retrato em assets/historia/<id>.webp)
// ou o id de um monstro (usa o retrato do monstro).
// Objetivos: { tipo: 'abate', area, qtd } = vencer criaturas comuns da região (chefe não conta);
//            { tipo: 'chefe', monstro }   = derrotar o chefe da região na caçada;
//            { tipo: 'masmorra', masmorra } = vencer a masmorra (em grupo ou com mercenários).
// Prêmio: ouro, expPct (% da exp do level atual), pergaminho {raridade, qtd}, item {tipo, raridade}, titulo, skin.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};
Tanka.dados = Tanka.dados || {};

Tanka.dados.HISTORIA = {
  nome: 'A Crônica de Eldrin',
  subtitulo: 'Os Sete Selos',
  PERSONAGENS: {
    aldric: { nome: 'Mestre Aldric', descricao: 'Velho guardião dos Sete Selos.' },
    kael: { nome: 'Kael', descricao: 'O aprendiz que Aldric perdeu.' },
    capuz: { nome: 'O Homem de Capuz Carmesim', descricao: 'Ninguém viu o rosto dele.' },
  },
  capitulos: [
    {
      id: 'c1', area: 'floresta', titulo: 'O Despertar',
      abertura: [
        { quem: 'narrador', texto: 'Há mil anos, o demônio de fogo Ignaroth quase reduziu Eldrin a cinzas. Sete guardiões o prenderam no coração do vulcão com sete selos, e cada selo foi escondido numa terra diferente.' },
        { quem: 'narrador', texto: 'Hoje os lobos da Floresta Sombria uivam ao meio-dia, e a névoa cheira a fumaça.' },
        { quem: 'aldric', texto: 'Você chegou na hora certa, jovem. Sou Aldric, o último guardião dos selos. Algo está envenenando esta floresta… os animais enlouqueceram.' },
        { quem: 'aldric', texto: 'Acalme as feras e encontre Velgrath, a árvore mais antiga do reino. Se ela adoeceu, o primeiro selo corre perigo.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'floresta', qtd: 20 },
        { tipo: 'chefe', monstro: 'velgrath' },
        { tipo: 'masmorra', masmorra: 'toca' },
      ],
      fechamento: [
        { quem: 'velgrath', texto: 'Ahhh… o espinho… tirem… o espinho…' },
        { quem: 'narrador', texto: 'Cravado no tronco apodrecido, você encontra um espinho negro, quente como brasa. Ao arrancá-lo, a névoa da floresta clareia pela primeira vez em semanas.' },
        { quem: 'aldric', texto: 'Um Espinho Negro… isto não nasce na natureza. Alguém o fincou aqui de propósito para rachar o selo. Os rastros seguem para o pântano.' },
      ],
      premio: { ouro: 500, expPct: 40 },
    },
    {
      id: 'c2', area: 'pantano', titulo: 'A Névoa que Sussurra',
      abertura: [
        { quem: 'narrador', texto: 'No Pântano de Brumafria, a névoa gelada fala com voz de gente. Os viajantes dizem que ela chama pelo nome quem se perde.' },
        { quem: 'aldric', texto: 'Morgath vive aqui. Era uma curandeira, antes de aprender a ouvir a névoa. Se alguém anda colhendo espinhos negros, ela sabe quem é.' },
        { quem: 'morgath', texto: 'Hihihi… mais um herói de botas limpas. Meu brejo vai gostar de você.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'pantano', qtd: 25 },
        { tipo: 'chefe', monstro: 'morgath' },
        { tipo: 'masmorra', masmorra: 'ninho' },
      ],
      fechamento: [
        { quem: 'morgath', texto: 'Está bem, está bem! Eu só plantava os espinhos… ele me pagava em ouro vermelho. Um homem de capuz carmesim. Nunca vi o rosto dele.' },
        { quem: 'morgath', texto: 'Ele falava de um reino caído… de um mapa… e ria. Ria como quem já ganhou.' },
        { quem: 'aldric', texto: 'Um reino caído… Dravenhold. Se o mapa dos selos ainda existe, está lá. Precisamos chegar antes dele.' },
      ],
      premio: { ouro: 1500, expPct: 40 },
    },
    {
      id: 'c3', area: 'ruinas', titulo: 'O Reino que Caiu',
      abertura: [
        { quem: 'narrador', texto: 'Dravenhold já foi a cidade mais rica de Eldrin. Numa única noite virou pó, e seus mortos nunca aprenderam a descansar.' },
        { quem: 'aldric', texto: 'O rei de Dravenhold quis o poder do selo para si. Abriu uma fresta, só uma… e o fogo que saiu por ela engoliu o reino inteiro.' },
        { quem: 'aldric', texto: 'O mago da corte, Varnok, guardava o mapa dos sete selos. Dizem que ele ainda guarda, mesmo depois de morto.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'ruinas', qtd: 30 },
        { tipo: 'chefe', monstro: 'varnok' },
        { tipo: 'masmorra', masmorra: 'catacumbas' },
      ],
      fechamento: [
        { quem: 'varnok', texto: 'Tolo… o homem de capuz já esteve aqui. Copiou o mapa com sangue. Eu não pude impedir. Ninguém pode.' },
        { quem: 'narrador', texto: 'Entre os ossos do Lich, você encontra o mapa original: sete marcas de fogo sobre Eldrin. Três delas já estão apagadas.' },
        { quem: 'aldric', texto: 'Três selos rachados… e a próxima marca brilha sobre a Torre Carmesim. Os cultistas não guardam aquela torre à toa.' },
      ],
      premio: { ouro: 3000, expPct: 40, pergaminho: { raridade: 'rara', qtd: 2 } },
    },
    {
      id: 'c4', area: 'torre', titulo: 'O Culto Vermelho',
      abertura: [
        { quem: 'narrador', texto: 'A Torre Carmesim pulsa como um coração. Lá dentro, cultistas cantam o nome de Ignaroth dia e noite.' },
        { quem: 'capuz', texto: 'Então você é o herói do velho. Chegou tarde. Meus irmãos já preparam o quarto selo para queimar.' },
        { quem: 'aldric', texto: 'Essa voz… não pode ser.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'torre', qtd: 30 },
        { tipo: 'chefe', monstro: 'guardiao' },
        { tipo: 'masmorra', masmorra: 'biblioteca' },
      ],
      fechamento: [
        { quem: 'narrador', texto: 'No alto da torre, o homem de capuz carmesim vira para você e, enfim, mostra o rosto.' },
        { quem: 'kael', texto: 'Olá, mestre. Sentiu saudade? Você me ensinou que os selos protegem Eldrin. Mentira. Eles só prendem o maior poder que este mundo já viu.' },
        { quem: 'aldric', texto: 'Kael… meu aprendiz. Eu te procurei por dez anos. Achei que tinha morrido no incêndio da escola.' },
        { quem: 'kael', texto: 'O garoto morreu, sim. Quando Ignaroth for livre, vocês vão entender. Até lá… não me sigam.' },
      ],
      premio: { ouro: 6000, expPct: 40, item: { tipo: 'arma', raridade: 'epica' } },
    },
    {
      id: 'c5', area: 'areias', titulo: 'O Império Engolido',
      abertura: [
        { quem: 'narrador', texto: 'As Areias Rubras não são vermelhas por acaso. Cada grão é cinza de um império que Ignaroth queimou na primeira guerra.' },
        { quem: 'aldric', texto: 'O Faraó daquele império foi o primeiro guardião. Ele ofereceu o próprio nome para fechar o selo… por isso ninguém lembra como ele se chamava.' },
        { quem: 'aldric', texto: 'Se Kael chegou até a tumba, o Faraó pode ter acordado. E um guardião acordado sem memória é a coisa mais perigosa do deserto.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'areias', qtd: 35 },
        { tipo: 'chefe', monstro: 'farao' },
        { tipo: 'masmorra', masmorra: 'tumba' },
      ],
      fechamento: [
        { quem: 'farao', texto: 'Eu… lembro agora. Meu nome era Amenreth. Eu jurei guardar este selo até o fim das areias.' },
        { quem: 'narrador', texto: 'O Faraó toca a sua testa com a mão seca. Por um instante você vê o império em chamas, e um dragão enorme lutando AO LADO dos homens.' },
        { quem: 'aldric', texto: 'Os dragões já foram nossos aliados… Se Kael envenenou Vhar\'kesh, ele vai usar o dragão contra nós. Para o Vale, rápido.' },
      ],
      premio: { ouro: 10000, expPct: 40, pergaminho: { raridade: 'epica', qtd: 1 } },
    },
    {
      id: 'c6', area: 'vale', titulo: 'O Último Pacto',
      abertura: [
        { quem: 'narrador', texto: 'No Vale dos Dragões, as rochas ainda guardam as marcas das garras da primeira guerra. Hoje os dragões atacam qualquer um que se aproxime.' },
        { quem: 'kael', texto: 'Lindo, não é? O velho Vhar\'kesh bebeu do meu espinho negro. Agora ele só obedece ao fogo. Vamos ver quanto tempo o herói do mestre dura.' },
        { quem: 'aldric', texto: 'Não lute para matar. Lute para tirar o espinho. Vhar\'kesh fez o pacto com os guardiões, mil anos atrás.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'vale', qtd: 40 },
        { tipo: 'chefe', monstro: 'vharkesh' },
        { tipo: 'masmorra', masmorra: 'covil' },
      ],
      fechamento: [
        { quem: 'vharkesh', texto: 'Pequeno guerreiro… você me tirou da escuridão. Eu me lembro do pacto. Os dragões voarão com você até o fim.' },
        { quem: 'vharkesh', texto: 'Mas escute: o garoto não quer libertar Ignaroth. Ele quer SER Ignaroth. Quando o último selo cair, os dois serão um só.' },
        { quem: 'aldric', texto: 'Então ainda há um jeito de salvar Eldrin… e talvez de salvar Kael. Ao Cume do Fogo Eterno.' },
      ],
      premio: { ouro: 15000, expPct: 40, pergaminho: { raridade: 'epica', qtd: 2 } },
    },
    {
      id: 'c7', area: 'cume', titulo: 'A Chama Eterna',
      abertura: [
        { quem: 'narrador', texto: 'O topo do vulcão treme. A lava sobe pelas rachaduras dos selos quebrados, e o céu de Eldrin fica vermelho como sangue.' },
        { quem: 'kael', texto: 'Você chegou! Que bom. Quero que o mestre veja: o fogo vai me dar tudo o que os selos me tiraram.' },
        { quem: 'ignaroth', texto: 'MIL ANOS… MIL ANOS NO ESCURO. DÊ-ME O SEU CORPO, CRIANÇA, E EU DAREI O MUNDO.' },
        { quem: 'aldric', texto: 'Segure Ignaroth o quanto puder. Eu cuido do último selo. Não olhe para trás.' },
      ],
      objetivos: [
        { tipo: 'abate', area: 'cume', qtd: 50 },
        { tipo: 'chefe', monstro: 'ignaroth' },
        { tipo: 'masmorra', masmorra: 'coracao' },
      ],
      fechamento: [
        { quem: 'narrador', texto: 'Ignaroth cai de joelhos. Kael é arrancado das chamas, desmaiado mas vivo. Aldric caminha até o centro da lava com o último selo nas mãos.' },
        { quem: 'aldric', texto: 'Cuide do meu aprendiz, guardião. Agora os selos são seus.' },
        { quem: 'narrador', texto: 'Uma luz branca cobre o cume. Quando ela se apaga, Aldric não está mais lá, e o vulcão dorme em silêncio pela primeira vez em mil anos.' },
        { quem: 'kael', texto: '…Mestre? Onde ele está? O que foi que eu fiz?' },
        { quem: 'narrador', texto: 'Epílogo: na manhã seguinte, uma oitava marca aparece no mapa dos selos, longe, além do mar. Ninguém em Eldrin sabia que existia um oitavo selo.' },
      ],
      premio: { ouro: 25000, expPct: 40, titulo: 'Guardião dos Selos', tituloF: 'Guardiã dos Selos', skin: 'selos' },
    },
  ],
};
