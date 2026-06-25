const typeDefs = `#graphql
  type Order {
    id: ID!
    customer_id: String!
    pickup_address: String!
    delivery_address: String!
    status: String!
    items: String!
    price: Float!
    created_at: String!
  }

  type Driver {
    id: ID!
    name: String!
    vehicle: String!
    status: String!
    latitude: Float!
    longitude: Float!
  }

  type Delivery {
    id: ID!
    order_id: ID!
    driver_id: ID!
    status: String!
    assigned_at: String!
    picked_up_at: String!
    delivered_at: String!
  }

  type Query {
    order(id: ID!): Order
    orders: [Order]
    driver(id: ID!): Driver
    drivers: [Driver]
    delivery(id: ID!): Delivery
    deliveries: [Delivery]
    deliveryByOrder(order_id: ID!): Delivery
  }

  type Mutation {
    createOrder(customer_id: String!, pickup_address: String!, delivery_address: String!, items: String!, price: Float!): Order
    createDriver(name: String!, vehicle: String!): Driver
    updateDriverLocation(id: ID!, latitude: Float!, longitude: Float!): Driver
    updateDeliveryStatus(id: ID!, status: String!): Delivery
  }
`;

module.exports = typeDefs;
