// Link ai dati Open Source ISTAT (Confini Italia)
const URL_REGIONI = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson";
const URL_PROVINCE = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson";

// --- TRADUTTORE ISTAT -> MINISTERO ---
// Serve a correggere le differenze di nome tra i confini ufficiali e come le chiama il MIM
const ALIAS_PROVINCE = {
    "Monza e della Brianza": "Monza Brianza",
    "Reggio di Calabria": "Reggio Calabria",
    "Forlì-Cesena": "Forli Cesena",
    "Bolzano/Bozen": "Bolzano",
    "Aosta": "Valle d'Aosta"
};

function normalizzaProvincia(nomeIstat) {
    return ALIAS_PROVINCE[nomeIstat] || nomeIstat;
}
// --------------------------------------

let map;
let geojsonRegioni;
let geojsonProvince;
let livelloAttuale = 'regioni'; 
let datiInterpelli = [];

const selectRegione = document.getElementById('regioneSelect');
const selectProvincia = document.getElementById('provinciaSelect');
const btnReset = document.getElementById('btnResetMappa');
const containerLista = document.getElementById('listaInterpelli');

document.addEventListener('DOMContentLoaded', async () => {
    inizializzaMappa();
    await caricaDatiScraper();
    
    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', (e) => mostraInterpelli(selectRegione.value, e.target.value));
    btnReset.addEventListener('click', resetMappa);
});

// =========================================
// 1. GESTIONE MAPPA (Leaflet)
// =========================================
function inizializzaMappa() {
    map = L.map('map', { zoomControl: false }).setView([41.8719, 12.5674], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        minZoom: 5
    }).addTo(map);

    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();

        if (geojsonProvince) map.removeLayer(geojsonProvince);
        
        geojsonRegioni = L.geoJSON(data, {
            style: {
                color: "#1e3a8a", 
                weight: 2,
                fillColor: "#3b82f6", 
                fillOpacity: 0.2,
                className: 'regione-polygon'
            },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.reg_name, { permanent: false, direction: "center", className: "font-bold" });
                
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
    map.fitBounds(bounds);
    selectRegione.value = nomeRegione;
    aggiornaMenuProvince(nomeRegione);
    map.removeLayer(geojsonRegioni);
    
    try {
        const response = await fetch(URL_PROVINCE);
        const data = await response.json();
        
        const provinceRegione = data.features.filter(f => f.properties.reg_name === nomeRegione);

        if (geojsonProvince) map.removeLayer(geojsonProvince);

        geojsonProvince = L.geoJSON(provinceRegione, {
            style: {
                color: "#991b1b", 
                weight: 1.5,
                fillColor: "#ef4444", 
                fillOpacity: 0.2,
                dashArray: '3' 
            },
            onEachFeature: (feature, layer) => {
                // Il tooltip sulla mappa mostra il nome ISTAT ufficiale
                layer.bindTooltip(feature.properties.prov_name, { permanent: true, direction: "center", className: "text-xs bg-transparent border-0 shadow-none font-bold text-gray-700" });
                
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                    mouseout: (e) => geojsonProvince.resetStyle(e.target),
                    click: (e) => {
                        // LA MAGIA E' QUI: Traduce il nome ISTAT nel nome del nostro Database!
                        const nomeDB = normalizzaProvincia(feature.properties.prov_name);
                        selectProvincia.value = nomeDB;
                        mostraInterpelli(nomeRegione, nomeDB);
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
    
    const provinceNelDB = [...new Set(datiInterpelli.filter(i => i.regione === regioneSelezionata).map(i => i.provincia))];
    
    // Mettiamo in ordine alfabetico le province nel menu
    provinceNelDB.sort().forEach(prov => {
        selectProvincia.innerHTML += `<option value="${prov}">${prov}</option>`;
    });
}

function selezionaRegioneDaMenu(regione) {
    if (!regione) return resetMappa();
    
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
        // Formattazione bella delle CDC (come avevamo fatto prima)
        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1">${c}</span>`).join('')
            : `<span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Generico</span>`;

        containerLista.innerHTML += `
            <div class="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm hover:shadow-md transition">
                <div class="text-xs text-gray-500 mb-2 flex justify-between items-center">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">${item.provincia}</span>
                    <span><i class="fa-regular fa-calendar"></i> ${item.data}</span>
                </div>
                <h4 class="font-bold text-gray-900 leading-tight mb-3 text-lg">${item.titolo}</h4>
                <div class="mb-4">
                    ${badgeCDC}
                </div>
                <a href="${item.url}" target="_blank" class="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md text-sm px-4 py-2 text-center inline-block transition"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> Apri Avviso</a>
            </div>
        `;
    });
}
