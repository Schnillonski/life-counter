# Life Counter

Offline-Lebenspunktezähler für Android 14+ für Magic (Commander, Standard/Modern, Brawl, Oathbreaker), Pokémon TCG, Yu-Gi-Oh!, Lorcana, Flesh and Blood, Star Wars Unlimited und eigene Spiele.
Die Bedienung ist auf Deutsch, die Spielbegriffe sind auf Englisch (Poison, Commander Damage, Prize Cards …).

## Funktionen

- **1–6 Spieler**, Felder drehen sich zu den Sitzplätzen (abschaltbar)
- **Tippen** links/rechts = −/+, **Halten** = große Schritte (±10, YGO ±1000) oder schnelles Zählen
- **Magic:** Commander Damage pro Gegner (auch Partner), Poison, Commander Tax, Energy, Experience, Storm, Rad, Speed, Monarch, Initiative, City's Blessing, Day/Night
- **Pokémon:** Prize Cards, Damage am Active, Special Conditions (Asleep/Confused/Paralyzed schließen sich aus), VSTAR/GX
- **Yu-Gi-Oh!:** 8000 LP, Rechner (Abziehen, Addieren, Setzen, Halbieren)
- **Lorcana:** zählt Lore bis 20
- Automatisches Ausscheiden (0 Life, 10 Poison, 21 Commander Damage), korrigierbar
- Zugverfolgung mit Timer, Zugzeiten, Checkliste (Land drop, Energy, Supporter …)
- Würfel (Münze, W4–W100, Planechase), Startspieler per Zufall oder Finger-Wahl
- Ereignisse, Merker mit Erinnerung bei Zugbeginn, Protokoll mit Grafik und Statistik
- **Doku:** Spielmodi und Keywords (Magic, Pokémon, Yu-Gi-Oh!, Lorcana, FaB, SWU) mit Suche
- Rückgängig, Spielhistorie, automatisches Speichern
- **Update-Check** beim Start gegen die GitHub-Releases dieses Repos

## Aufbau

```text
app/src/main/java/.../MainActivity.java   Vollbild-WebView, Bridge (Vibration, Teilen, Update-Check)
app/src/main/assets/www/                  die App: index.html, style.css, app.js, docs.js
.github/workflows/build.yml               CI: baut die APK, bei Tags auch ein Release
```

Keine externen Bibliotheken. Netzwerk wird nur für den Update-Check genutzt (`api.github.com`).
Die Web-App lässt sich im Desktop-Browser testen, indem man `app/src/main/assets/www/index.html` öffnet.

---

## Einrichtung auf GitHub (einmalig)

Das Repo muss **öffentlich** sein, sonst kann die App die Releases ohne Login nicht abfragen.

### 1. Repo anlegen und hochladen

Das Repo liegt unter `github.com/Schnillonski/life-counter`. Für lokale Builds steht es in `gradle.properties` (`updateRepo`), die CI setzt es automatisch.

### 2. Release-Schlüssel erzeugen (wichtig für Updates)

Android installiert ein Update nur, wenn es mit **demselben Schlüssel** signiert ist wie die installierte App.
Ohne festen Schlüssel erzeugt jeder CI-Lauf einen neuen Debug-Key, und Updates schlagen mit „App nicht installiert“ fehl.

Ohne Java geht das mit dem `openssl` aus Git für Windows (bzw. jedem Linux):

```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
  -keyout key.pem -out cert.pem -subj "/CN=Life Counter"
openssl pkcs12 -export -inkey key.pem -in cert.pem -name lifecounter -out lifecounter.p12 \
  -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
rm key.pem cert.pem
base64 -w0 lifecounter.p12 > LC_KEYSTORE_BASE64.txt
```

`lifecounter.p12` und das Passwort sicher aufbewahren und nicht ins Repo legen. Danach unter
*Settings › Secrets and variables › Actions* vier Secrets anlegen:

| Secret | Wert |
|---|---|
| `LC_KEYSTORE_BASE64` | Inhalt von `LC_KEYSTORE_BASE64.txt` |
| `LC_KEYSTORE_PASSWORD` | Passwort |
| `LC_KEY_ALIAS` | `lifecounter` |
| `LC_KEY_PASSWORD` | dasselbe Passwort (bei PKCS12 identisch) |

### 3. Version veröffentlichen

```bash
git tag v1.1.0
git push origin v1.1.0
```

Die CI baut die signierte APK `LifeCounter-1.1.0.apk` und legt ein GitHub-Release an.
Die erste Version installierst du von dort. Ab dann meldet die App beim Start neue Releases, und „Herunterladen“ lädt die APK im Browser.
Die Version kommt immer aus dem Tag (`v1.2.0` → versionName 1.2.0, versionCode 10200), sie muss also nur steigen.

Ein Push auf `main` ohne Tag baut nur ein Test-Artefakt (unter *Actions*) und erzeugt kein Release.

---

## Lokal bauen

Voraussetzungen: JDK 17+ (empfohlen 21), Android SDK Platform 35, Gradle 9.x.

```bash
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

Damit lokale Builds dieselbe Signatur haben wie die Releases, trage den Schlüssel in `~/.gradle/gradle.properties` ein
(`LC_KEYSTORE`, `LC_KEYSTORE_PASSWORD`, `LC_KEY_ALIAS`, `LC_KEY_PASSWORD`, siehe Vorlage in `gradle.properties`).

### Linux arm64 / Asahi Linux

Das Android SDK gibt es für Linux offiziell nur für x86_64. Gradle, AGP, d8, apksigner und sdkmanager laufen als Java auch auf arm64, **aapt2 aber nicht**.

1. JDK: `sudo dnf install java-21-openjdk-devel`
2. SDK:
   ```bash
   mkdir -p ~/Android/Sdk/cmdline-tools && cd ~/Android/Sdk/cmdline-tools
   # commandlinetools-linux-*_latest.zip von developer.android.com/studio laden, entpacken, Ordner in "latest" umbenennen
   ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-35" "build-tools;35.0.0"
   echo "sdk.dir=$HOME/Android/Sdk" > local.properties
   ```
3. Native arm64-aapt2 besorgen (z. B. <https://github.com/lzhiyong/android-sdk-tools/releases>) und in `gradle.properties` eintragen:
   `android.aapt2FromMavenOverride=/pfad/zu/aapt2`
4. `./gradlew assembleRelease`

Einfacher ist es, gar nicht lokal zu bauen: Tag pushen und die APK aus dem GitHub-Release nehmen.
