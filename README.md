# OPC Livraison

Site de demande de livraison locale. Les clients peuvent préciser le commerce, les articles et leur adresse. Les demandes sont transmises à `livraisonopc@gmail.com`.

## Tarification affichée

Livraison à partir de 5 $. Le prix final varie selon la distance et est confirmé avant la livraison.

## Formulaire

Les demandes sont maintenant enregistrées dans Supabase et visibles dans les tableaux de bord sécurisés.

## Comptes et répartition

Le site utilise Supabase Auth et une base PostgreSQL protégée par RLS. Les clients suivent leurs commandes, les livreurs approuvés gèrent leur disponibilité et l'administrateur `livraisonopc@gmail.com` assigne les commandes aux livreurs disponibles.
