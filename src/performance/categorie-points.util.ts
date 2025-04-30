export const categoriePointsMap: Record<string, number> = {
    'demande de rib': 10,
    'ajout login': 10,
    'changement mot de passe': 10,
    'installation logiciel': 20,
    'configuration réseau': 20,
    'réparation matériel': 30,
    'intervention sur site': 30,
  };
  

  export function normalizeCategorie(categorie: string | null | undefined): string {
    if (!categorie) return 'inconnue'; // ou retourne '' ou autre valeur par défaut
    return categorie.trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
  }
  export function getPointByCategorie(categorie: string): number {
    const cat = normalizeCategorie(categorie);
    return categoriePointsMap[cat] ?? 30;
  }
  