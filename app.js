document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENT REFERENCES ---
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarContent = document.getElementById('sidebar-content');
    const mapElement = document.getElementById('map');
    
    // --- APP STATE ---
    let fishData = new Map();
    let locationsData = [];
    let ukhoStations = [];
    let currentMark = null;

    // --- INITIALIZE MAP ---
    const map = L.map(mapElement).setView([54.5, -2.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- HELPER FUNCTIONS ---
    function parseCoord(coordString) {
        if (!coordString || typeof coordString !== 'string') return 0;
        const cleanedString = coordString.replace(/°/g, '').trim();
        const parts = cleanedString.split(' ');
        let value = parseFloat(parts[0]);
        if (isNaN(value)) return 0;
        value = Math.abs(value);
        const direction = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
        if (direction === 'S' || direction === 'W') value = -value;
        return value;
    }

    // Add this new function to handle the visit counter
    async function updateVisitCounter() {
        const counterEl = document.getElementById('visit-counter');
        try {
            const response = await fetch('api/count');
            if (!response.ok) {
                throw new Error('Failed to fetch visit count');
            }
            const data = await response.json();
            counterEl.textContent = data.count;
        } catch (error) {
            counterEl.textContent = 'N/A';
            console.error('Error fetching visit count:', error);
        }
    }

    /**
     * Converts a WMO weather code into a display icon.
     * @param {number} wmoCode The weather code from the API.
     * @returns {string} An emoji representing the weather.
     */
    function getWeatherIcon(wmoCode) {
        if (wmoCode === 0) return '☀️'; // Clear sky
        if (wmoCode >= 1 && wmoCode <= 3) return '☁️'; // Mainly clear, partly cloudy, overcast
        if (wmoCode >= 45 && wmoCode <= 48) return '🌫️'; // Fog
        if (wmoCode >= 51 && wmoCode <= 57) return '🌦️'; // Drizzle
        if (wmoCode >= 61 && wmoCode <= 67) return '🌧️'; // Rain
        if (wmoCode >= 71 && wmoCode <= 77) return '❄️'; // Snow
        if (wmoCode >= 80 && wmoCode <= 82) return '🌧️'; // Rain showers (Corrected)
        if (wmoCode >= 85 && wmoCode <= 86) return '🌨️'; // Snow showers
        if (wmoCode >= 95 && wmoCode <= 99) return '⛈️'; // Thunderstorm
        return '❓'; // Default case
    }

    // --- DATA LOADING ---
    async function loadData() {
        try {
            // The API call for stations is now a serverless function.
            const [fishResponse, locationsResponse, stationsResponse] = await Promise.all([
                fetch('fish.json'),
                fetch('locations.json'),
                fetch('/.netlify/functions/get-stations')
            ]);

            if (!fishResponse.ok || !locationsResponse.ok) throw new Error('Could not load local data files.');
            
            fishData = new Map((await fishResponse.json()).map(fish => [fish.id, fish]));
            locationsData = await locationsResponse.json();

            if(stationsResponse.ok) {
                ukhoStations = (await stationsResponse.json()).features;
            } else {
                console.warn("Could not load UKHO tide stations. Tide predictions will be unavailable.");
            }
            
            initializeMarkers();
        } catch (error) {
            console.error('Failed to load data:', error);
            sidebarContent.innerHTML = `<h2>Error</h2><p>Could not load essential fishing data. Please check the console. If you are running this locally, the Netlify serverless functions may not work.</p>`;
            sidebar.classList.remove('sidebar-hidden');
        }
    }
    
    // --- MAP MARKER INITIALIZATION ---
    function initializeMarkers() {
        locationsData.forEach(location => {
            const lat = parseCoord(location.latitude);
            const lon = parseCoord(location.longitude);
            const marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup(`<b>${location.name}</b>`);
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                currentMark = location;
                showLocationDetails(location);
            });
        });
    }

    // --- UI DISPLAY FUNCTIONS ---
    function showLocationDetails(location) {
        const description = `A ${location.markType} in ${location.county}, near ${location.nearestTown}.`;
        sidebarContent.innerHTML = `
            <h2 id="location-name">${location.name}</h2>
            <p id="location-description">${description}</p>
            <div class="info-section" id="weather-section">
                <h3><span>Weather</span><div class="forecast-toggle" id="weather-toggle"><button class="active" data-days="1">1 Day</button><button data-days="7">7 Day</button></div></h3>
                <div id="weather-content"><p>Loading weather...</p></div>
            </div>
            <div class="info-section" id="tide-section">
                 <h3><span>Tide Predictions</span><div class="forecast-toggle" id="tide-toggle"><button class="active" data-days="1">1 Day</button><button data-days="7">7 Day</button></div></h3>
                <div id="tide-content"><p>Loading tides...</p></div>
            </div>
            <div class="info-section" id="species-section"><h3>Likely Catches</h3><div id="species-grid"></div></div>
            <div class="info-section" id="regulations-section"><h3>Regulations</h3><p>Always check local and national regulations before fishing.</p></div>
        `;
        
        updateSpeciesGrid(location);
        addEventListeners(location);
        const lat = parseCoord(location.latitude);
        const lon = parseCoord(location.longitude);
        fetchAndDisplayWeather(lat, lon, 1);
        fetchAndDisplayTides(lat, lon, 1);
        sidebar.classList.remove('sidebar-hidden');
    }

    function updateSpeciesGrid(location) {
        const speciesGrid = document.getElementById('species-grid');
        if(!speciesGrid) return;
        let speciesHtml = '';
        location.targetableSpecies.forEach(speciesId => {
            const fish = fishData.get(speciesId);
            if (fish) {
                const imageUrl = `https://placehold.co/100x100/e3f2fd/0d47a1?text=${encodeURIComponent(fish.commonName)}`;
                speciesHtml += `<div class="species-card" data-fish-id="${fish.id}" role="button" tabindex="0"><img src="${imageUrl}" alt="${fish.commonName}" onerror="this.onerror=null;this.src='https://placehold.co/100x100/cccccc/333333?text=Error';"><p>${fish.commonName}</p></div>`;
            }
        });
        speciesGrid.innerHTML = speciesHtml;
    }

    function addEventListeners(location) {
        const lat = parseCoord(location.latitude);
        const lon = parseCoord(location.longitude);
        document.getElementById('weather-toggle')?.addEventListener('click', (e) => handleToggle(e, (days) => fetchAndDisplayWeather(lat, lon, days)));
        document.getElementById('tide-toggle')?.addEventListener('click', (e) => handleToggle(e, (days) => fetchAndDisplayTides(lat, lon, days)));
        sidebarContent.querySelectorAll('.species-card').forEach(card => {
            card.addEventListener('click', () => showFishDetails(card.dataset.fishId));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') showFishDetails(card.dataset.fishId);
            });
        });
    }

    function handleToggle(event, fetchFn) {
        if (event.target.tagName === 'BUTTON') {
            const button = event.target;
            const parent = button.parentElement;
            parent.querySelector('.active').classList.remove('active');
            button.classList.add('active');
            fetchFn(parseInt(button.dataset.days, 10));
        }
    }

    function showFishDetails(fishId) {
        const fish = fishData.get(fishId);
        if (!fish) return;
        const createList = (items) => items && items.length > 0 ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p>None specified.</p>';
        const imageUrl = `https://placehold.co/600x400/e3f2fd/0d47a1?text=${encodeURIComponent(fish.commonName)}`;
        sidebarContent.innerHTML = `
            <button id="back-to-mark-btn" class="back-button">← Back to Mark</button>
            <div class="fish-detail-view">
                <h2 class="fish-title">${fish.commonName}</h2>
                <p class="fish-subtitle"><em>${fish.scientificName}</em> (${fish.family})</p>
                <img src="${imageUrl}" alt="${fish.commonName}" class="fish-image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/cccccc/333333?text=Error';">
                <div class="info-section"><h3>Description</h3><p>${fish.description}</p></div>
                <div class="info-section"><h3>Habitat & Behaviour</h3><p>${fish.habitatAndBehaviour}</p></div>
                <div class="info-section"><h3>Angling Information</h3><p><strong>Minimum Size:</strong> ${fish.minimumSizeCm > 0 ? `${fish.minimumSizeCm} cm` : 'N/A - Catch & Release Recommended'}</p></div>
                <div class="info-section"><h3>Recommended Baits</h3>${createList(fish.baits)}</div>
                <div class="info-section"><h3>Effective Lures</h3>${createList(fish.lures)}</div>
                <div class="info-section"><h3>Recommended Rig</h3><p>${fish.rig || 'Not specified.'}</p></div>
                ${fish.conservationNote ? `<div class="info-section"><h3>Conservation</h3><p>${fish.conservationNote}</p></div>` : ''}
                ${fish.identificationNote ? `<div class="info-section"><h3>Identification Note</h3><p>${fish.identificationNote}</p></div>` : ''}
            </div>
        `;
        document.getElementById('back-to-mark-btn').addEventListener('click', () => {
            if (currentMark) showLocationDetails(currentMark);
        });
    }

    // --- API & DYNAMIC CONTENT FUNCTIONS ---
    async function fetchAndDisplayWeather(lat, lon, days) {
        const weatherEl = document.getElementById('weather-content');
        if (!weatherEl) return;
        weatherEl.innerHTML = '<p>Fetching weather...</p>';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,windspeed_10m_max&forecast_days=${days}&timezone=auto`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Weather data not available.');
            const data = await response.json();
            let html = '<div class="weather-forecast-grid">';
            for (let i = 0; i < data.daily.time.length; i++) {
                const date = new Date(data.daily.time[i]);
                const day = i === 0 ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' });

                // 1. Get the weather icon
                const icon = getWeatherIcon(data.daily.weathercode[i]);

                // 2. Convert wind speed from kph to mph (1 kph = 0.621371 mph)
                const windMph = Math.round(data.daily.windspeed_10m_max[i] * 0.621371);

                // 3. Update the HTML string with the icon and new wind speed
                html += `
                    <div class="weather-card">
                        <p class="day">${day}</p>
                        <p class="weather-icon">${icon}</p>
                        <p>${Math.round(data.daily.temperature_2m_max[i])}°C</p>
                        <p>${windMph} mph</p>
                    </div>`;
            }
            html += '</div>';
            weatherEl.innerHTML = html;
        } catch (error) {
            weatherEl.innerHTML = `<p>Could not load weather data. ${error.message}</p>`;
        }
    }

    async function fetchAndDisplayTides(lat, lon, days) {
        const tideEl = document.getElementById('tide-content');
        if (!tideEl) return;
        tideEl.innerHTML = '<p>Finding nearest tide station...</p>';
        if (ukhoStations.length === 0) {
            tideEl.innerHTML = `<p>Tide station data is unavailable.</p>`;
            return;
        }
        let nearestStation = null;
        let minDistance = Infinity;
        ukhoStations.forEach(station => {
            const [stLon, stLat] = station.geometry.coordinates;
            const distance = Math.sqrt(Math.pow(lat - stLat, 2) + Math.pow(lon - stLon, 2));
            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = station;
            }
        });
        if (!nearestStation) {
            tideEl.innerHTML = `<p>Could not find a nearby tide station.</p>`;
            return;
        }
        tideEl.innerHTML = `<p>Getting predictions for ${nearestStation.properties.Name}...</p>`;
        const stationId = nearestStation.properties.Id;
        
        // This is now a serverless function call.
        const url = `/.netlify/functions/get-tides?stationId=${stationId}&days=${days}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Tidal data not available for this station (Status: ${response.status}).`);
            const data = await response.json();
            if (data.length === 0) {
                tideEl.innerHTML = `<p>No tide predictions available for ${nearestStation.properties.Name}.</p>`;
                return;
            }
            let html = `<p style="font-size:0.8em; margin-bottom: 8px;">From ${nearestStation.properties.Name}</p><table class="tide-table">`;
            let currentDate = '';
            data.forEach(event => {
                const eventDate = new Date(event.DateTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                if (eventDate !== currentDate) {
                    html += `<tr><td colspan="3"><strong>${eventDate}</strong></td></tr>`;
                    currentDate = eventDate;
                }
                const time = new Date(event.DateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const typeClass = event.EventType === 'HighWater' ? 'tide-type-high' : 'tide-type-low';
                html += `<tr><td class="${typeClass}">${event.EventType === 'HighWater' ? 'High' : 'Low'}</td><td>${time}</td><td>${event.Height.toFixed(2)} m</td></tr>`;
            });
            html += '</table>';
            tideEl.innerHTML = html;
        } catch (error) {
            tideEl.innerHTML = `<p>Could not load tide data. ${error.message}</p>`;
        }
    }

    // --- GLOBAL EVENT LISTENERS ---
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('sidebar-hidden'));
    map.on('click', () => sidebar.classList.add('sidebar-hidden'));
    
    // --- INITIALIZATION ---
    loadData();

    updateVisitCounter();
});
