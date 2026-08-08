import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Prato (USR Toscana - Interpelli)...")

    url_base = "https://www.ufficioscolasticoprovinciale.prato.it/?s=interpello&submit="
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Prato, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        articoli = soup.find_all('div', class_='cerca-risultato-item')

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

            data_raw = ""
            small_tag = articolo.find('small')
            if small_tag:
                p_tag = small_tag.find('p')
                if p_tag:
                    data_raw = p_tag.get_text(strip=True)
            
            data_pulita = converti_data_italiana(data_raw)
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Toscana",
                "provincia": "Prato",
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
        print(f"    ⚠️ Errore durante lo scraping di Prato: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
