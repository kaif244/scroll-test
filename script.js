let map;
let userCoords = [17.6599, 75.9064]; // Default position (Solapur)
let markers = [];
let locationCircle = null;
let centerMarker = null; 
let debounceTimeout = null;

// Mobile Gesture Drawer Global State Tracking Vars
let touchStartY = 0;
let touchMoveY = 0;
const drawerState = { CURRENT: 'MID', EXPANDED: 'HIGH', COLLAPSED: 'LOW' };
let currentMobileState = drawerState.CURRENT;

const categoryConfig = {
    restaurant: { color: '#f59e0b', icon: 'fa-utensils' },
    pharmacy:   { color: '#10b981', icon: 'fa-pills' },
    hospital:   { color: '#ef4444', icon: 'fa-hospital' },
    police:     { color: '#3b82f6', icon: 'fa-shield-halved' },
    cafe:       { color: '#8b5cf6', icon: 'fa-mug-hot' },
    bank:       { color: '#64748b', icon: 'fa-building-columns' }
};

function initMap() {
    map = L.map('map', { zoomControl: false }).setView(userCoords, 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap'
    }).addTo(map);

    // Keep zoom controls safely accessible 
    L.control.zoom({ position: 'topright' }).addTo(map);

    map.on('click', function(e) {
        handleMapManualClick(e.latlng.lat, e.latlng.lng);
    });

    // Initialize Native Swipe Gesture Controls for Mobile Layouts
    initMobileDrawerEngine();

    setTimeout(() => {
        map.invalidateSize();
    }, 300);

    requestLiveLocation();
}

// ==========================================
// NEW: MOBILE INPUT GESTURE DRAG ALGORITHM
// ==========================================
function initMobileDrawerEngine() {
    const drawer = document.getElementById('sidebarDrawer');
    const resultsContainer = document.getElementById('results-panel');

    // Capture the exact location where the finger first touches the handle/header area
    drawer.addEventListener('touchstart', (e) => {
        // Only trigger drawer slide transitions if the user isn't actively scrolling inside the result lists
        if (resultsContainer.scrollTop === 0 || e.target.closest('.search-section') || e.target.classList.contains('drawer-handle')) {
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    drawer.addEventListener('touchmove', (e) => {
        if (window.innerWidth > 768) return; // Ignore on macbook screens

        touchMoveY = e.touches[0].clientY;
        const deltaY = touchMoveY - touchStartY;

        // User drags UPWARDS
        if (deltaY < -40 && currentMobileState !== drawerState.EXPANDED) {
            expandDrawer();
        }
        // User drags DOWNWARDS
        else if (deltaY > 40) {
            if (currentMobileState === drawerState.EXPANDED && resultsContainer.scrollTop === 0) {
                resetDrawerToMid();
            } else if (currentMobileState === drawerState.CURRENT) {
                collapseDrawer();
            }
        }
    }, { passive: true });
}

function expandDrawer() {
    const drawer = document.getElementById('sidebarDrawer');
    drawer.classList.remove('collapsed');
    drawer.classList.add('expanded');
    currentMobileState = drawerState.EXPANDED;
    // Offset map slightly so focus stays crisp
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function resetDrawerToMid() {
    const drawer = document.getElementById('sidebarDrawer');
    drawer.classList.remove('expanded', 'collapsed');
    currentMobileState = drawerState.CURRENT;
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function collapseDrawer() {
    const drawer = document.getElementById('sidebarDrawer');
    drawer.classList.remove('expanded');
    drawer.classList.add('collapsed');
    currentMobileState = drawerState.COLLAPSED;
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function handleMapManualClick(lat, lng) {
    userCoords = [lat, lng]; 
    clearPrevious();
    
    const radiusMeters = document.getElementById('radiusInput').value * 1000;
    const panel = document.getElementById('results-panel');

    if (locationCircle) {
        locationCircle.setLatLng(userCoords);
        locationCircle.setRadius(radiusMeters);
    } else {
        locationCircle = L.circle(userCoords, { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.1, radius: radiusMeters }).addTo(map);
    }

    if (centerMarker) map.removeLayer(centerMarker);
    
    const customCenterIcon = L.divIcon({
        html: `<div class="custom-map-marker" style="background:#1e1b4b; width:34px; height:34px; border-color:#4f46e5;"><i class="fa-solid fa-crosshairs" style="font-size:14px;"></i></div>`,
        className: 'center-marker-container',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
    
    centerMarker = L.marker(userCoords, { icon: customCenterIcon }).addTo(map).bindPopup("<b>Target Area Locked</b>").openPopup();
    
    panel.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-bullseye" style="color: #4f46e5; opacity: 1;"></i>
            <p>Target custom pin set successfully!<br>Now pick a discovery category below to find assets near this area.</p>
        </div>`;
        
    document.getElementById('categorySelect').selectedIndex = 0;
    
    // Smoothly ensure the menu control bar returns to viewport sight focus
    if (currentMobileState === drawerState.COLLAPSED) {
        resetDrawerToMid();
    }
}

function updateRadiusDisplay(val) {
    document.getElementById('radiusVal').innerText = `${val} km`;
    clearTimeout(debounceTimeout);
    const currentCategory = document.getElementById('categorySelect').value;
    if (currentCategory) {
        debounceTimeout = setTimeout(() => {
            findPlaces(currentCategory);
        }, 400);
    }
}

function requestLiveLocation() {
    const btn = document.getElementById('locateBtn');
    const panel = document.getElementById('results-panel');
    
    if (!navigator.geolocation) {
        panel.innerHTML = '<div class="empty-state"><p>Geolocation unsupported.</p></div>';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoords = [position.coords.latitude, position.coords.longitude];
            map.invalidateSize();
            map.flyTo(userCoords, 15, { duration: 1.8 });

            if (centerMarker) { map.removeLayer(centerMarker); centerMarker = null; }
            if (locationCircle) map.removeLayer(locationCircle);

            locationCircle = L.circle(userCoords, {
                color: '#4f46e5',
                fillColor: '#4f46e5',
                fillOpacity: 0.1,
                radius: document.getElementById('radiusInput').value * 1000
            }).addTo(map);

            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> Use My Current Location`;
            panel.innerHTML = '<div class="empty-state"><i class="fa-solid fa-street-view"></i><p>Position locked! Choose a discovery category or tap elsewhere on the map.</p></div>';
            
            document.getElementById('categorySelect').selectedIndex = 0;
            clearPrevious();
            if (window.innerWidth <= 768) resetDrawerToMid();
        },
        (error) => {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> Use My Current Location`;
            panel.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i><p>Location access denied.</p></div>`;
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

async function searchManualLocation() {
    const query = document.getElementById('locationInput').value;
    if (!query) return;

    const panel = document.getElementById('results-panel');
    panel.innerHTML = '<div class="empty-state"><p>Locating coordinates...</p></div>';

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data[0]) {
            userCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            map.invalidateSize();
            map.flyTo(userCoords, 14, { duration: 1.8 });
            clearPrevious();
            
            if (centerMarker) { map.removeLayer(centerMarker); centerMarker = null; }
            if (locationCircle) map.removeLayer(locationCircle);
            
            panel.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-building-circle-check"></i>
                    <p>Moved area to <b>${data[0].display_name.split(',')[0]}</b>.<br>Select a category to explore.</p>
                </div>`;
            document.getElementById('categorySelect').selectedIndex = 0;
            if (window.innerWidth <= 768) resetDrawerToMid();
        } else {
            panel.innerHTML = '<div class="empty-state"><p>Location name not found.</p></div>';
        }
    } catch (e) { 
        panel.innerHTML = '<div class="empty-state"><p>Connection failed.</p></div>'; 
    }
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return await response.json();
            if (response.status === 429 || response.status >= 500) {
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error("Server maxed out.");
}

async function findPlaces(type) {
    const panel = document.getElementById('results-panel');
    panel.innerHTML = '<div class="empty-state"><i class="fa-solid fa-satellite fa-spin"></i><p>Scanning radius...</p></div>';
    clearPrevious();

    // Auto-Expand drawer into full focus mode once results match
    if (window.innerWidth <= 768) expandDrawer();

    const chosenRadiusKm = document.getElementById('radiusInput').value;
    const radiusMeters = chosenRadiusKm * 1000;

    if (locationCircle) {
        locationCircle.setLatLng(userCoords);
        locationCircle.setRadius(radiusMeters);
    } else {
        locationCircle = L.circle(userCoords, { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.1, radius: radiusMeters }).addTo(map);
    }

    const query = `[out:json][timeout:25];node["amenity"="${type}"](around:${radiusMeters}, ${userCoords[0]}, ${userCoords[1]});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const data = await fetchWithRetry(url, 3, 1500);
        panel.innerHTML = "";

        if (!data.elements || data.elements.length === 0) {
            panel.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Zero matches inside ${chosenRadiusKm} km.</p></div>`;
            return;
        }

        const config = categoryConfig[type] || { color: '#6366f1', icon: 'fa-location-dot' };

        data.elements.forEach(item => {
            const name = item.tags.name || `Unnamed ${type}`;
            const distanceMeters = map.distance(userCoords, [item.lat, item.lon]);
            const distanceKm = (distanceMeters / 1000).toFixed(1);
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`;

            const customIcon = L.divIcon({
                html: `<div class="custom-map-marker" style="background:${config.color}; width:32px; height:32px;"><i class="fa-solid ${config.icon}" style="font-size:12px;"></i></div>`,
                className: 'marker-container-override',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([item.lat, item.lon], { icon: customIcon }).addTo(map).bindPopup(`<b>${name}</b><br>${distanceKm} km away`);
            markers.push(marker);

            const card = document.createElement('div');
            card.className = 'location-card';
            card.innerHTML = `
                <div class="icon-circle" style="background:${config.color}15; color:${config.color}">
                    <i class="fa-solid ${config.icon}"></i>
                </div>
                <div class="card-info">
                    <h4>${name}</h4>
                    <p>${distanceKm} km away</p>
                </div>
                <a href="${directionsUrl}" target="_blank" class="nav-link" title="Open Routing" onclick="event.stopPropagation();">
                    <i class="fa-solid fa-diamond-turn-right"></i>
                </a>`;
            
            card.onclick = () => {
                // Collapse the drawer slightly so the marker position popup window is visible on the map
                if (window.innerWidth <= 768) resetDrawerToMid();
                map.flyTo([item.lat, item.lon], 16);
                setTimeout(() => { marker.openPopup(); }, 400);
            };
            panel.appendChild(card);
        });
    } catch (e) { 
        panel.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color: #f59e0b"></i><p>Network delayed. Try re-selecting category.</p></div>'; 
    }
}

function clearPrevious() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

function handleSearch(e) { if (e.key === 'Enter') searchManualLocation(); }
window.onload = initMap;