

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

// Variabili Paginazione
let risultatiCorrenti = []; 
let indiceMostrati = 0;     
const CHUNK_INIZIALE = 50;  
const CHUNK_SUCCESSIVO = 20;

// --- Elementi DOM ---
const selectRegione = document.getElementById('regioneSelect');
const selectProvincia = document.getElementById('provinciaSelect');
const selectCdc = document.getElementById('cdcSelect');
const selectTipoScuola = document.getElementById('tipoScuolaSelect');
const btnReset = document.getElementById('btnResetMappa');
const containerLista = document.getElementById('listaInterpelli');

// NUOVI ELEMENTI PER IL COLLAPSE
const toggleFiltriBtn = document.getElementById('toggleFiltriBtn');
const filtriContainer = document.getElementById('filtriContainer');
const toggleIcon = document.getElementById('toggleIcon');
let filtriAperti = true;

// --- LOGICA COLLAPSE (Chiudi/Apri filtri) ---
toggleFiltriBtn.addEventListener('click', () => {
    filtriAperti = !filtriAperti;
    if (filtriAperti) {
        // Espande
        filtriContainer.style.maxHeight = filtriContainer.scrollHeight + "px";
        toggleIcon.classList.remove('rotate-180');
        // Dopo l'animazione, rimette maxHeight a 'none' per permettere ridimensionamenti
        setTimeout(() => filtriContainer.style.maxHeight = 'none', 300);
    } else {
        // Comprime
        filtriContainer.style.maxHeight = filtriContainer.scrollHeight + "px"; // Fissa l'altezza attuale
        // Un millisecondo dopo la forza a zero per l'animazione
        setTimeout(() => filtriContainer.style.maxHeight = "0px", 10);
        toggleIcon.classList.add('rotate-180');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    inizializzaMappa();
    await caricaDatiScraper();
    
    // Tutti i menu a tendina ora innescano la STESSA funzione di filtraggio combinato
    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', applicaFiltri);
    selectCdc.addEventListener('change', applicaFiltri);
    selectTipoScuola.addEventListener('change', applicaFiltri);
    
    btnReset.addEventListener('click', resetMappa);
});

// =========================================
// 1. GESTIONE MAPPA (Leaflet)
// =========================================
function inizializzaMappa() {
    map = L.map('map', { zoomControl: false }).setView([41.8719, 12.5674], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 10, minZoom: 5 }).addTo(map);
    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();
        if (geojsonProvince) map.removeLayer(geojsonProvince);
        
        geojsonRegioni = L.geoJSON(data, {
            style: { color: "#1e3a8a", weight: 2, fillColor: "#3b82f6", fillOpacity: 0.2, className: 'regione-polygon' },
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
    } catch (error) { console.error(error); }
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
            style: { color: "#991b1b", weight: 1.5, fillColor: "#ef4444", fillOpacity: 0.2, dashArray: '3' },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.prov_name, { permanent: true, direction: "center", className: "text-xs bg-transparent border-0 shadow-none font-bold text-gray-700" });
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                    mouseout: (e) => geojsonProvince.resetStyle(e.target),
                    click: (e) => {
                        const nomeDB = normalizzaProvincia(feature.properties.prov_name);
                        selectProvincia.value = nomeDB;
                        applicaFiltri(); // Aggiorna i risultati in base a tutti i filtri attivi
                    }
                });
            }
        }).addTo(map);
        
        livelloAttuale = 'province';
        selectProvincia.value = "TUTTE";
        applicaFiltri();
    } catch (error) {}
}

function resetMappa() {
    map.setView([41.8719, 12.5674], 6);
    selectRegione.value = "";
    selectProvincia.innerHTML = '<option value="">-- Prima seleziona una Regione --</option>';
    selectProvincia.disabled = true;
    selectCdc.value = "";
    selectTipoScuola.value = "";
    caricaLayerRegioni();
    containerLista.innerHTML = `<div class="text-center text-gray-400 mt-10"><i class="fa-solid fa-map text-4xl mb-3"></i><p>Seleziona una regione per iniziare.</p></div>`;
}

function selezionaRegioneDaMenu(regione) {
    if (!regione) return resetMappa();
    if(geojsonRegioni) {
        geojsonRegioni.eachLayer(layer => {
            if (layer.feature.properties.reg_name === regione) clickSuRegione(regione, layer.getBounds());
        });
    }
}

// =========================================
// 2. GESTIONE LOGICA E DATI
// =========================================
async function caricaDatiScraper() {
    try {
        const response = await fetch('database_nazionale.json?' + new Date().getTime());
        if (response.ok) {
            datiInterpelli = await response.json();
            popolaMenuCDC(); // Carica tutte le CDC trovate in Italia
        }
    } catch (e) { console.log("Database non pronto."); }
}

function popolaMenuCDC() {
    const cdcUniche = new Set();
    datiInterpelli.forEach(item => {
        if (item.cdc) item.cdc.forEach(c => cdcUniche.add(c));
    });
    // Ordina e aggiunge alla tendina
    Array.from(cdcUniche).sort().forEach(cdc => {
        selectCdc.innerHTML += `<option value="${cdc}">${cdc}</option>`;
    });
}

function aggiornaMenuProvince(regioneSelezionata) {
    selectProvincia.disabled = false;
    selectProvincia.innerHTML = '<option value="TUTTE">Tutte le Province</option>';
    const provinceNelDB = [...new Set(datiInterpelli.filter(i => i.regione === regioneSelezionata).map(i => i.provincia))];
    provinceNelDB.sort().forEach(prov => selectProvincia.innerHTML += `<option value="${prov}">${prov}</option>`);
}

// --- IL SUPER-FILTRO COMBINATO ---
function applicaFiltri() {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const cdc = selectCdc.value;
    const tipo = selectTipoScuola.value;

    if (!reg) return; // Se non c'è la regione, non mostra nulla

    let filtrati = datiInterpelli.filter(i => i.regione === reg);

    // Filtro Provincia
    if (prov && prov !== "TUTTE") {
        filtrati = filtrati.filter(i => i.provincia === prov);
    }

    // Filtro CDC
    if (cdc) {
        filtrati = filtrati.filter(i => i.cdc && i.cdc.includes(cdc));
    }

    // Filtro Algoritmico "Tipo di Scuola"
    if (tipo === "IC") {
        // Cerca keyword di IC/Primaria nel titolo, OPPURE cerca CDC tipiche (AAAA, EEEE, ADAA, ecc)
        const kw = [' ic ', 'i.c.', 'istituto comprensivo', 'primaria', 'infanzia', 'primo grado', ' 1 grado', ' i grado', 'media'];
        const cdcBase = ['AAAA','EEEE','AAHN','EEHN','AAMM','EEMM','ADAA','ADEE','ADMM'];
        
        filtrati = filtrati.filter(i => {
            const titolo = i.titolo.toLowerCase();
            const matchTesto = kw.some(k => titolo.includes(k));
            const matchCdc = i.cdc && i.cdc.some(c => cdcBase.includes(c));
            return matchTesto || matchCdc;
        });

    } else if (tipo === "SUPERIORI") {
        // Cerca keyword Licei/Superiori, OPPURE CDC di II grado (Iniziano con A o B + 2 numeri, es A041)
        const kw = ['liceo', 'iis', 'i.i.s.', 'superiore', 'secondo grado', ' 2 grado', ' ii grado', 'tecnico', 'professionale', 'is '];
        
        filtrati = filtrati.filter(i => {
            const titolo = i.titolo.toLowerCase();
            const matchTesto = kw.some(k => titolo.includes(k));
            const matchCdc = i.cdc && i.cdc.some(c => c.match(/^[A-Z]\d{2}$/) || c === 'ADSS');
            return matchTesto || matchCdc;
        });
    }

    // Ordinamento Data
    filtrati.sort((a, b) => {
        let dataA = a.data || ""; let dataB = b.data || "";
        return dataA > dataB ? -1 : (dataA < dataB ? 1 : 0);
    });

    risultatiCorrenti = filtrati;
    indiceMostrati = 0;

    // Rendering
    if (risultatiCorrenti.length === 0) {
        containerLista.innerHTML = `
            <div class="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 mt-4">
                <i class="fa-solid fa-triangle-exclamation"></i> Nessun interpello corrisponde ai tuoi filtri in ${prov === 'TUTTE' ? reg : prov}.
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Trovati ${risultatiCorrenti.length} risultati (${titoloRisultati})</h3>
        <div id="grigliaCard"></div>
    `;
    
    caricaPezzi(CHUNK_INIZIALE);
}

function caricaPezzi(quantita) {
    const griglia = document.getElementById('grigliaCard');
    if (!griglia) return;

    const oldBtn = document.getElementById('btnCaricaAltri');
    if (oldBtn) oldBtn.remove();

    const daMostrare = risultatiCorrenti.slice(indiceMostrati, indiceMostrati + quantita);
    const dataOdierna = new Date(); // Ci serve per calcolare se un interpello è "nuovo"
    
    daMostrare.forEach(item => {
        let titoloPulito = item.titolo;
        if (titoloPulito.includes(" - [CDC:")) titoloPulito = titoloPulito.split(" - [CDC:")[0];

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1 shadow-sm border border-blue-100">${c}</span>`).join('')
            : `<span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 shadow-sm border border-gray-100">Nessuna CDC specificata</span>`;

        let dataIta = item.data;
        if(dataIta.includes('-')) {
            let p = dataIta.split('-');
            dataIta = `${p[2]}/${p[1]}/${p[0]}`;
        }

        // --- LOGICA "BOLLINO NUOVO" (Ultime 48 ore) ---
        let isNuovo = false;
        if (item.data_rilevamento) {
            const dataRilevamento = new Date(item.data_rilevamento);
            const differenzaOre = (dataOdierna - dataRilevamento) / (1000 * 60 * 60);
            if (differenzaOre <= 48) {
                isNuovo = true;
            }
        }
        
        // Costruiamo il badge e la classe CSS speciale se è nuovo
        const badgeNuovoHTML = isNuovo ? `<span class="badge-nuovo"><span class="flex h-2 w-2 relative mr-1 inline-flex"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>NUOVO</span>` : '';
        const classeCardNuova = isNuovo ? 'card-nuova border-green-300 bg-green-50/10' : 'border-gray-200 bg-white';

        griglia.innerHTML += `
            <div class="relative rounded-lg p-5 mb-4 shadow-sm hover:shadow-md transition border ${classeCardNuova}">
                ${badgeNuovoHTML}
                <div class="text-xs text-gray-500 mb-3 flex justify-between items-center">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold shadow-sm">${item.provincia}</span>
                    <span class="font-medium bg-gray-50 px-2 py-1 rounded text-gray-600 border border-gray-100"><i class="fa-regular fa-calendar mr-1"></i> ${dataIta}</span>
                </div>
                <h4 class="font-bold text-gray-900 leading-snug mb-3 text-[15px] uppercase tracking-tight pr-6">${titoloPulito}</h4>
                <div class="mb-5 flex flex-wrap gap-1">
                    ${badgeCDC}
                </div>
                <a href="${item.url}" target="_blank" class="w-full text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md text-sm px-4 py-2 text-center inline-block transition shadow-sm"><i class="fa-solid fa-arrow-up-right-from-square mr-2"></i> Apri Avviso Ufficiale</a>
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-md mt-2 mb-8 border border-blue-200 transition shadow-sm';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-2"></i> Mostra altri (Mostrati ${indiceMostrati} di ${risultatiCorrenti.length})`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
