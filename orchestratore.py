import os
import json
import re
import time
import io
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from PyPDF2 import PdfReader

# ==========================================
# 1. CONFIGURAZIONE NAZIONALE
# ==========================================
DATA_FILE = "database_nazionale.json"

# Dizionario delle fonti attive
FONTI_NAZIONALI = {
    "Lombardia": {
        "Milano": "https://www.mim.gov.it/web/milano/interpelli-ricerca-supplenti",
        "Brescia": "https://www.mim.gov.it/web/brescia/interpelli-ricerca-supplenti",
        "Bergamo": "https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti",
        "Varese": "https://www.mim.gov.it/web/varese/interpelli-ricerca-supplenti"
    }
}

PAROLE_CHIAVE_OBBLIGATORIE = ['interpell'] 
PAROLE_ESCLUSE = ['decreto', 'gps', 'graduatorie', 'esaurimento', 'mobilità', 'utilizzazione', 'assegnazione', 'dsga', 'ata', 'proroghe', 'commissione', 'scorrimenti']

# ==========================================
# 2. FUNZIONI DI UTILITA' & REGEX
# ==========================================
def converti_data_italiana(data_str):
    mesi = {'gennaio': '01', 'febbraio': '02', 'marzo': '03', 'aprile': '04', 'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08', 'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12'}
    try:
        match = re.search(r'(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})', data_str.lower())
        if match:
            return f"{match.group(3)}-{mesi.get(match.group(2), '01')}-{match.group(1).zfill(2)}"
    except:
        pass
    return datetime.today().strftime('%Y-%m-%d')

def estrai_cdc(testo):
    testo_pulito = re.sub(r'\b(fino\s+al|dal|del|il|om|art\.?)\s+\d{1,4}\b', '', testo, flags=re.IGNORECASE)
    trovati_sec = re.findall(r'\b[A-Za-z]{1,2}[\-\s]*\d{2,3}\b', testo_pulito)
    trovati_prim = re.findall(r'\b(AAAA|EEEE|AAHN|EEHN|AAMM|EEMM|ADAA|ADEE|ADMM|ADSS|AADA|EEDA)\b', testo_pulito, re.IGNORECASE)
    
    falsi_positivi = {'AL01', 'AL02', 'AL03', 'AL15', 'AL30', 'AL31', 'OM88', 'OM27', 'E47', 'DI10', 'DI12', 'LE24'}
    
    cdc_pulite = set()
    for c in trovati_sec:
        sigla = re.sub(r'[^A-Za-z0-9]', '', c).upper()
        if sigla not in falsi_positivi and not sigla.startswith('AL'): cdc_pulite.add(sigla)
    for s in trovati_prim:
        if s.upper() not in falsi_positivi: cdc_pulite.add(s.upper())
            
    return list(cdc_pulite)

def leggi_cdc_da_pdf(pdf_url):
    cdc_trovate = set()
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(pdf_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            reader = PdfReader(io.BytesIO(resp.content))
            testo_pdf = " ".join(page.extract_text() for i, page in enumerate(reader.pages) if i < 3 and page.extract_text())
            cdc_trovate = set(estrai_cdc(testo_pdf))
    except:
        pass
    return list(cdc_trovate)

def esplora_dettaglio(url_pagina):
    dettagli = {"pdf_links": [], "form_links": [], "cdc_extra": []}
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url_pagina, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        cdc_dal_testo = estrai_cdc(soup.get_text())
        if cdc_dal_testo: dettagli["cdc_extra"].extend(cdc_dal_testo)

        for a in soup.find_all('a', href=True):
            href = a['href']
            if '.pdf' in href.lower() or '/documents/' in href.lower():
                if href.startswith('/'): href = "https://www.mim.gov.it" + href
                if href not in dettagli["pdf_links"]: dettagli["pdf_links"].append(href)
            elif any(f in href.lower() for f in ['google.com/forms', 'forms.gle', 'madinterpello', 'portaleargo', 'spaggiari']):
                if href not in dettagli["form_links"]: dettagli["form_links"].append(href)
                    
        if dettagli["pdf_links"]:
            dettagli["cdc_extra"].extend(leggi_cdc_da_pdf(dettagli["pdf_links"][0]))

        dettagli["cdc_extra"] = list(set(dettagli["cdc_extra"]))
    except:
        pass
    return dettagli

# ==========================================
# 3. SPIDER PRINCIPALE
# ==========================================
def raschia_provincia(regione, provincia, url_base, database):
    print(f"\n📡 Connessione a {provincia} ({regione})...")
    url_visti = {item["url"] for item in database}
    nuovi_trovati = 0
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        risposta = requests.get(url_base, headers=headers, timeout=15)
        if risposta.status_code != 200: return 0
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        for art in soup.find_all('div', class_='article_wrapper'):
            h3 = art.find('h3')
            if not h3 or not h3.find('a'): continue
                
            a_tag = h3.find('a')
            titolo = a_tag.get_text(strip=True)
            url_avviso = "https://www.mim.gov.it" + a_tag['href'] if a_tag['href'].startswith('/') else a_tag['href']
            
            if not any(obblig in titolo.lower() for obblig in PAROLE_CHIAVE_OBBLIGATORIE): continue
            if any(esclusa in titolo.lower() for esclusa in PAROLE_ESCLUSE): continue
            if url_avviso in url_visti: continue
                
            data_tag = art.find('div', class_='article_data_tags')
            data_pulita = converti_data_italiana(data_tag.get_text(strip=True) if data_tag else "")
            
            dettagli = esplora_dettaglio(url_avviso)
            cdc_totali = list(set(estrai_cdc(titolo) + dettagli["cdc_extra"]))
            titolo_finale = f"{titolo} - [CDC: {', '.join(cdc_totali)}]" if cdc_totali else titolo
            
            print(f"    🎯 Trovato: {titolo_finale}")
            nuovi_trovati += 1
            
            database.insert(0, {
                "regione": regione, "provincia": provincia, "titolo": titolo_finale,
                "data": data_pulita, "cdc": cdc_totali, "url": url_avviso,
                "pdf_links": dettagli["pdf_links"], "form_links": dettagli["form_links"],
                "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            time.sleep(0.5) 
    except:
        pass
    return nuovi_trovati

# ==========================================
# 4. MAIN
# ==========================================
if __name__ == "__main__":
    print("🚀 AVVIO ORCHESTRATORE INTERPELLI NAZIONALI")
    database = []
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            try: database = json.load(f)
            except: pass
    
    totale_nuovi = sum(raschia_provincia(reg, prov, url, database) for reg, province in FONTI_NAZIONALI.items() for prov, url in province.items())
        
    if totale_nuovi > 0:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(database, f, indent=4, ensure_ascii=False)
        print(f"✅ Salvataggio completato! Aggiunti {totale_nuovi} avvisi.")
