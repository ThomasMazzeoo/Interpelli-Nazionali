import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Ascoli Piceno (USR Marche - Interpelli)...")

    url_base = "https://www.uspascolipiceno.it/wordpress/interpelli/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Ascoli Piceno, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        articoli = soup.find_all('li', class_='wp-block-post')

        for articolo in articoli[:20]:
            a_tag = articolo.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            time_tag = articolo.find('time')
            if time_tag and time_tag.has_attr('datetime'):
                data_raw = time_tag['datetime']
                # Es: 2026-06-03T13:19:48+01:00 -> 2026-06-03
                data_pulita = data_raw.split('T')[0]
            else:
                data_pulita = datetime.now().strftime("%Y-%m-%d")

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Marche",
                "provincia": "Ascoli Piceno / Fermo",
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
        print(f"    ⚠️ Errore durante lo scraping di Ascoli Piceno: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
