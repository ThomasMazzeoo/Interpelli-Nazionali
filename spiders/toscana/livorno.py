import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3
import re

urllib3.disable_warnings()

def get_data_from_detail(url, headers):
    try:
        resp = requests.get(url, headers=headers, timeout=10, verify=False)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            time_tag = soup.find('time')
            if time_tag and time_tag.has_attr('datetime'):
                return time_tag['datetime'].split('T')[0]
            
            # Fallback: cerca testo come "Pubblicato: 10 Maggio 2026" o simile
            testo = soup.get_text()
            match = re.search(r'Pubblicato[:\s]+(\d{1,2}\s+[a-zA-Z]+\s+\d{4})', testo, re.IGNORECASE)
            if match:
                return converti_data_italiana(match.group(1))
    except:
        pass
    return ""

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Livorno (USR Toscana - Interpelli)...")

    url_base = "https://www.ustli.it/usp_livorno/index.php/docenti/interpelli"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Livorno, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        tabella = soup.find('table', class_='Table')
        if not tabella:
            return risultati
            
        righe = tabella.find('tbody').find_all('tr') if tabella.find('tbody') else []

        for riga in righe[:15]:
            a_tag = riga.find('a')
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_relativo = a_tag['href']
            url_interpello = urljoin(url_base, url_relativo)

            if url_interpello in url_visti:
                continue

            # Livorno non ha la data in tabella, proviamo a recuperarla dalla pagina di dettaglio
            data_pulita = get_data_from_detail(url_interpello, headers)
            
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Toscana",
                "provincia": "Livorno",
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
        print(f"    ❌ Errore durante lo scraping di Livorno: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
