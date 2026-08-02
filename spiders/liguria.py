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

            # Analizziamo tutte le righe senza limitazioni, ci pensa il codice a scartare l'intestazione
            righe = tabella.find_all('tr') 
            
            for riga in righe:
                cols = riga.find_all(['td', 'th'])
                
                # La tabella di Genova ha 11 colonne
                if len(cols) < 11: 
                    continue 
                
                cdc_raw = cols[0].get_text(strip=True)
                
                # SALTA L'INTESTAZIONE IN AUTOMATICO (se la colonna 0 si chiama CDC)
                if cdc_raw.upper() == 'CDC' or 'CLASSE DI CONCORSO' in cdc_raw.upper():
                    continue

                codice_mecc = cols[2].get_text(strip=True)
                nome_scuola = cols[3].get_text(strip=True)
                data_raw = cols[9].get_text(strip=True)
                
                link_tag = cols[10].find('a', href=True)
                testo_link = cols[10].get_text(strip=True)
                
                # TRUCCO ANTI-DUPLICATO: Rendiamo il link univoco per ogni CDC!
                # Rimuoviamo spazi e slash per non rompere l'URL
                cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
                
                if link_tag:
                    url_avviso = link_tag['href']
                    if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                        url_avviso = "https://www.istruzionegenova.gov.it" + url_avviso
                    url_avviso += f"#{cdc_per_link}" # Rende unico il link del PDF
                elif '@' in testo_link:
                    # Crea un link mailto che apre l'email già precompilata con l'oggetto!
                    url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw}"
                elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                    base_link = testo_link if testo_link.startswith('http') else 'https://' + testo_link
                    url_avviso = f"{base_link}#{cdc_per_link}"
                else:
                    url_avviso = f"{url_base}#no-link-{codice_mecc}-{cdc_per_link}"
                
                # Ora il controllo anti-duplicato scatterà solo per avvisi davvero identici!
                if url_avviso in url_visti:
                    continue
                
                # ESTRAZIONE DATA PRECISA per il formato DD/MM/YYYY o DD-MM-YYYY
                match_dt = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', data_raw)
                if match_dt:
                    data_pulita = f"{match_dt.group(3)}-{match_dt.group(2).zfill(2)}-{match_dt.group(1).zfill(2)}"
                else:
                    data_pulita = converti_data_italiana(data_raw)
                    
                cdc_pulite = estrai_cdc(cdc_raw) 
                
                # Costruzione Titolo
                titolo_finale = nome_scuola
                if cdc_pulite:
                    titolo_finale += f" - [CDC: {', '.join(cdc_pulite)}]"
                elif cdc_raw:
                    # Se non è una CDC standard (es. "Scuola d'Infanzia"), mettiamo la descrizione originale
                    titolo_finale += f" - [{cdc_raw}]"

                print(f"    🎯 Trovato: {titolo_finale}")
                
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
