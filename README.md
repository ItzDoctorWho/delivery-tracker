# Système de livraison en temps réel (Microservices Architecture)

Ce projet implémente un **Système de livraison en temps réel** basé sur une architecture microservices avec **Node.js**, **gRPC**, **GraphQL**, **REST**, et **Apache Kafka 4.0.0 (KRaft)**.

---

## 🏗️ Architecture du Projet

L'application est composée de plusieurs briques indépendantes :

```
                               ┌─────────────────┐
                               │     Client      │
                               └────────┬────────┘
                                        │ REST / GraphQL
                                        ▼
                               ┌─────────────────┐
                               │   API Gateway   │
                               └────────┬────────┘
                                        │ gRPC
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
         ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
         │  Order Service  │   │Delivery Service │   │ Driver Service  │
         │     (RxDB)      │   │     (RxDB)      │   │     (RxDB)      │
         └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
                  │                     │                     │
                  └───────────────► Kafka ◄───────────────────┘
```

1. **API Gateway** (Port `4000`) : Point d'entrée principal. Expose des routes REST (`/api/*`) et une passerelle GraphQL (`/graphql`). Elle relaie les appels vers les services internes en utilisant gRPC.
2. **Order Service** (Port `50051`) : Gère les commandes. Utilise la base NoSQL **RxDB** en mémoire. Produit des événements `order.created` et `order.status_updated` sur Kafka.
3. **Delivery Service** (Port `50052`) : Gère l'attribution et le suivi des livraisons. Utilise la base NoSQL **RxDB** en mémoire. Consomme l'événement `order.created` sur Kafka pour auto-attribuer un coursier disponible, et produit des événements de mise à jour.
4. **Driver Service** (Port `50053`) : Gère les profils des coursiers, leurs statuts et coordonnées. Utilise la base NoSQL **RxDB** en mémoire. Produit des événements de statut/localisation.
5. **Kafka** (Port `9092`) : Broker d'événements asynchrones fonctionnant en mode **KRaft (sans ZooKeeper)** avec l'image Apache Kafka 4.0.

---

## 🛠️ Endpoints API & Schémas

### REST Endpoints (API Gateway)
* `POST /api/orders` : Créer une commande
* `GET /api/orders/:id` : Récupérer une commande par ID
* `GET /api/orders` : Lister toutes les commandes
* `POST /api/drivers` : Créer un coursier
* `GET /api/drivers` : Lister tous les coursiers
* `PUT /api/drivers/:id/location` : Mettre à jour la localisation d'un coursier
* `PUT /api/drivers/:id/status` : Mettre à jour le statut d'un coursier (`AVAILABLE`, `BUSY`, `OFFLINE`)
* `GET /api/deliveries` : Lister toutes les livraisons
* `PUT /api/deliveries/:id/status` : Mettre à jour le statut d'une livraison (`PICKED_UP`, `DELIVERED`, `CANCELLED`)

### GraphQL API (API Gateway - `/graphql`)
#### Requêtes (Queries)
* `orders` : Récupère la liste de toutes les commandes
* `drivers` : Récupère tous les coursiers
* `deliveries` : Récupère toutes les livraisons
* `order(id: ID!)` : Détail d'une commande
* `deliveryByOrder(order_id: ID!)` : Récupérer la livraison liée à une commande

#### Mutations
* `createOrder(customer_id: String!, pickup_address: String!, delivery_address: String!, items: String!, price: Float!)`
* `createDriver(name: String!, vehicle: String!)`
* `updateDriverLocation(id: ID!, latitude: Float!, longitude: Float!)`
* `updateDeliveryStatus(id: ID!, status: String!)`

---

## 🚀 Instructions d'installation et d'exécution

### 1. Démarrer Kafka
Assurez-vous que Docker est installé et démarré. À la racine du projet, lancez :
```bash
docker-compose up -d
```
Cela démarrera l'instance Apache Kafka 4.0 en mode KRaft.

### 2. Installer les dépendances
Installez les modules Node.js pour chaque service :
```bash
# Gateway
cd api-gateway
npm install

# Service Commandes
cd ../services/order-service
npm install

# Service Livraisons
cd ../delivery-service
npm install

# Service Coursiers
cd ../driver-service
npm install
```

### 3. Lancer les Services (Automatiquement)
Vous pouvez lancer tous les microservices et l'API Gateway en une seule commande grâce au script de démarrage :
```bash
node start-all.js
```
Ce script lance les 4 services en parallèle, fusionne leurs logs en les préfixant par leur nom, et gère l'arrêt propre (en tuant tous les processus enfants) avec `Ctrl+C`.

### 4. Lancer le Script de Test
Une fois que le script `start-all.js` affiche que les services et serveurs gRPC tournent, ouvrez un nouveau terminal et lancez le test automatique :
```bash
node test.js
```
