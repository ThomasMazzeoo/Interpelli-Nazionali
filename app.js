// Link ai dati Open Source ISTAT (Confini Italia)
const URL_REGIONI = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson";
const URL_PROVINCE = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson";

// --- TRADUTTORE ISTAT -> MINISTERO ---
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

// Variabili Mappa e Dati
let map;
let geojsonRegioni;
let geojsonProvince;
let livelloAttuale = 'regioni'; 
let datiInterpelli = [];

// --- VARIABILI PAGINAZIONE ---
let risultatiCorrenti = []; // Contiene i dati filtrati attualmente selezionati
let indiceMostrati = 0;     // Conta quanti ne stiamo mostrando
const CHUNK_INIZIALE = 50;  // Quanti caricarne al primo click
const CHUNK_SUCCESSIVO = 20;// Quanti caricarne coi click successivi

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
                color: "#1e3a8a", weight: 2, fillColor: "#3b82f6", fillOpacity: 0.2, className: 'regione-polygon'
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
        console.error("Errore caricamento confini", error);
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
                color: "#991b1b", weight: 1.5, fillColor: "#ef4444", fillOpacity: 0.2, dashArray: '3' 
            },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.prov_name, { permanent: true, direction: "center", className: "text-xs bg-transparent border-0 shadow-none font-bold text-gray-700" });
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                    mouseout: (e) => geojsonProvince.resetStyle(e.target),
                    click: (e) => {
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
        console.log("Database non pronto.");
    }
}

function aggiornaMenuProvince(regioneSelezionata) {
    selectProvincia.disabled = false;
    selectProvincia.innerHTML = '<option value="TUTTE">Tutte le Province</option>';
    const provinceNelDB = [...new Set(datiInterpelli.filter(i => i.regione === regioneSelezionata).map(i => i.provincia))];
    provinceNelDB.sort().forEach(prov => selectProvincia.innerHTML += `<option value="${prov}">${prov}</option>`);
}

function selezionaRegioneDaMenu(regione) {
    if (!regione) return resetMappa();
    if(geojsonRegioni) {
        geojsonRegioni.eachLayer(layer => {
            if (layer.feature.properties.reg_name === regione) clickSuRegione(regione, layer.getBounds());
        });
    }
}

// --- LOGICA DI PAGINAZIONE ---
function mostraInterpelli(regione, provincia) {
    // 1. Filtra i dati
    let filtrati = datiInterpelli.filter(i => i.regione === regione);
    if (provincia && provincia !== "TUTTE") {
        filtrati = filtrati.filter(i => i.provincia === provincia);
    }

    // 2. Li ordina per data (dal più recente)
    filtrati.sort((a, b) => {
        let dataA = a.data || "";
        let dataB = b.data || "";
        if (dataA > dataB) return -1;
        if (dataA < dataB) return 1;
        return 0;
    });

    // 3. Resetta le variabili globali di impaginazione
    risultatiCorrenti = filtrati;
    indiceMostrati = 0;

    // 4. Prepara il contenitore vuoto
    if (risultatiCorrenti.length === 0) {
        containerLista.innerHTML = `
            <div class="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200">
                <i class="fa-solid fa-triangle-exclamation"></i> Nessun interpello per ${provincia === 'TUTTE' ? regione : provincia} in questo momento.
            </div>`;
        return;
    }

    containerLista.innerHTML = `
        <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Trovati ${risultatiCorrenti.length} interpelli in ${provincia === 'TUTTE' ? regione : provincia}</h3>
        <div id="grigliaCard"></div>
    `;
    
    // Avvia la prima iniezione di 50 elementi
    caricaPezzi(CHUNK_INIZIALE);
}

function caricaPezzi(quantita) {
    const griglia = document.getElementById('grigliaCard');
    if (!griglia) return;

    // Rimuove il vecchio bottone "Carica Altri" se esiste
    const oldBtn = document.getElementById('btnCaricaAltri');
    if (oldBtn) oldBtn.remove();

    // Seleziona la fetta di array da mostrare (es. da 0 a 50)
    const daMostrare = risultatiCorrenti.slice(indiceMostrati, indiceMostrati + quantita);
    
    daMostrare.forEach(item => {
        
        // Pulisce il titolo rimuovendo il testo [CDC: ...] aggiunto da Python
        let titoloPulito = item.titolo;
        if (titoloPulito.includes(" - [CDC:")) {
            titoloPulito = titoloPulito.split(" - [CDC:")[0];
        }

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1">${c}</span>`).join('')
            : `<span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Generico</span>`;

        // Data in formato Italiano DD/MM/YYYY
        let dataIta = item.data;
        if(dataIta.includes('-')) {
            let p = dataIta.split('-');
            dataIta = `${p[2]}/${p[1]}/${p[0]}`;
        }

        griglia.innerHTML += `
            <div class="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm hover:shadow-md transition">
                <div class="text-xs text-gray-500 mb-2 flex justify-between items-center">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">${item.provincia}</span>
                    <span><i class="fa-regular fa-calendar"></i> ${dataIta}</span>
                </div>
                <h4 class="font-bold text-gray-900 leading-tight mb-3 text-lg">${titoloPulito}</h4>
                <div class="mb-4">
                    ${badgeCDC}
                </div>
                <a href="${item.url}" target="_blank" class="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md text-sm px-4 py-2 text-center inline-block transition"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> Apri Avviso</a>
            </div>
        `;
    });

    // Aggiorna l'indice di quanti ne abbiamo renderizzati finora
    indiceMostrati += quantita;

    // Se ci sono ancora elementi da mostrare, crea il bottone in fondo!
    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-md mt-2 mb-8 border border-blue-200 transition shadow-sm';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-2"></i> Mostra prossimi 20 (Mostrati ${indiceMostrati} di ${risultatiCorrenti.length})`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
