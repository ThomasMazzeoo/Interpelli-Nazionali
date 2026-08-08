import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Macerata (USR Marche - Interpelli)...")

    url_base = "http://www.uspmc.sinp.net/documenti-uspmc-cms/?cat-documenti-uspmc=interpelli"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Macerata, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        articoli = soup.find_all('div', class_='archive-single')

        for articolo in articoli[:20]:
            h2_tag = articolo.find('h2', class_='titlearchive')
            if not h2_tag:
                continue
                
            a_tag = h2_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            data_raw = ""
            td_etichette = articolo.find_all('td', class_='etichetta')
            for td in td_etichette:
                if 'Data di pubblicazione' in td.get_text(strip=True):
                    td_valore = td.find_next_sibling('td', class_='valore')
                    if td_valore:
                        data_raw = td_valore.get_text(strip=True)
                        break
            
            data_pulita = converti_data_italiana(data_raw)
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Marche",
                "provincia": "Macerata",
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
        print(f"    ⚠️ Errore durante lo scraping di Macerata: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
