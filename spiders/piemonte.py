import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

FONTI = {
    "Torino": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php",
    "Alessandria": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_al.php",
    "Asti": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_at.php",
    "Biella": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_bi.php",
    "Cuneo": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_cn.php",
    "Novara": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_no.php",
    "Vercelli": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vc.php",
    "Verbano-Cusio-Ossola": "https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vb.php"
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
            
            tabella = soup.find('table')
            if not tabella:
                continue

            righe = tabella.find_all('tr')[1:401] 
            
            for riga in righe:
                cols = riga.find_all('td')
                
                if len(cols) < 9: 
                    continue 
                
                stato = cols[8].get_text(strip=True).lower()
                is_chiuso = 'chiuso' in stato or 'cancellato' in stato
                
                nome_scuola = cols[1].get_text(strip=True)
                cdc_raw = cols[2].get_text(strip=True)
                
                # --- NOVITÀ: Cerca la vera data di Scadenza! ---
                data_raw = cols[6].get_text(strip=True) # Fallback: Data Interpello
                if len(cols) > 9:
                    scadenza_text = cols[9].get_text(strip=True)
                    if scadenza_text and "senza" not in scadenza_text.lower() and "-" not in scadenza_text:
                        data_raw = scadenza_text
                
                link_tag = cols[7].find('a', href=True)
                
                if link_tag:
                    url_avviso = link_tag['href']
                    if not url_avviso.startswith('http'):
                        url_avviso = "https://servizi.istruzionepiemonte.it/interpello2025/" + url_avviso
                else:
                    codice_mecc = cols[0].get_text(strip=True)
                    url_avviso = f"{url_base}#no-link-{codice_mecc}"
                
                if url_avviso in url_visti:
                    continue
                
                data_pulita = converti_data_italiana(data_raw)
                cdc_pulite = estrai_cdc(cdc_raw) 
                
                titolo_finale = nome_scuola
                if is_chiuso:
                    titolo_finale = f"[CHIUSO] {titolo_finale}" 
                    
                print(f"    🎯 Trovato: {titolo_finale} ({provincia}) - Scadenza: {data_pulita}")
                
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
                
            time.sleep(0.5)
                
        except Exception as e:
            print(f"  ❌ Errore critico su {provincia}: {e}")
            
    return nuovi_interpelli
