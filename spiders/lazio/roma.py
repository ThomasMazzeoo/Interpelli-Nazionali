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
    print("    Inizio scraping Provincia di Roma (USR Lazio - Interpelli)...")

    url_base = "https://www.atpromaistruzione.it/atp/category/reclutamento/interpelli-personale-docente/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Roma, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Gli articoli sono in article.scheda
        articoli = soup.find_all('article', class_='scheda')

        for articolo in articoli[:20]:
            h4_tag = articolo.find('h4')
            if not h4_tag:
                continue
                
            a_tag = h4_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            data_pulita = ""
            # La data si trova nel div scheda-icona-small
            icona_div = articolo.find('div', class_='scheda-icona-small')
            if icona_div:
                data_raw = icona_div.get_text(strip=True)
                data_pulita = converti_data_italiana(data_raw)

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Lazio",
                "provincia": "Roma",
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
        print(f"    ❌ Errore durante lo scraping di Roma: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
