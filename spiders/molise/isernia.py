import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Isernia (ATP Isernia - Interpelli)...")

    url_base = "https://atpisernia.it/category/interpelli"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore ATP Isernia, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Ogni interpello e' un <article class="scheda ...">
        articoli = soup.find_all('article', class_='scheda')

        # Limita alle prime 20 card
        for articolo in articoli[:20]:
            # --- DATA ---
            icona_div = articolo.find('div', class_='scheda-icona-small')
            data_raw = ""
            if icona_div:
                # Il testo della data e' direttamente nel div, dopo l'SVG
                data_raw = icona_div.get_text(strip=True)

            # --- TITOLO e URL ---
            testo_div = articolo.find('div', class_='scheda-testo')
            if not testo_div:
                continue

            h4_tag = testo_div.find('h4')
            if not h4_tag:
                continue

            a_tag = h4_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            # Salta se gia' visto
            if url_interpello in url_visti:
                continue

            # --- CONVERSIONE DATA ---
            data_pulita = converti_data_italiana(data_raw)

            # --- ESTRAZIONE CDC DAL TITOLO ---
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Molise",
                "provincia": "Isernia",
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
        print(f"    ⚠️ Errore durante lo scraping di Isernia: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
