import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import estrai_cdc
import urllib3

urllib3.disable_warnings()

Mesi = {
    "Gen": "01",
    "Feb": "02",
    "Mar": "03",
    "Apr": "04",
    "Mag": "05",
    "Giu": "06",
    "Lug": "07",
    "Ago": "08",
    "Set": "09",
    "Ott": "10",
    "Nov": "11",
    "Dic": "12"
}

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Teramo (USR Abruzzo - Interpelli)...")

    url_base = "https://www.csateramo.it/wpusp/archive/category/interpello"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Teramo, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        # I post sono dentro div con id che inizia per "post-"
        articoli = soup.find_all('div', id=lambda x: x and x.startswith('post-'))

        for articolo in articoli[:20]:
            h2_tag = articolo.find('h2')
            if not h2_tag:
                continue

            a_tag = h2_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            data_pulita = ""
            cal_post = articolo.find('div', class_='calendarpost')
            if cal_post:
                mm = cal_post.find('div', class_='datamm_post')
                gg = cal_post.find('div', class_='datagg_post')
                aa = cal_post.find('div', class_='dataaa_post')
                if mm and gg and aa:
                    mese_str = mm.get_text(strip=True)
                    giorno = gg.get_text(strip=True).zfill(2)
                    anno = aa.get_text(strip=True)
                    mese = Mesi.get(mese_str, "01")
                    data_pulita = f"{anno}-{mese}-{giorno}"

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Abruzzo",
                "provincia": "Teramo",
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
        print(f"    ❌ Errore durante lo scraping di Teramo: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
