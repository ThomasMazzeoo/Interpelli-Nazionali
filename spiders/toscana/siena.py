import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Siena (USR Toscana - Interpelli)...")

    url_base = "https://www.uspsi.it/uspsiena/interpelli-docenti/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Siena, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        blog_list = soup.find('div', id='blog-list')
        articoli = blog_list.find_all('div', class_='bs-blog-post') if blog_list else []

        for articolo in articoli[:20]:
            h4_tag = articolo.find('h4', class_='title')
            if not h4_tag:
                continue

            a_tag = h4_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue
                
            p_tag = articolo.find('p')
            descrizione = p_tag.get_text(strip=True) if p_tag else ""

            data_raw = ""
            time_tag = articolo.find('time')
            if time_tag:
                data_raw = time_tag.get_text(strip=True)
            
            data_pulita = converti_data_italiana(data_raw)
            cdc = estrai_cdc(titolo + " " + descrizione)

            risultato = {
                "regione": "Toscana",
                "provincia": "Siena",
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
        print(f"    ❌ Errore durante lo scraping di Siena: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
