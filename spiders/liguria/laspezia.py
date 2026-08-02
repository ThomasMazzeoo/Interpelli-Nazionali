import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

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

        for riga in tabella.find_all('tr'):
            cols = riga.find_all(['td', 'th'])
            if len(cols) < 10: continue 
            
            cdc_raw = cols[0].get_text(strip=True)
            nome_scuola = cols[3].get_text(strip=True)
            
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper() or 'A.S.' in nome_scuola.upper() or 'CDC' in cdc_raw.upper():
                continue

            codice_mecc = cols[2].get_text(strip=True)
            dal_raw = cols[4].get_text(strip=True).replace('/', '-').replace('.', '-')
            al_raw = cols[5].get_text(strip=True).replace('/', '-').replace('.', '-')
            dettaglio_ore = cols[7].get_text(strip=True).replace('\n', ' ')
            
            data_raw = cols[8].get_text(strip=True) # La Spezia ha la data in colonna 9 (indice 8)
            testo_link = cols[9].get_text(strip=True) # La Spezia ha il link in colonna 10 (indice 9)
            link_tag = cols[9].find('a', href=True)
            
            cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
            ore_per_link = dettaglio_ore.replace(' ', '_')
            id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
            
            if link_tag:
                url_avviso = link_tag['href']
                if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                    url_avviso = "https://www.istruzionelaspezia.gov.it" + url_avviso
                url_avviso += f"#{id_univoco}" 
            elif '@' in testo_link:
                url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw} ({dettaglio_ore})"
            elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                url_avviso = (testo_link if testo_link.startswith('http') else 'https://' + testo_link) + f"#{id_univoco}"
            else:
                url_avviso = f"{URL_BASE}#no-link-{codice_mecc}-{id_univoco}"
            
            if url_avviso in url_visti: continue
            
            # Estrazione sicura della data (ignora il testo "ore 10:00" ecc.)
            match_dt = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', data_raw)
            if match_dt:
                data_pulita = f"{match_dt.group(3)}-{match_dt.group(2).zfill(2)}-{match_dt.group(1).zfill(2)}"
            else:
                # Se la scadenza è vuota, prova a prendere la data di Inizio Contratto (Dal)
                match_dal = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', dal_raw)
                if match_dal:
                    data_pulita = f"{match_dal.group(3)}-{match_dal.group(2).zfill(2)}-{match_dal.group(1).zfill(2)}"
                else:
                    data_pulita = datetime.today().strftime('%Y-%m-%d')
                
            cdc_pulite = estrai_cdc(cdc_raw) 
            if not cdc_pulite and cdc_raw:
                cdc_pulite = [cdc_raw.upper()] if len(cdc_raw) <= 20 else ["PRIMARIA/INFANZIA" if "INFANZIA" in cdc_raw.upper() or "PRIMARIA" in cdc_raw.upper() else "ALTRO"]
            
            print(f"    🎯 Trovato: {nome_scuola} (Data estratta: {data_pulita})")
            
            nuovi_interpelli.append({
                "regione": "Liguria", "provincia": "La Spezia", "titolo": nome_scuola,
                "data": data_pulita, "cdc": cdc_pulite, "url": url_avviso,
                "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                "form_links": [], "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            
    except Exception as e: print(f"  ❌ Errore critico su La Spezia: {e}")
    return nuovi_interpelli
