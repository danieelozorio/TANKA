// Proposta v2: "Constelação da Ascensão" (depois do level máximo). Números de SUGESTÃO.
// 6 domínios × 2 trilhas = 12 trilhas; cada trilha termina numa Pedra Angular (efeito forte com um custo).
// As duas Pedras de um mesmo domínio se excluem; no máximo 3 Pedras por herói; pontos não dão para tudo.
module.exports = {
  nivelInicio: 40,           // a árvore abre no level 40
  pontosPorNivel: 1,         // 1 ponto por level do 41 ao 60; depois do 60, pela exp
  limitePontos: 70,          // pontos máximos de Ascensão (o herói nunca completa a árvore)
  maxPedras: 3,              // Pedras Angulares ativas ao mesmo tempo
  custo: { pequeno: 1, notavel: 2, ponte: 2, pedra: 4 },
  dominios: [
    { id: 'furia', nome: 'Fúria', cor: '#e04a3c', ico: '⚔', tema: 'Dano', tronco: '+2% de dano',
      trilhas: [
        { nome: 'Carniceiro', pequeno: '+2% de dano', notavel: { nome: 'Golpe Pesado', txt: '+6% de dano, −3% de precisão' },
          pedra: { nome: 'Sede de Sangue', ico: '🩸', txt: '+25% de dano', custo: '−15% de vida máxima' } },
        { nome: 'Executor', pequeno: '+3% de dano contra chefes', notavel: { nome: 'Sem Piedade', txt: '+10% de dano em quem tem menos da metade da vida' },
          pedra: { nome: 'Execução', ico: '🪓', txt: '+40% de dano em quem tem menos de 30% da vida', custo: '−10% de dano em quem está com a vida cheia' } },
      ] },
    { id: 'precisao', nome: 'Precisão', cor: '#f0c24a', ico: '🎯', tema: 'Crítico', tronco: '+1% de crítico',
      trilhas: [
        { nome: 'Olho de Falcão', pequeno: '+1% de crítico', notavel: { nome: 'Mira Firme', txt: '+3% de crítico, +5 de precisão' },
          pedra: { nome: 'Golpe Certeiro', ico: '🏹', txt: 'Todo 4º golpe é crítico garantido', custo: 'Críticos fora dele causam −20% de dano' } },
        { nome: 'Lâmina Fina', pequeno: '+4% de dano crítico', notavel: { nome: 'Corte Profundo', txt: '+12% de dano crítico' },
          pedra: { nome: 'Ferida Aberta', ico: '🗡', txt: 'Crítico faz sangrar: 30% do golpe a mais em 3 turnos', custo: '−2% de chance de crítico' } },
      ] },
    { id: 'bastiao', nome: 'Bastião', cor: '#9fb4c8', ico: '🛡', tema: 'Defesa', tronco: '+2% de defesa',
      trilhas: [
        { nome: 'Muralha', pequeno: '+3% de defesa', notavel: { nome: 'Pele de Ferro', txt: '+8% de defesa e +4% de defesa mágica' },
          pedra: { nome: 'Inabalável', ico: '🏰', txt: '−15% de dano recebido; abaixo de 30% da vida, +25% de defesa', custo: '−10% de velocidade' } },
        { nome: 'Espinhos', pequeno: '+2% de defesa mágica', notavel: { nome: 'Farpas', txt: 'Devolve 5% do dano recebido' },
          pedra: { nome: 'Couraça de Espinhos', ico: '🌵', txt: 'Devolve 20% do dano recebido', custo: '−8% de dano' } },
      ] },
    { id: 'vigor', nome: 'Vigor', cor: '#4fbf62', ico: '❤', tema: 'Vida e cura', tronco: '+2% de vida',
      trilhas: [
        { nome: 'Sangue Vivo', pequeno: '+3% de vida', notavel: { nome: 'Coração Forte', txt: '+8% de vida' },
          pedra: { nome: 'Regeneração', ico: '🌿', txt: 'Cura 3% da vida a cada turno', custo: 'Poções curam 50% menos' } },
        { nome: 'Vampiro', pequeno: '+1% de roubo de vida', notavel: { nome: 'Presas', txt: '+3% de roubo de vida' },
          pedra: { nome: 'Sede Eterna', ico: '🦇', txt: '+10% de roubo de vida', custo: 'Não pode usar poção' } },
      ] },
    { id: 'tempestade', nome: 'Tempestade', cor: '#7b8cff', ico: '⚡', tema: 'Velocidade e habilidades', tronco: '+1% de velocidade',
      trilhas: [
        { nome: 'Relâmpago', pequeno: '+2% de velocidade', notavel: { nome: 'Passo Ligeiro', txt: '+5% de velocidade, +3 de evasão' },
          pedra: { nome: 'Primeiro Golpe', ico: '🌩', txt: 'Começa a luta com a barra de ataque cheia e o 1º golpe tem +40% de dano', custo: '−10% de vida máxima' } },
        { nome: 'Arcano', pequeno: '+3% de dano das habilidades', notavel: { nome: 'Foco', txt: 'Habilidades recarregam 1 turno mais rápido' },
          pedra: { nome: 'Eco', ico: '🔮', txt: 'Habilidades têm 25% de chance de sair 2 vezes', custo: 'Ataque normal −10% de dano' } },
      ] },
    { id: 'fortuna', nome: 'Fortuna', cor: '#e8963a', ico: '💰', tema: 'Ouro, drop e exp', tronco: '+3% de ouro',
      trilhas: [
        { nome: 'Saqueador', pequeno: '+4% de ouro', notavel: { nome: 'Bolsos Fundos', txt: '+4% de chance de drop' },
          pedra: { nome: 'Mão Dourada', ico: '🪙', txt: '+35% de ouro e +10% de drop', custo: '−15% de exp' } },
        { nome: 'Erudito', pequeno: '+3% de exp', notavel: { nome: 'Estudioso', txt: '+8% de exp' },
          pedra: { nome: 'Sabedoria', ico: '📖', txt: '+25% de exp; quando a exp não serve mais (pontos no limite), vira +20% de drop', custo: '−15% de ouro' } },
      ] },
  ],
  // Encruzilhadas: entre domínios vizinhos, duas pontes (perto e longe do centro), cada uma com metade de cada tema.
  pontes: {
    'furia-precisao': ['+1% de dano e +1% de crítico', '+3% de dano e +4% de dano crítico'],
    'precisao-bastiao': ['+1% de crítico e +2% de defesa', 'Crítico recebido −10%'],
    'bastiao-vigor': ['+2% de defesa e +2% de vida', '+5% de vida e +5% de defesa'],
    'vigor-tempestade': ['+2% de vida e +1% de velocidade', 'Cura 5% da vida ao usar habilidade'],
    'tempestade-fortuna': ['+1% de velocidade e +2% de ouro', '+4% de exp e +4% de ouro'],
    'fortuna-furia': ['+2% de ouro e +1% de dano', '+5% de dano contra monstros da caçada'],
  },
};
