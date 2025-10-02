export function calculerHeuresOuvrees(dateDebut: Date, dateFin: Date): number {
    if (dateFin <= dateDebut) return 0;
  
    // Horaires de travail
    const matinDebut = { h: 8, m: 30 };
    const matinFin = { h: 12, m: 0 };
    const apremDebut = { h: 13, m: 0 };
    const apremFin = { h: 16, m: 0 };
  
    let totalHeures = 0;
  
    // On parcourt jour par jour (sans muter les dates d'entrée)
    let currentDay = new Date(dateDebut);
    currentDay.setHours(0, 0, 0, 0);
  
    const lastDay = new Date(dateFin);
    lastDay.setHours(23, 59, 59, 999);
  
    while (currentDay <= lastDay) {
      const dayOfWeek = currentDay.getDay(); // 0 = dimanche, 6 = samedi
  
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // calcule le chevauchement entre [slotStart, slotEnd] et [dateDebut, dateFin]
        const addOverlap = (slotStart: Date, slotEnd: Date) => {
          const start = dateDebut > slotStart ? dateDebut : slotStart;
          const end = dateFin < slotEnd ? dateFin : slotEnd;
          if (end > start) {
            totalHeures += (end.getTime() - start.getTime()) / 3600000;
          }
        };
  
        const matinStart = new Date(currentDay); matinStart.setHours(matinDebut.h, matinDebut.m, 0, 0);
        const matinEnd = new Date(currentDay); matinEnd.setHours(matinFin.h, matinFin.m, 0, 0);
  
        const apremStart = new Date(currentDay); apremStart.setHours(apremDebut.h, apremDebut.m, 0, 0);
        const apremEnd = new Date(currentDay); apremEnd.setHours(apremFin.h, apremFin.m, 0, 0);
  
        addOverlap(matinStart, matinEnd);
        addOverlap(apremStart, apremEnd);
      }
  
      // passer au jour suivant
      currentDay.setDate(currentDay.getDate() + 1);
    }
  
    return parseFloat(totalHeures.toFixed(2));
  }
  