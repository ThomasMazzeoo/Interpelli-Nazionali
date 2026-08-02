import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

# Aggiunta La Spezia al dizionario!
FONTI = {
    "Genova": "https://www.istruzionegenova.gov.it/pagine/interpelli-ge---as-2026-2027",
    "La Spezia": "https://www.istruzionelaspezia.gov.it/pagine/interpelli-la-spezia---as-2024-2025"
}

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for provincia, url_base in FONTI.items():
        print(f"📡 [LIGURIA] Connessione a {provincia}...")
        
        # Estraiamo dinamicamente il dominio (es. https://www.istruzionelaspezia.gov.it)
        dominio_base = "https://" + url_base.split('/')[2]
        
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
                
                # Genova ha 11 colonne, La Spezia ne ha 10. Mettiamo >= 10 così le legge entrambe!
                if len(cols) < 10: 
                    continue 
                
                cdc_raw = cols[0].get_text(strip=True)
                nome_scuola = cols[3].get_text(strip=True)
                
                if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper():
                    continue
                if 'CDC' in cdc_raw.upper() or 'A.S.' in cdc_raw.upper() or 'A.S.' in nome_scuola.upper():
                    continue

                codice_mecc = cols[2].get_text(strip=True)
                dal_raw = cols[4].get_text(strip=True).replace('/', '-').replace('.', '-')
                al_raw = cols[5].get_text(strip=True).replace('/', '-').replace('.', '-')
                dettaglio_ore = cols[7].get_text(strip=True).replace('\n', ' ')
                
                # TRUCCO NINJA: Usiamo indici negativi per gestire tabelle di lunghezze diverse
                data_raw = cols[-2].get_text(strip=True) # Penultima colonna
                link_col = cols[-1] # Ultima colonna
                
                link_tag = link_col.find('a', href=True)
                testo_link = link_col.get_text(strip=True)
                
                cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
                ore_per_link = dettaglio_ore.replace(' ', '_')
                id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
                
                if link_tag:
                    url_avviso = link_tag['href']
                    if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                        # Aggiunge il dominio corretto in automatico
                        url_avviso = dominio_base + url_avviso
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
