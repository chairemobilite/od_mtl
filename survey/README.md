# Quelques détails d'implémentation sur cette enquête

- Support du pré-remplissage d'information, dont l'adresse de domicile, à partir du code d'accès
- Présence d'échantillons partiels, sous le champ `ep` des réponses, pour déterminer s'il faut afficher ou non certaines questions/sections. Ces échantillons sont: `exclusive`, une chaîne de caractères contenant le nom de l'échantillon partiel exclusif, `commonTrip` et `sameMode`, booléens mis à "vrai" si actifs. Ces échantillons sont déterminés aléatoirement en début d'enquête, lors de la validation du code d'accès.