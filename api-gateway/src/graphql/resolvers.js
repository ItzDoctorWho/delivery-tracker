const orderService = require('../services/orderService');
const driverService = require('../services/driverService');
const deliveryService = require('../services/deliveryService');

const resolvers = {
  Query: {
    order: (_, { id }) => orderService.get(id),
    orders: () => orderService.list(),
    driver: (_, { id }) => driverService.get(id),
    drivers: () => driverService.list(),
    delivery: (_, { id }) => deliveryService.get(id),
    deliveries: () => deliveryService.list(),
    deliveryByOrder: (_, { order_id }) => deliveryService.getByOrder(order_id)
  },
  Mutation: {
    createOrder: (_, args) => orderService.create(args),
    createDriver: (_, args) => driverService.create(args),
    updateDriverLocation: (_, { id, latitude, longitude }) => driverService.updateLocation(id, latitude, longitude),
    updateDeliveryStatus: (_, { id, status }) => deliveryService.updateStatus(id, status)
  }
};

module.exports = resolvers;
