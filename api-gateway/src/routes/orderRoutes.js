const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { grpc } = require('../config/grpc');

router.post('/', async (req, res) => {
  try {
    const order = await orderService.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await orderService.get(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(err.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const orders = await orderService.list();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
