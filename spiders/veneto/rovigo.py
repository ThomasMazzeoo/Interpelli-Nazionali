import time
import requests
import re
import io
from bs4 import BeautifulSoup
from datetime import datetime
from PyPDF2 import PdfReader
from utils.helpers import converti_data_italiana, estrai_cdc, esplora_dettaglio

URL_BASE = "https://rovigo.istruzioneveneto.gov.it/category/5-interpelli/docenti-rovigo/"

def estrai_data_scadenza_mirata(testo):
    """
    Cerca una data SOLO se è vicina a parole chiave DI SCADENZA ESATTE.
    Integra logica temporale per evitare gli anni '90 (es. D.M. del '97 diventerà 1997 e scartato)
    """
    testo = testo.lower().replace('\n', ' ')
    
    # Radar chirurgico: evita frasi come "entro l'anno" e punta solo alle vere scadenze
    pattern_keyword = r'(?:scadenza|scade\s*il|entro\s*(?:il|le|le\s*ore\s*\d{1,2}[:\.]\d{2}\s*del)|termine\s*presentazione).{0,25}?(\d{1,2}[\s\-\/\.]+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*[\s\-\/\.]+(?:\d{4}|\d{2})|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](?:\d{4}|\d{2}))'
    
    match = re.search(pattern_keyword, testo)
    if match:
        data_str = match.group(1)
        match_alpha = re.search(r'(\d{1,2})[\s\-\/\.]+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*[\s\-\/\.]+(\d{4}|\d{2})', data_str)
        match_num = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})', data_str)
        
        if match_alpha:
            mesi_map = {'gen':'01', 'feb':'02', 'mar':'03', 'apr':'04', 'mag':'05', 'giu':'06', 'lug':'07', 'ago':'08', 'set':'09', 'ott':'10', 'nov':'11', 'dic':'12'}
            giorno = match_alpha.group(1).zfill(2)
            mese = mesi_map[match_alpha.group(2)]
            anno = match_alpha.group(3)
            # Logica Anti-2097!
            if len(anno) == 2: 
                anno = f"19{anno}" if int(anno) > 50 else f"20{anno}"
            return f"{anno}-{mese}-{giorno}"
            
        elif match_num:
            giorno = match_num.group(1).zfill(2)
            mese = match_num.group(2).zfill(2)
            anno = match_num.group(3)
            # Logica Anti-2097!
            if len(anno) == 2: 
                anno = f"19{anno}" if int(anno) > 50 else f"20{anno}"
            return f"{anno}-{mese}-{giorno}"
            
    return ""

def esplora_pdf_per_scadenza(pdf_url):
    """Scarica il PDF in RAM e legge le prime due pagine per trovare la scadenza."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(pdf_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            # Legge il PDF direttamente in memoria, senza salvarlo su disco
            reader = PdfReader(io.BytesIO(resp.content))
            testo_pdf = " ".join(page.extract_text() for i, page in enumerate(reader.pages) if i < 2 and page.extract_text())
            return estrai_data_scadenza_mirata(testo_pdf)
    except:
        pass
    return ""

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print("📡 [VENETO] Connessione a Rovigo...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: 
            return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        
        articoli = soup.find_all('article')
        if not articoli:
            articoli = soup.find_all('div', class_=lambda c: c and ('post' in c.lower() or 'entry' in c.lower()))

        # Prendiamo gli ultimi 15 post
        for art in articoli[:15]:
            
            titolo_tag = art.find(['h2', 'h3', 'h4'])
            if not titolo_tag: continue
                
            link_tag = titolo_tag.find('a')
            if not link_tag: continue
                
            titolo_raw = link_tag.get_text(strip=True)
            url_avviso = link_tag['href']
            
            if url_avviso in url_visti: 
                continue
            if any(x in titolo_raw.lower() for x in ['decreto', 'graduatorie', 'gps', 'ata', 'mobilità', 'assunzioni']): 
                continue

            # Usiamo l'Esploratore per trovare allegati PDF e scovare CDC nascoste
            dettagli = esplora_dettaglio(url_avviso)
            cdc_totali = list(set(estrai_cdc(titolo_raw) + dettagli["cdc_extra"]))
            
            data_pulita = ""
            
            # FASE 1: Cerca la scadenza direttamente nel testo della pagina web
            try:
                resp_dettaglio = requests.get(url_avviso, headers=headers, timeout=10)
                soup_dettaglio = BeautifulSoup(resp_dettaglio.text, 'html.parser')
                testo_pagina = soup_dettaglio.get_text(separator=' ')
                data_pulita = estrai_data_scadenza_mirata(testo_pagina)
            except:
                pass
            
            # FASE 2: Se la pagina web non dice nulla (come spesso accade), l'IA entra nel PDF!
            if not data_pulita and dettagli["pdf_links"]:
                for pdf_url in dettagli["pdf_links"]:
                    data_pdf = esplora_pdf_per_scadenza(pdf_url)
                    if data_pdf:
                        data_pulita = data_pdf
                        break # Appena trova la data, ferma la ricerca nei PDF

            # NOTA: Se 'data_pulita' è rimasta vuota (""), l'interpello verrà scartato da main.py in sicurezza!
            
            print(f"    🎯 Analizzato: {titolo_raw[:50]}... -> Scadenza: {data_pulita if data_pulita else 'NESSUNA (SCARTATO)'}")
            
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
            time.sleep(0.5) 
            
    except Exception as e:
        print(f"  ❌ Errore critico su Rovigo: {e}")
        
    return nuovi_interpelli
