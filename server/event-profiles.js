/**
 * Modulo "Perfis Inteligentes de Eventos" - v2
 * Suporta: perfis configuráveis, fórmulas editáveis, fornecedores padrão,
 * orçamento base, configurações gerais, snapshot e configurações globais.
 */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Configurações Globais padrão ----------
function defaultGlobalSettings() {
  return {
    ageGroups: [
      { id: genId(), name: 'Adulto', minAge: 18, maxAge: 120, active: true },
      { id: genId(), name: 'Criança (5-9)', minAge: 5, maxAge: 9, active: true },
      { id: genId(), name: 'Criança (< 5)', minAge: 0, maxAge: 4, active: true }
    ],
    tableTypes: [
      { id: genId(), name: 'Redonda', defaultCapacity: 10, active: true },
      { id: genId(), name: 'Retangular', defaultCapacity: 8, active: true },
      { id: genId(), name: 'Bistrô', defaultCapacity: 4, active: true }
    ],
    units: [
      { id: genId(), name: 'unidade', abbr: 'un', active: true },
      { id: genId(), name: 'litro', abbr: 'L', active: true },
      { id: genId(), name: 'quilograma', abbr: 'kg', active: true },
      { id: genId(), name: 'porção', abbr: 'porç', active: true },
      { id: genId(), name: 'garrafa', abbr: 'grf', active: true },
      { id: genId(), name: 'lata', abbr: 'lata', active: true },
      { id: genId(), name: 'fatia', abbr: 'fatia', active: true },
      { id: genId(), name: 'conjunto', abbr: 'conj', active: true },
      { id: genId(), name: 'arranjo', abbr: 'arr', active: true }
    ],
    categories: [
      { id: genId(), name: 'Alimentação', color: '#F59E0B', active: true },
      { id: genId(), name: 'Bebidas', color: '#3B82F6', active: true },
      { id: genId(), name: 'Decoração', color: '#EC4899', active: true },
      { id: genId(), name: 'Materiais', color: '#8B5CF6', active: true },
      { id: genId(), name: 'Equipe', color: '#10B981', active: true },
      { id: genId(), name: 'Infraestrutura', color: '#6B7280', active: true },
      { id: genId(), name: 'Entretenimento', color: '#EF4444', active: true },
      { id: genId(), name: 'Planejamento', color: '#2B2622', active: true },
      { id: genId(), name: 'Convidados', color: '#B9502C', active: true },
      { id: genId(), name: 'Fornecedores', color: '#059669', active: true },
      { id: genId(), name: 'Financeiro', color: '#1D4ED8', active: true },
      { id: genId(), name: 'Organização', color: '#7C3AED', active: true }
    ],
    vendorTypes: [
      { id: genId(), name: 'Buffet', active: true },
      { id: genId(), name: 'Fotografia', active: true },
      { id: genId(), name: 'Vídeo', active: true },
      { id: genId(), name: 'DJ', active: true },
      { id: genId(), name: 'Banda', active: true },
      { id: genId(), name: 'Decoração', active: true },
      { id: genId(), name: 'Floricultura', active: true },
      { id: genId(), name: 'Confeitaria', active: true },
      { id: genId(), name: 'Cerimonialista', active: true },
      { id: genId(), name: 'Espaço/Local', active: true },
      { id: genId(), name: 'Iluminação', active: true },
      { id: genId(), name: 'Segurança', active: true },
      { id: genId(), name: 'Transporte', active: true },
      { id: genId(), name: 'Outros', active: true }
    ],
    teamTypes: [
      { id: genId(), name: 'Garçom', active: true },
      { id: genId(), name: 'Bartender', active: true },
      { id: genId(), name: 'Recepcionista', active: true },
      { id: genId(), name: 'Mestre de cerimônias', active: true },
      { id: genId(), name: 'DJ', active: true },
      { id: genId(), name: 'Recreacionista', active: true },
      { id: genId(), name: 'Segurança', active: true },
      { id: genId(), name: 'Coordenador', active: true }
    ],
    statusOptions: [
      { id: genId(), name: 'Planejamento', color: '#6B7280', active: true },
      { id: genId(), name: 'Confirmado', color: '#2563EB', active: true },
      { id: genId(), name: 'Realizado', color: '#059669', active: true },
      { id: genId(), name: 'Cancelado', color: '#DC2626', active: true }
    ],
    priorities: [
      { id: genId(), name: 'Alta', color: '#DC2626', active: true },
      { id: genId(), name: 'Média', color: '#F59E0B', active: true },
      { id: genId(), name: 'Baixa', color: '#6B7280', active: true }
    ],
    formulaTypes: [
      { id: genId(), key: 'fixed', label: 'Fixo', description: 'Quantidade fixa independente de convidados', active: true },
      { id: genId(), key: 'perAdult', label: 'Por adulto', description: 'Fator × número de adultos', active: true },
      { id: genId(), key: 'perChild', label: 'Por criança', description: 'Fator × número de crianças', active: true },
      { id: genId(), key: 'perGuest', label: 'Por convidado', description: 'Fator × total de convidados', active: true },
      { id: genId(), key: 'perTable', label: 'Por mesa', description: 'Fator × número de mesas', active: true },
      { id: genId(), key: 'perNGuests', label: 'A cada N convidados', description: '1 para cada N convidados (ex: 1 garçom/20 pessoas)', active: true },
      { id: genId(), key: 'perFamily', label: 'Por família', description: 'Fator × número estimado de famílias', active: true }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ---------- Perfis padrão de exemplo ----------
function defaultProfiles() {
  return [
    {
      id: genId(), name: 'Casamento', isDefault: true, active: true,
      color: '#B9502C', icon: '💍', description: 'Perfil completo para casamentos',
      settings: {
        peoplePerTable: 10, tableType: 'Redonda', maxPerTable: 12,
        eventDurationHours: 6, foodSafetyMargin: 0.1, drinkSafetyMargin: 0.15,
        surplusPercent: 0.05, familySize: 3
      },
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 15, perChild59: 8, perChildUnder5: 5, perExtraHour: 3, notes: '', order: 0, active: true },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 8, perChild59: 5, perChildUnder5: 3, perExtraHour: 0, notes: '', order: 1, active: true },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild59: 2, perChildUnder5: 1, perExtraHour: 0, notes: '', order: 2, active: true },
        { id: genId(), name: 'Bem-casados', unit: 'unidade', perAdult: 1, perChild59: 1, perChildUnder5: 0, perExtraHour: 0, notes: 'Lembrança', order: 3, active: true }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0.1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild59: 0.4, perChildUnder5: 0.2, perExtraHour: 0.05, notes: '', order: 1, active: true },
        { id: genId(), name: 'Espumante', unit: 'garrafa', perAdult: 0.3, perChild59: 0, perChildUnder5: 0, perExtraHour: 0, notes: 'Brinde', order: 2, active: true },
        { id: genId(), name: 'Cerveja', unit: 'lata', perAdult: 3, perChild59: 0, perChildUnder5: 0, perExtraHour: 1, notes: '', order: 3, active: true }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '1 por mesa', order: 0, active: true },
        { id: genId(), name: 'Arranjos', unit: 'unidade', formulaType: 'fixed', formulaFactor: 2, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '1 por mesa', order: 2, active: true },
        { id: genId(), name: 'Painéis', unit: 'unidade', formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 3, active: true },
        { id: genId(), name: 'Flores', unit: 'arranjo', formulaType: 'fixed', formulaFactor: 5, formulaN: 1, notes: '', order: 4, active: true }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 3, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Pratos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Talheres', unit: 'conjunto', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 2, active: true },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 5, formulaN: 1, notes: '', order: 3, active: true }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, formulaType: 'perNGuests', formulaFactor: 1, formulaN: 20, notes: '1 a cada 20 convidados', order: 0, active: true },
        { id: genId(), name: 'Bartender', defaultValue: 0, formulaType: 'perNGuests', formulaFactor: 1, formulaN: 80, notes: '1 a cada 80 convidados', order: 1, active: true },
        { id: genId(), name: 'DJ', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 2, active: true },
        { id: genId(), name: 'Mestre de cerimônias', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 3, active: true }
      ],
      checklist: [
        { id: genId(), text: 'Definir data e local', category: 'Planejamento', daysBeforeEvent: 365, priority: 'Alta', order: 0, active: true },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 180, priority: 'Alta', order: 1, active: true },
        { id: genId(), text: 'Contratar fotógrafo', category: 'Fornecedores', daysBeforeEvent: 180, priority: 'Alta', order: 2, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 60, priority: 'Média', order: 3, active: true },
        { id: genId(), text: 'Confirmar lista de convidados', category: 'Convidados', daysBeforeEvent: 30, priority: 'Alta', order: 4, active: true },
        { id: genId(), text: 'Confirmar fornecedores', category: 'Fornecedores', daysBeforeEvent: 15, priority: 'Alta', order: 5, active: true },
        { id: genId(), text: 'Reunião final com equipe', category: 'Organização', daysBeforeEvent: 7, priority: 'Alta', order: 6, active: true }
      ],
      schedule: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 365, order: 0, active: true },
        { id: genId(), text: 'Fechar orçamentos principais', category: 'Financeiro', daysBeforeEvent: 180, order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 60, order: 2, active: true },
        { id: genId(), text: 'Degustação do cardápio', category: 'Alimentação', daysBeforeEvent: 45, order: 3, active: true },
        { id: genId(), text: 'Confirmar quantidade de convidados', category: 'Convidados', daysBeforeEvent: 30, order: 4, active: true },
        { id: genId(), text: 'Montagem da decoração', category: 'Decoração', daysBeforeEvent: 1, order: 5, active: true }
      ],
      defaultVendors: [
        { id: genId(), name: 'Buffet Premium', type: 'Buffet', notes: 'Sugestão de buffet para casamentos', order: 0, active: true },
        { id: genId(), name: 'Fotógrafo', type: 'Fotografia', notes: '', order: 1, active: true },
        { id: genId(), name: 'DJ', type: 'DJ', notes: '', order: 2, active: true },
        { id: genId(), name: 'Decoração', type: 'Decoração', notes: '', order: 3, active: true }
      ],
      budget: [
        { id: genId(), category: 'Local/Espaço', estimatedValue: 5000, notes: '', order: 0, active: true },
        { id: genId(), category: 'Buffet', estimatedValue: 8000, notes: '', order: 1, active: true },
        { id: genId(), category: 'Decoração', estimatedValue: 3000, notes: '', order: 2, active: true },
        { id: genId(), category: 'Fotografia/Vídeo', estimatedValue: 4000, notes: '', order: 3, active: true },
        { id: genId(), category: 'Música/DJ', estimatedValue: 2000, notes: '', order: 4, active: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Festa de 15 anos', isDefault: false, active: true,
      color: '#8B5CF6', icon: '🎂', description: 'Perfil para festas de 15 anos',
      settings: { peoplePerTable: 10, tableType: 'Redonda', maxPerTable: 10, eventDurationHours: 5, foodSafetyMargin: 0.1, drinkSafetyMargin: 0.1, surplusPercent: 0.05, familySize: 3 },
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 12, perChild59: 8, perChildUnder5: 5, perExtraHour: 2, notes: '', order: 0, active: true },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 6, perChild59: 5, perChildUnder5: 3, perExtraHour: 0, notes: '', order: 1, active: true },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild59: 2, perChildUnder5: 1, perExtraHour: 0, notes: '', order: 2, active: true }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0.1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild59: 0.4, perChildUnder5: 0.2, perExtraHour: 0.05, notes: '', order: 1, active: true },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0, notes: '', order: 2, active: true }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Balões', unit: 'unidade', formulaType: 'fixed', formulaFactor: 50, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Painel da aniversariante', unit: 'unidade', formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 2, active: true }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 3, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Pratos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 5, formulaN: 1, notes: '', order: 2, active: true }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, formulaType: 'perNGuests', formulaFactor: 1, formulaN: 20, notes: '1 a cada 20 convidados', order: 0, active: true },
        { id: genId(), name: 'DJ', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 1, active: true }
      ],
      checklist: [
        { id: genId(), text: 'Definir tema da festa', category: 'Planejamento', daysBeforeEvent: 180, priority: 'Alta', order: 0, active: true },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 120, priority: 'Alta', order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45, priority: 'Média', order: 2, active: true },
        { id: genId(), text: 'Confirmar lista de convidados', category: 'Convidados', daysBeforeEvent: 20, priority: 'Alta', order: 3, active: true }
      ],
      schedule: [
        { id: genId(), text: 'Definir tema e local', category: 'Planejamento', daysBeforeEvent: 180, order: 0, active: true },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 90, order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45, order: 2, active: true },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15, order: 3, active: true }
      ],
      defaultVendors: [
        { id: genId(), name: 'Buffet', type: 'Buffet', notes: '', order: 0, active: true },
        { id: genId(), name: 'DJ', type: 'DJ', notes: '', order: 1, active: true },
        { id: genId(), name: 'Fotógrafo', type: 'Fotografia', notes: '', order: 2, active: true }
      ],
      budget: [
        { id: genId(), category: 'Local/Espaço', estimatedValue: 3000, notes: '', order: 0, active: true },
        { id: genId(), category: 'Buffet', estimatedValue: 5000, notes: '', order: 1, active: true },
        { id: genId(), category: 'Decoração', estimatedValue: 2000, notes: '', order: 2, active: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Aniversário Infantil', isDefault: false, active: true,
      color: '#F59E0B', icon: '🎈', description: 'Perfil para festas infantis',
      settings: { peoplePerTable: 8, tableType: 'Redonda', maxPerTable: 8, eventDurationHours: 4, foodSafetyMargin: 0.1, drinkSafetyMargin: 0.1, surplusPercent: 0.1, familySize: 3 },
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 10, perChild59: 8, perChildUnder5: 5, perExtraHour: 2, notes: '', order: 0, active: true },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 5, perChild59: 6, perChildUnder5: 4, perExtraHour: 0, notes: '', order: 1, active: true },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild59: 2, perChildUnder5: 1, perExtraHour: 0, notes: '', order: 2, active: true },
        { id: genId(), name: 'Pipoca', unit: 'porção', perAdult: 0, perChild59: 1, perChildUnder5: 1, perExtraHour: 0, notes: '', order: 3, active: true }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.4, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0.1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild59: 0.3, perChildUnder5: 0.1, perExtraHour: 0.05, notes: '', order: 1, active: true },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild59: 0.4, perChildUnder5: 0.3, perExtraHour: 0, notes: '', order: 2, active: true }
      ],
      decor: [
        { id: genId(), name: 'Balões', unit: 'unidade', formulaType: 'fixed', formulaFactor: 100, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Painel temático', unit: 'unidade', formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 2, active: true }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Pratos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 5, formulaN: 1, notes: '', order: 2, active: true }
      ],
      team: [
        { id: genId(), name: 'Recreacionista', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 0, active: true }
      ],
      checklist: [
        { id: genId(), text: 'Definir tema', category: 'Planejamento', daysBeforeEvent: 60, priority: 'Alta', order: 0, active: true },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 30, priority: 'Alta', order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 21, priority: 'Média', order: 2, active: true }
      ],
      schedule: [
        { id: genId(), text: 'Definir tema e local', category: 'Planejamento', daysBeforeEvent: 60, order: 0, active: true },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 30, order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 21, order: 2, active: true }
      ],
      defaultVendors: [
        { id: genId(), name: 'Buffet Infantil', type: 'Buffet', notes: '', order: 0, active: true },
        { id: genId(), name: 'Recreacionista', type: 'Entretenimento', notes: '', order: 1, active: true }
      ],
      budget: [
        { id: genId(), category: 'Local/Espaço', estimatedValue: 1500, notes: '', order: 0, active: true },
        { id: genId(), category: 'Buffet', estimatedValue: 2500, notes: '', order: 1, active: true },
        { id: genId(), category: 'Decoração', estimatedValue: 1000, notes: '', order: 2, active: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Evento Corporativo', isDefault: false, active: true,
      color: '#1D4ED8', icon: '🏢', description: 'Perfil para eventos corporativos',
      settings: { peoplePerTable: 8, tableType: 'Retangular', maxPerTable: 10, eventDurationHours: 4, foodSafetyMargin: 0.05, drinkSafetyMargin: 0.1, surplusPercent: 0.05, familySize: 1 },
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 8, perChild59: 0, perChildUnder5: 0, perExtraHour: 2, notes: '', order: 0, active: true },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 4, perChild59: 0, perChildUnder5: 0, perExtraHour: 0, notes: '', order: 1, active: true },
        { id: genId(), name: 'Café', unit: 'litro', perAdult: 0.2, perChild59: 0, perChildUnder5: 0, perExtraHour: 0.1, notes: '', order: 2, active: true }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild59: 0, perChildUnder5: 0, perExtraHour: 0.1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.2, perChild59: 0, perChildUnder5: 0, perExtraHour: 0.05, notes: '', order: 1, active: true },
        { id: genId(), name: 'Suco', unit: 'litro', perAdult: 0.2, perChild59: 0, perChildUnder5: 0, perExtraHour: 0, notes: '', order: 2, active: true }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 1, active: true }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 3, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 4, formulaN: 1, notes: '', order: 1, active: true }
      ],
      team: [
        { id: genId(), name: 'Recepcionista', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Garçom', defaultValue: 0, formulaType: 'perNGuests', formulaFactor: 1, formulaN: 30, notes: '1 a cada 30 convidados', order: 1, active: true }
      ],
      checklist: [
        { id: genId(), text: 'Definir pauta', category: 'Planejamento', daysBeforeEvent: 30, priority: 'Alta', order: 0, active: true },
        { id: genId(), text: 'Confirmar palestrantes', category: 'Organização', daysBeforeEvent: 15, priority: 'Alta', order: 1, active: true },
        { id: genId(), text: 'Enviar confirmações', category: 'Convidados', daysBeforeEvent: 7, priority: 'Média', order: 2, active: true }
      ],
      schedule: [
        { id: genId(), text: 'Definir local e data', category: 'Planejamento', daysBeforeEvent: 60, order: 0, active: true },
        { id: genId(), text: 'Confirmar participantes', category: 'Convidados', daysBeforeEvent: 15, order: 1, active: true },
        { id: genId(), text: 'Enviar agenda', category: 'Organização', daysBeforeEvent: 7, order: 2, active: true }
      ],
      defaultVendors: [
        { id: genId(), name: 'Buffet Corporativo', type: 'Buffet', notes: '', order: 0, active: true },
        { id: genId(), name: 'Audiovisual', type: 'Outros', notes: '', order: 1, active: true }
      ],
      budget: [
        { id: genId(), category: 'Local/Espaço', estimatedValue: 2000, notes: '', order: 0, active: true },
        { id: genId(), category: 'Buffet', estimatedValue: 3000, notes: '', order: 1, active: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: genId(), name: 'Formatura', isDefault: false, active: true,
      color: '#059669', icon: '🎓', description: 'Perfil para formaturas',
      settings: { peoplePerTable: 10, tableType: 'Redonda', maxPerTable: 12, eventDurationHours: 5, foodSafetyMargin: 0.1, drinkSafetyMargin: 0.15, surplusPercent: 0.05, familySize: 3 },
      food: [
        { id: genId(), name: 'Salgados', unit: 'unidade', perAdult: 12, perChild59: 8, perChildUnder5: 5, perExtraHour: 2, notes: '', order: 0, active: true },
        { id: genId(), name: 'Doces', unit: 'unidade', perAdult: 6, perChild59: 5, perChildUnder5: 3, perExtraHour: 0, notes: '', order: 1, active: true },
        { id: genId(), name: 'Fatias de bolo', unit: 'fatia', perAdult: 2, perChild59: 2, perChildUnder5: 1, perExtraHour: 0, notes: '', order: 2, active: true }
      ],
      drinks: [
        { id: genId(), name: 'Água', unit: 'litro', perAdult: 0.5, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0.1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Refrigerante', unit: 'litro', perAdult: 0.3, perChild59: 0.3, perChildUnder5: 0.2, perExtraHour: 0.05, notes: '', order: 1, active: true },
        { id: genId(), name: 'Espumante', unit: 'garrafa', perAdult: 0.3, perChild59: 0, perChildUnder5: 0, perExtraHour: 0, notes: 'Brinde', order: 2, active: true }
      ],
      decor: [
        { id: genId(), name: 'Centros de mesa', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Painel de formatura', unit: 'unidade', formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Toalhas', unit: 'unidade', formulaType: 'perTable', formulaFactor: 1, formulaN: 1, notes: '', order: 2, active: true }
      ],
      materials: [
        { id: genId(), name: 'Copos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 3, formulaN: 1, notes: '', order: 0, active: true },
        { id: genId(), name: 'Pratos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 2, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Guardanapos', unit: 'unidade', category: 'Utensílios', formulaType: 'perGuest', formulaFactor: 5, formulaN: 1, notes: '', order: 2, active: true }
      ],
      team: [
        { id: genId(), name: 'Garçom', defaultValue: 0, formulaType: 'perNGuests', formulaFactor: 1, formulaN: 20, notes: '1 a cada 20 convidados', order: 0, active: true },
        { id: genId(), name: 'DJ', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 1, active: true },
        { id: genId(), name: 'Mestre de cerimônias', defaultValue: 0, formulaType: 'fixed', formulaFactor: 1, formulaN: 1, notes: '', order: 2, active: true }
      ],
      checklist: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 180, priority: 'Alta', order: 0, active: true },
        { id: genId(), text: 'Contratar buffet', category: 'Alimentação', daysBeforeEvent: 90, priority: 'Alta', order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45, priority: 'Média', order: 2, active: true },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15, priority: 'Alta', order: 3, active: true }
      ],
      schedule: [
        { id: genId(), text: 'Contratar local', category: 'Infraestrutura', daysBeforeEvent: 180, order: 0, active: true },
        { id: genId(), text: 'Fechar fornecedores', category: 'Fornecedores', daysBeforeEvent: 90, order: 1, active: true },
        { id: genId(), text: 'Enviar convites', category: 'Convidados', daysBeforeEvent: 45, order: 2, active: true },
        { id: genId(), text: 'Confirmar convidados', category: 'Convidados', daysBeforeEvent: 15, order: 3, active: true }
      ],
      defaultVendors: [
        { id: genId(), name: 'Buffet', type: 'Buffet', notes: '', order: 0, active: true },
        { id: genId(), name: 'Fotógrafo', type: 'Fotografia', notes: '', order: 1, active: true },
        { id: genId(), name: 'DJ', type: 'DJ', notes: '', order: 2, active: true }
      ],
      budget: [
        { id: genId(), category: 'Local/Espaço', estimatedValue: 4000, notes: '', order: 0, active: true },
        { id: genId(), category: 'Buffet', estimatedValue: 6000, notes: '', order: 1, active: true },
        { id: genId(), category: 'Decoração', estimatedValue: 2000, notes: '', order: 2, active: true }
      ],
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Calcula quantidades sugeridas para um evento com base no perfil e número de convidados.
 * Suporta todos os tipos de fórmula: fixed, perAdult, perChild, perGuest, perTable, perNGuests, perFamily
 */
function calcSuggestions(profile, adults, children59, childrenUnder5, extraHours, tables) {
  const children = (children59 || 0) + (childrenUnder5 || 0);
  const total = adults + children;
  const t = tables || Math.ceil(total / ((profile.settings && profile.settings.peoplePerTable) || 10)) || 1;
  const extra = extraHours || 0;
  const familySize = (profile.settings && profile.settings.familySize) || 3;
  const families = Math.ceil(total / familySize);
  const margin = (section) => {
    if (section === 'food') return 1 + ((profile.settings && profile.settings.foodSafetyMargin) || 0);
    if (section === 'drinks') return 1 + ((profile.settings && profile.settings.drinkSafetyMargin) || 0);
    return 1;
  };

  const calcFormula = (item, section) => {
    const ft = item.formulaType || 'fixed';
    const ff = Number(item.formulaFactor) || 1;
    const fn = Number(item.formulaN) || 1;
    let base = 0;
    if (ft === 'fixed') base = ff;
    else if (ft === 'perAdult') base = ff * adults;
    else if (ft === 'perChild') base = ff * children;
    else if (ft === 'perGuest') base = ff * total;
    else if (ft === 'perTable') base = ff * t;
    else if (ft === 'perNGuests') base = Math.max(1, Math.ceil(total / fn) * ff);
    else if (ft === 'perFamily') base = ff * families;
    return Math.ceil(base * margin(section));
  };

  return {
    food: (profile.food || []).filter(i => i.active !== false).map(item => {
      const a = Math.ceil((Number(item.perAdult) || 0) * adults);
      const c59 = Math.ceil((Number(item.perChild59) || Number(item.perChild) || 0) * (children59 || 0));
      const cu5 = Math.ceil((Number(item.perChildUnder5) || 0) * (childrenUnder5 || 0));
      const eh = Math.ceil((Number(item.perExtraHour) || 0) * extra);
      const raw = a + c59 + cu5 + eh;
      const total = Math.ceil(raw * margin('food'));
      return { ...item, suggestedAdult: a, suggestedChild59: c59, suggestedChildUnder5: cu5, suggestedExtraHour: eh, suggestedTotal: total };
    }),
    drinks: (profile.drinks || []).filter(i => i.active !== false).map(item => {
      const a = (Number(item.perAdult) || 0) * adults;
      const c59 = (Number(item.perChild59) || Number(item.perChild) || 0) * (children59 || 0);
      const cu5 = (Number(item.perChildUnder5) || 0) * (childrenUnder5 || 0);
      const eh = (Number(item.perExtraHour) || 0) * extra;
      const raw = a + c59 + cu5 + eh;
      const total = Math.ceil(raw * margin('drinks') * 10) / 10;
      return { ...item, suggestedAdult: Math.ceil(a * 10) / 10, suggestedChild59: Math.ceil(c59 * 10) / 10, suggestedChildUnder5: Math.ceil(cu5 * 10) / 10, suggestedExtraHour: Math.ceil(eh * 10) / 10, suggestedTotal: total };
    }),
    decor: (profile.decor || []).filter(i => i.active !== false).map(item => ({
      ...item, suggestedQty: calcFormula(item, 'decor')
    })),
    materials: (profile.materials || []).filter(i => i.active !== false).map(item => ({
      ...item, suggestedQty: calcFormula(item, 'materials')
    })),
    team: (profile.team || []).filter(i => i.active !== false).map(item => ({
      ...item, suggestedQty: calcFormula(item, 'team')
    }))
  };
}

/**
 * Cria um snapshot completo do perfil para ser copiado ao evento.
 * Alterações futuras no perfil não afetam eventos já criados.
 */
function snapshotProfile(profile, storeId) {
  const newId = storeId || genId;
  const snap = JSON.parse(JSON.stringify(profile));
  // Regenera IDs de todos os itens para que sejam independentes do perfil
  ['food','drinks','decor','materials','team','checklist','schedule','defaultVendors','budget'].forEach(k => {
    if (Array.isArray(snap[k])) snap[k].forEach(item => { item.id = newId(); });
  });
  snap._snapshotFrom = profile.id;
  snap._snapshotAt = new Date().toISOString();
  return snap;
}

module.exports = { defaultProfiles, defaultGlobalSettings, calcSuggestions, snapshotProfile, genId };
