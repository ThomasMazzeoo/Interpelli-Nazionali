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
    // Base cartografica pulitissima
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 10, minZoom: 5 }).addTo(map);
    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();
        if (geojsonProvince) map.removeLayer(geojsonProvince);
        
        // Stile "Color Block" per l'Italia sulla mappa
        geojsonRegioni = L.geoJSON(data, {
            style: { color: "#000000", weight: 1, fillColor: "#f4ecd6", fillOpacity: 0.9 },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillColor: "#c5b0f4" }), // Diventa Lilla al passaggio!
                    mouseout: (e) => geojsonRegioni.resetStyle(e.target),
                    click: (e) => clickSuRegione(feature.properties.reg_name, e.target.getBounds())
                });
            }
        }).addTo(map);
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

        // Le province usano il color block Lime
        geojsonProvince = L.geoJSON(provinceRegione, {
            style: { color: "#000000", weight: 1, fillColor: "#dceeb1", fillOpacity: 0.9 },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillColor: "#efd4d4" }), // Rosa al passaggio
                    mouseout: (e) => geojsonProvince.resetStyle(e.target),
                    click: (e) => {
                        const nomeDB = normalizzaProvincia(feature.properties.prov_name);
                        selectProvincia.value = nomeDB;
                        applicaFiltri(); 
                    }
                });
            }
        }).addTo(map);
        
        selectProvincia.value = "TUTTE";
        applicaFiltri();
        if(btnReset) btnReset.classList.remove('hidden');
    } catch (error) { console.error(error); }
}

function resetMappa() {
    map.setView([41.8719, 12.5674], 6);
    selectRegione.value = "";
    selectProvincia.innerHTML = '<option value="">-- Seleziona prima una Regione --</option>';
    selectProvincia.disabled = true;
    selectCdc.value = "";
    selectTipoScuola.value = "";
    
    if (geojsonProvince) map.removeLayer(geojsonProvince);
    caricaLayerRegioni();
    if(btnReset) btnReset.classList.add('hidden');
    
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

    if (rightPanel.classList.contains('hidden')) {
        rightPanel.classList.remove('hidden');
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
        // Blocco colore Corallo per lo stato vuoto!
        containerLista.innerHTML = `
            <div class="bg-figma-coral rounded-[24px] p-8 flex flex-col items-center justify-center text-center">
                <i class="fa-solid fa-ghost text-4xl text-figma-black mb-4"></i>
                <h3 class="text-[26px] font-[540] tracking-tighter leading-tight text-figma-black">Nessun interpello in questa zona.</h3>
                <p class="font-sans text-[18px] font-[320] text-figma-black mt-2">Prova a cambiare filtri o guarda gli scaduti.</p>
            </div>`;
        return;
    }

    containerLista.innerHTML = `
        <div class="mb-6">
            <h2 class="text-[32px] font-[600] tracking-tighter leading-none text-figma-black mb-1">${prov && prov !== "TUTTE" ? prov : reg}</h2>
            <p class="font-mono text-[12px] uppercase tracking-widest text-gray-500">${risultatiCorrenti.length} Trovati</p>
        </div>
        <div id="grigliaCard" class="flex flex-col gap-6"></div>
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

        // Badges: font mono, uppercase, bordi netti
        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="border border-figma-hairline px-2 py-1 rounded-[4px] font-mono text-[12px] uppercase tracking-widest text-figma-black bg-white">${c}</span>`).join('')
            : `<span class="border border-figma-hairline px-2 py-1 rounded-[4px] font-mono text-[12px] uppercase tracking-widest text-gray-400 bg-white">NO CDC</span>`;

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
        
        const badgeNuovoHTML = isNuovo ? `<span class="bg-figma-lilac text-figma-black font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-[4px] mr-2">Nuovo</span>` : '';
        
        const classeCardContainer = scaduto ? 'opacity-50' : '';
        const nomeProvinciaMostrato = (item.provincia || "");

        // Typography Card: Figma Design
        griglia.innerHTML += `
            <div class="rounded-[24px] border border-figma-hairline bg-figma-white p-6 flex flex-col ${classeCardContainer}">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center">
                        ${badgeNuovoHTML}
                        <span class="font-mono text-[12px] uppercase tracking-widest text-gray-500">${nomeProvinciaMostrato}</span>
                    </div>
                    <span class="font-mono text-[12px] uppercase tracking-widest ${scaduto ? 'text-gray-400' : 'text-figma-success'}">
                        ${scaduto ? 'CHIUSO' : `Scade ${dataIta}`}
                    </span>
                </div>
                
                <h4 class="font-sans font-[600] text-[22px] leading-[1.3] tracking-tighter text-figma-black mb-5 pr-2">${titoloPulito}</h4>
                
                <div class="mb-8 flex flex-wrap gap-2">
                    ${badgeCDC}
                </div>
                
                <a href="${item.url}" target="_blank" class="w-full ${scaduto ? 'bg-figma-soft text-figma-black border border-figma-hairline' : 'bg-figma-black text-figma-white hover:bg-gray-800'} rounded-full text-[18px] px-6 py-3 text-center transition-transform active:scale-95 font-sans font-[500] block">
                    ${scaduto ? 'Bando Scaduto' : 'Apri Avviso'}
                </a>
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-figma-white text-figma-black border border-figma-hairline font-sans font-[500] py-3 px-6 rounded-full mt-2 mb-8 transition-transform active:scale-95 text-[18px]';
        btn.innerHTML = `Mostra altri`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
