import os
import json
import importlib

DATA_FILE = "database_nazionale.json"

# LISTA DEI MODULI DA ESEGUIRE
MODULI_ATTIVI = [
    "spiders.lombardia",
    "spiders.piemonte",
    "spiders.liguria.genova",
    "spiders.liguria.laspezia",
    "spiders.liguria.imperia",
    "spiders.liguria.savona"  # <-- AGGIUNTA SAVONA QUI!
]

def avvia_orchestratore():
    print("🚀 AVVIO ORCHESTRATORE INTERPELLI NAZIONALI (Modulare)")
    
    database = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                database = json.load(f)
        except Exception as e:
            print(f"⚠️ Errore lettura DB precedente: {e}")
            
    url_visti = {item["url"] for item in database if "url" in item}
    
    totale_nuovi = 0
    nuovi_interpelli_totali = []

    for modulo_nome in MODULI_ATTIVI:
        try:
            spider = importlib.import_module(modulo_nome)
            print(f"\n--- AVVIO SPIDER: {modulo_nome} ---")
            
            risultati = spider.run(url_visti)
            
            if risultati:
                nuovi_interpelli_totali.extend(risultati)
                totale_nuovi += len(risultati)
                
        except ModuleNotFoundError:
            print(f"\n❌ ERRORE: Modulo '{modulo_nome}' non trovato. Controlla il percorso.")
        except Exception as e:
            print(f"\n❌ ERRORE CRITICO nello spider '{modulo_nome}': {e}")
            
    if nuovi_interpelli_totali:
        database = nuovi_interpelli_totali + database
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(database, f, indent=4, ensure_ascii=False)
        print(f"\n✅ Salvataggio completato! Aggiunti {totale_nuovi} nuovi avvisi.")
    else:
        print("\n💤 Nessun nuovo interpello trovato oggi. Nessun salvataggio necessario.")

if __name__ == "__main__":
    avvia_orchestratore()
