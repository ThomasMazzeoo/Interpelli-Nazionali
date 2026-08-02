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

// =========================================
// PALETTE COLORI APPLE E FUNZIONE HASH
// =========================================
const APPLE_COLORS = [
    '#0071e3', // Blue
    '#34c759', // Green
    '#5856d6', // Indigo
    '#ff9500', // Orange
    '#ff2d55', // Pink
    '#af52de', // Purple
    '#ff3b30', // Red
    '#5ac8fa', // Teal
    '#00c7be', // Cyan
    '#32ade6'  // Light blue
];

// Genera sempre lo stesso colore per lo stesso nome
function getColorFromName(name) {
    if (!name) return '#0071e3';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return APPLE_COLORS[Math.abs(hash) % APPLE_COLORS.length];
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

// INIEZIONE CSS PER PULIRE I TOOLTIP DI LEAFLET (Rimuove sfondo e freccette)
const style = document.createElement('style');
style.innerHTML = `
    .leaflet-tooltip.clean-label {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        text-shadow: 0 1px 3px rgba(255,255,255,0.8), 0 -1px 3px rgba(255,255,255,0.8), 1px 0 3px rgba(255,255,255,0.8), -1px 0 3px rgba(255,255,255,0.8);
    }
    .leaflet-tooltip.clean-label::before { display: none !important; }
`;
document.head.appendChild(style);

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
            style: (feature) => ({ 
                color: "#ffffff", // Bordo bianco per separare i colori
                weight: 1.5, 
                fillColor: getColorFromName(feature.properties.reg_name), 
                fillOpacity: 0.25 // Semi-trasparente
            }),
            onEachFeature: (feature, layer) => {
                // Etichetta fissa al centro, senza sfondo
                layer.bindTooltip(feature.properties.reg_name, { 
                    permanent: true, 
                    direction: "center", 
                    className: "clean-label text-apple-ink font-bold text-[12px] uppercase tracking-wider" 
                });
                
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.45, weight: 2 }),
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
            style: (feature) => ({ 
                color: "#ffffff", 
                weight: 1.5, 
                fillColor: getColorFromName(feature.properties.prov_name), 
                fillOpacity: 0.3 
            }),
            onEachFeature: (feature, layer) => {
                // Etichetta Provincia fissa
                layer.bindTooltip(feature.properties.prov_name, { 
                    permanent: true, 
                    direction: "center", 
                    className: "clean-label text-apple-ink font-bold text-[10px] uppercase tracking-wider" 
                });

                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.55 }),
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
            <div class="text-center p-8 mt-10">
                <p class="text-[17px] font-semibold text-apple-ink">Nessun risultato</p>
                <p class="text-[14px] text-apple-muted mt-2">Prova a modificare i filtri o controlla gli interpelli scaduti.</p>
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <p class="text-[14px] text-apple-muted font-medium mb-4">${risultatiCorrenti.length} interpelli in ${titoloRisultati}</p>
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

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="bg-apple-parchment text-apple-ink border border-apple-hairline px-3 py-1 rounded-full text-[12px] font-medium">${c}</span>`).join('')
            : `<span class="bg-apple-parchment text-apple-muted border border-apple-hairline px-3 py-1 rounded-full text-[12px] font-medium">CDC non specificata</span>`;

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
            ? 'opacity-50 bg-apple-pearl' 
            : 'bg-white';

        const nomeProvinciaMostrato = (item.provincia || "");
        
        const testoProvincia = isNuovo ? `<span class="text-apple-blue font-semibold uppercase">Nuovo · ${nomeProvinciaMostrato}</span>` : `<span class="uppercase">${nomeProvinciaMostrato}</span>`;
        const testoData = scaduto ? `Chiuso` : `Scade il ${dataIta}`;

        const stileBottone = scaduto 
            ? 'bg-apple-parchment text-apple-muted border border-apple-hairline' 
            : 'bg-apple-blue hover:bg-apple-blueFocus text-white shadow-sm';

        griglia.innerHTML += `
            <div class="rounded-[18px] border border-apple-hairline p-6 flex flex-col transition-all ${classeCard}">
                
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[12px] tracking-tightest font-medium ${isNuovo ? '' : 'text-apple-muted'}">${testoProvincia}</span>
                    <span class="text-[12px] tracking-tightest font-medium text-apple-muted">${testoData}</span>
                </div>
                
                <h4 class="text-apple-ink font-semibold text-[19px] leading-tight tracking-tightest mb-4 pr-2">${titoloPulito}</h4>
                
                <div class="mb-6 flex flex-wrap gap-2">
                    ${badgeCDC}
                </div>
                
                <a href="${item.url}" target="_blank" class="w-full rounded-full text-[15px] px-4 py-2.5 text-center transition-transform active:scale-95 font-medium tracking-tightest ${stileBottone}">
                    ${scaduto ? 'Avviso Chiuso' : 'Apri Avviso Ufficiale'}
                </a>
                
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-apple-pearl hover:bg-apple-parchment text-apple-ink border border-apple-hairline font-medium py-3 px-4 rounded-full mt-2 mb-8 transition-transform active:scale-95 text-[15px]';
        btn.innerHTML = `Mostra altri`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
