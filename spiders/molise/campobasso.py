import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Campobasso (MIM - USR Molise Interpelli)...")

    url_base = "https://www.mim.gov.it/web/campobasso/interpelli"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore MIM Campobasso, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        # La lista degli interpelli e' dentro <div class="list-posts">
        lista = soup.find('div', class_='list-posts')
        if not lista:
            print("    ⚠️ Nessuna lista interpelli trovata nella pagina.")
            return risultati

        # Ogni interpello e' un <article class="article">
        articoli = lista.find_all('article', class_='article')

        for articolo in articoli[:20]:
            # --- DATA ---
            data_span = articolo.find('span', class_='article_data')
            data_raw = data_span.get_text(strip=True) if data_span else ""

            # --- TITOLO e URL ---
            h3_tag = articolo.find('h3')
            if not h3_tag:
                continue

            a_tag = h3_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            # Assicura URL assoluto
            if url_interpello.startswith('/'):
                url_interpello = "https://www.mim.gov.it" + url_interpello

            # Salta se gia' visto
            if url_interpello in url_visti:
                continue

            # --- CONVERSIONE DATA ---
            data_pulita = converti_data_italiana(data_raw)

            # --- ESTRAZIONE CDC DAL TITOLO ---
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Molise",
                "provincia": "Campobasso",
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
        print(f"    ⚠️ Errore durante lo scraping di Campobasso: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
