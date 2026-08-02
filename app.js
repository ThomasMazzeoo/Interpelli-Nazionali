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
            style: { color: "#181d26", weight: 1, fillColor: "#181d26", fillOpacity: 0.1 },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.2 }),
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
            style: { color: "#1b61c9", weight: 1, fillColor: "#1b61c9", fillOpacity: 0.1 },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.3 }),
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
    selectProvincia.innerHTML = '<option value="">Scegli prima la regione</option>';
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
        // Hero Card Dark - Empty state (Brand Voltage)
        containerLista.innerHTML = `
            <div class="bg-[#181d26] text-[#ffffff] p-[48px] rounded-[12px] mt-4 flex flex-col items-center justify-center text-center">
                <p class="text-[20px] font-normal leading-[1.4]">Nessun risultato in ${prov === 'TUTTE' ? reg : prov}.</p>
                <p class="text-[14px] text-[#9297a0] mt-3">Prova a rimuovere un filtro o a cercare tra gli interpelli chiusi.</p>
            </div>`;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : reg;
    containerLista.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <span class="text-[14px] font-medium text-[#41454d]">Mostrando risultati per ${titoloRisultati}</span>
            <span class="text-[14px] text-[#181d26] font-medium bg-[#e0e2e6] px-2 py-0.5 rounded-[6px]">${risultatiCorrenti.length}</span>
        </div>
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

        // Classi CDC (Design System: soft gray background, hairline border)
        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="inline-block bg-[#ffffff] border border-[#dddddd] text-[#333840] px-2 py-1 rounded-[6px] text-[14px] font-medium">${c}</span>`).join('')
            : `<span class="inline-block bg-[#ffffff] border border-[#dddddd] text-[#9297a0] px-2 py-1 rounded-[6px] text-[14px] font-medium">Nessuna classe specificata</span>`;

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
        
        // Brand Voltage Badge: Signature Mint
        const badgeNuovoHTML = isNuovo ? `<span class="inline-block bg-[#a8d8c4] text-[#0a2e0e] px-2 py-1 rounded-[6px] text-[12px] font-medium mb-4 mr-2">Nuovo</span>` : '';
        
        const nomeProvinciaMostrato = (item.provincia || "");

        // Brand Voltage Badge: Signature Cream + Coral per la data attiva. Flat gray per scaduto.
        let badgeDataHtml = '';
        if (scaduto) {
            badgeDataHtml = `<span class="inline-block bg-[#e0e2e6] text-[#41454d] px-2 py-1 rounded-[6px] text-[12px] font-medium mb-4"><i class="fa-solid fa-lock mr-1"></i> Chiuso</span>`;
        } else {
            badgeDataHtml = `<span class="inline-block bg-[#f5e9d4] text-[#aa2d00] px-2 py-1 rounded-[6px] text-[12px] font-medium mb-4"><i class="fa-regular fa-clock mr-1"></i> Scade il ${dataIta}</span>`;
        }

        const badgeProvincia = `<span class="inline-block bg-[#ffffff] border border-[#dddddd] text-[#41454d] px-2 py-1 rounded-[6px] text-[12px] font-medium mb-4 mr-2">${nomeProvinciaMostrato}</span>`;

        // Card Container (Demo Grid Card analog: 10px radius, 24px padding, 1px border, NO SHADOW)
        const classeCardNuova = scaduto ? 'opacity-60 bg-[#ffffff] border-[#dddddd]' : 'bg-[#ffffff] border-[#dddddd]';

        // Bottoni (Primary Button: Near Black, 12px radius)
        const buttonClass = scaduto
            ? 'bg-[#ffffff] border border-[#dddddd] text-[#41454d]'
            : 'bg-[#181d26] hover:bg-[#0d1218] text-[#ffffff]';

        griglia.innerHTML += `
            <div class="relative rounded-[10px] p-[24px] mb-6 border ${classeCardNuova}">
                <div class="flex flex-wrap items-center">
                    ${badgeNuovoHTML}
                    ${badgeProvincia}
                    ${badgeDataHtml}
                </div>
                
                <h4 class="font-normal text-[#181d26] text-[20px] leading-[1.4] mb-4">${titoloPulito}</h4>
                
                <div class="mb-6 flex flex-wrap gap-2">
                    ${badgeCDC}
                </div>
                
                <a href="${item.url}" target="_blank" class="w-full ${buttonClass} font-medium rounded-[12px] text-[16px] h-[48px] flex items-center justify-center transition-colors">
                    ${scaduto ? 'Avviso Chiuso' : 'Apri Avviso'}
                </a>
            </div>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        // Secondary Button per caricare gli altri (White, hairline border)
        btn.className = 'w-full bg-[#ffffff] border border-[#dddddd] text-[#181d26] hover:bg-[#f8fafc] font-medium rounded-[12px] h-[48px] mb-8 transition-colors flex items-center justify-center';
        btn.innerHTML = `Mostra altri`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}
