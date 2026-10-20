# Plan: PvP online (1 na 1)

## Pomysł

- Menu: "Co-op online" → **"Multiplayer"**. Lobby (`CoopScene` → `MultiScene`) ma trzy wejścia:
  **Host co-op**, **Host PvP**, **Join room**. Gość wpisuje tylko kod; tryb pokoju przychodzi od hosta
  (`roster` dostaje pole `mode: 'coop' | 'pvp'`), więc join jest wspólny.
- PvP to osobny tryb (`sandbox.mode = 'pvp'`), nie wariant bitwy: każdy gracz ma swój keep i swojego łucznika, nie ma
  fal ani `WaveDirector`. Wrogiem jest drugi gracz i jego wojsko.
- Posiłki: obaj wzywają swoich żołnierzy (dzisiejsze `BattleAllies`: Z/X/C, rozkaz V: hold / advance / retreat).
- Opcje hosta (strona Rules w setupie): życie łucznika, życie keepu, wsparcie (wł./wył.), banery (wł./wył.; bez
  wsparcia wyszarzone i wyłączone, bo nie ma kto ich nosić).
- Mapy jak w trybie bitwy (`battlegroundsFor('battle')`), jeden poziom = jedna runda; run to np. "do 2 wygranych"
  (opcjonalnie, na start wystarczy jedna runda).
- Każdy widzi swój keep po lewej: gość ma lustrzane odbicie świata hosta.

## Czy to ma sens — tak, z kilkoma uwagami

1. **Lustro tylko w widoku, nie w symulacji.** Host liczy wszystko w swoich współrzędnych (keep hosta na
   `PLAYER_TOWER_X`, keep gościa na `ENEMY_TOWER_X`). Gość odwraca: `world.scale.x = -1` + przesunięcie o
   `WORLD_WIDTH`, a jego wejście (kierunek, kąt celowania) jest odbijane przed wysłaniem/po odebraniu
   (`x' = WORLD_WIDTH - x`, `vx' = -vx`, kierunek `-d`). Wiatr też się odwraca. Tekst w świecie (liczby obrażeń,
   napisy) trzeba wtedy odwrócić z powrotem, a HUD jest w DOM, więc go to nie dotyczy.
   Alternatywa (gość symuluje w odbitych współrzędnych) jest gorsza: każdy event i snapshot trzeba by przeliczać.
2. **Teren musi być symetryczny albo lustro pokaże inną mapę.** `groundAt(x)` i sceneria nie są dziś symetryczne
   względem środka. Albo gość widzi po prostu odbitą mapę hosta (to wystarczy — obaj grają na tym samym polu, tylko
   z drugiej strony), albo dodajemy mapom tryb symetryczny. Rekomendacja: zwykłe odbicie, bez zmian w mapach.
3. **Fair play przy host-authoritative.** Host ma zerowe opóźnienie, gość ~100 ms (interpolacja + round trip
   strzału). W co-opie to nie przeszkadza, w PvP tak. Na start akceptujemy (gra jest wolna: łuk, piechota), ale
   warto: lokalny podgląd strzału gościa (jest na liście "Not yet" w `net/CLAUDE.md`) i ewentualnie mniejsze
   opóźnienie interpolacji dla PvP.
4. **Wojsko ma dziś jedną stronę.** Żołnierze to `Enemy` z `side: 'ally'`, wrogowie to reszta; łucznik wroga to
   nowość (dziś bowmen są zawsze "nasi"). Potrzebne jest pojęcie **drużyny** (`team: 0 | 1`) zamiast `ally / enemy`.
   To największa i najbardziej ryzykowna zmiana — dotyka targetingu, AI, trafień strzał, banerów.
5. **Wsparcie w sieci jeszcze nie działa** (`BattleAllies` jest wyłączone przy `ctx.session.net`). PvP z posiłkami
   wymaga najpierw synchronizacji żołnierzy — to się przyda też co-opowi, więc warto zrobić to jako osobny krok.
6. Banery już są (solo): przejęcie banera = wygrana, utrata = porażka. W PvP to zwyczajnie symetryczne.

## Etapy (każdy osobna sesja / commit)

1. **Menu Multiplayer** — zmiana nazwy, trzy przyciski, `mode` w `roster` i `NetLink`, lobby pokazuje tryb. Join bez
   zmian. (`ui/CoopPanel.ts`, `scenes/CoopScene.ts`, `net/coopLink.ts`, `net/protocol.ts`, `index.html`)
2. **Wsparcie w co-opie** — sync żołnierzy (spawn/rozkaz jako input gościa, stan w snapshotcie, istniejące eventy
   trafień). Wartość sama w sobie, warunek dla PvP z posiłkami.
3. **Drużyny** — `team` na Enemy/Bowman/Arrow/Tower, `targeting.ts` i `AllyAI` / `EnemyAI` szukają wrogów "innej
   drużyny", `ArrowHits` trafia w przeciwną drużynę (łucznik w łucznika, keep w keep). Solo i co-op dalej działają
   jak dziś (wszyscy gracze = team 0, fale = team 1). Testy czystej logiki.
4. **Tryb PvP na hoście** (lokalnie, `?pvp` jak `?coop`: drugi łucznik z konsoli) — `SandboxSettings.mode = 'pvp'`,
   setup: mapa + opcje (`bowmanHealth`, `keepHealth`, `support`, `banners`; domyślne w `data/sandbox.ts`), drugi keep
   jako keep gracza (z wieżą i kryjówką), brak fal, `BattleOutcome`: przegrywa ten, czyj keep padnie / łucznik zginie
   / baner zostanie przejęty.
5. **Lustro gościa** — odbicie świata i wejścia, kamera, podgląd toru lotu, napisy w świecie. Sprawdzone w
   `?net=local` w dwóch kartach.
6. **Szlif** — ekran końca (Wygrana / Przegrana zamiast Victory/Defeat dla obu), rewanż w lobby, ewentualnie
   "do 2 wygranych", balans żołnierzy w PvP w `config/battle.ts` + panel `?tune`.

## Otwarte pytania

- Ile graczy w PvP: tylko 1 na 1, czy kiedyś 2 na 2 (wtedy drużyny od razu jako liczba, nie bool)?
- Czy w PvP są neutralne fale (np. potwory atakujące obu)? Na start: nie.
- Czy łucznik może zejść z wieży i iść w pole jak dziś? (Zakładam że tak — wtedy jest celem dla wrogich żołnierzy.)
- Kołczan: każdy swój, czy host ustala dozwolone strzały?
- Limity wojska: wspólne `ALLIES` czy osobne ustawienie hosta (np. "ilość złota" / punkty wsparcia)?
