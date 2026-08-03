from datetime import datetime

# Il link diretto fornito dall'USR per la cartella condivisa di Vicenza
URL_CARTELLA_VICENZA = "https://usrveneto-my.sharepoint.com/personal/redazione_sito_usrve_it/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fredazione%5Fsito%5Fusrve%5Fit%2FDocuments%2FInterpelli%2FVI%2FAggiornamento%20interpelli&ga=1"

def run(url_visti):
    print("📡 [VENETO] Creazione collegamento diretto per Vicenza...")
    
    interpello_vicenza = {
        "regione": "Veneto",
        "provincia": "Vicenza",
        "titolo": "Cartella Ufficiale Interpelli Vicenza (Report aggiornati ogni 6 ore)",
        "data": "",                  # <--- NESSUNA DATA INVENTATA!
        "permanente": True,          # <--- Bypassa lo scarto di main.py
        "escludi_scoreboard": True,  # <--- Esclude dal conteggio della Scoreboard
        "cdc": ["TUTTE LE CLASSI"],
        "url": URL_CARTELLA_VICENZA,
        "pdf_links": [],
        "form_links": [],
        "data_rilevamento": datetime.now().isoformat()
    }
    
    if URL_CARTELLA_VICENZA not in url_visti:
        url_visti.add(URL_CARTELLA_VICENZA)
        print("    🎯 Trovato Vicenza: Collegamento alla cartella SharePoint inserito con successo.")
        return [interpello_vicenza]
    
    return []
