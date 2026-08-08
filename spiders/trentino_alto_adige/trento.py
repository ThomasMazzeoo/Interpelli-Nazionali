import hashlib
import requests
from bs4 import BeautifulSoup
from utils.helpers import estrai_cdc
from datetime import datetime

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Trento (Vivoscuola - Quadri di disponibilità)...")

    # URL XHR estratto direttamente dal codice JS della pagina
    url = "https://www.vivoscuola.it/facetsearch/datatable_search/quadro_disponibilita/classe_concorso|tipo_posto|scuola|numero_ore_incarico|tipo_incarico|data_inizio_incarico|data_fine_incarico/scuola|classe_concorso|tipo_istituzione|tipo_incarico|tipo_posto|numero_ore_incarico|miurcode/29192//false"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.vivoscuola.it/Lavora-con-noi/Quadri-di-disponibilita"
    }
    
    params = {
        "draw": "1",
        "start": "0",
        "length": "100"
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        
        if resp.status_code != 200:
            print(f"    ⚠️ Errore API Trento, status code: {resp.status_code}")
            return risultati
            
        data_json = resp.json()
        righe = data_json.get("data", [])
        
        # Limita alle ultime 20 richieste come indicato
        righe = righe[:20]
        
        oggi_iso = datetime.now().isoformat()
        
        for item in righe:
            if len(item) < 7:
                continue
                
            # item[0]: CDC e link modal
            col_cdc_html = item[0]
            soup_cdc = BeautifulSoup(col_cdc_html, "html.parser")
            a_tag_cdc = soup_cdc.find("a")
            testo_cdc = a_tag_cdc.get_text(strip=True) if a_tag_cdc else BeautifulSoup(col_cdc_html, "html.parser").get_text(strip=True)
            
            cdc = estrai_cdc(testo_cdc)
            
            # item[1]: Tipo posto
            tipo_posto = item[1].strip()
            
            # item[2]: Scuola
            col_scuola_html = item[2]
            soup_scuola = BeautifulSoup(col_scuola_html, "html.parser")
            a_tag_scuola = soup_scuola.find("a")
            testo_scuola = a_tag_scuola.get_text(strip=True) if a_tag_scuola else BeautifulSoup(col_scuola_html, "html.parser").get_text(strip=True)
            
            # item[3]: Ore
            ore = item[3].strip()
            
            # item[4]: Tipo incarico
            tipo_incarico = item[4].strip()
            
            # item[5]: Data inizio, item[6]: Data fine (opzionali per il titolo)
            
            titolo = f"{tipo_posto} - {testo_scuola} ({ore} ore, Incarico {tipo_incarico})"
            
            # Creiamo un hash univoco per l'URL, in modo che l'Orchestratore non lo processi ogni volta
            hash_id = hashlib.md5(f"{testo_cdc}_{titolo}".encode('utf-8')).hexdigest()[:10]
            link_ufficiale = "https://www.vivoscuola.it/Lavora-con-noi/Quadri-di-disponibilita"
            url_univoco = f"{link_ufficiale}#{hash_id}"
            
            if url_univoco in url_visti:
                continue
                
            risultato = {
                "regione": "Trentino-Alto Adige",
                "provincia": "Trento",
                "titolo": titolo,
                "data": "", # nessuna data di scadenza da esporre, è un Quadro disponibilità
                "permanente": True,
                "escludi_scoreboard": True, # come richiesto dall'utente per le bacheche
                "cdc": cdc,
                "url": url_univoco,
                "pdf_links": [],
                "form_links": [],
                "data_rilevamento": oggi_iso
            }
            risultati.append(risultato)
            
    except Exception as e:
        print(f"    ⚠️ Errore durante lo scraping di Trento: {e}")
        
    return risultati

if __name__ == "__main__":
    # Test locale
    res = run(set())
    for r in res:
        print(r)
