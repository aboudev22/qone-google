# Spécification de sécurité Firestore — qone ERP

## 1. Invariants de données (Phase 0)

1. **Isolation stricte par utilisateur (`users/{userId}`)**: Un utilisateur authentifié et vérifié ne peut lire et modifier que son propre document de profil. Aucune lecture globale de la collection `users` n'est autorisée (isolation PII).
2. **Création atomique d'entreprise (`companies/{companyId}`)**: Aucune entreprise ne peut être créée sans la création simultanée du document membre propriétaire `companies/{companyId}/members/{uid}` avec `role: "owner"`.
3. **Appartenance dérivée et contrôle RBAC (`members`)**: Toutes les opérations sur `clients`, `opportunities`, `activities` et `invitations` exigent que l'utilisateur vérifié appartienne activement à l'entreprise cible (`exists(.../members/{uid})`).
4. **Anti-auto-promotion de rôle**: Un utilisateur ne peut jamais s'attribuer `owner` ou `admin` sur une entreprise existante sans soit être l'administrateur/propriétaire existant, soit consommer de façon atomique une invitation `pending` correspondant exactement à son email vérifié (`email_verified == true`).
5. **Verrouillage d'état terminal sur les invitations (`invitations/{inviteId}`)**: Une invitation passée à `accepted` ou `revoked` ne peut plus jamais être modifiée.
6. **Requêtes `list` sécurisées sans `get()`/`exists()`**: Toute opération `list` valide directement `request.auth.uid in resource.data.memberUids` (tableau borné 1..25) ou `resource.data.uid == request.auth.uid`, rendant toute énumération inter-entreprises impossible.
7. **Intégrité temporelle & anti-payload fantôme**: Tous les schémas valident `hasAll(...)` + `hasOnly(...)`, les bornes `.size()` sur chaque chaîne et liste, `isValidId()` sur les identifiants de chemin, et `request.time` sur `createdAt`/`updatedAt`.

## 2. Payloads malveillants (« Dirty Dozen ») devant retourner `PERMISSION_DENIED`

1. **Ghost field sur création client**: Ajout de `isAdmin: true` ou `internalFlag: 1` dans `companies/c1/clients/cl1` -> rejeté par `hasOnly(...)`.
2. **Usurpation d'auteur sur client**: Création de `companies/c1/clients/cl1` avec `createdByUid: "autre_uid"` -> rejeté par `incoming().createdByUid == request.auth.uid`.
3. **Accès inter-entreprises (`get`/`create`)**: Utilisateur de l'entreprise A tentant de lire ou écrire `companies/B/clients/cl1` -> rejeté par `isCompanyMember("B")`.
4. **Auto-promotion de rôle sur `members`**: Utilisateur simple (`member`) tentant de modifier son `role` vers `"owner"` via `update` -> rejeté par `isCompanyAdmin` + `isCompanyOwner`.
5. **Rejoindre une entreprise sans invitation**: Utilisateur non membre créant `companies/c1/members/mon_uid` sans être `ownerUid` ni posséder d'invitation `pending` pour son email vérifié -> rejeté par le Master Gate.
6. **Usurpation d'email sur invitation**: Utilisateur avec `email_verified: false` ou un email différent acceptant `invitations/tok1` -> rejeté par `isVerifiedUser()` et `isValidUserEmailMatch()`.
7. **Réouverture d'invitation terminée**: Modification d'une invitation `status: "accepted"` ou `"revoked"` vers `"pending"` -> rejeté par `existing().status == 'pending'`.
8. **Liste non filtrée (`allow list` scraping)**: Requête `collectionGroup` ou `list` sans filtre `memberUids array-contains uid` -> rejeté par `request.auth.uid in existing().memberUids`.
9. **Fuite PII inter-utilisateurs**: Lecture de `users/autre_uid` par un utilisateur authentifié -> rejeté par `request.auth.uid == userId`.
10. **Falsification d'horodatage (`createdAt` / `updatedAt`)**: Envoi d'une date antidatée au lieu de `request.time` -> rejeté par `== request.time` et immutabilité de `createdAt`.
11. **Injection de texte géant / ID empoisonné**: Création avec un ID > 128 chars ou caractères spéciaux (`../admin`) ou `notes` > 2000 chars -> rejeté par `isValidId()` et `.size() <= 2000`.
12. **Opportunité orpheline**: Création d'une opportunité pointant vers un `clientId` inexistant dans l'entreprise -> rejeté par `exists(/databases/$(database)/documents/companies/$(companyId)/clients/$(incoming().clientId))`.
