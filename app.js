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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 10, minZoom: 5 }).addTo(map);
    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();
        if (geojsonProvince) map.removeLayer(geojsonProvince);
        
        geojsonRegioni = L.geoJSON(data, {
            // Mappa vibrante e colorata
            style: { color: "#3b82f6", weight: 1.5, fillColor: "#60a5fa", fillOpacity: 0.15 },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.3, weight: 2 }),
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

        geojsonProvince = L.geoJSON(provinceRegione, {
            // Colore vivace per le province (Rose/Rosso tenue)
            style: { color: "#f43f5e", weight: 1.5, fillColor: "#fb7185", fillOpacity: 0.1, dashArray: '4' },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.prov_name, { permanent: true, direction: "center", className: "text-xs bg-transparent border-0 shadow-none font-bold text-gray-700" });
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.25 }),
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
    selectProvincia.innerHTML = '<option value="">-- Prima seleziona una Regione --</option>';
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
        containerLista.innerHTML = `
            <div class="text-center p-8 mt-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <i class="fa-solid fa-ghost text-4xl mb-4 text-slate-300"></i>
                <p class="text-[16px] font-bold text-slate-700">Nessun risultato trovato</p>
                <p class="text-[13px] text-slate-500 mt-2 leading-relaxed">Prova a modificare i filtri o seleziona "Tutti gli Interpelli" nello stato.</p>
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <div class="flex justify-between items-center mb-5 px-1">
            <p class="text-[13px] text-slate-500 font-bold uppercase tracking-wider">${titoloRisultati}</p>
            <span class="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">${risultatiCorrenti.length} Trovati</span>
        </div>
        <div id="grigliaCard" class="flex flex-col gap-4"></div>
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

        // Badge CDC: Colore Indaco vibrante
        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm">${c}</span>`).join('')
            : `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm">Nessuna CDC</span>`;

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
        
        const classeCard = scaduto 
            ? 'opacity-60 bg-slate-50 border-slate-200 grayscale-[0.2]' 
            : 'bg-white border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300';

        const nomeProvinciaMostrato = (item.provincia || "");
        
        // Provincia: Azzurro vivido. Nuovo: Smeraldo acceso con pallino pulsante.
        let testoProvincia = `<span class="text-blue-700 font-bold uppercase bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 shadow-sm">${nomeProvinciaMostrato}</span>`;
        
        if (isNuovo) {
            testoProvincia = `
                <span class="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider shadow-sm uppercase">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Nuovo
                </span>
                ${testoProvincia}
            `;
        }

        // Data: Rosa scuro vibrante per la scadenza, Grigio per lo scaduto
        const testoData = scaduto 
            ? `<span class="text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-lock text-[10px]"></i> Chiuso</span>` 
            : `<span class="text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200 flex items-center gap-1 shadow-sm"><i class="fa-regular fa-clock text-[10px]"></i> Scade: ${dataIta}</span>`;

        const stileBottone = scaduto 
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300' 
            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md';

        griglia.innerHTML += `
            <div class="rounded-[16px] border p-5 flex flex-col transition-all duration-200 ${classeCard}">
                
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-2 text-[10px] tracking-tightest">
                        ${testoProvincia}
                    </div>
                    <div class="text-[10px] tracking-tightest">
                        ${testoData}
                    </div>
                </div>
                
                <h4 class="text-slate-800 font-bold text-[16px] leading-tight tracking-tight mb-4 pr-2">${titoloPulito}</h4>
                
                <div class="mb-5 flex flex-wrap gap-1.5">
                    ${badgeCDC}
                </div>
                
                <a href="${item.url}" target="_blank" class="w-full rounded-xl text-[14px] px-4 py-2.5 text-center transition-transform active:scale-95 font-bold tracking-tight ${stileBottone}">
                    ${scaduto ? '<i class="fa-solid fa-ban mr-1"></i> Bando Chiuso' : '<i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> Apri Avviso Ufficiale'}
                </a>
                
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold py-3 px-4 rounded-xl mt-2 mb-8 transition-transform active:scale-95 text-[14px] shadow-sm';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-2"></i> Mostra altri (Mostrati ${indiceMostrati} di ${risultatiCorrenti.length})`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
