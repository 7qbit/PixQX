# PixQX
Leichter Bildeditor für Browser &amp; Docker, ohne Login


# 🖼️ Bildeditor – leicht, lokal, ohne Login

Ein schlanker Bildeditor in purem **HTML, JavaScript und CSS**. Er läuft direkt im Browser, braucht weder Anmeldung noch Backend und lässt sich optional als **Docker-Container** betreiben. Alle Bilder werden ausschließlich im Browser des Nutzers verarbeitet.

## ✨ Features

- **Ohne Anmeldung:** Seite öffnen und loslegen
- **Ebenen (Layer) und Masken:** nicht-destruktives Arbeiten
- **Bild-in-Bild:** weitere Bilder als Ebenen einfügen, platzieren und skalieren
- **Zuschnitt und Schnitt:** Bildbereiche freistellen, beschneiden, ausrichten
- **Retusche und Verbesserung:** Korrekturen, Anpassungen und Feinarbeit
- **Viele Formate:** Import und Export gängiger Bildformate (z. B. JPG, PNG, WebP)
- **Optionale KI-Anbindung:** eigenen API-Key hinterlegen und KI-Funktionen nutzen
- **Leichtgewichtig:** keine Frameworks, keine Build-Pipeline, wenige Abhängigkeiten

## 🔒 Datenschutz und IT-Sicherheit

- Die Verarbeitung findet **lokal im Browser** statt. Es gibt keinen Upload auf einen Server des Projekts.
- Keine Accounts, kein Tracking, keine Cookies zur Nutzerverfolgung.
- Keine externen CDNs oder Fonts nötig, daher auch im **Intranet und Offline-Betrieb** nutzbar.
- Einfach zu prüfen: kleiner, lesbarer Quellcode ohne Black Box.
- **Hinweis zur KI-Funktion:** Sie ist optional und standardmäßig aus. Wenn du einen API-Key einträgst, werden die betroffenen Bilddaten an den jeweiligen KI-Anbieter gesendet. Der Key bleibt in deinem Browser. Prüfe vor dem Einsatz im Unternehmen die Datenschutzbedingungen des Anbieters.

## 🚀 Schnellstart

### Direkt im Browser

```bash
git clone [https://github.com/](https://github.com/)<user>/<repo>.git
cd <repo>
# index.html im Browser öffnen
```

### Mit Docker

```bash
docker build -t bildeditor .
docker run -d --name bildeditor -p 8080:80 bildeditor
```

Danach im Browser `http://localhost:8080` öffnen.

## 🤖 KI-Anbindung (optional)

1. Einstellungen im Editor öffnen.
2. API-Endpunkt und eigenen API-Key eintragen.
3. KI-Funktionen aktivieren.

Der Key wird nur lokal im Browser gespeichert und nicht an Dritte außer den konfigurierten Anbieter übertragen.

## 🧱 Technik

| Bereich | Umsetzung |
|---|---|
| Frontend | HTML, JavaScript, CSS |
| Rendering | Canvas im Browser |
| Deployment | statische Dateien, optional Docker (z. B. nginx) |
| Backend | keines |

## 🛣️ Roadmap

- [ ] Weitere Filter und Retusche-Werkzeuge
- [ ] Tastenkürzel und Undo/Redo-Verbesserungen
- [ ] Zusätzliche KI-Anbieter
- [ ] Mehrsprachige Oberfläche

## 🤝 Mitmachen

Issues und Pull Requests sind willkommen. Bitte halte den Code schlank und ohne unnötige Abhängigkeiten.

## 📄 Lizenz

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).
