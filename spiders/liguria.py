import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

FONTI = {
    "Genova": "https://www.istruzionegenova.gov.it/pagine/interpelli-ge---as-2026-2027"
}

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for provincia, url_base in FONTI.items():
        print(f"📡 [LIGURIA] Connessione a {provincia}...")
        
        try:
            risposta = requests.get(url_base, headers=headers, timeout=15)
            if risposta.status_code != 200:
                print(f"  ⚠️ HTTP {risposta.status_code} su {provincia}")
                continue
                
            soup = BeautifulSoup(risposta.text, 'html.parser')
            
            tabella = soup.find('table')
            if not tabella:
                print(f"  ⚠️ Nessuna tabella trovata su {provincia}")
                continue

            righe = tabella.find_all('tr') 
            
            for riga in righe:
                cols = riga.find_all(['td', 'th'])
                
                if len(cols) < 11: 
                    continue 
                
                cdc_raw = cols[0].get_text(strip=True)
                nome_scuola = cols[3].get_text(strip=True)
                
                if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper():
                    continue
                if 'CDC' in cdc_raw.upper() or 'A.S.' in cdc_raw.upper() or 'A.S.' in nome_scuola.upper():
                    continue

                codice_mecc = cols[2].get_text(strip=True)
                
                # Preleviamo ORE, DAL e AL per fare un ID assolutamente unico!
                dal_raw = cols[4].get_text(strip=True).replace('/', '-').replace('.', '-')
                al_raw = cols[5].get_text(strip=True).replace('/', '-').replace('.', '-')
                dettaglio_ore = cols[7].get_text(strip=True).replace('\n', ' ')
                
                data_raw = cols[9].get_text(strip=True) # Data Scadenza
                link_tag = cols[10].find('a', href=True)
                testo_link = cols[10].get_text(strip=True)
                
                # Creiamo l'ID Infallibile
                cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
                ore_per_link = dettaglio_ore.replace(' ', '_')
                id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
                
                if link_tag:
                    url_avviso = link_tag['href']
                    if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                        url_avviso = "https://www.istruzionegenova.gov.it" + url_avviso
                    url_avviso += f"#{id_univoco}" 
                elif '@' in testo_link:
                    url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw} ({dettaglio_ore})"
                elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                    base_link = testo_link if testo_link.startswith('http') else 'https://' + testo_link
                    url_avviso = f"{base_link}#{id_univoco}"
                else:
                    url_avviso = f"{url_base}#no-link-{codice_mecc}-{id_univoco}"
                
                if url_avviso in url_visti:
                    continue
                
                # Estrazione data precisa
                match_dt = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', data_raw)
                if match_dt:
                    data_pulita = f"{match_dt.group(3)}-{match_dt.group(2).zfill(2)}-{match_dt.group(1).zfill(2)}"
                else:
                    data_pulita = converti_data_italiana(data_raw)
                    
                cdc_pulite = estrai_cdc(cdc_raw) 
                
                if not cdc_pulite and cdc_raw:
                    if len(cdc_raw) <= 20: 
                        cdc_pulite = [cdc_raw.upper()]
                    else: 
                        cdc_pulite = ["PRIMARIA/INFANZIA" if "INFANZIA" in cdc_raw.upper() or "PRIMARIA" in cdc_raw.upper() else "ALTRO"]
                
                titolo_finale = nome_scuola

                print(f"    🎯 Trovato: {titolo_finale} ({dettaglio_ore})")
                
                nuovi_interpelli.append({
                    "regione": "Liguria", 
                    "provincia": provincia, 
                    "titolo": titolo_finale,
                    "data": data_pulita, 
                    "cdc": cdc_pulite, 
                    "url": url_avviso,
                    "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                    "form_links": [],
                    "data_rilevamento": datetime.now().isoformat()
                })
                
                url_visti.add(url_avviso)
                
            time.sleep(0.5)
                
        except Exception as e:
            print(f"  ❌ Errore critico su {provincia}: {e}")
            
    return nuovi_interpelli
