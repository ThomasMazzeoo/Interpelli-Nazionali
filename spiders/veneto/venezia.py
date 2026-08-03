import time
import requests
import io
import re
from bs4 import BeautifulSoup
from datetime import datetime
from PyPDF2 import PdfReader
from utils.helpers import estrai_cdc

# Nota: SharePoint blocca l'accesso diretto ai bot. 
# Se in futuro Venezia fornirà un link diretto al PDF (es. un link RSS), 
# lo inseriremo qui.
URL_BASE_VENEZIA = "https://usrveneto-my.sharepoint.com/personal/redazione_sito_usrve_it/Documents/Interpelli/VE/Aggiornamento interpelli"

def estrai_dati_da_riga_pdf(riga_testo):
    """
    Legge una riga del PDF tabellare di Venezia ed estrae i dati utili.
    Ordine colonne: Istituto | Comune | Grado | CDC | Data Pub | Inizio | Fine | Posto | Intera | Ore | Link | Scadenza
    """
    # Se la riga non contiene un link HTTP, probabilmente non è una riga di dati valida
    if "http" not in riga_testo:
        return None
        
    parti = riga_testo.split("http")
    prima_parte = parti[0].strip()
    link_e_scadenza = "http" + parti[1].strip()
    
    # 1. Estrai il link
    link = link_e_scadenza.split(" ")[0]
    
    # 2. Estrai la scadenza (Tutto ciò che c'è dopo il link di solito è la scadenza)
    scadenza_raw = link_e_scadenza.replace(link, "").strip()
    
    # Usa il super radar per normalizzare la scadenza
    data_pulita = ""
    match_num = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})', scadenza_raw)
    if match_num:
        giorno, mese, anno = match_num.groups()
        if len(anno) == 2: anno = f"20{anno}"
        data_pulita = f"{anno}-{mese.zfill(2)}-{giorno.zfill(2)}"
        
    # 3. Estrai le CDC usando il nostro aiutante standard sulla prima parte del testo
    cdc = estrai_cdc(prima_parte)
    
    # 4. Trova l'istituto (di solito le prime parole prima del comune)
    istituto = prima_parte[:50].strip() + "..." # Approssimazione elegante

    return {
        "regione": "Veneto",
        "provincia": "Venezia",
        "titolo": istituto,
        "data": data_pulita,
        "cdc": cdc,
        "url": link,
        "pdf_links": [],
        "form_links": [],
        "data_rilevamento": datetime.now().isoformat()
    }

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    print("📡 [VENETO] Connessione a Venezia...")
    
    # A causa del muro di SharePoint, senza un Token OAuth aggiornato, la richiesta 
    # API diretta Python -> Microsoft fallirà. 
    # INSERIAMO QUI IL BYPASS: qualora avessimo un link di "Scarica Diretto" al PDF.
    
    # ESEMPIO DI LETTURA FUTURA (quando avremo il link di download diretto del PDF):
    link_download_diretto_pdf = None # Da popolare con il link "Download" di Sharepoint se disponibile
    
    if link_download_diretto_pdf:
        try:
            resp = requests.get(link_download_diretto_pdf, headers=headers, timeout=15)
            if resp.status_code == 200:
                reader = PdfReader(io.BytesIO(resp.content))
                testo_pdf = " ".join(page.extract_text() for page in reader.pages)
                
                # Split per righe e analizziamo
                righe = testo_pdf.split('\n')
                for riga in righe:
                    dati_estratti = estrai_dati_da_riga_pdf(riga)
                    if dati_estratti and dati_estratti["url"] not in url_visti:
                        if dati_estratti["data"]: # Salva solo se la scadenza esiste!
                            nuovi_interpelli.append(dati_estratti)
                            url_visti.add(dati_estratti["url"])
                            print(f"    🎯 Trovato in PDF Venezia: {dati_estratti['titolo']} - {dati_estratti['data']}")
        except Exception as e:
            print(f"  ❌ Errore nella lettura del PDF di Venezia: {e}")

    # Per ora restituiamo vuoto, evitando che il bot si schianti contro il login Microsoft.
    # Appena Venezia genererà interpelli reali tramite scuole, o troveremo un link RSS, 
    # questo modulo sarà già pronto per "masticarlo".
    return nuovi_interpelli
