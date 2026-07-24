import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

# STRUTTURA A DIZIONARIO (Stile Lombardia)
# Pronta per essere espansa appena scopriamo i link delle altre province!
FONTI = {
    "Torino": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php"
    # "Alessandria": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_al.php", # (Esempio futuro)
}

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for provincia, url_base in FONTI.items():
        print(f"📡 [PIEMONTE] Connessione a {provincia}...")
        
        try:
            risposta = requests.get(url_base, headers=headers, timeout=15)
            if risposta.status_code != 200:
                print(f"  ⚠️ HTTP {risposta.status_code} su {provincia}")
                continue
                
            soup = BeautifulSoup(risposta.text, 'html.parser')
            
            # Trova la tabella principale
            tabella = soup.find('table')
            if not tabella:
                continue

            # Salta la prima riga di intestazione [1:]
            righe = tabella.find_all('tr')[1:]
            
            for riga in righe:
                cols = riga.find_all('td')
                # Assicuriamoci che la riga abbia tutte e 9 le colonne dello screenshot
                if len(cols) < 9: 
                    continue 
                
                # CONTROLLO STATO: Se è chiuso, passiamo oltre!
                stato = cols[8].get_text(strip=True).lower()
                if 'chiuso' in stato:
                    continue
                
                nome_scuola = cols[1].get_text(strip=True)
                cdc_raw = cols[2].get_text(strip=True)
                data_raw = cols[6].get_text(strip=True)
                
                # Cerca il link nella colonna "Interpello"
                link_tag = cols[7].find('a', href=True)
                
                # Se non c'è un link cliccabile (a volte capita), creiamo un URL virtuale univoco 
                # per non farlo elaborare all'infinito dallo spider
                if link_tag:
                    url_avviso = link_tag['href']
                    if not url_avviso.startswith('http'):
                        url_avviso = "https://servizi.istruzionepiemonte.it/interpello2025/" + url_avviso
                else:
                    codice_mecc = cols[0].get_text(strip=True)
                    url_avviso = f"{url_base}#no-link-{codice_mecc}"
                
                # Controlla se l'abbiamo già salvato nel DB JSON
                if url_avviso in url_visti:
                    continue
                
                # Pulizia Dati tramite il nostro arsenale in utils/helpers.py
                data_pulita = converti_data_italiana(data_raw)
                cdc_pulite = estrai_cdc(cdc_raw) 
                
                titolo_finale = f"{nome_scuola}"
                if cdc_pulite:
                    titolo_finale += f" - [CDC: {', '.join(cdc_pulite)}]"

                print(f"    🎯 Trovato: {titolo_finale}")
                
                nuovi_interpelli.append({
                    "regione": "Piemonte", 
                    "provincia": provincia, 
                    "titolo": titolo_finale,
                    "data": data_pulita, 
                    "cdc": cdc_pulite, 
                    "url": url_avviso,
                    "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                    "form_links": [url_avviso] if 'google' in url_avviso.lower() or 'forms' in url_avviso.lower() else [],
                    "data_rilevamento": datetime.now().isoformat()
                })
                
                url_visti.add(url_avviso)
                
            time.sleep(0.5) # Pausa tra una provincia e l'altra
                
        except Exception as e:
            print(f"  ❌ Errore critico su {provincia}: {e}")
            
    return nuovi_interpelli
