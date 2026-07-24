import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc, esplora_dettaglio

FONTI = {
    "Milano": "https://www.mim.gov.it/web/milano/interpelli-ricerca-supplenti",
    "Brescia": "https://www.mim.gov.it/web/brescia/interpelli-ricerca-supplenti",
    "Bergamo": "https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti",
    "Varese": "https://www.mim.gov.it/web/varese/interpelli-ricerca-supplenti",
    "Monza Brianza": "https://www.mim.gov.it/web/monza-brianza/interpelli-ricerca-supplenti",
    "Como": "https://www.mim.gov.it/web/como/interpelli-ricerca-supplenti",
    "Cremona": "https://www.mim.gov.it/web/cremona/interpelli-ricerca-supplenti",
    "Lecco": "https://www.mim.gov.it/web/lecco/interpelli-ricerca-supplenti",
    "Lodi": "https://www.mim.gov.it/web/lodi/interpelli-ricerca-supplenti",
    "Mantova": "https://www.mim.gov.it/web/mantova/interpelli-ricerca-supplenti",
    "Pavia": "https://www.mim.gov.it/web/pavia/interpelli-ricerca-supplenti",
    "Sondrio": "https://www.mim.gov.it/web/sondrio/interpelli-ricerca-supplenti"
}

PAROLE_ESCLUSE = ['decreto', 'gps', 'graduatorie', 'esaurimento', 'mobilità', 'utilizzazione', 'assegnazione', 'dsga', 'ata', 'proroghe', 'commissione', 'scorrimenti']

def run(url_visti):
    """
    Ritorna una lista di dizionari con i nuovi interpelli trovati in Lombardia.
    Riceve il set 'url_visti' dal main per evitare duplicati senza interrogare il DB.
    """
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for provincia, url_base in FONTI.items():
        print(f"📡 [LOMBARDIA] Connessione a {provincia}...")
        
        try:
            risposta = requests.get(url_base, headers=headers, timeout=15)
            if risposta.status_code != 200:
                print(f"  ⚠️ HTTP {risposta.status_code} su {provincia}")
                continue
                
            soup = BeautifulSoup(risposta.text, 'html.parser')
            articoli = soup.find_all('div', class_='article_wrapper')[:50]
            
            for art in articoli:
                h3 = art.find('h3')
                if not h3 or not h3.find('a'): continue
                    
                a_tag = h3.find('a')
                titolo = a_tag.get_text(strip=True)
                testo_intero_card = art.get_text()
                
                url_avviso = "https://www.mim.gov.it" + a_tag['href'] if a_tag['href'].startswith('/') else a_tag['href']
                
                if any(esclusa in testo_intero_card.lower() for esclusa in PAROLE_ESCLUSE): continue
                if url_avviso in url_visti: continue
                    
                data_tag = art.find('div', class_='article_data_tags')
                data_pulita = converti_data_italiana(data_tag.get_text(strip=True) if data_tag else "")
                
                cdc_da_card = estrai_cdc(testo_intero_card)
                dettagli = esplora_dettaglio(url_avviso)
                cdc_totali = list(set(cdc_da_card + dettagli["cdc_extra"]))
                
                titolo_finale = titolo
                if cdc_totali and not any(c in titolo for c in cdc_totali):
                    titolo_finale = f"{titolo} - [CDC: {', '.join(cdc_totali)}]"
                
                print(f"    🎯 Trovato: {titolo_finale}")
                
                nuovi_interpelli.append({
                    "regione": "Lombardia", "provincia": provincia, "titolo": titolo_finale,
                    "data": data_pulita, "cdc": cdc_totali, "url": url_avviso,
                    "pdf_links": dettagli["pdf_links"], "form_links": dettagli["form_links"],
                    "data_rilevamento": datetime.now().isoformat()
                })
                
                url_visti.add(url_avviso) # Aggiungo l'URL per i giri successivi
                time.sleep(0.5)
                
        except Exception as e:
            print(f"  ❌ Errore critico su {provincia}: {e}")
            
    return nuovi_interpelli
