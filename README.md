# Meditation Timer — Apple PWA

Samodzielna, instalowalna wersja PWA przygotowana przede wszystkim do testów na iPhonie. Nie wymaga Xcode, Maca ani konta Apple Developer. Źródłem zachowania jest `Research/Meditation Timer - Ideas.md`, a źródłem układu mobilnego — aktualne ramki Green, Light, Dark i Active session w Figmie.

**Wersja buildu:** v6

**Wersja online:** https://danielhalat.github.io/meditation-timer-apple-pwa/

## Co zawiera

- instalację na ekranie początkowym iPhone’a w trybie `standalone`;
- cztery motywy: Green, Light, Dark i Modern; Modern zachowuje bazową geometrię aplikacji i przenosi wyłącznie paletę ZEN.COM inspired z aktualnej Figmy;
- globalny przycisk ustawień z ikoną trzech poziomych kresek oraz otwierany od góry panel `CHOOSE COLOR` z trzema kolumnami; etykieta korzysta z tej samej typografii co `YOUR PRESETS`, a panel jest wspólnym wzorcem dla PWA i Androida i w przyszłości może otrzymać kolejne sekcje, np. język lub wsparcie aplikacji;
- płaski canvas bez warstw `Ambient line`, `Ambient glow` i `Ambient haze` we wszystkich motywach i stanach; zasada nie usuwa funkcjonalnej poświaty, pierścieni i łuku postępu samego timera;
- timer countdown/count up, pauzę, wznowienie, potwierdzone zakończenie i wskaźnik postępu;
- cztery startowe presety oraz lokalne dodawanie, edycję, usuwanie i zmianę kolejności;
- pełnoekranowy mobilny edytor presetu zgodny z ramkami `Preset Flow` w Figmie: kierunek timera, dwa pola gongów, sekwencję interwałów ze stepperami i stałą akcję `Save`;
- sekwencje interwałów oraz osobne gongi Start & end i Interval;
- lokalny zapis w przeglądarce, działanie offline po pierwszym poprawnym uruchomieniu i blokadę układu do pionowej kompozycji;
- Screen Wake Lock, gdy przeglądarka i ustawienia telefonu na to pozwalają.

## Lista presetów na ekranie głównym

Na telefonie stały nagłówek `YOUR PRESETS / EDIT-DONE / +` wyznacza wyłącznie górną granicę przewijalnej listy. Viewport listy ma sięgać do fizycznej dolnej krawędzi ekranu aplikacji: presety znikają u góry pod nagłówkiem, a u dołu dopiero po przekroczeniu krawędzi ekranu. Nie wolno kończyć kontenera listy nad `safe-area-inset-bottom` ani dodawać stałej dolnej belki, maski lub stopki. Dolny safe area może występować tylko jako padding na końcu przewijanej zawartości, dzięki któremu ostatni wiersz można wysunąć ponad wskaźnik Home. Główna powierzchnia PWA korzysta z `100lvh` z fallbackiem `100vh`, ponieważ `100svh` może w zainstalowanej PWA na iOS kończyć się przed dolnym obszarem systemowym. W zainstalowanej PWA na iOS dodatkowy, zmierzony odstęp pomiędzy fizyczną wysokością ekranu a viewportem WebKit jest używany wyłącznie jako awaryjny końcowy padding listy; nie tworzy belki ani nie podnosi jej granicy przycinania. W stanie początkowym na obsługiwanych wysokościach iPhone'a muszą być widoczne co najmniej cztery pełne presety; regresję chronią testy układu, a kontrolę wykonano również dla viewportów 390 × 844 i 390 × 667.

## Budowanie i testy

Projekt nie ma zewnętrznych zależności. Wymaga tylko Node.js.

```powershell
npm test
npm run build
npm start
```

`npm run build` tworzy gotową paczkę w `Builds/Apple PWA`. `npm start` udostępnia ją lokalnie pod `http://localhost:4173` do testu na tym samym komputerze.

## Instalacja na iPhonie

PWA musi być umieszczona pod publicznym adresem HTTPS. Można opublikować zawartość `Builds/Apple PWA` jako statyczną stronę, np. przez GitHub Pages, Cloudflare Pages albo Netlify. Następnie:

1. Otwórz publiczny adres **w Safari na iPhonie**.
2. W kompaktowym układzie Safari wybierz **… → Udostępnij**. W klasycznym układzie użyj przycisku udostępniania.
3. Wybierz **Dodaj do ekranu początkowego**; jeśli czynność jest ukryta, dodaj ją przez **Edytuj czynności** na dole listy.
4. Potwierdź nazwę i wybierz **Dodaj**.
5. Uruchamiaj timer z nowej ikony na ekranie początkowym, a nie z karty Safari.
6. Przy pierwszym uruchomieniu dźwięku zezwól na odtwarzanie i sprawdź głośność multimediów oraz tryb cichy.

## Aktualizacja zainstalowanej PWA

Po opublikowaniu nowej wersji iOS pobiera aktualizację automatycznie przy kolejnym uruchomieniu aplikacji z dostępem do internetu. Service worker wymusza sprawdzenie własnej aktualizacji, nawigacja preferuje sieć, a pliki wersji v6 mają jawny identyfikator cache. Pierwsze otwarcie po publikacji może jeszcze pokazać poprzednią wersję, gdy w tle aktualizuje się cache. W takim przypadku zamknij PWA z przełącznika aplikacji i uruchom ją ponownie. Pierwszy etap panelu ustawień pokazuje wyłącznie `CHOOSE COLOR` i nazwy profili, dlatego numer aktywnej paczki należy potwierdzić w metadanych paczki oraz podsumowaniu buildu; każda publikacja nadal wymaga odrębnej wersji cache. Nie trzeba usuwać ikony ani dodawać aplikacji ponownie, a lokalne presety pozostają zachowane.

## Ważne ograniczenie iOS

To PWA jest użyteczną wersją testową, ale nie zastępuje w pełni natywnej aplikacji. iOS może uśpić kod i zablokować dźwięk po wygaszeniu ekranu albo przeniesieniu PWA do tła. Aplikacja oblicza czas z zegara systemowego po powrocie i próbuje utrzymać ekran aktywny, jednak gong graniczny lub końcowy nie ma gwarancji odtworzenia w tle. Niezawodne alarmy, audio i powiadomienia przy zablokowanym ekranie wymagają docelowo natywnej wersji iOS.

iOS 27 beta ma dodatkowo potwierdzony błąd WebKit dotyczący PWA dodanych do ekranu początkowego: system może zakończyć warstwę webową przy początku dolnego zaokrąglenia ekranu i narysować pozostały pas poza zasięgiem HTML, CSS i JavaScript. W MVP problem jest zaakceptowany jako ograniczenie platformy. Nie planujemy kolejnych prób usuwania tego pasa przed poprawką Apple/WebKit; aplikacja ma jedynie umożliwić przewinięcie ostatniego presetu ponad dostępną granicę.
