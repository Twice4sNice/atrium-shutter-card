# Atrium Rollladen

Rollladen mit Fensteransicht über die volle Kartenbreite, Hoch/Stopp/Runter und Positionsregler. Passt sich auch sehr schmalen Spalten an. Ersetzt shutter-card.

Teil der Atrium-Kartenfamilie. Die [Atrium-Integration](https://github.com/Twice4sNice/Atrium) bringt diese Karte bereits mit; dieses Repo ist für alle, die nur die Karte in einem normalen Dashboard nutzen wollen.

## Installation

**HACS:** HACS → Benutzerdefinierte Repositories → `https://github.com/Twice4sNice/atrium-shutter-card` mit Typ *Dashboard* hinzufügen, dann „Atrium Rollladen“ installieren.

**Manuell:** `atrium-shutter-card.js` nach `/config/www/` kopieren und unter Einstellungen → Dashboards → Ressourcen als `/local/atrium-shutter-card.js` (JavaScript-Modul) eintragen.

Ist die Atrium-Integration installiert, ist keine zusätzliche Ressource nötig.

## Konfiguration

```yaml
type: custom:atrium-shutter
entities:
  - cover.rolladen_schlafzimmer_links
  - cover.rolladen_schlafzimmer_rechts
name: Schlafzimmer   # optional, nur bei einer Entität
```

Die Karte erscheint auch in der Kartenauswahl des Dashboard-Editors.

## Ersetzt

`shutter-card`: Atrium übersetzt bestehende Konfigurationen dieser Karte automatisch.

## Lizenz

MIT
