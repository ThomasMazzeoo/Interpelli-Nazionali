import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Arezzo (USR Toscana - Interpelli)...")

    url_base = "https://www.arezzoistruzione.it/usparezzo/index.php/interpelli"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Arezzo, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        articoli = soup.find_all('div', itemprop='blogPost')

        for articolo in articoli[:20]:
            h3_tag = articolo.find('h3', itemprop='headline')
            if not h3_tag:
                continue

            a_tag = h3_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_relativo = a_tag['href']
            url_interpello = urljoin(url_base, url_relativo)

            if url_interpello in url_visti:
                continue

            data_raw = ""
            time_tag = articolo.find('time', itemprop='datePublished')
            if time_tag and time_tag.has_attr('datetime'):
                data_raw = time_tag['datetime'].split('T')[0] # Prende solo la parte YYYY-MM-DD
            
            # Se `data_raw` è già in formato ISO YYYY-MM-DD, non abbiamo bisogno di `converti_data_italiana`,
            # ma lo passiamo per sicurezza. Essendo già YYYY-MM-DD, converti_data_italiana potrebbe non gestirlo se si aspetta GG/MM/YYYY.
            # Vediamo di usare direttamente datetime.
            data_pulita = ""
            if data_raw:
                try:
                    # Assicuriamoci che sia YYYY-MM-DD
                    datetime.strptime(data_raw, '%Y-%m-%d')
                    data_pulita = data_raw
                except ValueError:
                    data_pulita = converti_data_italiana(data_raw)

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Toscana",
                "provincia": "Arezzo",
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
        print(f"    ❌ Errore durante lo scraping di Arezzo: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
