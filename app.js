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
const selectStato = document.getElementById('statoSelect');
const btnReset = document.getElementById('btnResetMappa'); 
const containerLista = document.getElementById('listaInterpelli');

// GESTIONE NUOVO PANNELLO DESTRO
const rightPanel = document.getElementById('rightPanel');
const chiudiPannelloBtn = document.getElementById('chiudiPannelloBtn');

document.addEventListener('DOMContentLoaded', async () => {
    inizializzaMappa();
    await caricaDatiScraper();
    
    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', applicaFiltri);
    selectCdc.addEventListener('change', applicaFiltri);
    selectTipoScuola.addEventListener('change', applicaFiltri);
    selectStato.addEventListener('change', applicaFiltri);
    
    if(btnReset) btnReset.addEventListener('click', resetMappa);

    // Chiude il pannello destro e riallarga la mappa
    if(chiudiPannelloBtn) {
        chiudiPannelloBtn.addEventListener('click', () => {
            rightPanel.classList.add('hidden');
            setTimeout(() => { if (map) map.invalidateSize(); }, 100);
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
    if(btnReset) btnReset.classList.add('hidden');
    
    // Chiude il pannello destro quando si torna all'Italia intera
    rightPanel.classList.add('hidden');
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
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

function isScaduto(item) {
    if ((item.titolo || "").toUpperCase().includes('[CHIUSO]')) return true;
    
    if (item.data) {
        const parts = item.data.split('-');
        if (parts.length === 3) {
            const dataScadenza = new Date(parts[0], parts[1] - 1, parts[2]);
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0); 
            return dataScadenza < oggi;
        }
    }
    return false; 
}

function applicaFiltri() {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const cdc = selectCdc.value;
    const tipo = selectTipoScuola.value;
    const stato = selectStato.value;

    if (!reg) return; 

    // APRE IL PANNELLO DESTRO IN AUTOMATICO
    if (rightPanel.classList.contains('hidden')) {
        rightPanel.classList.remove('hidden');
        // Ricalcola le dimensioni della mappa per tenerla centrata
        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }

    let filtrati = datiInterpelli.filter(i => (i.regione || "").toLowerCase() === reg.toLowerCase());

    if (prov && prov !== "TUTTE") {
        filtrati = filtrati.filter(i => (i.provincia || "").toLowerCase() === prov.toLowerCase());
    }
    if (cdc) filtrati = filtrati.filter(i => i.cdc && i.cdc.includes(cdc));

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
            <div class="bg-yellow-50 text-yellow-800 p-5 rounded-lg border border-yellow-200 mt-4 shadow-sm text-center">
                <i class="fa-solid fa-face-frown-open text-3xl mb-3 text-yellow-500"></i>
                <p class="font-medium">Nessun interpello trovato in ${prov === 'TUTTE' ? reg : prov}.</p>
                <p class="text-sm mt-1 opacity-80">Prova a cambiare lo "Stato" in "Tutti" se cerchi avvisi scaduti.</p>
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <h3 class="font-bold text-gray-500 mb-4 border-b border-gray-200 pb-2 flex justify-between text-xs tracking-wider uppercase">
            <span>In ${titoloRisultati}</span>
            <span class="bg-gray-200 text-gray-700 px-2 rounded-full">${risultatiCorrenti.length}</span>
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
        let titoloPulito = item.titolo.replace('[CHIUSO]', '').trim();
        if (titoloPulito.startsWith('-')) titoloPulito = titoloPulito.substring(1).trim();
        if (titoloPulito.includes(" - [CDC:")) titoloPulito = titoloPulito.split(" - [CDC:")[0];

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1 shadow-sm border border-blue-100">${c}</span>`).join('')
            : `<span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-bold text-gray-600 ring-1 ring-inset ring-gray-500/10 shadow-sm border border-gray-200">Nessuna CDC specificata</span>`;

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
        
        const classeCardNuova = scaduto 
            ? 'opacity-60 bg-gray-50' 
            : (isNuovo ? 'card-nuova border-green-300 bg-green-50/10 hover:shadow-md' : 'border-white bg-white hover:shadow-lg');

        const nomeProvinciaMostrato = (item.provincia || "").toUpperCase();

        let badgeDataHtml = '';
        if (scaduto) {
            badgeDataHtml = `<span class="font-bold bg-gray-200 px-2.5 py-1 rounded text-gray-500 border border-gray-300 shadow-sm"><i class="fa-solid fa-lock mr-1"></i> SCADUTO</span>`;
        } else {
            badgeDataHtml = `<span class="font-bold bg-red-50 px-2.5 py-1 rounded text-red-700 border border-red-200 shadow-sm"><i class="fa-regular fa-clock mr-1"></i> Scade il: ${dataIta}</span>`;
        }

        griglia.innerHTML += `
            <div class="relative rounded-xl p-5 mb-4 shadow-sm transition-all border ${classeCardNuova}">
                ${badgeNuovoHTML}
                <div class="text-[10px] text-gray-500 mb-3 flex justify-between items-center tracking-wider">
                    <span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold shadow-sm">${nomeProvinciaMostrato}</span>
                    ${badgeDataHtml}
                </div>
                <h4 class="font-extrabold text-gray-900 leading-snug mb-3 text-[14px] uppercase tracking-tight pr-6">${titoloPulito}</h4>
                <div class="mb-5 flex flex-wrap gap-1">
                    ${badgeCDC}
                </div>
                <a href="${item.url}" target="_blank" class="w-full text-white ${scaduto ? 'bg-gray-400 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} font-bold rounded-lg text-sm px-4 py-2.5 text-center inline-block transition shadow-md">
                    <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i> ${scaduto ? 'Avviso Chiuso' : 'Apri Avviso Ufficiale'}
                </a>
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-white hover:bg-blue-50 text-blue-600 font-bold py-3 px-4 rounded-xl mt-2 mb-8 border border-blue-200 transition shadow-sm';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-2"></i> Mostra altri (Mostrati ${indiceMostrati} di ${risultatiCorrenti.length})`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
