import re
import io
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from PyPDF2 import PdfReader

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
    
    pattern_standard = r'\b[AB][\-\s]*(?:0\d{2}|\d{1,2})\b'
    pattern_speciali = r'\b[A-B][A-Z](?:55|56|02)\b'
    pattern_prim = r'\b(AAAA|EEEE|PPPP|EEIL|EEEM|AAHN|EEHN|AAMM|EEMM|AADA|EEDA|AD[A-Z]{2}|IRC)\b'
    
    trovati_standard = re.findall(pattern_standard, testo_pulito, re.IGNORECASE)
    trovati_speciali = re.findall(pattern_speciali, testo_pulito, re.IGNORECASE)
    trovati_prim = re.findall(pattern_prim, testo_pulito, re.IGNORECASE)
    
    cdc_pulite = set()
    
    for c in trovati_standard:
        sigla = re.sub(r'[^A-Za-z0-9]', '', c).upper()
        lettera = sigla[0]
        numeri = sigla[1:]
        sigla_ufficiale = f"{lettera}{numeri.zfill(3)}"
        if sigla_ufficiale not in ['B000', 'A000']:
            cdc_pulite.add(sigla_ufficiale)
            
    for c in trovati_speciali:
        cdc_pulite.add(c.upper())
            
    for s in trovati_prim:
        cdc_pulite.add(s.upper())
            
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
