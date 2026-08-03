import re
import io
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from PyPDF2 import PdfReader

def converti_data_italiana(data_str):
    testo = data_str.lower().strip()
    
    # 1. Prova formato con mesi a lettere (es. 4 Giugno 2026, 25-set-25)
    match_alpha = re.search(r'(\d{1,2})[\s\-\/\.]+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*[\s\-\/\.]+(\d{4}|\d{2})', testo)
    if match_alpha:
        mesi_map = {'gen':'01', 'feb':'02', 'mar':'03', 'apr':'04', 'mag':'05', 'giu':'06', 'lug':'07', 'ago':'08', 'set':'09', 'ott':'10', 'nov':'11', 'dic':'12'}
        giorno = match_alpha.group(1).zfill(2)
        mese = mesi_map[match_alpha.group(2)]
        anno = match_alpha.group(3)
        if len(anno) == 2: anno = "20" + anno
        return f"{anno}-{mese}-{giorno}"

    # 2. Prova formato numerico (es. 24/07/2026, 24.07.26, 24-07-2026)
    match_num = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})', testo)
    if match_num:
        giorno = match_num.group(1).zfill(2)
        mese = match_num.group(2).zfill(2)
        anno = match_num.group(3)
        if len(anno) == 2: anno = "20" + anno
        return f"{anno}-{mese}-{giorno}"
        
    # Se fallisce, restituisce la data di oggi per non far crashare nulla
    # Se fallisce e non trova una data valida, restituisce stringa vuota
    return ""

def estrai_cdc(testo):
    testo_pulito = re.sub(r'\b(fino\s+al|dal|del|il|om|art\.?|posti?|n\.?)\s+\d{1,4}\b', '', testo, flags=re.IGNORECASE)
    testo_upper = testo.upper()

    cdc_trovate = set()

    pattern_standard = r'\b[AB][\-]?\d{2,3}\b'
    for c in re.findall(pattern_standard, testo_pulito, re.IGNORECASE):
        sigla = re.sub(r'[^A-Za-z0-9]', '', c).upper()
        sigla_ufficiale = f"{sigla[0]}{sigla[1:].zfill(3)}"
        if sigla_ufficiale not in ['B000', 'A000']:
            cdc_trovate.add(sigla_ufficiale)

    pattern_speciali = r'(ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|PPPP|EEIL|EEEM|AAHN|EEHN|AAMM|EEMM|AADA|EEDA|IRC|[A-B][A-Z]\d{2})'
    for c in re.findall(pattern_speciali, testo_upper):
        cdc_trovate.add(c)

    if not cdc_trovate:
        if "INFANZIA" in testo_upper and "PRIMARIA" in testo_upper:
            cdc_trovate.update(["INFANZIA", "PRIMARIA"])
        elif "INFANZIA" in testo_upper:
            cdc_trovate.add("INFANZIA")
        elif "PRIMARIA" in testo_upper:
            cdc_trovate.add("PRIMARIA")
        elif "SECONDARIA I" in testo_upper or "1 GRADO" in testo_upper or "MEDIE" in testo_upper:
            cdc_trovate.add("SECONDARIA I GRADO")
        elif "SECONDARIA II" in testo_upper or "2 GRADO" in testo_upper or "SUPERIORI" in testo_upper:
            cdc_trovate.add("SECONDARIA II GRADO")
        elif "SECONDARIA" in testo_upper:
            cdc_trovate.add("SECONDARIA")
        elif "RELIGIONE" in testo_upper:
            cdc_trovate.add("RELIGIONE")
        elif "SOSTEGNO" in testo_upper:
            cdc_trovate.add("SOSTEGNO")

    if "MMMM" in cdc_trovate:
        cdc_trovate.remove("MMMM")

    cdc_finali = []
    for cdc in cdc_trovate:
        if not re.match(r'^[A-Z]{2,4}\d{4,5}[A-Z\d]?$', cdc):
            cdc_finali.append(cdc)

    return sorted(cdc_finali)

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
