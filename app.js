const URL_REGIONI = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson";
const URL_PROVINCE = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson";

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

let map;
let geojsonRegioni;
let geojsonProvince;
let livelloAttuale = 'regioni'; 
let datiInterpelli = [];
let risultatiCorrenti = []; 
let indiceMostrati = 0;     
const CHUNK_INIZIALE = 50;  
const CHUNK_SUCCESSIVO = 20;

const selectRegione = document.getElementById('regioneSelect');
const selectProvincia = document.getElementById('provinciaSelect');
const selectCdc = document.getElementById('cdcSelect');
const selectTipoScuola = document.getElementById('tipoScuolaSelect');
const selectStato = document.getElementById('statoSelect'); // IL NUOVO MENU STATO
const btnReset = document.getElementById('btnResetMappa'); 
const containerLista = document.getElementById('listaInterpelli');

const toggleFiltriBtn = document.getElementById('toggleFiltriBtn');
const filtriContainer = document.getElementById('filtriContainer');
const toggleIcon = document.getElementById('toggleIcon');
let filtriAperti = true;

document.addEventListener('DOMContentLoaded', async () => {
    inizializzaMappa();
    await caricaDatiScraper();
    
    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', applicaFiltri);
    selectCdc.addEventListener('change', applicaFiltri);
    selectTipoScuola.addEventListener('change', applicaFiltri);
    selectStato.addEventListener('change', applicaFiltri); // Listener per lo stato
    
    if(btnReset) btnReset.addEventListener('click', resetMappa);

    if(toggleFiltriBtn) {
        toggleFiltriBtn.addEventListener('click', () => {
            filtriAperti = !filtriAperti;
            if (filtriAperti) {
                filtriContainer.style.maxHeight = filtriContainer.scrollHeight + "px";
                toggleIcon.classList.remove('rotate-180');
                setTimeout(() => { filtriContainer.style.maxHeight = 'none'; }, 300);
            } else {
                filtriContainer.style.maxHeight = filtriContainer.scrollHeight + "px"; 
                setTimeout(() => { filtriContainer.style.maxHeight = "0px"; }, 10);
                toggleIcon.classList.add('rotate-180');
            }
        });
    }
});

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
    map.removeLayer(geojsonRegioni);
    
    try {
        const response = await fetch(URL_PROVINCE);
        const data = await response.json();
        const provinceRegione = data.features.filter(f => f.properties.reg_name === nomeRegione);
        if (geojsonProvince) map.removeLayer(geojsonProvince);

        aggiornaMenuProvinceDaGeoJSON(provinceRegione);

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
                        applicaFiltri(); 
                        if(filtriAperti && toggleFiltriBtn) toggleFiltriBtn.click();
                    }
                });
            }
        }).addTo(map);
        
        livelloAttuale = 'province';
        selectProvincia.value = "TUTTE";
        applicaFiltri();
        if(btnReset) btnReset.classList.remove('hidden');
    } catch (error) { console.error(error); }
}

function resetMappa() {
    map.setView([41.8719, 12.5674], 6);
    selectRegione.value = "";
    selectProvincia.innerHTML = '<option value="">-- Prima seleziona una Regione --</option>';
    selectProvincia.disabled = true;
    selectCdc.value = "";
    selectTipoScuola.value = "";
    
    if (geojsonProvince) map.removeLayer(geojsonProvince);
    caricaLayerRegioni();
    if(!filtriAperti && toggleFiltriBtn) toggleFiltriBtn.click();
    if(btnReset) btnReset.classList.add('hidden');
    
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

async function caricaDatiScraper() {
    try {
        const response = await fetch('database_nazionale.json?' + new Date().getTime());
        if (response.ok) {
            datiInterpelli = await response.json();
            popolaMenuCDC(); 
        }
    } catch (e) { console.log("Database non pronto."); }
}

function popolaMenuCDC() {
    const cdcUniche = new Set();
    datiInterpelli.forEach(item => {
        if (item.cdc) item.cdc.forEach(c => cdcUniche.add(c));
    });
    Array.from(cdcUniche).sort().forEach(cdc => {
        selectCdc.innerHTML += `<option value="${cdc}">${cdc}</option>`;
    });
}

function aggiornaMenuProvinceDaGeoJSON(features) {
    selectProvincia.disabled = false;
    selectProvincia.innerHTML = '<option value="TUTTE">Tutte le Province</option>';
    const nomiProvince = features.map(f => normalizzaProvincia(f.properties.prov_name)).sort();
    nomiProvince.forEach(prov => {
        selectProvincia.innerHTML += `<option value="${prov}">${prov}</option>`;
    });
}

// IL CERVELLO CHE CAPISCE SE UN INTERPELLO È SCADUTO
function isScaduto(item) {
    // 1. Controllo Piemonte (ha l'etichetta nel titolo)
    if ((item.titolo || "").toUpperCase().includes('[CHIUSO]')) return true;
    
    // 2. Controllo Liguria (confronta la data di scadenza col calendario di oggi)
    if (item.regione === "Liguria" && item.data) {
        const parts = item.data.split('-');
        if (parts.length === 3) {
            const dataScadenza = new Date(parts[0], parts[1] - 1, parts[2]);
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0); // Azzera l'orologio per un confronto pulito al giorno
            return dataScadenza < oggi;
        }
    }
    return false; // Di default lo consideriamo aperto
}

function applicaFiltri() {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const cdc = selectCdc.value;
    const tipo = selectTipoScuola.value;
    const stato = selectStato.value;

    if (!reg) return; 

    let filtrati = datiInterpelli.filter(i => (i.regione || "").toLowerCase() === reg.toLowerCase());

    if (prov && prov !== "TUTTE") {
        filtrati = filtrati.filter(i => (i.provincia || "").toLowerCase() === prov.toLowerCase());
    }
    if (cdc) filtrati = filtrati.filter(i => i.cdc && i.cdc.includes(cdc));

    // APPLICA IL FILTRO DI STATO
    if (stato === "ATTIVI") {
        filtrati = filtrati.filter(i => !isScaduto(i));
    } else if (stato === "SCADUTI") {
        filtrati = filtrati.filter(i => isScaduto(i));
    }

    if (tipo === "IC") {
        const kw = [' ic ', 'i.c.', 'istituto comprensivo', 'primaria', 'infanzia', 'primo grado', ' 1 grado', ' i grado', 'media'];
        const cdcBase = ['AAAA','EEEE','AAHN','EEHN','AAMM','EEMM','ADAA','ADEE','ADMM'];
        filtrati = filtrati.filter(i => {
            const titolo = i.titolo.toLowerCase();
            return kw.some(k => titolo.includes(k)) || (i.cdc && i.cdc.some(c => cdcBase.includes(c)));
        });
    } else if (tipo === "SUPERIORI") {
        const kw = ['liceo', 'iis', 'i.i.s.', 'superiore', 'secondo grado', ' 2 grado', ' ii grado', 'tecnico', 'professionale', 'is '];
        filtrati = filtrati.filter(i => {
            const titolo = i.titolo.toLowerCase();
            return kw.some(k => titolo.includes(k)) || (i.cdc && i.cdc.some(c => c.match(/^[A-Z]\d{2}$/) || c === 'ADSS'));
        });
    }

    filtrati.sort((a, b) => {
        let dataA = a.data || ""; let dataB = b.data || "";
        return dataA > dataB ? -1 : (dataA < dataB ? 1 : 0);
    });

    risultatiCorrenti = filtrati;
    indiceMostrati = 0;

    if (risultatiCorrenti.length === 0) {
        containerLista.innerHTML = `
            <div class="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 mt-4">
                <i class="fa-solid fa-triangle-exclamation"></i> Nessun interpello corrisponde ai tuoi filtri (potrebbero essere tutti scaduti).
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <h3 class="font-bold text-gray-700 mb-4 border-b pb-2 sticky top-0 bg-white z-10 flex justify-between">
            <span>Trovati ${risultatiCorrenti.length} risultati (${titoloRisultati})</span>
        </h3>
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
    const dataOdierna = new Date(); 
    
    daMostrare.forEach(item => {
        // Rimuoviamo [CHIUSO] dal titolo visivamente, perché ora mettiamo il badge
        let titoloPulito = item.titolo.replace('[CHIUSO]', '').trim();
        if (titoloPulito.startsWith('-')) titoloPulito = titoloPulito.substring(1).trim();
        if (titoloPulito.includes(" - [CDC:")) titoloPulito = titoloPulito.split(" - [CDC:")[0];

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1 shadow-sm border border-blue-100">${c}</span>`).join('')
            : `<span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 shadow-sm border border-gray-100">Nessuna CDC specificata</span>`;

        let dataIta = item.data;
        if(dataIta.includes('-')) {
            let p = dataIta.split('-');
            dataIta = `${p[2]}/${p[1]}/${p[0]}`;
        }

        const scaduto = isScaduto(item);
        
        let isNuovo = false;
        if (item.data_rilevamento && !scaduto) {
            const dataRilevamento = new Date(item.data_rilevamento);
            const differenzaOre = (dataOdierna - dataRilevamento) / (1000 * 60 * 60);
            if (differenzaOre <= 48) isNuovo = true;
        }
        
        const badgeNuovoHTML = isNuovo ? `<span class="badge-nuovo"><span class="flex h-2 w-2 relative mr-1 inline-flex"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>NUOVO</span>` : '';
        
        // Se è chiuso, rendiamo la scheda grigia e semitrasparente
        const classeCardNuova = scaduto 
            ? 'opacity-60 bg-gray-50' 
            : (isNuovo ? 'card-nuova border-green-300 bg-green-50/10 hover:shadow-md' : 'border-gray-200 bg-white hover:shadow-md');

        const nomeProvinciaMostrato = (item.provincia || "").toUpperCase();

        // GRAFICA DELLA DATA: Lucchetto chiuso vs Calendario Scadenza
        let badgeDataHtml = '';
        if (scaduto) {
            badgeDataHtml = `<span class="font-bold bg-gray-200 px-2.5 py-1 rounded text-gray-500 border border-gray-300 shadow-sm"><i class="fa-solid fa-lock mr-1"></i> CHIUSO</span>`;
        } else if (item.regione === "Liguria") {
            badgeDataHtml = `<span class="font-bold bg-red-50 px-2.5 py-1 rounded text-red-700 border border-red-200 shadow-sm"><i class="fa-regular fa-clock mr-1"></i> Scade il: ${dataIta}</span>`;
        } else {
            badgeDataHtml = `<span class="font-bold bg-gray-50 px-2.5 py-1 rounded text-gray-700 border border-gray-200 shadow-sm"><i class="fa-regular fa-calendar mr-1"></i> Del: ${dataIta}</span>`;
        }

        griglia.innerHTML += `
            <div class="relative rounded-lg p-5 mb-4 shadow-sm transition border ${classeCardNuova}">
                ${badgeNuovoHTML}
                <div class="text-xs text-gray-500 mb-3 flex justify-between items-center">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold shadow-sm">${nomeProvinciaMostrato}</span>
                    ${badgeDataHtml}
                </div>
                <h4 class="font-bold text-gray-900 leading-snug mb-3 text-[15px] uppercase tracking-tight pr-6">${titoloPulito}</h4>
                <div class="mb-5 flex flex-wrap gap-1">
                    ${badgeCDC}
                </div>
                <a href="${item.url}" target="_blank" class="w-full text-white ${scaduto ? 'bg-gray-400 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} font-medium rounded-md text-sm px-4 py-2 text-center inline-block transition shadow-sm">
                    <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i> Apri Avviso Ufficiale
                </a>
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
