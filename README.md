# PixQX

Leichter Bildeditor für Browser & Docker, ohne Login.

Ein schlanker Bildeditor in purem **HTML, JavaScript und CSS**. Er läuft direkt im Browser, braucht weder Anmeldung noch Backend und lässt sich optional als **Docker-Container** betreiben. Alle Bilder werden ausschließlich im Browser des Nutzers verarbeitet.

## ✨ Features (v0.7)

- **Ohne Anmeldung:** Seite öffnen und loslegen
- **Mehrere Tabs:** mehrere Dokumente parallel, Warnung bei nicht exportierten Änderungen
- **Ebenen (Layer):** hinzufügen, duplizieren, umbenennen, sortieren, ein-/ausblenden, Deckkraft, nach unten zusammenführen
- **Bild-in-Bild:** weitere Bilder als neue Ebene einfügen; Drag & Drop und Einfügen aus der Zwischenablage
- **Auswahl & Zuschnitt:** Rechteck, Lasso, Zauberstab, Zuschneiden; Kopieren, Einfügen, Löschen
- **Zeichnen:** Bleistift, Pinsel, Radierer, Füllen, Rechteck, Ellipse, Linie, Text, Pipette
- **19 Filter:** u. a. Graustufen, Sepia, Weichzeichnen, Schärfen, Kontrast, Sättigung, Posterisieren, Vignette
- **Undo/Redo** (Strg+Z / Strg+Y) und Tastenkürzel für alle Werkzeuge
- **Formate:** Import PNG, JPEG, GIF, WebP, BMP, SVG – Export PNG, JPEG, WebP (mit Qualitätsregler)
- **Leichtgewichtig:** keine Frameworks, kein Build-Schritt, keine Abhängigkeiten

## 🔒 Datenschutz und IT-Sicherheit

- Die Verarbeitung findet **lokal im Browser** statt. Es gibt keinen Upload auf einen Server.
- Keine Accounts, kein Tracking, keine Cookies.
- Keine externen CDNs oder Fonts, daher auch im **Intranet und Offline-Betrieb** nutzbar.
- Einfach zu prüfen: kleiner, lesbarer Quellcode ohne Black Box.

## 🚀 Installation

### Variante 1: Direkt im Browser (ohne Installation)

```bash
git clone https://github.com/7qbit/PixQX.git
cd PixQX
```

Danach `index.html` im Browser öffnen (Doppelklick genügt).

### Variante 2: Docker

Voraussetzung: Docker ist installiert.

```bash
git clone https://github.com/7qbit/PixQX.git
cd PixQX
docker build -t pixqx .
docker run -d --name pixqx --restart unless-stopped -p 8080:80 pixqx
```

Danach im Browser `http://localhost:8080` öffnen.

Stoppen und entfernen:

```bash
docker stop pixqx && docker rm pixqx
```

### Variante 3: Docker Compose

Lege eine `docker-compose.yml` neben das Projekt:

```yaml
services:
  pixqx:
    build: .
    container_name: pixqx
    restart: unless-stopped
    ports:
      - "8080:80"
```

```bash
docker compose up -d --build
```

### Variante 4: Eigener Webserver (nginx, Apache, …)

Es sind reine statische Dateien. Kopiere `index.html`, `pixqx-logo.svg`, `css/` und `js/` in das Webroot, z. B. `/usr/share/nginx/html/`. Es ist kein Backend nötig.

### Aktualisieren

```bash
git pull
docker build -t pixqx . && docker rm -f pixqx
docker run -d --name pixqx --restart unless-stopped -p 8080:80 pixqx
```

## ⌨️ Tastenkürzel

| Taste | Werkzeug | Taste | Werkzeug |
|---|---|---|---|
| V | Verschieben | R | Rechteck |
| S | Auswahl | O | Ellipse |
| K | Lasso | L | Linie |
| W | Zauberstab | T | Text |
| C | Zuschneiden | I | Pipette |
| P | Bleistift | Z | Zoom |
| B | Pinsel | H | Hand |
| E | Radierer | G | Füllen |

Außerdem: `Strg+Z` rückgängig, `Strg+Y` wiederholen, `Strg+C` / `Strg+V` Auswahl kopieren/einfügen, `Entf` Auswahl löschen.

## 🧱 Technik

| Bereich | Umsetzung |
|---|---|
| Frontend | HTML, JavaScript (klassische Skripte, keine Module), CSS |
| Rendering | HTML5 Canvas im Browser |
| Deployment | statische Dateien, optional Docker (nginx:alpine) |
| Backend | keines |

```
.
├── index.html
├── pixqx-logo.svg
├── css/pixqx.css
├── js/
│   ├── pixqx-filters.js   # Pixel-Filter
│   ├── pixqx-state.js     # Dokument, Ebenen, History, Tabs
│   ├── pixqx-tools.js     # Werkzeuge
│   └── pixqx-ui.js        # Oberfläche, Datei-I/O, Tastenkürzel
└── Dockerfile
```

## 🛣️ Roadmap

- [ ] Ebenenmasken
- [ ] Optionale KI-Anbindung mit eigenem API-Key (standardmäßig aus)
- [ ] Weitere Filter und Retusche-Werkzeuge
- [ ] Mehrsprachige Oberfläche

## 🤝 Mitmachen

Issues und Pull Requests sind willkommen. Bitte halte den Code schlank und ohne unnötige Abhängigkeiten.

## 📄 Lizenz

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).
