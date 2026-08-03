import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import estrai_cdc

URL_BASE = "https://www.istruzionesavona.gov.it/pagine/interpelli-sv---as-2024-2025-2"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print(f"📡 [LIGURIA] Connessione a Savona...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        tabella = soup.find('table')
        if not tabella: return []

        for riga in tabella.find_all('tr')[1:]:
            cols = riga.find_all(['td', 'th'])
            if len(cols) < 9: continue 
            
            cdc_raw = cols[0].get_text(strip=True)
            if 'CDC' in cdc_raw.upper() or 'ART.' in cdc_raw.upper(): continue
                
            nome_scuola = cols[3].get_text(separator=' ', strip=True)
            nome_scuola = re.sub(r'\s+', ' ', nome_scuola)
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper() or 'A.S.' in nome_scuola.upper(): continue

            codice_mecc = cols[2].get_text(strip=True)
            dal_raw = cols[4].get_text(strip=True).replace('/', '-').replace('.', '-')
            al_raw = cols[5].get_text(strip=True).replace('/', '-').replace('.', '-')
            dettaglio_ore = cols[7].get_text(strip=True).replace('\n', ' ')

            # ID DETERMINISTICO
            cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
            ore_per_link = dettaglio_ore.replace(' ', '_')
            id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
            
            testo_scadenza = cols[-2].get_text(strip=True).lower()
            link_col = cols[-1]
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

            # Mietitore per Savona
            try:
                if data_pulita:
                    data_obj = datetime.strptime(data_pulita, '%Y-%m-%d')
                    if (datetime.now() - data_obj).days > 15: continue
            except: pass
            
            if link_tag:
                url_avviso = link_tag['href']
                if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                    url_avviso = "https://www.istruzionesavona.gov.it" + url_avviso
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
                "regione": "Liguria", "provincia": "Savona", "titolo": nome_scuola,
                "data": data_pulita, "cdc": cdc_pulite, "url": url_avviso,
                "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                "form_links": [], "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            
    except Exception as e: print(f"  ❌ Errore critico su Savona: {e}")
    return nuovi_interpelli
