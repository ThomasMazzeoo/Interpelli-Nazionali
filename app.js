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

const APPLE_COLORS = [
    '#0071e3', '#34c759', '#5856d6', '#ff9500', '#ff2d55', 
    '#af52de', '#ff3b30', '#5ac8fa', '#00c7be', '#32ade6'
];

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
const rightPanelTitle = document.getElementById('rightPanelTitle');
const chiudiPannelloBtn = document.getElementById('chiudiPannelloBtn');

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
                color: "#ffffff", 
                weight: 1.5, 
                fillColor: getColorFromName(feature.properties.reg_name), 
                fillOpacity: 0.25 
            }),
            onEachFeature: (feature, layer) => {
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
        livelloAttuale = 'regioni';
    } catch (error) { console.error(error); }
}

async function clickSuRegione(nomeRegione, bounds) {
    if(bounds) map.fitBounds(bounds);
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
    
    mostraScoreboard();
}

function selezionaRegioneDaMenu(regione) {
    if (!regione) return resetMappa();
    if(geojsonRegioni) {
        geojsonRegioni.eachLayer(layer => {
            if (layer.feature.properties.reg_name === regione) clickSuRegione(regione, layer.getBounds());
        });
    } else {
        clickSuRegione(regione, null);
    }
}

async function caricaDatiScraper() {
    try {
        const response = await fetch('database_nazionale.json?' + new Date().getTime());
        if (response.ok) {
            datiInterpelli = await response.json();
            popolaMenuCDC(); 
            mostraScoreboard();
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
    if (item.data && item.data !== "") {
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

function mostraScoreboard() {
    if (rightPanel.classList.contains('hidden')) {
        rightPanel.classList.remove('hidden');
        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }

    rightPanelTitle.innerHTML = '<i class="fa-solid fa-chart-simple text-apple-blue mr-2"></i> Classifica Nazionale';

    let attivi = datiInterpelli.filter(i => !isScaduto(i));
    let conteggio = {};
    
    attivi.forEach(i => {
        let r = i.regione || "Altre";
        conteggio[r] = (conteggio[r] || 0) + 1;
    });

    let classifica = Object.keys(conteggio).map(r => ({ regione: r, conteggio: conteggio[r] }));
    classifica.sort((a, b) => b.conteggio - a.conteggio);

    if (classifica.length === 0) {
        containerLista.innerHTML = `
            <div class="text-center p-8 mt-10">
                <i class="fa-solid fa-mug-hot text-4xl text-apple-muted mb-4 opacity-50"></i>
                <p class="text-[17px] font-semibold text-apple-ink">Tutto tranquillo</p>
                <p class="text-[14px] text-apple-muted mt-2">Al momento non ci sono posizioni aperte in Italia.</p>
            </div>`;
        return;
    }

    let html = `<p class="text-[14px] text-apple-muted font-medium mb-5">Regioni con più interpelli aperti</p><div class="flex flex-col gap-3">`;
    let maxCount = classifica[0].conteggio;

    classifica.forEach((item, index) => {
        let percentuale = (item.conteggio / maxCount) * 100;
        let medaglia = '';
        if(index === 0) medaglia = '<span class="text-lg">🥇</span>';
        else if(index === 1) medaglia = '<span class="text-lg">🥈</span>';
        else if(index === 2) medaglia = '<span class="text-lg">🥉</span>';
        else medaglia = `<span class="text-apple-muted text-[13px] font-bold w-[22px] inline-block text-center">${index+1}</span>`;

        html += `
            <div class="bg-white rounded-[14px] border border-apple-hairline p-4 hover:shadow-md transition-all cursor-pointer group" onclick="selezionaRegioneDaMenu('${item.regione}')">
                <div class="flex justify-between items-center mb-2.5">
                    <span class="font-semibold text-apple-ink tracking-tightest flex items-center gap-2 group-hover:text-apple-blue transition-colors">${medaglia} ${item.regione}</span>
                    <span class="bg-apple-blue text-white text-[12px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">${item.conteggio}</span>
                </div>
                <div class="w-full bg-apple-pearl rounded-full h-1.5 overflow-hidden">
                    <div class="bg-apple-blue h-1.5 rounded-full" style="width: ${percentuale}%"></div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    containerLista.innerHTML = html;
}

function applicaFiltri() {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const cdc = selectCdc.value;
    const tipo = selectTipoScuola.value;
    const stato = selectStato.value;

    if (!reg && !cdc && !tipo && stato === "ATTIVI") {
        mostraScoreboard();
        return;
    }

    rightPanelTitle.innerHTML = '<i class="fa-solid fa-list-check text-apple-blue mr-2"></i> Risultati';

    if (rightPanel.classList.contains('hidden')) {
        rightPanel.classList.remove('hidden');
        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }

    let filtrati = datiInterpelli;
    
    if(reg) filtrati = filtrati.filter(i => (i.regione || "").toLowerCase() === reg.toLowerCase());

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

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : (reg ? reg : "Tutta Italia");
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
        if(dataIta && dataIta.includes('-')) {
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
        
        // IL NUOVO BADGE DELLA DATA
        let testoData = "";
        if (scaduto) {
            testoData = `<span class="font-bold bg-gray-200 px-2.5 py-1 rounded text-gray-500 border border-gray-300 shadow-sm"><i class="fa-solid fa-lock mr-1"></i> CHIUSO</span>`;
        } else if (!item.data || item.data === "") {
            // SE LA DATA E' VUOTA, BADGE GIALLO!
            testoData = `<span class="font-bold bg-amber-50 px-2.5 py-1 rounded text-amber-600 border border-amber-200 shadow-sm"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Non specificata</span>`;
        } else {
            testoData = `<span class="font-bold bg-red-50 px-2.5 py-1 rounded text-red-700 border border-red-200 shadow-sm"><i class="fa-regular fa-clock mr-1"></i> Scade il: ${dataIta}</span>`;
        }

        const stileBottone = scaduto 
            ? 'bg-apple-parchment text-apple-muted border border-apple-hairline' 
            : 'bg-apple-blue hover:bg-apple-blueFocus text-white shadow-sm';

        griglia.innerHTML += `
            <div class="rounded-[18px] border border-apple-hairline p-6 flex flex-col transition-all ${classeCard}">
                
                <div class="flex justify-between items-center mb-4">
                    <span class="text-[12px] tracking-tightest font-medium ${isNuovo ? '' : 'text-apple-muted'}">${testoProvincia}</span>
                    ${testoData}
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
