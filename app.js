const URL_REGIONI = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson";
const URL_PROVINCE = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson";

const ALIAS_REGIONI = {
    "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
    "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta"
};

function normalizzaRegione(nomeIstat) {
    return ALIAS_REGIONI[nomeIstat] || nomeIstat;
}

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

// 📱 PUNTO 6: Paginazione adattiva (15 per Mobile, 50 per Desktop)
const isMobileDevice = window.innerWidth < 768;
const CHUNK_INIZIALE = isMobileDevice ? 15 : 50;  
const CHUNK_SUCCESSIVO = isMobileDevice ? 15 : 20;

const selectRegione = document.getElementById('regioneSelect');
const selectProvincia = document.getElementById('provinciaSelect');
const selectCdc = document.getElementById('cdcSelect');

const selectStato = document.getElementById('statoSelect');
const btnReset = document.getElementById('btnResetMappa'); 
const containerLista = document.getElementById('listaInterpelli');

const rightPanel = document.getElementById('rightPanel');
const leftSidebar = document.getElementById('leftSidebar');
const mobileBackdrop = document.getElementById('mobileBackdrop');
const rightPanelTitle = document.getElementById('rightPanelTitle');
const chiudiPannelloBtn = document.getElementById('chiudiPannelloBtn');
const btnMostraRisultatiMappa = document.getElementById('btnMostraRisultatiMappa');
const testoBtnRisultatiMappa = document.getElementById('testoBtnRisultatiMappa');

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

    selectRegione.addEventListener('change', (e) => selezionaRegioneDaMenu(e.target.value, false));
    selectProvincia.addEventListener('change', () => applicaFiltri(false));
    selectCdc.addEventListener('change', () => applicaFiltri(false));
    selectStato.addEventListener('change', () => applicaFiltri(false));
    
    if(btnReset) btnReset.addEventListener('click', resetMappa);

    if(chiudiPannelloBtn) {
        chiudiPannelloBtn.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                mostraVistaMobile('mappa');
            } else {
                rightPanel.classList.add('hidden');
                setTimeout(() => { if (map) map.invalidateSize(); }, 100);
            }
            resetMappa();
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

    const boundsItalia = [[35.0, 5.0], [48.0, 20.0]]; // Limiti mappa (anti-dispersione)

    map = L.map('map', { 
        zoomControl: false,
        tap: !L.Browser.mobile,
        bounceAtZoomLimits: false,
        maxBounds: boundsItalia,
        maxBoundsViscosity: 0.8
    });

    if (isMobile) {
        map.setView([42.5, 12.5674], 5.5); // Centratura rialzata per la barra inferiore
    } else {
        map.setView([41.8719, 12.5674], 6);
    }

    if (!isMobile) {
        L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    // Aggiungo il tilelayer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { 
        maxZoom: 10, 
        minZoom: 5,
        bounds: boundsItalia 
    }).addTo(map);
    caricaLayerRegioni();
}

async function caricaLayerRegioni() {
    try {
        const response = await fetch(URL_REGIONI);
        const data = await response.json();
        if (geojsonProvince) map.removeLayer(geojsonProvince);
        if (geojsonRegioni) map.removeLayer(geojsonRegioni);
        
        geojsonRegioni = L.geoJSON(data, {
            style: (feature) => ({ 
                color: "#ffffff", 
                weight: 2, // Bordo premium
                fillColor: getColorFromName(feature.properties.reg_name), 
                fillOpacity: 0.4 // Colori più vibranti
            }),
            onEachFeature: (feature, layer) => {
                const nomeReg = feature.properties.reg_name;
                const etichetta = isMobileDevice ? (nomeReg.substring(0,3).toUpperCase()) : nomeReg;
                layer.bindTooltip(etichetta, { 
                    permanent: true, 
                    direction: "center", 
                    className: "clean-label text-apple-ink font-bold text-[12px] uppercase tracking-wider" 
                });
                
                layer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.6, weight: 2.5 }),
                    mouseout: (e) => geojsonRegioni.resetStyle(e.target),
                    click: (e) => clickSuRegione(feature.properties.reg_name, e.target.getBounds())
                });
            }
        }).addTo(map);
        livelloAttuale = 'regioni';
    } catch (error) { console.error(error); }
}

async function clickSuRegione(nomeRegione, bounds, forzaJump = false) {
    if(bounds) {
        const padBottom = isMobileDevice ? [0, 80] : [0, 0];
        map.flyToBounds(bounds, { paddingBottomRight: padBottom, duration: 0.8, easeLinearity: 0.25 });
    }
    selectRegione.value = normalizzaRegione(nomeRegione);
    if (geojsonRegioni) map.removeLayer(geojsonRegioni);
    
    try {
        const response = await fetch(URL_PROVINCE);
        const data = await response.json();
        const provinceRegione = data.features.filter(f => f.properties.reg_name === nomeRegione);
        if (geojsonProvince) map.removeLayer(geojsonProvince);

        aggiornaMenuProvinceDaGeoJSON(provinceRegione);

        let provinciaSelezionataLayer = null;

        geojsonProvince = L.geoJSON(provinceRegione, {
            style: (feature) => ({ 
                color: "#ffffff", 
                weight: 2, 
                fillColor: getColorFromName(feature.properties.prov_name), 
                fillOpacity: 0.45 
            }),
            onEachFeature: (feature, layer) => {
                const nomeProv = feature.properties.prov_name;
                const etichettaProv = isMobileDevice ? nomeProv.substring(0, 2).toUpperCase() : nomeProv;
                layer.bindTooltip(etichettaProv, { 
                    permanent: true, 
                    direction: "center", 
                    className: "clean-label text-apple-ink font-bold text-[10px] uppercase tracking-wider" 
                });

                layer.on({
                    mouseover: (e) => {
                        if (provinciaSelezionataLayer !== e.target) {
                            e.target.setStyle({ fillOpacity: 0.65 });
                        }
                    },
                    mouseout: (e) => {
                        if (provinciaSelezionataLayer !== e.target) {
                            geojsonProvince.resetStyle(e.target);
                        }
                    },
                    click: (e) => {
                        // Ripristina lo stile della provincia precedentemente selezionata
                        if (provinciaSelezionataLayer) {
                            geojsonProvince.resetStyle(provinciaSelezionataLayer);
                        }
                        
                        // Imposta lo stile nero marcato per la nuova provincia selezionata
                        provinciaSelezionataLayer = e.target;
                        provinciaSelezionataLayer.setStyle({
                            color: "#000000",
                            weight: 3,
                            fillOpacity: 0.65
                        });
                        provinciaSelezionataLayer.bringToFront();

                        const nomeDB = normalizzaProvincia(feature.properties.prov_name);
                        selectProvincia.value = nomeDB;
                        applicaFiltri(false); 
                    }
                });
            }
        }).addTo(map);
        
        livelloAttuale = 'province';
        selectProvincia.value = "TUTTE";
        
        // 🎯 PUNTO 6: Zoom sulla Regione SENZA aprire automaticamente il pannello dei risultati!
        applicaFiltri(forzaJump);
        
        if(btnReset) btnReset.classList.remove('hidden');
    } catch (error) { console.error(error); }
}

function resetMappa() {
    if (isMobileDevice) {
        map.flyTo([42.5, 12.5674], 5.5, { duration: 0.8 });
    } else {
        map.flyTo([41.8719, 12.5674], 6, { duration: 0.8 });
    }
    selectRegione.value = "";
    selectProvincia.innerHTML = '<option value="">-- Prima seleziona una Regione --</option>';
    selectProvincia.disabled = true;
    selectCdc.value = "";

    
    if (geojsonProvince) map.removeLayer(geojsonProvince);
    
    if (geojsonRegioni) {
        if (!map.hasLayer(geojsonRegioni)) {
            map.addLayer(geojsonRegioni);
        }
    } else {
        caricaLayerRegioni();
    }
    
    if(btnReset) btnReset.classList.add('hidden');
    if(btnMostraRisultatiMappa) btnMostraRisultatiMappa.classList.add('hidden');
    
    window.history.replaceState({}, '', window.location.pathname);
    aggiornaMetaTagsSEO(null, null, null);

    mostraScoreboard();
}

function selezionaRegioneDaMenu(regione, forzaJump = false) {
    if (!regione) return resetMappa();
    if(geojsonRegioni) {
        geojsonRegioni.eachLayer(layer => {
            const nomeMap = normalizzaRegione(layer.feature.properties.reg_name);
            const nomeInput = normalizzaRegione(regione);
            if (nomeMap === nomeInput) {
                clickSuRegione(layer.feature.properties.reg_name, layer.getBounds(), forzaJump);
            }
        });
    } else {
        clickSuRegione(regione, null, forzaJump);
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
            // Aggiungiamo 5 giorni di tolleranza. Spesso la 'data' è quella di pubblicazione
            // e non quella reale di scadenza. Così evitiamo che scompaiano subito.
            dataScadenza.setDate(dataScadenza.getDate() + 5);
            
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0); 
            return dataScadenza < oggi;
        }
    }
    return false; 
}

function mostraScoreboard() {
    if (rightPanel.classList.contains('hidden') && window.innerWidth >= 768) {
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

// 🎯 PUNTO 6: 'apriPannelloEsplicito' controlla se mostrare il pannello risultati o tenere il focus sulla mappa
function applicaFiltri(apriPannelloEsplicito = false) {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const cdc = selectCdc.value;
    const stato = selectStato.value;

    const newUrl = new URL(window.location.href);
    if (reg) newUrl.searchParams.set('regione', reg); else newUrl.searchParams.delete('regione');
    if (prov && prov !== "TUTTE") newUrl.searchParams.set('provincia', prov); else newUrl.searchParams.delete('provincia');
    if (cdc) newUrl.searchParams.set('cdc', cdc); else newUrl.searchParams.delete('cdc');
    window.history.replaceState({}, '', newUrl);

    aggiornaMetaTagsSEO(reg, prov, cdc);

    if (!reg && (!prov || prov === "TUTTE") && !cdc && stato === "ATTIVI") {
        mostraScoreboard();
        return;
    }

    let filtrati = datiInterpelli;
    
    if(reg) {
        const regNormalizzata = normalizzaRegione(reg).toLowerCase();
        filtrati = filtrati.filter(i => (i.regione || "").toLowerCase() === regNormalizzata);
    }

    if (prov && prov !== "TUTTE") {
        filtrati = filtrati.filter(i => (i.provincia || "").toLowerCase() === prov.toLowerCase());
    }
    if (cdc) filtrati = filtrati.filter(i => i.cdc && i.cdc.includes(cdc));

    if (stato === "ATTIVI") {
        filtrati = filtrati.filter(i => !isScaduto(i));
    } else if (stato === "SCADUTI") {
        filtrati = filtrati.filter(i => isScaduto(i));
    } else if (stato === "DAVERIFICARE") {
        filtrati = filtrati.filter(i => {
            if (isScaduto(i)) return false;
            return !i.data || i.data.trim() === "" || i.data.toLowerCase().includes("da verificare");
        });
    }



    filtrati.sort((a, b) => {
        let dataA = a.data || ""; let dataB = b.data || "";
        return dataA > dataB ? -1 : (dataA < dataB ? 1 : 0);
    });

    risultatiCorrenti = filtrati;
    indiceMostrati = 0;

    const conteggioInZona = risultatiCorrenti.length;
    aggiornaBadgeMobile(conteggioInZona);

    // 🎯 PUNTO 6: AGGIORNA IL PULSANTE FLUTTUANTE SULLA MAPPA "VEDI X INTERPELLI"
    const nomeZona = prov && prov !== "TUTTE" ? prov : (reg ? reg : "Italia");
    if (testoBtnRisultatiMappa && btnMostraRisultatiMappa) {
        
        btnMostraRisultatiMappa.classList.remove('btn-status-red', 'btn-status-orange', 'btn-status-green');

        if (conteggioInZona > 0) {
            testoBtnRisultatiMappa.textContent = `Vedi ${conteggioInZona} Interpelli in ${nomeZona}`;
            
            // Se c'è almeno un interpello con la data definita, diventa verde, altrimenti arancione
            const haDatiValidi = risultatiCorrenti.some(i => i.data && i.data.trim() !== "");
            
            if (haDatiValidi) {
                btnMostraRisultatiMappa.classList.add('btn-status-green');
            } else {
                btnMostraRisultatiMappa.classList.add('btn-status-orange');
            }
            
            btnMostraRisultatiMappa.classList.remove('hidden');
        } else {
            testoBtnRisultatiMappa.textContent = `Nessun Interpello in ${nomeZona}`;
            btnMostraRisultatiMappa.classList.add('btn-status-red');
            btnMostraRisultatiMappa.classList.remove('hidden');
        }
    }

    // Apri il pannello risultati (sempre aggiornato, ma forza il jump su mobile solo se richiesto)
    apriPannelloRisultatiGUI(nomeZona, apriPannelloEsplicito);
}

// Apre il pannello con i risultati renderizzati
function apriPannelloRisultatiGUI(nomeZona, forzaJumpMobile = false) {
    rightPanelTitle.innerHTML = '<i class="fa-solid fa-list-check text-apple-blue mr-2"></i> Risultati';

    const isMobile = window.innerWidth < 768;

    if (!isMobile) {
        if (rightPanel.classList.contains('hidden')) {
            rightPanel.classList.remove('hidden');
            setTimeout(() => { if (map) map.invalidateSize(); }, 100);
        }
    } else {
        if (forzaJumpMobile) {
            mostraVistaMobile('risultati');
        }
    }

    if (risultatiCorrenti.length === 0) {
        const reg = selectRegione.value;
        const cdc = selectCdc.value;
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

    containerLista.innerHTML = `
        <p class="text-[14px] text-apple-muted font-medium mb-4">${risultatiCorrenti.length} interpelli in ${escapeHTML(nomeZona)}</p>
        <div id="grigliaCard" class="flex flex-col gap-4"></div>
    `;
    
    aggiornaDatiStrutturatiSchema(risultatiCorrenti);
    indiceMostrati = 0;
    caricaPezzi(CHUNK_INIZIALE);
}

function apriRisultatiDaMappa() {
    const reg = selectRegione.value;
    const prov = selectProvincia.value;
    const nomeZona = prov && prov !== "TUTTE" ? prov : (reg ? reg : "Italia");
    apriPannelloRisultatiGUI(nomeZona, true);
}

function caricaPezzi(quantita) {
    const griglia = document.getElementById('grigliaCard');
    if (!griglia) return;

    const oldBtn = document.getElementById('btnCaricaAltri');
    if (oldBtn) oldBtn.remove();

    const daMostrare = risultatiCorrenti.slice(indiceMostrati, indiceMostrati + quantita);
    const dataOdierna = new Date(); 
    
    daMostrare.forEach(item => {
        let titoloGrezzo = (item.titolo || "").replace('[CHIUSO]', '').trim();
        if (titoloGrezzo.startsWith('-')) titoloGrezzo = titoloGrezzo.substring(1).trim();
        if (titoloGrezzo.includes(" - [CDC:")) titoloGrezzo = titoloGrezzo.split(" - [CDC:")[0];

        let titoloPulito = escapeHTML(titoloGrezzo);
        let urlSicuro = sanitizeURL(item.url);
        let provinciaSicura = escapeHTML(item.provincia || "");

        const badgeCDC = item.cdc && item.cdc.length > 0 
            ? item.cdc.map(c => `<span class="bg-apple-parchment text-apple-ink border border-apple-hairline px-3 py-1 rounded-full text-[12px] font-medium">${escapeHTML(c)}</span>`).join('')
            : `<span class="bg-apple-parchment text-apple-muted border border-apple-hairline px-3 py-1 rounded-full text-[12px] font-medium">CDC non specificata</span>`;

        let dataIta = item.data;
        if(dataIta && dataIta.includes('-')) {
            let p = dataIta.split('-');
            dataIta = `${escapeHTML(p[2])}/${escapeHTML(p[1])}/${escapeHTML(p[0])}`;
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

        const testoProvincia = isNuovo 
            ? `<span class="text-apple-blue font-semibold uppercase">Nuovo · ${provinciaSicura}</span>` 
            : `<span class="uppercase">${provinciaSicura}</span>`;
        
        let testoData = "";
        if (scaduto) {
            testoData = `<span class="font-bold bg-gray-200 px-2.5 py-1 rounded text-gray-500 border border-gray-300 shadow-sm"><i class="fa-solid fa-lock mr-1"></i> CHIUSO</span>`;
        } else if (!item.data || item.data === "") {
            testoData = `<span class="font-bold bg-amber-50 px-2.5 py-1 rounded text-amber-600 border border-amber-200 shadow-sm"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Non specificata</span>`;
        } else {
            testoData = `<span class="font-bold bg-red-50 px-2.5 py-1 rounded text-red-700 border border-red-200 shadow-sm"><i class="fa-regular fa-clock mr-1"></i> Scade il: ${dataIta}</span>`;
        }

        const stileBottone = scaduto 
            ? 'bg-apple-parchment text-apple-muted border border-apple-hairline' 
            : 'bg-apple-blue hover:bg-apple-blueFocus text-white shadow-sm';

        // Mappa delle province per il link all'USR (fonte)
        const MAPPA_USR = {
            "Ancona": "https://www.istruzione-ancona.it/category/docenti/interpelli/",
            "Ascoli Piceno": "https://www.uspascolipiceno.it/wordpress/interpelli/",
            "Fermo": "https://www.uspascolipiceno.it/wordpress/interpelli/",
            "Macerata": "http://www.uspmc.sinp.net/documenti-uspmc-cms/page/2/?cat-documenti-uspmc=interpelli",
            "Pesaro Urbino": "https://www.usppesarourbino.it/category/interpelli/",
            "Genova": "https://www.istruzioneliguria.it/istituti-scolastici-interpelli-per-le-supplenze/",
            "Imperia": "https://www.istruzioneimperia.gov.it/pagine/interpelli-im---as-2024-2025-1",
            "La Spezia": "https://www.istruzioneliguria.it/istituti-scolastici-interpelli-per-le-supplenze/",
            "Savona": "https://www.istruzioneliguria.it/istituti-scolastici-interpelli-per-le-supplenze/",
            "Massa Carrara": "https://www.ustms.it/category/docenti/interpelli/",
            "Pistoia": "https://www.ufficioscolasticoprovinciale.pistoia.it/category/docenti/interpelli-docenti/",
            "Prato": "https://www.ufficioscolasticoprovinciale.prato.it/?s=interpello&submit=",
            "Firenze": "https://www.ust.fi.it/mese/interpelli/",
            "Pisa": "https://www.usp-pi.it/category/interpelli/",
            "Siena": "https://www.uspsi.it/uspsiena/interpelli-docenti/",
            "Arezzo": "https://www.arezzoistruzione.it/usparezzo/index.php/interpelli",
            "Livorno": "https://www.ustli.it/usp_livorno/index.php/docenti/interpelli",
            "Grosseto": "https://www.ufficioscolasticogrosseto.it/uff7/index.php/utilita/interpelli-nazionali-2",
            "Teramo": "https://www.csateramo.it/wpusp/archive/category/interpello",
            "Pescara": "https://www.istruzionechietipescara.it/category/dalle-istituzioni-scolatiche/",
            "Sassari": "https://www.mim.gov.it/web/sassari/interpelli-docenti",
            "Nuoro": "https://www.mim.gov.it/web/nuoro/interpelli",
            "Oristano": "https://www.mim.gov.it/web/oristano/notizie",
            "Cagliari": "https://www.mim.gov.it/web/cagliari/interpelli-docenti-e-personale-educativo",
            "Sud Sardegna": "https://www.mim.gov.it/web/cagliari/interpelli-docenti-e-personale-educativo",
            "Viterbo": "https://www.provveditoratostudiviterbo.it/DOCENTI/interpelli/INTERPELLIDOC.htm",
            "Rieti": "https://www.usp-rieti.it/interpelli/",
            "Roma": "https://www.atpromaistruzione.it/atp/category/reclutamento/interpelli-personale-docente/",
            "Frosinone": "https://www.uspistruzione.fr.it/wp2/category/graduatorie/interpello-nazionale",
            "Latina": "https://www.csalatina.it/interpelli/"
        };
        const usrUrl = MAPPA_USR[item.provincia] || `https://www.google.com/search?q=Ambito+Territoriale+${encodeURIComponent(item.provincia)}+interpelli`;

        griglia.innerHTML += `
            <article class="rounded-[18px] border border-apple-hairline p-6 flex flex-col transition-all ${classeCard}" aria-label="Interpello ${titoloPulito}">
                
                <div class="flex justify-between items-center mb-4">
                    <span class="text-[12px] tracking-tightest font-medium ${isNuovo ? '' : 'text-apple-muted'}">${testoProvincia}</span>
                    ${testoData}
                </div>
                
                <h4 class="text-apple-ink font-semibold text-[19px] leading-tight tracking-tightest mb-4 pr-2">${titoloPulito}</h4>
                
                <div class="mb-6 flex flex-wrap gap-2">
                    ${badgeCDC}
                </div>
                
                <div class="mt-auto flex flex-col gap-2">
                    <a href="${urlSicuro}" target="_blank" rel="noopener noreferrer" class="w-full rounded-full text-[15px] px-4 py-3 text-center transition-transform active:scale-95 font-medium tracking-tightest min-h-[44px] flex items-center justify-center ${stileBottone}">
                        ${scaduto ? 'Avviso Chiuso' : 'Apri Avviso Ufficiale'}
                    </a>
                    
                    <a href="${usrUrl}" target="_blank" rel="noopener noreferrer" title="Visita la pagina dell'Ufficio Scolastico Territoriale" class="w-full bg-apple-pearl hover:bg-apple-parchment text-apple-muted border border-apple-hairline rounded-full text-[14px] px-4 py-2.5 text-center transition-transform active:scale-95 font-medium tracking-tightest flex items-center justify-center">
                        <i class="fa-solid fa-university mr-2 opacity-70"></i> Bacheca USR ${provinciaSicura}
                    </a>
                </div>
                
            </article>
        `;
    });

    indiceMostrati += quantita;

    if (indiceMostrati < risultatiCorrenti.length) {
        const btn = document.createElement('button');
        btn.id = 'btnCaricaAltri';
        btn.className = 'w-full bg-apple-pearl hover:bg-apple-parchment text-apple-ink border border-apple-hairline font-medium py-3.5 px-4 rounded-full mt-2 mb-8 transition-transform active:scale-95 text-[15px] cursor-pointer min-h-[44px]';
        btn.innerHTML = `Mostra altri`;
        btn.onclick = () => caricaPezzi(CHUNK_SUCCESSIVO);
        containerLista.appendChild(btn);
    }
}

// ----------------------------------------------------------------------
// 📱 MODULI MOBILE: Viste, Bottom Nav, Bottom Sheet & Gesture Drag
// ----------------------------------------------------------------------

function mostraVistaMobile(vista) {
    if (window.innerWidth >= 768) return; 

    const btnFiltri = document.getElementById('navFiltriBtn');
    const btnMappa = document.getElementById('navMappaBtn');
    const btnRisultati = document.getElementById('navRisultatiBtn');
    const mapContainer = document.getElementById('map-container');
    const backdrop = document.getElementById('mobileBackdrop');

    [btnFiltri, btnMappa, btnRisultati].forEach(b => {
        if(b) {
            b.classList.remove('text-apple-blue');
            b.classList.add('text-apple-muted');
        }
    });

    if (vista === 'filtri') {
        if (leftSidebar) {
            leftSidebar.classList.remove('hidden');
            leftSidebar.classList.add('flex');
        }
        if (rightPanel) {
            rightPanel.classList.add('hidden');
            rightPanel.style.transform = '';
        }
        if (btnFiltri) {
            btnFiltri.classList.remove('text-apple-muted');
            btnFiltri.classList.add('text-apple-blue');
        }
        if (backdrop) backdrop.classList.remove('hidden');
        if (mapContainer) mapContainer.classList.add('pointer-events-none');

    } else if (vista === 'risultati') {
        if (rightPanel) {
            rightPanel.classList.remove('hidden');
            rightPanel.classList.add('flex');
            rightPanel.style.transform = 'translateY(0)';
        }
        if (leftSidebar) leftSidebar.classList.add('hidden');
        if (btnRisultati) {
            btnRisultati.classList.remove('text-apple-muted');
            btnRisultati.classList.add('text-apple-blue');
        }
        if (backdrop) backdrop.classList.remove('hidden');
        if (mapContainer) mapContainer.classList.add('pointer-events-none');
        
        const btnMostraRisultatiMappa = document.getElementById('btnMostraRisultatiMappa');
        if(btnMostraRisultatiMappa) btnMostraRisultatiMappa.style.display = 'none';
        const btnResetMappa = document.getElementById('btnResetMappa');
        if(btnResetMappa) btnResetMappa.style.display = 'none';

    } else { // 'mappa'
        if (leftSidebar) leftSidebar.classList.add('hidden');
        if (rightPanel) {
            rightPanel.classList.add('hidden');
            rightPanel.style.transform = '';
        }
        if (btnMappa) {
            btnMappa.classList.remove('text-apple-muted');
            btnMappa.classList.add('text-apple-blue');
        }
        if (backdrop) backdrop.classList.add('hidden');
        if (mapContainer) mapContainer.classList.remove('pointer-events-none');
        
        const btnMostraRisultatiMappa = document.getElementById('btnMostraRisultatiMappa');
        if(btnMostraRisultatiMappa) btnMostraRisultatiMappa.style.display = '';
        const btnResetMappa = document.getElementById('btnResetMappa');
        if(btnResetMappa) btnResetMappa.style.display = '';

        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }
}

function aggiornaBadgeMobile(conteggio) {
    const badge = document.getElementById('mobileBadgeRisultati');
    if (!badge) return;

    if (conteggio > 0) {
        badge.textContent = conteggio > 99 ? '99+' : conteggio;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// 📱 GESTURE DRAG-DOWN SULLA MANIGLIA DEL BOTTOM SHEET
function inizializzaBottomSheetTouch() {
    const handle = document.getElementById('bottomSheetHandle');
    const panel = document.getElementById('rightPanel');
    if (!handle || !panel) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    handle.addEventListener('touchstart', (e) => {
        if (window.innerWidth >= 768) return;
        startY = e.touches[0].clientY;
        isDragging = true;
        panel.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
        if (!isDragging || window.innerWidth >= 768) return;
        currentY = e.touches[0].clientY - startY;
        if (currentY > 0) {
            panel.style.transform = `translateY(${currentY}px)`;
        }
    }, { passive: true });

    handle.addEventListener('touchend', () => {
        if (!isDragging || window.innerWidth >= 768) return;
        isDragging = false;
        panel.style.transition = 'transform 0.3s ease-out';
        
        if (currentY > 100) {
            panel.style.transform = '';
            mostraVistaMobile('mappa');
        } else {
            panel.style.transform = 'translateY(0)';
        }
        currentY = 0;
    });
}

// ----------------------------------------------------------------------
// 🚀 MODULI SEO DEDICATI
// ----------------------------------------------------------------------

function applicaFiltriDaURL() {
    const params = new URLSearchParams(window.location.search);
    const reg = params.get('regione');
    const prov = params.get('provincia');
    const cdc = params.get('cdc');

    if (reg && selectRegione) {
        selectRegione.value = reg;
        selezionaRegioneDaMenu(reg);
    }
    if (prov && selectProvincia) {
        selectProvincia.disabled = false;
        selectProvincia.innerHTML = `<option value="${escapeHTML(prov)}" selected>${escapeHTML(prov)}</option>`;
    }
    if (cdc && selectCdc) selectCdc.value = cdc;

    if (reg || prov || cdc) {
        // All'avvio via Deep Link o Search Engine, mostriamo esplicitamente i risultati!
        applicaFiltri(true);
    }
}

function aggiornaMetaTagsSEO(reg, prov, cdc) {
    let titolo = "Interpello Nazionale - La mappa delle supplenze";
    let desc = "Trova la tua prossima cattedra con Interpello Nazionale. Mappa interattiva e aggiornata in tempo reale con tutti gli interpelli scolastici d'Italia.";

    if (reg || prov || cdc) {
        let parti = [];
        if (cdc) parti.push(`Classe di Concorso ${cdc}`);
        if (prov && prov !== "TUTTE") parti.push(`Provincia di ${prov}`);
        else if (reg) parti.push(`Regione ${reg}`);

        titolo = `Interpelli ${parti.join(' - ')} | Interpello Nazionale`;
        desc = `Tutti gli interpelli scolastici attivi per ${parti.join(', ')}. Consulta gli avvisi di reclutamento docenti e candidati subito su Interpello Nazionale.`;
    }

    document.title = titolo;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
    
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', titolo);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);
}

function generaSchemaJobPosting(item) {
    let datePosted = item.data_rilevamento ? item.data_rilevamento.split('T')[0] : new Date().toISOString().split('T')[0];
    let validThrough = item.data && item.data !== "" ? `${item.data}T23:59:59` : undefined;
    
    let cdcText = item.cdc && item.cdc.length > 0 ? item.cdc.join(', ') : 'Tutte le classi';
    let titoloPulito = item.titolo.replace('[CHIUSO]', '').trim();

    let schema = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": `Interpello Docente ${cdcText} - ${titoloPulito}`,
        "description": `Avviso di reclutamento docente (Interpello Nazionale) per ${titoloPulito} in provincia di ${item.provincia || 'Italia'} (${item.regione || ''}). Classe di concorso: ${cdcText}.`,
        "identifier": {
            "@type": "PropertyValue",
            "name": "Interpello Nazionale",
            "value": item.url
        },
        "datePosted": datePosted,
        "employmentType": "OTHER",
        "hiringOrganization": {
            "@type": "Organization",
            "name": titoloPulito,
            "sameAs": item.url
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": item.provincia || "Italia",
                "addressRegion": item.regione || "Italia",
                "addressCountry": "IT"
            }
        }
    };

    if (validThrough) {
        schema["validThrough"] = validThrough;
    }

    return schema;
}

function aggiornaDatiStrutturatiSchema(lista) {
    let scriptExist = document.getElementById('schema-jobs');
    if (scriptExist) scriptExist.remove();

    if (!lista || lista.length === 0) return;

    const daIndicizzare = lista.slice(0, 20).filter(i => !isScaduto(i));
    if (daIndicizzare.length === 0) return;

    const schemas = daIndicizzare.map(generaSchemaJobPosting);

    const script = document.createElement('script');
    script.id = 'schema-jobs';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schemas, null, 2);
    document.head.appendChild(script);
}
