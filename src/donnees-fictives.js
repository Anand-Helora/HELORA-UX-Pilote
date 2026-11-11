/**
 * Jeu d'essai ENTIÈREMENT FICTIF pour le pilote UX/UI (Issue #1).
 *
 * Aucun équipement, lieu, bâtiment ni règle métier réels. La catégorie
 * unique attribuée à chaque équipement (en_retard, prioritaire, a_controler)
 * est une contrainte du test, PAS une règle métier HELORA.
 *
 * Champs :
 * - id          identifiant fictif unique (« EQ-DEMO-xxx »)
 * - designation libellé fictif
 * - categorie   « en_retard » | « prioritaire » | « a_controler »
 * - statut      texte libre fictif affiché sur la fiche
 * - echeance    date ISO (AAAA-MM-JJ) fictive, ou null
 * - priorite    entier 1 (la plus haute) à 3, ou null
 * - zone        localisation fictive générique
 */
export const EQUIPEMENTS_FICTIFS = Object.freeze([
  { id: "EQ-DEMO-001", designation: "Centrale de traitement d'air A", categorie: "en_retard", statut: "Contrôle périodique dépassé", echeance: "2026-09-14", priorite: null, zone: "Zone fictive Nord" },
  { id: "EQ-DEMO-002", designation: "Pompe de circulation 2", categorie: "en_retard", statut: "Contrôle périodique dépassé", echeance: "2026-10-02", priorite: null, zone: "Zone fictive Sud" },
  { id: "EQ-DEMO-003", designation: "Groupe froid démonstration", categorie: "en_retard", statut: "Intervention à planifier", echeance: "2026-08-30", priorite: null, zone: "Zone fictive Est" },
  { id: "EQ-DEMO-004", designation: "Extracteur de toiture B", categorie: "en_retard", statut: "Contrôle périodique dépassé", echeance: "2026-10-02", priorite: null, zone: "Zone fictive Ouest" },
  { id: "EQ-DEMO-005", designation: "Tableau électrique test", categorie: "prioritaire", statut: "Anomalie signalée (fictive)", echeance: null, priorite: 1, zone: "Zone fictive Nord" },
  { id: "EQ-DEMO-006", designation: "Porte automatique exemple", categorie: "prioritaire", statut: "Fonctionnement dégradé", echeance: null, priorite: 2, zone: "Zone fictive Centre" },
  { id: "EQ-DEMO-007", designation: "Ascenseur de démonstration", categorie: "prioritaire", statut: "Anomalie signalée (fictive)", echeance: null, priorite: 1, zone: "Zone fictive Sud" },
  { id: "EQ-DEMO-008", designation: "Chaudière d'essai", categorie: "prioritaire", statut: "Surveillance renforcée", echeance: null, priorite: 3, zone: "Zone fictive Est" },
  { id: "EQ-DEMO-009", designation: "Onduleur fictif C", categorie: "a_controler", statut: "Contrôle à venir", echeance: "2026-12-05", priorite: null, zone: "Zone fictive Ouest" },
  { id: "EQ-DEMO-010", designation: "Détecteur de fumée lot 4", categorie: "a_controler", statut: "Contrôle à venir", echeance: "2026-11-20", priorite: null, zone: "Zone fictive Centre" },
  { id: "EQ-DEMO-011", designation: "Surpresseur exemple", categorie: "a_controler", statut: "Contrôle à venir", echeance: "2027-01-15", priorite: null, zone: "Zone fictive Nord" },
  { id: "EQ-DEMO-012", designation: "Éclairage de secours test", categorie: "a_controler", statut: "Contrôle à venir", echeance: "2026-11-20", priorite: null, zone: "Zone fictive Sud" },
  { id: "EQ-DEMO-013", designation: "Adoucisseur démonstration", categorie: "a_controler", statut: "Contrôle à venir", echeance: "2026-12-18", priorite: null, zone: "Zone fictive Est" },
].map((equipement) => Object.freeze(equipement)));
