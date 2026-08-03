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

// 🛡️ FUNZIONE ANTI-XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 🛡️ FUNZIONE ANTI-LINK INJECTION
function sanitizeURL(url) {
    if (!url) return '#';
    const str = String(url).trim();
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('mailto:')) {
        return escapeHTML(str);
    }
    return '#';
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
const leftSidebar = document.getElementById('leftSidebar');
const mobileBackdrop = document.getElementById('mobileBackdrop');
const rightPanelTitle = document.getElementById('rightPanelTitle');
const chiudiPannelloBtn = document.getElementById('chiudiPannelloBtn');

// Stile per le etichette pulite sulla Mappa Leaflet
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
    
    // Inizializza la gesture di trascinamento in basso per chiudere il Bottom Sheet su mobile
    inizializzaBottomSheetTouch();

    // Legge i parametri dall'URL e applica i filtri SEO Deep Linking
    applicaFiltriDaURL();

    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value));
    selectProvincia.addEventListener('change', applicaFiltri);
    selectCdc.addEventListener('change', applicaFiltri);
    selectTipoScuola.addEventListener('change', applicaFiltri);
    selectStato.addEventListener('change', applicaFiltri);
    
    if(btnReset) btnReset.addEventListener('click', resetMappa);

    if(chiudiPannelloBtn) {
        chiudiPannelloBtn.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                mostraVistaMobile('mappa');
            } else {
                rightPanel.classList.add('hidden');
                setTimeout(() => { if (map) map.invalidateSize(); }, 100);
            }
        });
    }

    // Gestione ridimensionamento finestra
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            if (leftSidebar) leftSidebar.classList.remove('hidden');
            if (rightPanel) rightPanel.style.transform = '';
            if (mobileBackdrop) mobileBackdrop.classList.add('hidden');
            const mapContainer = document.getElementById('map-container');
            if (mapContainer) mapContainer.classList.remove('pointer-events-none');
        }
    });
});

function inizializzaMappa() {
    const isMobile = window.innerWidth < 768;

    map = L.map('map', { 
        zoomControl: false,
        tap: !L.Browser.mobile,
        bounceAtZoomLimits: false
    }).setView([41.8719, 12.5674], 6);

    L.control.zoom({ position: isMobile ? 'topright' : 'bottomright' }).addTo(map);

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
    if (geojsonRegioni) map.removeLayer(geojsonRegioni);
    
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
    
    window.history.replaceState({}, '', window.location.pathname);
    aggiornaMetaTagsSEO(null, null, null);

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
        if (item.cdc) item.cdc.forEach(c => {
            if(c && c !== "TUTTE LE CLASSI" && c !== "DA VERIFICARE SUL SITO") {
                cdcUniche.add(c);
            }
        });
    });
    Array.from(cdcUniche).sort().forEach(cdc => {
        selectCdc.innerHTML += `<option value="${escapeHTML(cdc)}">${escapeHTML(cdc)}</option>`;
    });
}

function aggiornaMenuProvinceDaGeoJSON(features) {
    selectProvincia.disabled = false;
    selectProvincia.innerHTML = '<option value="TUTTE">Tutte le Province</option>';
    const nomiProvince = features.map(f => normalizzaProvincia(f.properties.prov_name)).sort();
    nomiProvince.forEach(prov => {
        selectProvincia.innerHTML += `<option value="${escapeHTML(prov)}">${escapeHTML(prov)}</option>`;
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

    let attivi = datiInterpelli.filter(i => !isScaduto(i) && i.data && i.data !== "" && !i.escludi_scoreboard);
    
    aggiornaBadgeMobile(attivi.length);

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
            <div class="bg-white rounded-[14px] border border-apple-hairline p-4 hover:shadow-md transition-all cursor-pointer group min-h-[44px] flex flex-col justify-center" onclick="selezionaRegioneDaMenu('${escapeHTML(item.regione)}')">
                <div class="flex justify-between items-center mb-2.5">
                    <span class="font-semibold text-apple-ink tracking-tightest flex items-center gap-2 group-hover:text-apple-blue transition-colors">${medaglia} ${escapeHTML(item.regione)}</span>
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

    const newUrl = new URL(window.location.href);
    if (reg) newUrl.searchParams.set('regione', reg); else newUrl.searchParams.delete('regione');
    if (prov && prov !== "TUTTE") newUrl.searchParams.set('provincia', prov); else newUrl.searchParams.delete('provincia');
    if (cdc) newUrl.searchParams.set('cdc', cdc); else newUrl.searchParams.delete('cdc');
    window.history.replaceState({}, '', newUrl);

    aggiornaMetaTagsSEO(reg, prov, cdc);

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

    aggiornaBadgeMobile(risultatiCorrenti.length);

    if (window.innerWidth < 768) {
        mostraVistaMobile('risultati');
    }

    if (risultatiCorrenti.length === 0) {
        let suggeriti = datiInterpelli.filter(i => !isScaduto(i) && (
            (reg && i.regione === reg) || (cdc && i.cdc && i.cdc.includes(cdc))
        )).slice(0, 5);
        
        let htmlSuggeriti = "";
        if (suggeriti.length > 0) {
            htmlSuggeriti = `
                <div class="mt-6 pt-6 border-t border-apple-hairline">
                    <p class="text-[14px] font-semibold text-apple-ink mb-3 flex items-center gap-2">
                        <i class="fa-solid fa-lightbulb text-amber-500"></i> Potrebbero interessarti in ${escapeHTML(reg || 'Italia')}:
                    </p>
                    <div class="flex flex-col gap-3">
                        ${suggeriti.map(s => `
                            <a href="${sanitizeURL(s.url)}" target="_blank" rel="noopener noreferrer" class="p-3.5 bg-white rounded-[14px] border border-apple-hairline hover:border-apple-blue hover:shadow-sm transition-all group block min-h-[44px]">
                                <div class="text-[11px] text-apple-blue font-bold uppercase tracking-tight">${escapeHTML(s.provincia)} · ${s.cdc ? escapeHTML(s.cdc.join(', ')) : 'Varie'}</div>
                                <div class="text-[14px] font-semibold text-apple-ink leading-snug group-hover:text-apple-blue transition-colors mt-0.5">${escapeHTML(s.titolo)}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        containerLista.innerHTML = `
            <div class="text-center p-6 mt-4 bg-white rounded-[18px] border border-apple-hairline">
                <i class="fa-solid fa-folder-open text-3xl text-apple-muted mb-2 opacity-50"></i>
                <p class="text-[16px] font-semibold text-apple-ink">Nessun interpello attivo trovato</p>
                <p class="text-[13px] text-apple-muted mt-1">Non ci sono posizioni aperte con i filtri selezionati.</p>
            </div>
            ${htmlSuggeriti}
        `;
        return;
    }

    const titoloRisultati = prov && prov !== "TUTTE" ? prov : (reg ? reg : "Tutta Italia");
    containerLista.innerHTML = `
        <p class="text-
