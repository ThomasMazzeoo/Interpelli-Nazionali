import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Reggio Emilia (USR ER - Interpelli)...")

    url_base = "https://re.istruzioneer.gov.it/category/docenti/interpello/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Reggio Emilia, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Ogni interpello e' un <article> con classe "post"
        articoli = soup.find_all('article', class_='post')

        for articolo in articoli[:20]:
            # --- TITOLO e URL ---
            h2_tag = articolo.find('h2', class_='entry-title')
            if not h2_tag:
                continue

            a_tag = h2_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            if url_interpello in url_visti:
                continue

            # --- DATA ---
            time_tag = articolo.find('time', class_='entry-date')
            data_raw = time_tag.get_text(strip=True) if time_tag else ""

            # --- CONVERSIONE DATA ---
            data_pulita = converti_data_italiana(data_raw)

            # --- ESTRAZIONE CDC DAL TITOLO ---
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Emilia-Romagna",
                "provincia": "Reggio Emilia",
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
        print(f"    ⚠️ Errore durante lo scraping di Reggio Emilia: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
