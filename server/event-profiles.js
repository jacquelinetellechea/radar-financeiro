/**
 * Modulo "Perfis Inteligentes de Eventos"
 * Gerencia perfis configuráveis de eventos com itens de alimentação,
 * bebidas, decoração, materiais, equipe, checklist, cronograma e fórmulas.
 * Também gerencia a Biblioteca de Modelos.
 */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Perfis padrão de exemplo ----------
function defaultProfiles() {
  return [
    {
      id: genId(), name: 'Casamento', isDefault: true, active: true,
      color: '#B9502C', icon: '💍',
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 15, perChild: 8, notes: '' },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 8, perChild: 5, notes: '' },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Bem-casados', unit: 'unidade', perAdult: 1, perChild: 1, notes: '' }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild: 0.4, notes: '' },
        { id: genId(), name: 'Espumante', unit: 'garrafa', perAdult: 0.3, perChild: 0, notes: 'Brinde' },
        { id: genId(), name: 'Cerveja', unit: 'lata', perAdult: 3, perChild: 0, notes: '' }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '1 por mesa' },
        { id: genId(), name: 'Arranjos', unit: 'unidade', formula: 'fixed', formulaFactor: 2, notes: '' },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '1 por mesa' },
        { id: genId(), name: 'Painéis', unit: 'unidade', formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Flores', unit: 'arranjo', formula: 'fixed', formulaFactor: 5, notes: '' }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', perAdult: 3, perChild: 2, notes: '' },
        { id: genId(), name: 'Pratos', unit: 'unidade', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Talheres', unit: 'conjunto', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', perAdult: 5, perChild: 5, notes: '' }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, suggestedQty: 1, formula: 'per50guests', formulaFactor: 1, notes: '1 a cada 50 convidados' },
        { id: genId(), name: 'Bartender', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'DJ', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Mestre de cerimônias', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      checklist: [
        { id: genId(), text: 'Definir data e local', category: 'Planejamento', daysBeforeEvent: 365 },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 180 },
        { id: genId(), text: 'Contratar fotógrafo', category: 'Fornecedores', daysBeforeEvent: 180 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 60 },
        { id: genId(), text: 'Confirmar lista de convidados', category: 'Convidados', daysBeforeEvent: 30 },
        { id: genId(), text: 'Confirmar fornecedores', category: 'Fornecedores', daysBeforeEvent: 15 },
        { id: genId(), text: 'Reunião final com equipe', category: 'Organização', daysBeforeEvent: 7 }
      ],
      schedule: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 365 },
        { id: genId(), text: 'Fechar orçamentos principais', category: 'Financeiro', daysBeforeEvent: 180 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 60 },
        { id: genId(), text: 'Degustação do cardápio', category: 'Alimentação', daysBeforeEvent: 45 },
        { id: genId(), text: 'Confirmar quantidade de convidados', category: 'Convidados', daysBeforeEvent: 30 },
        { id: genId(), text: 'Montagem da decoração', category: 'Decoração', daysBeforeEvent: 1 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Festa de 15 anos', isDefault: false, active: true,
      color: '#8B5CF6', icon: '🎂',
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 12, perChild: 8, notes: '' },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 6, perChild: 5, notes: '' },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild: 2, notes: '' }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild: 0.4, notes: '' },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild: 0.3, notes: '' }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Balões', unit: 'unidade', formula: 'fixed', formulaFactor: 50, notes: '' },
        { id: genId(), name: 'Painel da aniversariante', unit: 'unidade', formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', perAdult: 3, perChild: 2, notes: '' },
        { id: genId(), name: 'Pratos', unit: 'unidade', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', perAdult: 5, perChild: 5, notes: '' }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, suggestedQty: 1, formula: 'per50guests', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'DJ', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      checklist: [
        { id: genId(), text: 'Definir tema da festa', category: 'Planejamento', daysBeforeEvent: 180 },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 120 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45 },
        { id: genId(), text: 'Confirmar lista de convidados', category: 'Convidados', daysBeforeEvent: 20 }
      ],
      schedule: [
        { id: genId(), text: 'Definir tema e local', category: 'Planejamento', daysBeforeEvent: 180 },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 90 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45 },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Aniversário Infantil', isDefault: false, active: true,
      color: '#F59E0B', icon: '🎈',
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 10, perChild: 8, notes: '' },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 5, perChild: 6, notes: '' },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Pipoca', unit: 'porção', perAdult: 0, perChild: 1, notes: '' }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.4, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild: 0.4, notes: '' }
      ],
      decor: [
        { id: genId(), name: 'Balões', unit: 'unidade', formula: 'fixed', formulaFactor: 100, notes: '' },
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Painel temático', unit: 'unidade', formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Pratos', unit: 'unidade', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', perAdult: 4, perChild: 5, notes: '' }
      ],
      team: [
        { id: genId(), name: 'Recreacionista', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      checklist: [
        { id: genId(), text: 'Definir tema', category: 'Planejamento', daysBeforeEvent: 60 },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 30 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 21 }
      ],
      schedule: [
        { id: genId(), text: 'Definir tema e local', category: 'Planejamento', daysBeforeEvent: 60 },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 30 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 21 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Evento Corporativo', isDefault: false, active: true,
      color: '#1D4ED8', icon: '🏢',
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 8, perChild: 0, notes: '' },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 4, perChild: 0, notes: '' },
        { id: genId(), name: 'Café', unit: 'litro', perAdult: 0.2, perChild: 0, notes: '' }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild: 0, notes: '' },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.2, perChild: 0, notes: '' },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild: 0, notes: '' }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', perAdult: 3, perChild: 0, notes: '' },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', perAdult: 4, perChild: 0, notes: '' }
      ],
      team: [
        { id: genId(), name: 'Recepcionista', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Garçom', defaultValue: 0, suggestedQty: 1, formula: 'per50guests', formulaFactor: 1, notes: '' }
      ],
      checklist: [
        { id: genId(), text: 'Definir pauta', category: 'Planejamento', daysBeforeEvent: 30 },
        { id: genId(), text: 'Confirmar palestrantes', category: 'Organização', daysBeforeEvent: 15 },
        { id: genId(), text: 'Enviar confirmações', category: 'Convidados', daysBeforeEvent: 7 }
      ],
      schedule: [
        { id: genId(), text: 'Definir local e data', category: 'Planejamento', daysBeforeEvent: 60 },
        { id: genId(), text: 'Confirmar participantes', category: 'Convidados', daysBeforeEvent: 15 },
        { id: genId(), text: 'Enviar agenda', category: 'Organização', daysBeforeEvent: 7 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Formatura', isDefault: false, active: true,
      color: '#059669', icon: '🎓',
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 12, perChild: 8, notes: '' },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 6, perChild: 5, notes: '' },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild: 2, notes: '' }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild: 0.3, notes: '' },
        { id: genId(), name: 'Espumante', unit: 'garrafa', perAdult: 0.3, perChild: 0, notes: 'Brinde' }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Painel de formatura', unit: 'unidade', formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formula: 'tables', formulaFactor: 1, notes: '' }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', perAdult: 3, perChild: 2, notes: '' },
        { id: genId(), name: 'Pratos', unit: 'unidade', perAdult: 2, perChild: 2, notes: '' },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', perAdult: 5, perChild: 4, notes: '' }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, suggestedQty: 1, formula: 'per50guests', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'DJ', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' },
        { id: genId(), name: 'Mestre de cerimônias', defaultValue: 0, suggestedQty: 1, formula: 'fixed', formulaFactor: 1, notes: '' }
      ],
      checklist: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 180 },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 90 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45 },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15 }
      ],
      schedule: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 180 },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 90 },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45 },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15 }
      ],
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Calcula quantidades sugeridas para um evento com base no perfil e número de convidados.
 * @param {object} profile - Perfil de evento
 * @param {number} adults - Número de adultos
 * @param {number} children - Número de crianças (menores de 10)
 * @param {number} tables - Número de mesas (estimado: ceil(guests/10))
 */
function calcSuggestions(profile, adults, children, tables) {
  const total = adults + children;
  const t = tables || Math.ceil(total / 10) || 1;

  const calcDecor = (item) => {
    if (item.formula === 'tables') return Math.ceil(t * (Number(item.formulaFactor) || 1));
    if (item.formula === 'perGuest') return Math.ceil(total * (Number(item.formulaFactor) || 1));
    return Math.ceil(Number(item.formulaFactor) || 0); // fixed
  };

  const calcTeam = (item) => {
    if (item.formula === 'per50guests') return Math.max(1, Math.ceil(total / 50) * (Number(item.formulaFactor) || 1));
    if (item.formula === 'per30guests') return Math.max(1, Math.ceil(total / 30) * (Number(item.formulaFactor) || 1));
    if (item.formula === 'perGuest') return Math.ceil(total * (Number(item.formulaFactor) || 1));
    return Math.ceil(Number(item.formulaFactor) || 1); // fixed
  };

  return {
    food: (profile.food || []).map(item => ({
      ...item,
      suggestedAdult: Math.ceil((Number(item.perAdult) || 0) * adults),
      suggestedChild: Math.ceil((Number(item.perChild) || 0) * children),
      suggestedTotal: Math.ceil((Number(item.perAdult) || 0) * adults + (Number(item.perChild) || 0) * children)
    })),
    drinks: (profile.drinks || []).map(item => ({
      ...item,
      suggestedAdult: Math.ceil((Number(item.perAdult) || 0) * adults * 10) / 10,
      suggestedChild: Math.ceil((Number(item.perChild) || 0) * children * 10) / 10,
      suggestedTotal: Math.ceil(((Number(item.perAdult) || 0) * adults + (Number(item.perChild) || 0) * children) * 10) / 10
    })),
    decor: (profile.decor || []).map(item => ({
      ...item,
      suggestedQty: calcDecor(item)
    })),
    materials: (profile.materials || []).map(item => ({
      ...item,
      suggestedAdult: Math.ceil((Number(item.perAdult) || 0) * adults),
      suggestedChild: Math.ceil((Number(item.perChild) || 0) * children),
      suggestedTotal: Math.ceil((Number(item.perAdult) || 0) * adults + (Number(item.perChild) || 0) * children)
    })),
    team: (profile.team || []).map(item => ({
      ...item,
      suggestedQty: calcTeam(item)
    }))
  };
}

module.exports = { defaultProfiles, calcSuggestions, genId };
