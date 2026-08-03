from datetime import datetime, timedelta

# Il link diretto fornito dall'USR per la cartella condivisa di Vicenza
URL_CARTELLA_VICENZA = "https://usrveneto-my.sharepoint.com/personal/redazione_sito_usrve_it/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fredazione%5Fsito%5Fusrve%5Fit%2FDocuments%2FInterpelli%2FVI%2FAggiornamento%20interpelli&ga=1"

def run(url_visti):
    print("📡 [VENETO] Creazione collegamento diretto per Vicenza...")
    
    # Generiamo una data di scadenza mobile (Oggi + 3 giorni) 
    # Così il bottone rimarrà sempre Verde e Attivo sulla mappa nazionale.
    data_scadenza = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    interpello_vicenza = {
        "regione": "Veneto",
        "provincia": "Vicenza",
        "titolo": "Cartella Ufficiale Interpelli Vicenza (Report aggiornati ogni 6 ore)",
        "data": data_scadenza,
        "cdc": ["TUTTE LE CLASSI"], # Badge generico per far capire che contiene tutto
        "url": URL_CARTELLA_VICENZA,
        "pdf_links": [],
        "form_links": [],
        "data_rilevamento": datetime.now().isoformat()
    }
    
    # Lo inseriamo nel database solo se non c'è già per evitare duplicati
    if URL_CARTELLA_VICENZA not in url_visti:
        url_visti.add(URL_CARTELLA_VICENZA)
        print("    🎯 Trovato Vicenza: Collegamento alla cartella SharePoint inserito con successo.")
        return [interpello_vicenza]
    
    return []
