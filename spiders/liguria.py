import time
import requests
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
            
            # Cerca la prima tabella nella pagina
            tabella = soup.find('table')
            if not tabella:
                print(f"  ⚠️ Nessuna tabella trovata su {provincia}")
                continue

            # Salta la prima riga (titoli delle colonne)
            righe = tabella.find_all('tr')[1:] 
            
            for riga in righe:
                # Usa 'td' e 'th' perché a volte chi fa i siti sbaglia i tag HTML
                cols = riga.find_all(['td', 'th'])
                
                # La tabella di Genova ha 11 colonne
                if len(cols) < 11: 
                    continue 
                
                # Mappatura delle colonne in base al tuo screenshot
                cdc_raw = cols[0].get_text(strip=True)
                codice_mecc = cols[2].get_text(strip=True)
                nome_scuola = cols[3].get_text(strip=True)
                data_raw = cols[9].get_text(strip=True)
                
                # Gestione Avanzata dei Link / Email
                link_tag = cols[10].find('a', href=True)
                testo_link = cols[10].get_text(strip=True)
                
                if link_tag:
                    url_avviso = link_tag['href']
                    # Se il link è un PDF relativo (manca https), lo aggiungiamo
                    if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                        url_avviso = "https://www.istruzionegenova.gov.it" + url_avviso
                elif '@' in testo_link:
                    # Se non c'è un tag <a> ma c'è un'email scritta (es. personale_genova@libero.it)
                    url_avviso = f"mailto:{testo_link}"
                else:
                    # Nessun link e nessuna email: generiamo un link finto per il database
                    url_avviso = f"{url_base}#no-link-{codice_mecc}"
                
                # Anti-Duplicati
                if url_avviso in url_visti:
                    continue
                
                data_pulita = converti_data_italiana(data_raw)
                cdc_pulite = estrai_cdc(cdc_raw) 
                
                # Costruzione Titolo
                titolo_finale = nome_scuola
                if cdc_pulite:
                    titolo_finale += f" - [CDC: {', '.join(cdc_pulite)}]"
                elif cdc_raw:
                    # Se è un testo anomalo tipo "Scuola d'Infanzia", lo aggiungiamo comunque
                    titolo_finale += f" - [{cdc_raw}]"

                print(f"    🎯 Trovato: {titolo_finale} ({provincia})")
                
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
