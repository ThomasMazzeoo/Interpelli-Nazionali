// Link ai dati Open Source ISTAT (Confini Italia)
const URL_REGIONI = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson";
const URL_PROVINCE = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson";

let map;
let geojsonRegioni;
let geojsonProvince;
let livelloAttuale = 'regioni'; // Può essere 'regioni' o 'province'
let datiInterpelli = [];

// Elementi UI
const selectRegione = document.getElementById('regioneSelect');
const selectProvincia = document.getElementById('provinciaSelect');
const btnReset = document.getElementById('btnResetMappa');
const containerLista = document.getElementById('listaInterpelli');

// Inizializzazione al caricamento
document.addEventListener('DOMContentLoaded', async () => {
    inizializzaMappa();
    await caricaDatiScraper();
    
    // Event Listeners per i menu a tendina
    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', (e) => mostraInterpelli(selectRegione.value, e.target.value));
    btnReset.addEventListener('click', resetMappa);
});

// =========================================
// 1. GESTIONE MAPPA (Leaflet)
// =========================================
function inizializzaMappa() {
    // Centra l'Italia
    map = L.map('map', { zoomControl: false }).setView([41.8719, 12.5674], 6);
    
    // Aggiungiamo i controlli zoom in basso a destra
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Carichiamo uno sfondo molto pulito (Political Style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        minZoom: 5
    }).addTo(map);

    // Carica subito il layer delle Regioni
    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();

        // Rimuove province se ci sono
        if (geojsonProvince) map.removeLayer(geojsonProvince);
        
        geojsonRegioni = L.geoJSON(data, {
            style: {
                color: "#1e3a8a", // Blu scuro
                weight: 2,
                fillColor: "#3b82f6", // Blu chiaro
                fillOpacity: 0.2,
                className: 'regione-polygon'
            },
            onEachFeature: (feature, layer) => {
                // Tooltip col nome
                layer.bindTooltip(feature.properties.reg_name, { permanent: false, direction: "center", className: "font-bold" });
                
                // Interazioni mouse
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5, weight: 3 }),
                    mouseout: (e) => geojsonRegioni.resetStyle(e.target),
                    click: (e) => clickSuRegione(feature.properties.reg_name, e.target.getBounds())
                });
            }
        }).addTo(map);
        
        livelloAttuale = 'regioni';
    } catch (error) {
        console.error("Errore caricamento confini regioni", error);
    }
}

async function clickSuRegione(nomeRegione, bounds) {
    // 1. Zoomma sulla regione cliccata
    map.fitBounds(bounds);
    
    // 2. Sincronizza il menu a sinistra
    selectRegione.value = nomeRegione;
    aggiornaMenuProvince(nomeRegione);
    
    // 3. Rimuove il livello Regioni e carica le Province di QUELLA regione
    map.removeLayer(geojsonRegioni);
    
    try {
        const response = await fetch(URL_PROVINCE);
        const data = await response.json();
        
        // Filtriamo solo le province della regione cliccata
        const provinceRegione = data.features.filter(f => f.properties.reg_name === nomeRegione);

        if (geojsonProvince) map.removeLayer(geojsonProvince);

        geojsonProvince = L.geoJSON(provinceRegione, {
            style: {
                color: "#991b1b", // Rosso scuro
                weight: 1.5,
                fillColor: "#ef4444", // Rosso chiaro
                fillOpacity: 0.2,
                dashArray: '3' // Linea tratteggiata per le province
            },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.prov_name, { permanent: true, direction: "center", className: "text-xs bg-transparent border-0 shadow-none font-bold text-gray-700" });
                
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                    mouseout: (e) => geojsonProvince.resetStyle(e.target),
                    click: (e) => {
                        selectProvincia.value = feature.properties.prov_name;
                        mostraInterpelli(nomeRegione, feature.properties.prov_name);
                    }
                });
            }
        }).addTo(map);
        
        livelloAttuale = 'province';
        mostraInterpelli(nomeRegione, "TUTTE");

    } catch (error) {
        console.error("Errore province", error);
    }
}

function resetMappa() {
    map.setView([41.8719, 12.5674], 6);
    selectRegione.value = "";
    selectProvincia.innerHTML = '<option value="">-- Prima seleziona una Regione --</option>';
    selectProvincia.disabled = true;
    caricaLayerRegioni();
    containerLista.innerHTML = `<div class="text-center text-gray-400 mt-10"><i class="fa-solid fa-map text-4xl mb-3"></i><p>Seleziona una regione per iniziare.</p></div>`;
}

// =========================================
// 2. GESTIONE LOGICA E DATI
// =========================================
async function caricaDatiScraper() {
    try {
        const response = await fetch('database_nazionale.json?' + new Date().getTime());
        if (response.ok) datiInterpelli = await response.json();
    } catch (e) {
        console.log("Database non ancora pronto o vuoto.");
    }
}

function aggiornaMenuProvince(regioneSelezionata) {
    selectProvincia.disabled = false;
    selectProvincia.innerHTML = '<option value="TUTTE">Tutte le Province</option>';
    
    // Per ora abbiamo in DB solo province lombarde. Estraiamo quelle esistenti nel DB:
    const provinceNelDB = [...new Set(datiInterpelli.filter(i => i.regione === regioneSelezionata).map(i => i.provincia))];
    
    provinceNelDB.forEach(prov => {
        selectProvincia.innerHTML += `<option value="${prov}">${prov}</option>`;
    });
}

function selezionaRegioneDaMenu(regione) {
    if (!regione) return resetMappa();
    
    // Simula il click sulla mappa cercando il livello giusto (Solo per far scattare lo zoom e il caricamento province)
    if(geojsonRegioni) {
        geojsonRegioni.eachLayer(layer => {
            if (layer.feature.properties.reg_name === regione) {
                clickSuRegione(regione, layer.getBounds());
            }
        });
    }
}

function mostraInterpelli(regione, provincia) {
    let filtrati = datiInterpelli.filter(i => i.regione === regione);
    if (provincia && provincia !== "TUTTE") {
        filtrati = filtrati.filter(i => i.provincia === provincia);
    }

    if (filtrati.length === 0) {
        containerLista.innerHTML = `
            <div class="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200">
                <i class="fa-solid fa-triangle-exclamation"></i> Nessun interpello per ${provincia === 'TUTTE' ? regione : provincia} in questo momento.
            </div>`;
        return;
    }

    containerLista.innerHTML = `<h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Trovati ${filtrati.length} interpelli in ${provincia === 'TUTTE' ? regione : provincia}</h3>`;
    
    filtrati.forEach(item => {
        containerLista.innerHTML += `
            <div class="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition">
                <div class="text-xs text-gray-500 mb-1 flex justify-between">
                    <span class="bg-blue-100 text-blue-800 px-2 rounded-full font-bold">${item.provincia}</span>
                    <span>${item.data}</span>
                </div>
                <h4 class="font-bold text-gray-900 leading-tight mb-2">${item.titolo}</h4>
                <a href="${item.url}" target="_blank" class="text-blue-600 text-sm hover:underline"><i class="fa-solid fa-arrow-up-right-from-square"></i> Vai all'avviso</a>
            </div>
        `;
    });
}