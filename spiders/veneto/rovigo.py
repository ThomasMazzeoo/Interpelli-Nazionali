import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc, esplora_dettaglio

URL_BASE = "https://rovigo.istruzioneveneto.gov.it/category/5-interpelli/docenti-rovigo/"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print("📡 [VENETO] Connessione a Rovigo...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: 
            return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        
        # Cerca i blocchi degli articoli (WordPress usa <article> o div simili)
        articoli = soup.find_all('article')
        if not articoli:
            articoli = soup.find_all('div', class_=lambda c: c and ('post' in c.lower() or 'entry' in c.lower()))

        # Ne prendiamo massimo 20 per non sovraccaricare il server del Ministero
        for art in articoli[:20]:
            
            # Troviamo il link (di solito è nell'h2 o nell'h3 del titolo)
            titolo_tag = art.find(['h2', 'h3'])
            if not titolo_tag: continue
                
            link_tag = titolo_tag.find('a')
            if not link_tag: continue
                
            titolo_raw = link_tag.get_text(strip=True)
            url_avviso = link_tag['href']
            
            # Anti-Duplicati e Anti-Burocrazia
            if url_avviso in url_visti: 
                continue
            if any(x in titolo_raw.lower() for x in ['decreto', 'graduatorie', 'gps', 'ata', 'mobilità', 'assunzioni']): 
                continue

            # Passiamo l'intero testo del blocco alla nostra IA che scoverà la data!
            testo_intero = art.get_text(separator=' ')
            data_pulita = converti_data_italiana(testo_intero)
            
            # IL MAGICO ESPLORATORE: entra nella pagina e "legge" i file allegati!
            dettagli = esplora_dettaglio(url_avviso)
            
            # Uniamo le CDC trovate nel titolo con quelle scovate nel testo della pagina e nei PDF
            cdc_totali = list(set(estrai_cdc(titolo_raw) + dettagli["cdc_extra"]))

            print(f"    🎯 Trovato: {titolo_raw} (Data: {data_pulita})")
            
            nuovi_interpelli.append({
                "regione": "Veneto", 
                "provincia": "Rovigo", 
                "titolo": titolo_raw,
                "data": data_pulita, 
                "cdc": cdc_totali, 
                "url": url_avviso,
                "pdf_links": dettagli["pdf_links"], 
                "form_links": dettagli["form_links"],
                "data_rilevamento": datetime.now().isoformat()
            })
            
            url_visti.add(url_avviso)
            time.sleep(0.5) # Pausa gentile tra un caricamento e l'altro
            
    except Exception as e:
        print(f"  ❌ Errore critico su Rovigo: {e}")
        
    return nuovi_interpelli
