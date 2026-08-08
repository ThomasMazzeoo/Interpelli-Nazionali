import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Latina (USR Lazio - Interpelli)...")

    url_base = "https://www.csalatina.it/interpelli/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Latina, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Gli elementi sono in una tabella Fabrik (Joomla)
        righe = soup.find_all('tr', class_=lambda c: c and 'fabrik_row' in c)

        for riga in righe[:20]:
            td_titolo = riga.find('td', class_=lambda c: c and 'albo___nome_atto' in c)
            td_data = riga.find('td', class_=lambda c: c and 'albo___date_time' in c)
            td_link = riga.find('td', class_=lambda c: c and 'albo___id' in c)
            
            if not td_titolo or not td_data or not td_link:
                continue

            titolo = td_titolo.get_text(strip=True)
            if not titolo:
                continue
                
            a_tag = td_link.find('a', href=True)
            url_interpello = urljoin("https://www.csalatina.it/", a_tag['href']) if a_tag else url_base

            if url_interpello in url_visti and url_interpello != url_base:
                continue

            data_raw = td_data.get_text(strip=True)
            data_pulita = ""
            if data_raw:
                # Esempio: 2026-01-28
                try:
                    data_obj = datetime.strptime(data_raw, '%Y-%m-%d')
                    data_pulita = data_obj.strftime('%Y-%m-%d')
                except ValueError:
                    data_pulita = converti_data_italiana(data_raw)

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Lazio",
                "provincia": "Latina",
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
        print(f"    ❌ Errore durante lo scraping di Latina: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
