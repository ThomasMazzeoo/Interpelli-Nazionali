import hashlib
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Ravenna (USR ER - Interpelli)...")

    url_base = "https://ra.istruzioneer.gov.it/conferimento-supplenze-per-esaurimento-graduatorie-di-istituto/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Ravenna, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        content_div = soup.find('div', class_='entry-content')
        if not content_div:
            print("    ⚠️ Contenitore 'entry-content' non trovato.")
            return risultati

        paragrafi = content_div.find_all('p')

        # Limita ai primi 30 paragrafi per evitare scraping eccessivo di interpelli vecchi
        for p in paragrafi[:30]:
            testo = p.get_text(separator='\n').strip()
            linee = [line.strip() for line in testo.split('\n') if line.strip()]
            
            if len(linee) < 2:
                continue
                
            # La prima riga e' la data
            data_raw = linee[0]
            if not re.search(r'\d{2}/\d{2}/\d{4}', data_raw):
                continue
                
            a_tags = p.find_all('a', href=True)
            if not a_tags:
                continue
                
            url_interpello = a_tags[0]['href']
            
            # Il titolo di solito e' la seconda riga
            titolo = linee[1]
            
            # Se il titolo e' cortissimo o spezzato su piu' righe (e non e' la riga dei link)
            if len(linee) > 2 and linee[2].lower() not in ['link', 'interpello', 'modulo', 'avviso', 'interpello sostituito', 'modello']:
                 titolo += " " + linee[2]

            data_pulita = converti_data_italiana(data_raw)
            cdc = estrai_cdc(titolo)
            
            # Usa hash per rendere unico l'URL
            hash_id = hashlib.md5(f"{data_raw}_{titolo}_{url_interpello}".encode('utf-8')).hexdigest()[:10]
            url_univoco = f"{url_interpello}#{hash_id}"

            if url_univoco in url_visti:
                continue

            pdf_links = []
            form_links = []
            for a in a_tags:
                href = a['href']
                if '.pdf' in href.lower() or '.docx' in href.lower():
                    pdf_links.append(href)
                elif any(f in href.lower() for f in ['google.com/forms', 'forms.gle', 'nuvola.madisoft', 'spaggiari', 'madinterpello', 'portaleargo']):
                    form_links.append(href)
            
            # Se l'URL principale e' esso stesso un form
            if any(f in url_interpello.lower() for f in ['google.com/forms', 'forms.gle', 'nuvola.madisoft', 'spaggiari', 'madinterpello', 'portaleargo']):
                if url_interpello not in form_links:
                    form_links.append(url_interpello)

            risultato = {
                "regione": "Emilia-Romagna",
                "provincia": "Ravenna",
                "titolo": titolo,
                "data": data_pulita,
                "cdc": cdc,
                "url": url_univoco,
                "pdf_links": pdf_links,
                "form_links": form_links,
                "data_rilevamento": oggi_iso
            }
            risultati.append(risultato)
            url_visti.add(url_univoco)

    except Exception as e:
        print(f"    ⚠️ Errore durante lo scraping di Ravenna: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
