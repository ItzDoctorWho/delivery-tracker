const { orderClient } = require('../config/grpc');

const orderService = {
  create: (data) => new Promise((resolve, reject) => {
    orderClient.createOrder(data, (err, res) => err ? reject(err) : resolve(res));
  }),
  get: (id) => new Promise((resolve, reject) => {
    orderClient.getOrder({ id }, (err, res) => err ? reject(err) : resolve(res));
  }),
  updateStatus: (id, status) => new Promise((resolve, reject) => {
    orderClient.updateOrderStatus({ id, status }, (err, res) => err ? reject(err) : resolve(res));
  }),
  list: () => new Promise((resolve, reject) => {
    orderClient.listOrders({}, (err, res) => err ? reject(err) : resolve(res.orders || []));
  })
};

module.exports = orderService;
