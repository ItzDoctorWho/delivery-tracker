const { createRxDatabase } = require('rxdb');
const { getRxStorageLoki } = require('rxdb/plugins/storage-lokijs');
const LokiFsStructuredAdapter = require('lokijs/src/loki-fs-structured-adapter.js');

const deliverySchema = {
  title: 'delivery schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    order_id: { type: 'string' },
    driver_id: { type: 'string' },
    status: { type: 'string' }, // ASSIGNED, PICKED_UP, DELIVERED, CANCELLED
    assigned_at: { type: 'string' },
    picked_up_at: { type: 'string' },
    delivered_at: { type: 'string' }
  },
  required: ['id', 'order_id', 'driver_id', 'status', 'assigned_at', 'picked_up_at', 'delivered_at']
};

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase({
        name: 'deliverydb',
        storage: getRxStorageLoki({
          adapter: new LokiFsStructuredAdapter()
        })
      });
      await db.addCollections({
        deliveries: {
          schema: deliverySchema
        }
      });
      return db;
    })();
  }
  return dbPromise;
}

module.exports = { getDB };
