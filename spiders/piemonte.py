import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

# TUTTO IL PIEMONTE COMPLETATO! 🎯
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

            # PRENDE SOLO LE PRIME 400 RIGHE (salta la prima riga di intestazione)
            righe = tabella.find_all('tr')[1:401] 
            
            for riga in righe:
                cols = riga.find_all('td')
                
                # Il controllo < 9 ci garantisce di prendere i dati giusti in tutte le tabelle del Piemonte
                if len(cols) < 9: 
                    continue 
                
                # Leggiamo lo stato (aperto/chiuso)
                stato = cols[8].get_text(strip=True).lower()
                is_chiuso = 'chiuso' in stato
                
                nome_scuola = cols[1].get_text(strip=True)
                cdc_raw = cols[2].get_text(strip=True)
                data_raw = cols[6].get_text(strip=True)
                
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
                
                # COSTRUZIONE DEL TITOLO VISUALE
                titolo_finale = nome_scuola
                if is_chiuso:
                    titolo_finale = f"[CHIUSO] {titolo_finale}" 
                    
                if cdc_pulite:
                    titolo_finale += f" - [CDC: {', '.join(cdc_pulite)}]"

                print(f"    🎯 Trovato: {titolo_finale} ({provincia})")
                
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
