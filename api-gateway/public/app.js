// DelivX Live Tracking Dashboard Logic - Leaflet & Sousse Routing

const API_BASE = '/api';
const POLL_INTERVAL_MS = 2500;

// Sousse Restaurants (Coordinates and metadata)
const SOUSSE_RESTAURANTS = [
    { name: "L'Escargot", lat: 35.8431, lng: 10.6315, desc: "Gourmet Dining" },
    { name: "La Villa", lat: 35.8388, lng: 10.6341, desc: "Fine Mediterranean Cuisine" },
    { name: "Restaurant Bonaparte", lat: 35.8295, lng: 10.6391, desc: "Popular Seafood Restaurant" },
    { name: "Café la Grotte", lat: 35.8251, lng: 10.6384, desc: "Seaside Traditional Café" },
    { name: "Hard Rock Cafe", lat: 35.8924, lng: 10.5986, desc: "Port El Kantaoui" }
];

// Map Initialization (Centered on Sousse city center)
const map = L.map('map').setView([35.8256, 10.63699], 13);

// Dark Theme Tile Layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Custom Icons
const violetIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const restaurantIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    popupAnchor: [1, -30],
    shadowSize: [32, 32]
});

// Setup Location Pickers (Draggable Markers)
let deliveryMarker = L.marker([35.8200, 10.6400], { icon: blueIcon, draggable: true }).addTo(map);
deliveryMarker.bindPopup("<b>Delivery Destination (B)</b><br>Drag me!").openPopup();

// Robust Coordinate Extractor (handles "Address Name (lat, lng)" and "lat, lng")
function parseCoords(addressString) {
    if (!addressString) return [0, 0];
    const match = addressString.match(/\(([^)]+)\)/);
    if (match) {
        return match[1].split(',').map(Number);
    }
    return addressString.split(',').map(Number);
}

// Reverse Geocode coordinates via OSM Nominatim API
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.display_name) {
                // Shorten the address to make it look clean (Street, City)
                const parts = data.display_name.split(',');
                const shortAddress = parts.slice(0, 2).join(',').trim();
                return shortAddress || "Custom Location";
            }
        }
    } catch (e) {
        console.warn("Geocoding service unavailable, falling back to coordinates.");
    }
    return "Custom Location";
}

// Sync Coordinates and human-friendly address names to Form Inputs
async function syncFormCoords(marker, inputId, defaultName) {
    const pos = marker.getLatLng();
    const inputEl = document.getElementById(inputId);
    inputEl.value = `${defaultName} (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`;
}

// Triggered when user stops dragging to perform Nominatim reverse geocode
async function handleMarkerDragEnd(marker, inputId, labelPrefix) {
    const pos = marker.getLatLng();
    const inputEl = document.getElementById(inputId);
    inputEl.value = `Loading address...`;
    
    const addressName = await reverseGeocode(pos.lat, pos.lng);
    inputEl.value = `${addressName} (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`;
}

deliveryMarker.on('drag', () => syncFormCoords(deliveryMarker, 'deliveryAddress', 'Delivery Point'));
deliveryMarker.on('dragend', () => handleMarkerDragEnd(deliveryMarker, 'deliveryAddress', 'Delivery'));

// Initial Sync
syncFormCoords(deliveryMarker, 'deliveryAddress', 'Delivery Point');

// Add Restaurant Markers
SOUSSE_RESTAURANTS.forEach(rest => {
    const restMarker = L.marker([rest.lat, rest.lng], { icon: restaurantIcon }).addTo(map);
    restMarker.bindPopup(`<b>${rest.name}</b><br>${rest.desc}<br><button class="mt-1.5 px-2 py-0.5 rounded text-[10px] bg-purple-600 hover:bg-purple-500 font-bold text-white shadow" onclick="setPickupFromRestaurant(${rest.lat}, ${rest.lng}, '${rest.name}')">Set as Pickup</button>`);
});

function setPickupFromRestaurant(lat, lng, name) {
    const selectEl = document.getElementById('pickupAddress');
    const valueToSet = `${name} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    selectEl.value = valueToSet;
    logConsole(`Pickup point set to restaurant: ${name}`, 'info');
}

// Populate Pickup Restaurants Dropdown
const pickupSelect = document.getElementById('pickupAddress');
pickupSelect.innerHTML = SOUSSE_RESTAURANTS.map((rest, index) => 
    `<option value="${rest.name} (${rest.lat.toFixed(5)}, ${rest.lng.toFixed(5)})" data-lat="${rest.lat}" data-lng="${rest.lng}" ${index === 0 ? 'selected' : ''}>${rest.name}</option>`
).join('');

// Populate price calculation handler
const itemsSelect = document.getElementById('items');
const quantityInput = document.getElementById('quantity');
const priceInput = document.getElementById('price');

function updateCalculatedPrice() {
    const selectedOption = itemsSelect.options[itemsSelect.selectedIndex];
    const unitPrice = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const qty = parseInt(quantityInput.value) || 1;
    priceInput.value = (unitPrice * qty).toFixed(2);
}

itemsSelect.addEventListener('change', updateCalculatedPrice);
quantityInput.addEventListener('input', updateCalculatedPrice);
updateCalculatedPrice(); // initial call

// Application State
let state = {
    orders: [],
    drivers: [],
    deliveries: [],
    simulations: {} // id: { driver_marker, path: [], currentIndex, phase }
};

// Map Layer Groups for Dynamic Markers/Lines
const driverLayerGroup = L.layerGroup().addTo(map);
const routeLayerGroup = L.layerGroup().addTo(map);

// Terminal Log Helper
function logConsole(message, type = 'system') {
    const consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) return;

    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.innerText = `[${time}] ${message}`;

    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// REST API calls
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (err) {
        logConsole(`API Error (${endpoint}): ${err.message}`, 'error');
        throw err;
    }
}

// Fetch OSRM Route (Sousse Road Network)
async function fetchOSRMRoute(startLat, startLng, endLat, endLng) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM routing request failed");
        
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
            // Returns coordinates array in [lng, lat] format
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        return [];
    } catch (err) {
        logConsole(`OSRM Routing Error (Sousse): ${err.message}. Using straight line instead.`, 'error');
        // Fallback to straight line coordinate array
        return [[startLat, startLng], [endLat, endLng]];
    }
}

// Refresh Data Loop
async function refreshData() {
    try {
        const [orders, drivers, deliveries] = await Promise.all([
            fetchAPI('/orders'),
            fetchAPI('/drivers'),
            fetchAPI('/deliveries')
        ]);

        state.orders = orders;
        state.drivers = drivers;
        state.deliveries = deliveries;

        updateMetrics();
        renderDriversList();
        renderDeliveriesList();
        renderOrdersList();
        drawDriverMarkers();
    } catch (err) {
        console.error("Data refresh failed", err);
    }
}

// Render All Orders in the Right Column
function renderOrdersList() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    if (state.orders.length === 0) {
        list.innerHTML = `<div class="flex items-center justify-center h-full border border-dashed border-white/5 rounded-xl text-sm text-slate-500">No orders placed.</div>`;
        return;
    }

    // Sort orders by created_at desc (newest first)
    const sortedOrders = [...state.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    list.innerHTML = sortedOrders.map(order => {
        let badgeClass = 'bg-white/5 text-slate-400 border border-white/10';
        let statusLabel = order.status;

        if (order.status === 'PENDING') {
            badgeClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
        } else if (order.status === 'ASSIGNED') {
            badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        } else if (order.status === 'PICKED_UP') {
            badgeClass = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        } else if (order.status === 'DELIVERED') {
            badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        } else if (order.status === 'CANCELLED') {
            badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
        }

        const friendlyPickup = order.pickup_address.split('(')[0].trim();
        const friendlyDest = order.delivery_address.split('(')[0].trim();

        return `
            <div class="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1.5 hover:border-white/20 hover:bg-white/10 transition-all duration-200">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-xs text-slate-300">Order #${order.id.substring(0, 5)}</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="text-xs font-semibold text-slate-100">${order.items}</div>
                <div class="flex justify-between text-[11px] text-slate-400">
                    <span class="truncate max-w-[200px]" title="${friendlyPickup} ➔ ${friendlyDest}"><i class="fa-solid fa-arrow-right-long text-purple-400 mr-0.5"></i> ${friendlyPickup} ➔ ${friendlyDest}</span>
                    <span class="font-bold text-slate-300">$${parseFloat(order.price).toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Update Dashboard Header Cards
function updateMetrics() {
    document.querySelector('#metricOrders .metric-value').innerText = state.orders.length;
    document.querySelector('#metricActiveDeliveries .metric-value').innerText = 
        state.deliveries.filter(d => ['ASSIGNED', 'PICKED_UP'].includes(d.status)).length;
    
    document.querySelector('#metricDriversAvailable .metric-value').innerText = 
        state.drivers.filter(d => d.status === 'AVAILABLE').length;
    document.querySelector('#metricDriversBusy .metric-value').innerText = 
        state.drivers.filter(d => d.status === 'BUSY').length;
}

// Render Drivers in the Right Column
function renderDriversList() {
    const list = document.getElementById('driversList');
    if (state.drivers.length === 0) {
        list.innerHTML = `<div class="flex items-center justify-center h-full border border-dashed border-white/5 rounded-xl text-sm text-slate-500">No registered drivers.</div>`;
        return;
    }

    list.innerHTML = state.drivers.map(driver => {
        const isBusy = driver.status === 'BUSY';
        const badgeClass = driver.status === 'AVAILABLE' 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : (isBusy ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-slate-400 border border-white/10');
        const statusLabel = driver.status === 'AVAILABLE' ? 'Available' : (isBusy ? 'Busy' : 'Offline');
        
        return `
            <div class="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col gap-2 relative overflow-hidden hover:border-white/20 hover:bg-white/10 transition-all duration-200" id="driver-card-${driver.id}">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-sm">${driver.name}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="flex gap-3 text-xs text-slate-400">
                    <span><i class="fa-solid fa-bicycle text-purple-400"></i> ${driver.vehicle}</span>
                    <span><i class="fa-solid fa-location-dot text-cyan-400"></i> [${driver.latitude.toFixed(4)}, ${driver.longitude.toFixed(4)}]</span>
                </div>
            </div>
        `;
    }).join('');
}

// Render Active Deliveries & Actions
function renderDeliveriesList() {
    const list = document.getElementById('deliveriesList');
    const activeDeliveries = state.deliveries.filter(d => d.status !== 'DELIVERED' && d.status !== 'CANCELLED');

    if (activeDeliveries.length === 0) {
        list.innerHTML = `<div class="flex items-center justify-center h-full border border-dashed border-white/5 rounded-xl text-sm text-slate-500">No active deliveries.</div>`;
        return;
    }

    list.innerHTML = activeDeliveries.map(delivery => {
        const order = state.orders.find(o => o.id === delivery.order_id);
        const driver = state.drivers.find(d => d.id === delivery.driver_id);
        
        const driverName = driver ? driver.name : 'Unknown';
        const items = order ? order.items : 'Items';
        const pickup = order ? order.pickup_address : '?';
        const dest = order ? order.delivery_address : '?';

        // Extract friendly name for the card (ignoring coordinates suffix)
        const friendlyPickup = pickup.split('(')[0].trim();
        const friendlyDest = dest.split('(')[0].trim();

        let badgeClass = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        let statusLabel = delivery.status;
        let actionButton = '';

        if (delivery.status === 'ASSIGNED') {
            badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            statusLabel = 'Assigned';
            actionButton = `
                <button class="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 active:scale-95 transition-all flex items-center gap-1 shadow-lg shadow-purple-500/20" onclick="simulateDeliveryTrip('${delivery.id}')">
                    <i class="fa-solid fa-route"></i> Simulate Trip
                </button>`;
        } else if (delivery.status === 'PICKED_UP') {
            badgeClass = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
            statusLabel = 'Out for Delivery';
            actionButton = `
                <button class="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-white hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-1 shadow-lg shadow-cyan-500/20" onclick="updateDeliveryStatus('${delivery.id}', 'DELIVERED')">
                    <i class="fa-solid fa-check"></i> Complete
                </button>`;
        }

        return `
            <div class="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col gap-2 relative overflow-hidden hover:border-white/20 hover:bg-white/10 transition-all duration-200">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-sm">Delivery #${delivery.id.substring(0, 5)}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="text-xs text-slate-300 font-medium">${items}</div>
                <div class="flex gap-3 text-xs text-slate-400">
                    <span><i class="fa-solid fa-user-ninja text-purple-400"></i> ${driverName}</span>
                    <span class="truncate" title="${friendlyPickup} ➔ ${friendlyDest}"><i class="fa-solid fa-arrow-right-long text-cyan-400"></i> ${friendlyPickup} ➔ ${friendlyDest}</span>
                </div>
                ${actionButton ? `<div class="flex gap-2 mt-1">${actionButton}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Drawing/Updating Driver Locations on Leaflet
function drawDriverMarkers() {
    driverLayerGroup.clearLayers();

    state.drivers.forEach(driver => {
        let lat = driver.latitude;
        let lng = driver.longitude;

        // Default coordinate setup if they are new / uninitialized (0, 0)
        if (lat === 0 && lng === 0) {
            lat = 35.8256;
            lng = 10.63699;
        }

        const isBusy = driver.status === 'BUSY';
        const color = isBusy ? '#f59e0b' : '#10b981';

        // Draw a neat pulsing Circle Marker for each active driver
        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.95
        }).addTo(driverLayerGroup);

        marker.bindPopup(`<b>${driver.name}</b><br>Vehicle: ${driver.vehicle}<br>Status: ${driver.status}`);
    });
}

// Handle Form Submissions
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const customer_id = document.getElementById('customerId').value;
    const pickup_address = document.getElementById('pickupAddress').value;
    const delivery_address = document.getElementById('deliveryAddress').value;
    const item_name = document.getElementById('items').value;
    const quantity = document.getElementById('quantity').value;
    const items = `${quantity}x ${item_name}`;
    const price = parseFloat(document.getElementById('price').value);

    try {
        logConsole(`Submitting order for ${customer_id}...`, 'info');
        const order = await fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify({ customer_id, pickup_address, delivery_address, items, price })
        });
        logConsole(`[REST] Order created: ID ${order.id} | Status: ${order.status}`, 'event-tx');
        logConsole(`[KAFKA] Event 'order.created' broadcasted in Kafka topic!`, 'event-rx');
        
        document.getElementById('orderForm').reset();
        syncFormCoords(deliveryMarker, 'deliveryAddress', 'Delivery Point');
        updateCalculatedPrice();
        await refreshData();
    } catch (err) {
        logConsole(`Order submission failed: ${err.message}`, 'error');
    }
});

document.getElementById('driverForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('driverName').value;
    const vehicle = document.getElementById('vehicle').value;

    try {
        logConsole(`Registering driver ${name}...`, 'info');
        // Initial coordinates for new driver placed around Sousse center
        const driver = await fetchAPI('/drivers', {
            method: 'POST',
            body: JSON.stringify({ name, vehicle })
        });
        logConsole(`[REST] Driver registered: ID ${driver.id}`, 'event-tx');
        
        // Update their location immediately to Sousse center
        await fetch(`${API_BASE}/drivers/${driver.id}/location`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: 35.8256, longitude: 10.63699 })
        });
        
        document.getElementById('driverForm').reset();
        await refreshData();
    } catch (err) {
        logConsole(`Registration failed: ${err.message}`, 'error');
    }
});

document.getElementById('clearConsole').addEventListener('click', () => {
    document.getElementById('consoleOutput').innerHTML = '';
});

// Update Delivery Status via REST
async function updateDeliveryStatus(id, status) {
    try {
        logConsole(`Updating delivery status ${id.substring(0, 5)} ➔ ${status}...`, 'info');
        const updated = await fetchAPI(`/deliveries/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        logConsole(`[REST] Delivery updated: ${updated.status}`, 'event-tx');
        
        if (status === 'DELIVERED') {
            logConsole(`[KAFKA] Event 'delivery.delivered' broadcasted! Driver is free.`, 'event-rx');
            // Remove drawn path line
            routeLayerGroup.clearLayers();
        }
        await refreshData();
    } catch (err) {
        logConsole(`Update failed: ${err.message}`, 'error');
    }
}

// OSRM Routing and Step-by-Step Simulation along roads
async function simulateDeliveryTrip(deliveryId) {
    const delivery = state.deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    const order = state.orders.find(o => o.id === delivery.order_id);
    const driver = state.drivers.find(d => d.id === delivery.driver_id);
    if (!order || !driver) return;

    // Robust extraction of coordinates from order strings (Format: "Address (lat, lng)")
    const pickupCoords = parseCoords(order.pickup_address);
    const destCoords = parseCoords(order.delivery_address);

    const driverLat = driver.latitude === 0 ? 35.8256 : driver.latitude;
    const driverLng = driver.longitude === 0 ? 10.63699 : driver.longitude;

    logConsole(`Calculating road route for ${driver.name} via OSRM...`, 'info');
    
    // Fetch route coordinates from current driver location to pickup location
    const routeToPickup = await fetchOSRMRoute(driverLat, driverLng, pickupCoords[0], pickupCoords[1]);
    
    if (routeToPickup.length === 0) {
        logConsole("Unable to load route from OSRM. Simulation aborted.", "error");
        return;
    }

    // Draw route polyline
    routeLayerGroup.clearLayers();
    const polyline = L.polyline(routeToPickup, { color: '#a78bfa', weight: 4, dashArray: '5, 10' }).addTo(routeLayerGroup);
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // Store in active simulations state
    state.simulations[deliveryId] = {
        driver_id: driver.id,
        phase: 'TO_PICKUP',
        path: routeToPickup,
        currentIndex: 0,
        pickupCoords: pickupCoords,
        destCoords: destCoords,
        delivery_id: deliveryId
    };
}

// Update Active Simulation Positions (Running every 800ms)
async function processSimulations() {
    for (const [deliveryId, sim] of Object.entries(state.simulations)) {
        if (sim.currentIndex < sim.path.length) {
            const nextCoord = sim.path[sim.currentIndex];
            sim.currentIndex++;

            // Push coordinate updates back to API server (updates DB)
            try {
                await fetch(`${API_BASE}/drivers/${sim.driver_id}/location`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latitude: nextCoord[0], longitude: nextCoord[1] })
                });
            } catch (err) {
                console.error("Simulation location sync failed", err);
            }
        } else {
            // Reached destination for current phase
            if (sim.phase === 'TO_PICKUP') {
                logConsole(`Driver arrived at pickup location! Collecting package.`, 'info');
                await updateDeliveryStatus(deliveryId, 'PICKED_UP');
                
                // Fetch next route segment from Pickup point to final destination
                logConsole(`Calculating route to final destination...`, 'info');
                const routeToDest = await fetchOSRMRoute(sim.pickupCoords[0], sim.pickupCoords[1], sim.destCoords[0], sim.destCoords[1]);
                
                // Redraw line for destination trip
                routeLayerGroup.clearLayers();
                L.polyline(routeToDest, { color: '#06b6d4', weight: 4 }).addTo(routeLayerGroup);

                sim.phase = 'TO_DESTINATION';
                sim.path = routeToDest;
                sim.currentIndex = 0;
            } else {
                // Trip finished
                logConsole(`Delivery completed successfully by driver!`, 'info');
                await updateDeliveryStatus(deliveryId, 'DELIVERED');
                delete state.simulations[deliveryId];
            }
        }
    }
}

// Initial triggers
refreshData();
setInterval(refreshData, POLL_INTERVAL_MS);

// Fast simulation loop for smooth marker transition updates on the map
setInterval(processSimulations, 800);
