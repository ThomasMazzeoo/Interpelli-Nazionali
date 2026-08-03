import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import estrai_cdc

# URL temporaneo per i test (da aggiornare a 2026-2027)
URL_BASE = "https://www.istruzionelaspezia.gov.it/pagine/interpelli-la-spezia---as-2024-2025"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print(f"📡 [LIGURIA] Connessione a La Spezia...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        tabella = soup.find('table')
        if not tabella: return []

        righe = tabella.find_all('tr')
        if len(righe) < 2: return []
        
        # 1. AUTO-MAPPATURA DELLE COLONNE
        idx_cdc = 0
        idx_scuola = 3
        idx_dal = 4
        idx_al = 5
        idx_ore = 7
        idx_scad = 8
        idx_link = 9
        
        start_row = 1
        for i, riga in enumerate(righe):
            text = riga.get_text(strip=True).lower()
            if 'cdc' in text and 'denominazione' in text:
                intestazioni = [th.get_text(strip=True).lower() for th in riga.find_all(['th', 'td'])]
                
                for j, s in enumerate(intestazioni):
                    s_clean = s.replace('\xa0', ' ').strip()
                    if s_clean == 'cdc': idx_cdc = j
                    elif 'denominazione' in s_clean: idx_scuola = j
                    # Usiamo startswith per catturare "dal" o "dal giorno"
                    elif s_clean.startswith('dal'): idx_dal = j
                    elif s_clean.startswith('al ') or s_clean == 'al': idx_al = j
                    elif 'ore' in s_clean or 'intera' in s_clean or 'spezzone' in s_clean: idx_ore = j
                    elif 'termine' in s_clean or 'scadenza' in s_clean or 'domanda' in s_clean: idx_scad = j
                    elif 'link' in s_clean: idx_link = j
                        
                start_row = i + 1
                break

        # 2. ESTRAZIONE DINAMICA E ANTIFRAGILE
        for riga in righe[start_row:]:
            cols = riga.find_all(['td', 'th'])
            
            if len(cols) <= max(idx_cdc, idx_scuola, idx_link): continue 
            
            cdc_raw = cols[idx_cdc].get_text(strip=True)
            if not cdc_raw or 'CDC' in cdc_raw.upper() or 'ART.' in cdc_raw.upper(): continue
                
            nome_scuola = cols[idx_scuola].get_text(separator=' ', strip=True)
            nome_scuola = re.sub(r'\s+', ' ', nome_scuola)
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper() or 'A.S.' in nome_scuola.upper(): continue

            dal_raw = cols[idx_dal].get_text(strip=True).replace('/', '-').replace('.', '-') if len(cols) > idx_dal else ""
            al_raw = cols[idx_al].get_text(strip=True).replace('/', '-').replace('.', '-') if len(cols) > idx_al else ""
            dettaglio_ore = cols[idx_ore].get_text(strip=True).replace('\n', ' ') if len(cols) > idx_ore else ""

            cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
            ore_per_link = dettaglio_ore.replace(' ', '_')
            id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
            
            testo_scadenza = cols[idx_scad].get_text(strip=True).lower() if len(cols) > idx_scad else ""
            link_col = cols[idx_link] if len(cols) > idx_link else cols[-1]
            
            link_tag = link_col.find('a', href=True)
            testo_link = link_col.get_text(strip=True)
            
            data_pulita = ""
            
            match_alpha = re.search(r'(\d{1,2})[\s\-\/\.]+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*[\s\-\/\.]+(\d{4}|\d{2})', testo_scadenza)
            match_num = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})', testo_scadenza)
            
            if match_alpha:
                mesi_map = {'gen':'01', 'feb':'02', 'mar':'03', 'apr':'04', 'mag':'05', 'giu':'06', 'lug':'07', 'ago':'08', 'set':'09', 'ott':'10', 'nov':'11', 'dic':'12'}
                giorno = match_alpha.group(1).zfill(2)
                mese = mesi_map[match_alpha.group(2)]
                anno = match_alpha.group(3)
                if len(anno) == 2: anno = "20" + anno
                data_pulita = f"{anno}-{mese}-{giorno}"
            elif match_num:
                giorno = match_num.group(1).zfill(2)
                mese = match_num.group(2).zfill(2)
                anno = match_num.group(3)
                if len(anno) == 2: anno = "20" + anno
                data_pulita = f"{anno}-{mese}-{giorno}"

            if link_tag:
                url_avviso = link_tag['href']
                if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                    url_avviso = "https://www.istruzionelaspezia.gov.it" + url_avviso
                url_avviso += f"#{id_univoco}" 
            elif '@' in testo_link:
                url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw}"
            elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                url_avviso = (testo_link if testo_link.startswith('http') else 'https://' + testo_link) + f"#{id_univoco}"
            else:
                url_avviso = f"{URL_BASE}#no-link-{id_univoco}"
            
            if url_avviso in url_visti: continue
            
            cdc_pulite = estrai_cdc(cdc_raw) 
            
            nuovi_interpelli.append({
                "regione": "Liguria", "provincia": "La Spezia", "titolo": nome_scuola,
                "data": data_pulita, "cdc": cdc_pulite, "url": url_avviso,
                "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                "form_links": [], "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            
    except Exception as e: print(f"  ❌ Errore critico su La Spezia: {e}")
    return nuovi_interpelli
