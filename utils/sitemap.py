import os
import xml.etree.ElementTree as ET
from datetime import datetime
import urllib.parse

# Sostituisci con il tuo dominio reale (es. https://www.interpellonazionale.it)
BASE_URL = "https://www.interpellonazionale.it"

def genera_sitemap_e_robots(database, output_sitemap="sitemap.xml", output_robots="robots.txt"):
    print("\n🗺️ [SEO ENGINE] Avvio generazione Sitemap.xml e Robots.txt...")
    
    # 1. Creiamo il root XML con lo namespace ufficiale Sitemaps
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    # Data di oggi nel formato ISO richiesto da Google
    oggi_str = datetime.now().strftime("%Y-%m-%d")
    
    # --- HOMEPAGE PRINCIPALE ---
    url_home = ET.SubElement(urlset, "url")
    ET.SubElement(url_home, "loc").text = f"{BASE_URL}/"
    ET.SubElement(url_home, "lastmod").text = oggi_str
    ET.SubElement(url_home, "changefreq").text = "hourly"
    ET.SubElement(url_home, "priority").text = "1.0"

    # Raccogliamo regioni, province e CDC uniche dal database
    regioni = set()
    province = set()
    cdcs = set()
    
    for item in database:
        if item.get("regione"): regioni.add(item["regione"])
        if item.get("provincia"): province.add(item["provincia"])
        if item.get("cdc"):
            for c in item["cdc"]:
                if c and c not in ["TUTTE LE CLASSI", "DA VERIFICARE SUL SITO"]:
                    cdcs.add(c)

    # --- URL PER OGNI REGIONE ---
    for reg in sorted(regioni):
        url_node = ET.SubElement(urlset, "url")
        param = urllib.parse.quote(reg)
        ET.SubElement(url_node, "loc").text = f"{BASE_URL}/?regione={param}"
        ET.SubElement(url_node, "lastmod").text = oggi_str
        ET.SubElement(url_node, "changefreq").text = "daily"
        ET.SubElement(url_node, "priority").text = "0.8"

    # --- URL PER OGNI PROVINCIA ---
    for prov in sorted(province):
        url_node = ET.SubElement(urlset, "url")
        param = urllib.parse.quote(prov)
        ET.SubElement(url_node, "loc").text = f"{BASE_URL}/?provincia={param}"
        ET.SubElement(url_node, "lastmod").text = oggi_str
        ET.SubElement(url_node, "changefreq").text = "daily"
        ET.SubElement(url_node, "priority").text = "0.8"

    # --- URL PER OGNI CLASSE DI CONCORSO (CDC) ---
    for cdc in sorted(cdcs):
        url_node = ET.SubElement(urlset, "url")
        param = urllib.parse.quote(cdc)
        ET.SubElement(url_node, "loc").text = f"{BASE_URL}/?cdc={param}"
        ET.SubElement(url_node, "lastmod").text = oggi_str
        ET.SubElement(url_node, "changefreq").text = "daily"
        ET.SubElement(url_node, "priority").text = "0.7"

    # --- SALVATAGGIO SITEMAP.XML ---
    tree = ET.ElementTree(urlset)
    try:
        ET.indent(tree, space="  ", level=0) # Formattazione pulita dell'XML
    except AttributeError:
        pass # Per versioni Python più vecchie
        
    tree.write(output_sitemap, encoding="utf-8", xml_declaration=True)
    totale_urls = len(urlset)
    print(f"  ✅ Sitemap.xml generata con successo ({totale_urls} URL indicizzabili pronti per Google!)")

    # --- GENERAZIONE ROBOTS.TXT ---
    robots_content = f"""User-agent: *
Allow: /

# Link automatico alla Sitemap per i crawler di Google e Bing
Sitemap: {BASE_URL}/{output_sitemap}
"""
    with open(output_robots, "w", encoding="utf-8") as f:
        f.write(robots_content)
    print("  ✅ Robots.txt aggiornato con successo.")
