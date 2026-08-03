import os
import json
import importlib
from datetime import datetime

DATA_FILE = "database_nazionale.json"

# LISTA DEI MODULI DA ESEGUIRE
MODULI_ATTIVI = [
    "spiders.lombardia",
    "spiders.piemonte",
    "spiders.liguria.genova",
    "spiders.liguria.laspezia",
    "spiders.liguria.imperia",
    "spiders.liguria.savona",
    "spiders.veneto.rovigo"
]

def is_troppo_vecchio(item):
    GIORNI_LIMITE = 15
    oggi = datetime.now()

    data_str = item.get("data", "")
    if data_str:
        try:
            data_obj = datetime.strptime(data_str, '%Y-%m-%d')
            if (oggi - data_obj).days > GIORNI_LIMITE:
                return True
        except:
            pass

    data_ril_str = item.get("data_rilevamento", "")
    if data_ril_str:
        try:
            data_ril_obj = datetime.fromisoformat(data_ril_str.split('.')[0])
            if (oggi - data_ril_obj).days > GIORNI_LIMITE:
                return True
        except:
            pass

    return False

def avvia_orchestratore():
    print("🚀 AVVIO ORCHESTRATORE INTERPELLI NAZIONALI (Modulare & Smart)")
    
    database = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                database = json.load(f)
        except Exception as e:
            print(f"⚠️ Errore lettura DB precedente: {e}")
            
    db_iniziale_len = len(database)
    database = [item for item in database if not is_troppo_vecchio(item)]
    eliminati = db_iniziale_len - len(database)
    if eliminati > 0:
        print(f"🧹 PULIZIA AUTOMATICA: Eliminati {eliminati} interpelli vecchi di oltre 15 giorni dal Database!")

    url_visti = {item["url"] for item in database if "url" in item}
    
    totale_nuovi = 0
    nuovi_interpelli_totali = []

    for modulo_nome in MODULI_ATTIVI:
        try:
            spider = importlib.import_module(modulo_nome)
            print(f"\n--- AVVIO SPIDER: {modulo_nome} ---")
            
            risultati = spider.run(url_visti)
            
            if risultati:
                for item in risultati:
                    if not is_troppo_vecchio(item):
                        # IL LOG ORA È CENTRALIZZATO QUI! NON FALLIRÀ MAI PIÙ.
                        print(f"    🟢 AGGIUNTO: {item['titolo']} ({item['provincia']}) - Scadenza: {item['data']}")
                        nuovi_interpelli_totali.append(item)
                        totale_nuovi += 1
                    else:
                        print(f"    🔴 SCARTATO (Troppo vecchio): {item['titolo']} ({item['provincia']})")
                
        except ModuleNotFoundError:
            print(f"\n❌ ERRORE: Modulo '{modulo_nome}' non trovato.")
        except Exception as e:
            print(f"\n❌ ERRORE CRITICO nello spider '{modulo_nome}': {e}")
            
    if nuovi_interpelli_totali or eliminati > 0:
        database = nuovi_interpelli_totali + database
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(database, f, indent=4, ensure_ascii=False)
        print(f"\n✅ Salvataggio completato! Aggiunti {totale_nuovi} nuovi avvisi. (Totale nel DB: {len(database)})")
    else:
        print("\n💤 Nessun nuovo interpello e nessuna pulizia necessaria oggi.")

if __name__ == "__main__":
    avvia_orchestratore()
