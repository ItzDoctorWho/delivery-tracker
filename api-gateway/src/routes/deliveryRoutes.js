const express = require('express');
const router = express.Router();
const deliveryService = require('../services/deliveryService');

router.get('/', async (req, res) => {
  try {
    const deliveries = await deliveryService.list();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await deliveryService.updateStatus(req.params.id, status);
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
