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
    print("    Inizio scraping Provincia di Grosseto (USR Toscana - Interpelli)...")

    url_base = "https://www.ufficioscolasticogrosseto.it/uff7/index.php/utilita/interpelli-nazionali-2"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Grosseto, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        tabella = soup.find('table', class_='category')
        if not tabella:
            return risultati
            
        righe = tabella.find('tbody').find_all('tr') if tabella.find('tbody') else []

        for riga in righe[:20]:
            a_tag = riga.find('a')
            if not a_tag:
                continue

            titolo_originale = a_tag.get_text(strip=True)
            url_relativo = a_tag['href']
            url_interpello = urljoin(url_base, url_relativo)

            if url_interpello in url_visti:
                continue

            # Grosseto inserisce la data all'inizio del titolo (es. "15.06.2026 - Interpello...")
            data_pulita = ""
            titolo = titolo_originale
            match_data = re.search(r'^(\d{2}[./-]\d{2}[./-]\d{4})\s*[-–]?\s*(.*)', titolo_originale)
            if match_data:
                data_raw = match_data.group(1).replace('.', '/')
                data_pulita = converti_data_italiana(data_raw)
                titolo = match_data.group(2) # Rimuoviamo la data dal titolo per renderlo più pulito

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Toscana",
                "provincia": "Grosseto",
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
        print(f"    ❌ Errore durante lo scraping di Grosseto: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
