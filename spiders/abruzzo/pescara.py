import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3
import re

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Pescara (USR Abruzzo - Interpelli)...")

    url_base = "https://www.istruzionechietipescara.it/category/dalle-istituzioni-scolatiche/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Pescara, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Gli articoli sono dentro div con classe 'card-news'
        articoli = soup.find_all('div', class_='card-news')

        for articolo in articoli[:20]:
            h3_tag = articolo.find('h3')
            if not h3_tag:
                continue
                
            a_tag = h3_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            data_pulita = ""
            # La data si trova nel primo paragrafo con classe u-text-h6
            p_date = articolo.find('p', class_=lambda c: c and 'u-text-h6' in c)
            if p_date:
                span_date = p_date.find('span')
                if span_date:
                    data_raw = span_date.get_text(strip=True)
                    data_pulita = converti_data_italiana(data_raw)

            # Il testo riassuntivo può contenere info extra come la classe di concorso
            p_extra = articolo.find('p', class_=lambda c: c and 'u-text-p' in c)
            testo_extra = p_extra.get_text(strip=True) if p_extra else ""
            testo_completo = f"{titolo} {testo_extra}"

            cdc = estrai_cdc(testo_completo)

            risultato = {
                "regione": "Abruzzo",
                "provincia": "Pescara",
                "titolo": titolo,
                "data": data_pulita,
                "cdc": cdc,
                "url": url_interpello,
                "pdf_links": [],
                "form_links": [],
                "data_rilevamento": oggi_iso
            }
            risultati.append(risultato)
            url_visti.add(url_interpello)

    except Exception as e:
        print(f"    ❌ Errore durante lo scraping di Pescara: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
